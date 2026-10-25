import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fit quality on invented people at invented companies: what keeps a fit at
// Possible, who is never a decision-maker, the funnel, the intro group, the
// sender limit, the radar labels, the presets and emails. Offline.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vnet-fit-"));
process.env.DATA_DIR = dir;
process.env.APP_TODAY = "2026-10-24";
process.env.PRH_OFFLINE = "1";

const { buildNetwork, loadNetwork } = await import("../lib/network.ts");
const { analyseTitle } = await import("../lib/roles.ts");
const { DEFAULT_PROFILE, BROAD_PROFILE, industryRule, presetOf } = await import("../lib/industry.ts");
const { looseKey } = await import("../lib/prh.ts");
const { analyse } = await import("../lib/analysis.ts");
const { funnel, funnelPeople, canIntroduce, thisWeek, getRadar } = await import("../lib/queries.ts");
const { applyNotTargets, notTargetList, readState, setProfile, getProfile } = await import("../lib/state.ts");
const { importNetwork, ownerText } = await import("../lib/store.ts");
const { blankEmails, parseConnections } = await import("../lib/ingest.ts");
type Owner = import("../lib/store.ts").Owner;
type Resolved = import("../lib/matching.ts").Resolved;
type PrhCompany = import("../lib/prh.ts").PrhCompany;

const HEAD = "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n";
const owner = (id: string, name: string): Owner => ({ id, name, file: `${id}.csv`, original: `${id}.csv`, importedAt: "2026-10-24T10:00:00Z", rows: 0, accepted: 0, skipped: 0, noCompany: 0, noUrl: 0, demo: true });
const co = (businessId: string, name: string, tol: string, extra: Partial<PrhCompany> = {}): PrhCompany => ({ businessId, name, otherNames: [], tol, industry: `Industry ${tol}`, town: "TAMPERE", registrationDate: "2000-01-01", active: true, situations: [], formCode: "16", ...extra });
const res = (raw: string, company: PrhCompany, status: Resolved["status"] = "verified"): Resolved => ({ raw, key: looseKey(raw), status, company, candidates: [company], note: "", by: "rule", foreign: false });
const state = { version: 2 as const, status: {}, overrides: {}, reactions: [], angles: {} };
const row = (first: string, last: string, company: string, title: string) => `${first},${last},https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-ft,,${company},${title},01 Mar 2024`;

test("titles: students, trainees, board years and event roles never decide", () => {
  for (const t of ["Board 2026", "Hallituksen jäsen 2025", "Board Member 2025–2026", "Head of Events", "Student", "Tuotantotalouden opiskelija", "Trainee, Operations", "Kesäharjoittelija", "Thesis Worker, Production", "Operations Intern", "Kesätyöntekijä", "CEO | Student at Aalto"]) {
    const r = analyseTitle(t, DEFAULT_PROFILE.roles);
    assert.equal(r.decisionMaker, false, t);
    assert.ok(r.notDecider, `${t} says why`);
  }
  for (const t of ["International Sales Director", "Head of Operations", "Tuotantojohtaja", "COO"]) assert.equal(analyseTitle(t, DEFAULT_PROFILE.roles).decisionMaker, true, t);
});

// One person per rule, each at their own invented company in manufacturing.
const people = [
  ["Aino", "Aalto", "Esimerkki Konepaja Oy", "Operations Director"], // verified, old: strong
  ["Ville", "Vainio", "Testi Metalli Oy", "Operations Director"], // inferred match: possible
  ["Sanna", "Salo", "Uusi Tehdas Oy", "Toimitusjohtaja"], // registered 2025: early-stage, possible
  ["Pekka", "Peltola", "Teekkarit ry", "Toimitusjohtaja"], // association: not a decision-maker
  ["Riikka", "Rinne", "Esimerkki Konepaja Oy", "Production Planner"], // can introduce, a fit at the company
  ["Olli", "Ojala", "Hiljainen Valimo Oy", "Quality Engineer"], // can introduce, no fit known there
  ["Tiina", "Toivonen", "Ohjelmisto Oy", "CEO"], // other industry
  ["Kalle", "Koski", "Ei Löydy", "CEO"], // not found in PRH
];
const text = HEAD + people.map(([f, l, c, t]) => row(f, l, c, t)).join("\n") + "\n";
const companies: Record<string, Resolved> = {
  "Esimerkki Konepaja Oy": res("Esimerkki Konepaja Oy", co("1000001-1", "Esimerkki Konepaja Oy", "28150")),
  "Testi Metalli Oy": res("Testi Metalli Oy", co("1000002-2", "Testi Metallityö Oy", "25620"), "inferred"),
  "Uusi Tehdas Oy": res("Uusi Tehdas Oy", co("1000003-3", "Uusi Tehdas Oy", "25620", { registrationDate: "2025-06-01" })),
  "Teekkarit ry": res("Teekkarit ry", co("1000004-4", "Teekkarit ry", "28150", { formCode: "6", form: "Non-profit association" })),
  "Hiljainen Valimo Oy": res("Hiljainen Valimo Oy", co("1000005-5", "Hiljainen Valimo Oy", "24510")),
  "Ohjelmisto Oy": res("Ohjelmisto Oy", co("1000006-6", "Ohjelmisto Oy", "62010")),
  "Ei Löydy": { raw: "Ei Löydy", key: "ei loydy", status: "none", candidates: [], note: "", by: "rule", foreign: false },
};
const net = buildNetwork({ networks: [{ owner: owner("you", "You"), text }], resolved: new Map(Object.entries(companies)), state, profile: DEFAULT_PROFILE, signals: null, today: "2026-10-24" });
const who = (first: string) => net.contacts.find((c) => c.name.startsWith(first))!;

