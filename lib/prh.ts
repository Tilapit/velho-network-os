// PRH open data (Finnish Patent and Registration Office), read from the docs
// at https://avoindata.prh.fi (OpenAPI: /opendata-ytj-api/v3/schema). One
// endpoint is used here: GET /opendata-ytj-api/v3/companies?name=<name>, and
// ?businessId=<id> when the founder picks a company by hand. Every response is
// stored in data/cache/prh, so a re-run never hits PRH again. At most three
// requests are in flight, with a pause between starts and back-off on 429.
// Registered notices (the signal radar) are in lib/signals.ts.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fold } from "./normalize.ts";

const YTJ = "https://avoindata.prh.fi/opendata-ytj-api/v3";
const GAP_MS = Number(process.env.PRH_GAP_MS || 250);

export function cacheDir(): string {
  return path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "cache", "prh");
}

export const ytjUrl = (businessId: string) => `https://tietopalvelu.ytj.fi/yritys/${businessId}`;

export type PrhCompany = {
  businessId: string;
  name: string;
  /** Current parallel and auxiliary names, and previous names. */
  otherNames: { name: string; kind: "parallel" | "auxiliary" | "previous" }[];
  formCode?: string;
  form?: string;
  /** TOL main line of business code, e.g. "28300". */
  tol?: string;
  industry?: string;
  industryFi?: string;
  registrationDate?: string;
  town?: string;
  website?: string;
  active: boolean;
  /** Restructuring, liquidation or bankruptcy codes (SANE, SELTILA, KONK). */
  situations: string[];
};

export type PrhSearch = { query: string; fetchedAt: string; totalResults: number; companies: PrhCompany[] };

// ---------- HTTP with a polite queue and a disk cache ----------

// A few requests in flight, starts spaced GAP_MS apart. PRH answers in about a
// second, so one at a time would make a cold 1,500-row import take 15 minutes.
const CONCURRENCY = Number(process.env.PRH_CONCURRENCY || 3);
let active = 0;
let nextStart = 0;
const waiting: (() => void)[] = [];
export const stats = { requests: 0, retries: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire() {
  if (active < CONCURRENCY) active++;
  else await new Promise<void>((r) => waiting.push(r));
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + GAP_MS;
  if (at > now) await sleep(at - now);
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

export async function politeGet(url: string): Promise<unknown> {
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      stats.requests++;
      const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "velho-network-os (prototype; contact via repo owner)" } });
      if (res.status === 429 || res.status === 503) {
        if (attempt >= 4) throw new Error(`PRH ${res.status} after retries`);
        stats.retries++;
        const after = (Number(res.headers.get("retry-after")) || 2 ** attempt * 3) * 1000;
        nextStart = Math.max(nextStart, Date.now() + after);
        await sleep(after);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`PRH ${res.status} for ${url}`);
      return await res.json();
    }
  } finally {
    release();
  }
}