test("fit: an unconfirmed company match or an early-stage company is Possible at most, and says why", () => {
  assert.equal(who("Aino").fit, "strong");
  assert.equal(who("Ville").fit, "possible");
  assert.deepEqual(who("Ville").caps, ["company match not confirmed"]);
  assert.match(analyse(net, who("Ville")).fitWhy, /Possible at most: company match not confirmed/);
  assert.equal(who("Sanna").fit, "possible");
  assert.deepEqual(who("Sanna").caps, ["early-stage, likely small"]);
  assert.match(analyse(net, who("Sanna")).fitWhy, /early-stage, likely small/);
  assert.ok(analyse(net, who("Sanna")).reasons.some((r) => /Registered 1 Jun 2025, under two years ago/.test(r.text)));
});

test("an association or a foundation in PRH has no decision-makers", () => {
  const p = who("Pekka");
  assert.equal(p.role.decisionMaker, false);
  assert.equal(p.fit, null);
  assert.match(p.role.notDecider!, /association or foundation/);
  assert.match(analyse(net, p).fitWhy, /not counted as a decision-maker: an association or foundation in PRH/);
});

test("funnel: people → found in PRH → in your industries → who fit, with what drops out", () => {
  const f = funnel(net);
  assert.deepEqual(f.map((s) => s.count), [8, 7, 6, 3]);
  assert.deepEqual(f.map((s) => s.rest?.count ?? 0), [0, 1, 1, 3]);
  assert.match(f[2].rest!.label, /^1 in other industries/);
  assert.equal(f[3].rest!.href, "/people?step=intro");
  assert.equal(funnelPeople(net, "intro").length, 3);
  assert.ok(funnel(net, "you").every((s) => s.href.includes("owner=you")));
});

test("can introduce: not decision-makers at target companies, where no one decides first", () => {
  const r = canIntroduce(net);
  assert.equal(r.total, 3);
  assert.equal(r.people[0].name, "Olli Ojala", "no decision-maker known at his company");
  assert.match(r.people[0].why, /No decision-maker who fits is known there/);
  assert.ok(r.people.every((p) => p.approach === "ask_intro"));
  assert.match(r.people[0].prompt, /approach ask_intro\.$/);
});

test("this week: never more than the share for each sender, even when the list is shorter", () => {
  // Six strong fits, all with the same suggested sender; three teammates.
  const rows = HEAD + ["A", "B", "C", "D", "E", "F"].map((x, i) => row(`Aa${x}`, `Bb${x}`, `Konepaja ${i} Oy`, "COO")).join("\n") + "\n";
  const resolved = new Map(["A", "B", "C", "D", "E", "F"].map((_, i) => [`Konepaja ${i} Oy`, res(`Konepaja ${i} Oy`, co(`200000${i}-${i}`, `Konepaja ${i} Oy`, "28150"))]));
  const n = buildNetwork({ networks: [{ owner: owner("you", "You"), text: rows }, { owner: owner("b", "Co-founder"), text: HEAD }, { owner: owner("c", "Board member"), text: HEAD }], resolved, state, profile: DEFAULT_PROFILE, signals: null, today: "2026-10-24" });
  assert.equal(thisWeek(n).length, 2, "at most two for You");
  assert.equal(thisWeek(n, 5, "you").length, 5, "a teammate's own list is not capped");
});