export function readCache<T>(sub: string, key: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(cacheDir(), sub, `${key}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache(sub: string, key: string, value: unknown) {
  const dir = path.join(cacheDir(), sub);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value));
}

export const hash = (s: string) => crypto.createHash("sha1").update(s.toLowerCase()).digest("hex").slice(0, 16);

// ---------- YTJ company search ----------

type Desc = { languageCode: string; description?: string };
const en = (d?: Desc[]) => d?.find((x) => x.languageCode === "3")?.description ?? d?.find((x) => x.languageCode === "1")?.description;
const fi = (d?: Desc[]) => d?.find((x) => x.languageCode === "1")?.description;

/** Keeps only what the app uses, so the cache stays small. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compact(c: any): PrhCompany {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names: any[] = c.names ?? [];
  const current = names.filter((n) => n.version === 1 && !n.endDate);
  const official = current.find((n) => n.type === "1") ?? names.find((n) => n.type === "1") ?? names[0];
  const otherNames: PrhCompany["otherNames"] = [];
  for (const n of names) {
    if (n === official) continue;
    const kind = n.version !== 1 || n.endDate ? "previous" : n.type === "2" ? "parallel" : "auxiliary";
    otherNames.push({ name: n.name, kind });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = (c.companyForms ?? []).find((f: any) => f.version === 1 && !f.endDate) ?? c.companyForms?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addr = (c.addresses ?? []).find((a: any) => a.type === 1) ?? c.addresses?.[0];
  return {
    businessId: c.businessId?.value,
    name: official?.name ?? "",
    otherNames,
    formCode: form?.type,
    form: en(form?.descriptions),
    tol: c.mainBusinessLine?.type,
    industry: en(c.mainBusinessLine?.descriptions),
    industryFi: fi(c.mainBusinessLine?.descriptions),
    registrationDate: c.registrationDate ?? undefined,
    town: addr?.postOffices?.find((p: { languageCode: string }) => p.languageCode === "1")?.city ?? addr?.postOffices?.[0]?.city,
    website: c.website?.url,
    // Registered and not ended. A pending registration has no registration date yet.
    active: !c.endDate && !!c.registrationDate && c.status !== "1" && c.status !== "5" && c.tradeRegisterStatus !== "2" && c.tradeRegisterStatus !== "4",
    situations: (c.companySituations ?? []).filter((s: { endDate?: string }) => !s.endDate).map((s: { type: string }) => s.type),
  };
}

/** One YTJ name search (first page, up to 100 results), cached. */
export async function searchYtj(query: string, opts: { offline?: boolean } = {}): Promise<PrhSearch | null> {
  const key = hash(query);
  const cached = readCache<PrhSearch>("ytj", key);
  if (cached) return cached;
  if (opts.offline) return null;
  const raw = (await politeGet(`${YTJ}/companies?name=${encodeURIComponent(query)}`)) as { totalResults: number; companies: unknown[] } | null;
  const result: PrhSearch = { query, fetchedAt: new Date().toISOString(), totalResults: raw?.totalResults ?? 0, companies: (raw?.companies ?? []).map(compact) };
  writeCache("ytj", key, result);
  return result;
}

// ---------- Matching a LinkedIn company name to a PRH company ----------

export type MatchStatus = "verified" | "inferred" | "ambiguous" | "none" | "skipped" | "pending";

export type PrhMatch = {
  name: string;
  key: string;
  status: MatchStatus;
  company?: PrhCompany;
  candidates: PrhCompany[];
  note: string;
  queries: string[];
};

const NOT_A_COMPANY = /^(self[- ]?employed|freelancer?|freelance|stealth( mode| startup)?|open to work|retired|student|opiskelija|between jobs|confidential|various|n\/?a|none|-|private|independent( consultant)?|itsenäinen ammatinharjoittaja|yrittäjä)$/i;
const LEGAL = /(^|\s)(oyj|oy|ab|abp|ltd\.?|limited|plc|inc\.?|corp\.?|corporation|ky|ay|tmi|osakeyhtiö|aktiebolag)(?=\s|$|,)/gi;
// Company forms that are never an employer worth matching (housing companies, property companies).
const IGNORED_FORMS = new Set(["2", "10"]);

/** "Oy Sisu Auto Ab" -> "Sisu Auto": the search text PRH gets. */
export function searchText(name: string): string {
  return name
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(LEGAL, " ")
    .replace(/[,|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FORMS = new Set(["oy", "oyj", "ab", "abp", "ky", "ay", "tmi", "ltd", "limited", "plc", "inc", "corp", "corporation", "osakeyhtio", "aktiebolag", "llc", "gmbh"]);

/** "Oy Sisu Auto Ab" -> "sisu auto". Legal forms are dropped only at either end. */
export function strictKey(name: string): string {
  const w = fold(name).replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (w.length > 1 && FORMS.has(w[0])) w.shift();
  while (w.length > 1 && FORMS.has(w[w.length - 1])) w.pop();
  return w.join(" ");
}

/** strictKey without a trailing "Group": "Sarlin Group Oy Ab" -> "sarlin". */
export function looseKey(name: string): string {
  const w = strictKey(name).split(" ");
  while (w.length > 1 && (w[w.length - 1] === "group" || FORMS.has(w[w.length - 1]))) w.pop();
  return w.join(" ");
}

function namesOf(c: PrhCompany) {
  const official = [c.name, ...c.otherNames.filter((n) => n.kind === "parallel").map((n) => n.name)];
  const other = c.otherNames.filter((n) => n.kind !== "parallel").map((n) => n.name);
  return { official, other };
}

const contains = (a: string, b: string) => b.length >= 4 && ` ${a} `.includes(` ${b} `);

/**
 * Pure matching rule, separated so tests can run it on recorded responses.
 * Exact normalised name = verified (strict first, so "Hydroline" does not
 * collide with its holding company "Hydroline Group"). One close candidate =
 * inferred. Several, or none = unmatched. Never guesses.
 */
export function decide(name: string, results: PrhSearch[]): Omit<PrhMatch, "queries"> {
  const strict = strictKey(name);
  const loose = looseKey(name);
  const key = loose;
  const seen = new Map<string, PrhCompany>();
  for (const r of results) for (const c of r.companies) if (c.businessId && c.active && c.registrationDate && !IGNORED_FORMS.has(c.formCode ?? "")) seen.set(c.businessId, c);
  const all = [...seen.values()];
  for (const [tier, k, fn] of [["strict", strict, strictKey], ["loose", loose, looseKey]] as const) {
    const exact = all.filter((c) => namesOf(c).official.some((n) => fn(n) === k));
    if (exact.length === 1) return { name, key, status: "verified", company: exact[0], candidates: exact, note: tier === "strict" ? "Exact name match in the trade register" : "Exact name match, apart from \"Group\"" };
    if (exact.length > 1) return { name, key, status: "ambiguous", candidates: exact, note: `${exact.length} registered companies have this name` };
  }
  const fuzzy = all.filter((c) => {
    const n = namesOf(c);
    return n.other.some((o) => looseKey(o) === loose) || n.official.map(looseKey).some((o) => contains(o, loose) || contains(loose, o));
  });
  if (fuzzy.length === 1) {
    const c = fuzzy[0];
    const why = namesOf(c).other.some((o) => looseKey(o) === loose) ? "matches an auxiliary or previous name" : "name is close, not identical";
    return { name, key, status: "inferred", company: c, candidates: fuzzy, note: `One candidate: ${why}. Check it.` };
  }
  if (fuzzy.length > 1) return { name, key, status: "ambiguous", candidates: fuzzy.slice(0, 12), note: `${fuzzy.length} possible companies. Pick the right one.` };
  const total = results.reduce((n, r) => Math.max(n, r.totalResults), 0);
  return { name, key, status: "none", candidates: [], note: total > 100 ? "Name too common to match without a business ID" : "No registered Finnish company with this name" };
}

/** One company by business ID (for a match the founder picks by hand), cached. */
export async function getCompany(businessId: string, opts: { offline?: boolean } = {}): Promise<PrhCompany | null> {
  const id = businessId.trim();
  if (!/^\d{7}-\d$/.test(id)) return null;
  const cached = readCache<PrhSearch>("ytj", hash(`businessId:${id}`));
  if (cached) return cached.companies[0] ?? null;
  if (opts.offline) return null;
  const raw = (await politeGet(`${YTJ}/companies?businessId=${encodeURIComponent(id)}`)) as { totalResults: number; companies: unknown[] } | null;
  const result: PrhSearch = { query: `businessId:${id}`, fetchedAt: new Date().toISOString(), totalResults: raw?.totalResults ?? 0, companies: (raw?.companies ?? []).map(compact) };
  writeCache("ytj", hash(`businessId:${id}`), result);
  return result.companies[0] ?? null;
}

const GENERIC = /\s+(solutions|technologies|technology|finland|suomi|group|services|systems|company|industries|international|holding|nordic|europe|global|ltd|oy)$/i;

/** "RELEX Solutions" -> "RELEX", "Varjo Technologies Finland" -> "Varjo". */
export function coreName(base: string): string {
  let s = base.trim();
  while (GENERIC.test(s) && s.replace(GENERIC, "").trim().length >= 3) s = s.replace(GENERIC, "").trim();
  return s;
}

/** Looks a LinkedIn company name up in YTJ. Never guesses: see decide(). */
export async function matchCompany(name: string, opts: { offline?: boolean } = {}): Promise<PrhMatch> {
  const key = looseKey(name);
  const base = searchText(name);
  if (!key || !base || NOT_A_COMPANY.test(name.trim()) || base.length < 2) {
    return { name, key, status: "skipped", candidates: [], note: "Not a company name", queries: [] };
  }
  const queries = [base];
  const results: PrhSearch[] = [];
  const first = await searchYtj(base, opts);
  if (!first) return { name, key, status: "pending", candidates: [], note: "Not looked up in PRH yet", queries: [] };
  results.push(first);
  // A short or common name returns hundreds of hits in register order, so the
  // right company may not be on the first page. Narrow with the legal form.
  if (first.totalResults > 100) {
    for (const q of [`${base} Oy`, `Oy ${base}`, `${base} Oyj`, `${base} Ab`]) {
      const r = await searchYtj(q, opts);
      if (!r) {
        if (decide(name, results).status !== "verified") return { name, key, status: "pending", candidates: [], note: "Not looked up in PRH yet", queries };
        continue;
      }
      queries.push(q);
      results.push(r);
      if (decide(name, results).status === "verified") break;
    }
  }
  // "RELEX Solutions", "Varjo Technologies Finland": people add generic words
  // the register name may not have. Search again without them; anything found
  // this way can only be a close match (inferred), never verified.
  const core = coreName(base);
  if (core !== base && core.length >= 3 && decide(name, results).status === "none") {
    const r = await searchYtj(core, opts);
    if (!r) return { name, key, status: "pending", candidates: [], note: "Not looked up in PRH yet", queries };
    queries.push(core);
    const d = decide(core, [r]);
    if (d.status === "verified" || d.status === "inferred") {
      return { name, key, status: "inferred", company: d.company, candidates: d.candidates, note: `One candidate without "${base.slice(core.length).trim()}": check it.`, queries };
    }
    if (d.status === "ambiguous") return { ...d, name, key, queries };
  }
  return { ...decide(name, results), queries };
}