test("radar: each person we know is a decision-maker or can introduce", () => {
  const signals = { fetchedAt: "2026-10-24T00:00:00Z", start: "2026-07-26", end: "2026-10-24", complete: true, pages: 1, signals: [{ businessId: "1000001-1", company: "Esimerkki Konepaja Oy", tol: "28150", type: "md_change" as const, date: "2026-10-01", recordNumber: "2026/9", entryCodes: ["TOIM"] }] };
  const n = buildNetwork({ networks: [{ owner: owner("you", "You"), text }], resolved: new Map(Object.entries(companies)), state, profile: DEFAULT_PROFILE, signals, today: "2026-10-24" });
  const known = getRadar(n).rows.find((r) => r.businessId === "1000001-1")!.known;
  assert.deepEqual(known.map((k) => [k.name, k.role]), [["Aino Aalto", "decision-maker"], ["Riikka Rinne", "can introduce"]]);
});

test("presets: broad takes in every line of business; the default does not", () => {
  assert.equal(industryRule("62010", DEFAULT_PROFILE), null);
  assert.ok(industryRule("62010", BROAD_PROFILE));
  assert.equal(industryRule("84110", BROAD_PROFILE), null, "public administration");
  assert.equal(industryRule("94991", BROAD_PROFILE), null, "associations");
  assert.equal(presetOf(DEFAULT_PROFILE), "default");
  assert.equal(presetOf(BROAD_PROFILE), "broad");
  assert.equal(presetOf({ industries: [{ code: "28", label: "Machinery" }] }), null);
});

test("not-targets: applied in any data folder, once, so the team's undo holds", async () => {
  importNetwork("Friend", text);
  await loadNetwork();
  const list = notTargetList();
  for (const name of ["Konecranes Oyj", "Neste Oyj", "Helen Oy", "Nordea Bank Abp", "OP Osuuskunta", "Kesko Oyj", "Telia Finland Oyj", "Lindex Group Oyj", "Fingrid Oyj", "ABB Oy", "Vaisala Oyj", "Atria Oyj", "Legrand Finland Oy", "Amazon Data Services Finland Oy"]) assert.ok(list.some((x) => x.name === name), name);
  const excluded = new Set(getProfile().excluded?.map((x) => x.businessId));
  assert.ok(list.every((x) => excluded.has(x.businessId)));
  // The team takes Vaisala off the list: it stays off.
  const p = getProfile();
  setProfile({ ...p, excluded: p.excluded!.filter((x) => x.businessId !== "0124416-2") });
  await loadNetwork();
  assert.equal(applyNotTargets(), 0);
  assert.ok(!getProfile().excluded!.some((x) => x.businessId === "0124416-2"));
  assert.equal(readState().notTargetsApplied?.length, list.length);
  // The demo load puts every one back.
  assert.equal(applyNotTargets({ force: true }), 1);
});

test("emails: blanked when stored, column and rows kept, so row numbers do not change", () => {
  const fx = (n: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", n), "utf8");
  for (const f of fs.readdirSync(path.join(import.meta.dirname, "fixtures")).filter((x) => x.endsWith(".csv"))) {
    const before = parseConnections(fx(f)).records;
    const out = blankEmails(fx(f));
    const after = parseConnections(out.text).records;
    assert.equal(after.length, before.length, f);
    assert.ok(after.every((r) => r.email === ""), `${f}: no email left`);
    assert.deepEqual(after.map(({ email, ...r }) => r), before.map(({ email, ...r }) => r), `${f}: everything else the same`);
    assert.equal(out.blanked, before.filter((r) => r.email).length, f);
  }
  const withEmail = 'Notes:\n"Some emails are missing."\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\r\nAino,Aalto,https://www.linkedin.com/in/aino-aalto-em,aino@example.com,"Esimerkki, Oy",CEO,01 Mar 2024\r\n';
  const o = importNetwork("Mail", withEmail);
  const stored = ownerText(o);
  assert.ok(!stored.includes("@example.com"));
  assert.ok(stored.includes("Email Address"), "the column stays");
  assert.ok(stored.startsWith('Notes:\n"Some emails are missing."\n\n'), "the preamble stays");
  assert.equal(parseConnections(stored).records[0].row, parseConnections(withEmail).records[0].row);
  assert.equal(parseConnections(stored).records[0].company, "Esimerkki, Oy");
});
