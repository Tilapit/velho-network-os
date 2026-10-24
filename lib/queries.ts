// Read and write operations shared by the web app and the MCP server. All
// ranking and filtering is here, in code; an LLM only picks the arguments.
import { analyse, fmtDate, shortName, type Analysis } from "./analysis.ts";
import { GROUP, GROUPS, groupForTol, industryRule, type GroupId } from "./industry.ts";
import { matchTerm } from "./roles.ts";
import { SIGNAL_TYPES, addDays, type CompanySignal, type SignalType } from "./signals.ts";
import { addReactionRows, STATUS_LABEL, type Reaction, type Status } from "./state.ts";
import { fold, isoDate } from "./normalize.ts";
import { candidateOf, cleanName, matchReactions, nameKey, parseReactions, postsWithin, RECENT_DAYS, type ParsedReaction } from "./reactions.ts";
import { contactsFor, type Contact, type Fit, type Network } from "./network.ts";
import { ytjUrl } from "./prh.ts";

export const appUrl = (p: string) => `${(process.env.APP_BASE_URL || "http://localhost:3100").replace(/\/$/, "")}${p}`;

/** Resolves an owner given by id or name ("You", "co-founder"). */
export function ownerId(net: Network, owner?: string): string | undefined {
  if (!owner) return undefined;
  const o = fold(owner).toLowerCase().trim();
  return net.owners.find((x) => x.id === o || fold(x.name).toLowerCase() === o)?.id ?? "__none__";
}

/** Accepts group ids ("metal") or labels ("Metal and machinery", "logistics"). */
export function groupIds(list?: string[]): GroupId[] | undefined {
  if (!list?.length) return undefined;
  const out = new Set<GroupId>();
  for (const x of list) {
    const k = fold(x).toLowerCase().trim();
    for (const g of GROUPS) if (g.id === k || fold(g.label).toLowerCase().includes(k) || k.includes(g.id)) out.add(g.id);
  }
  return [...out];
}

export type PersonSummary = {
  id: string;
  name: string;
  title: string;
  company: string;
  businessId?: string;
  group: string;
  fit: Fit | null;
  approach: string;
  score: number;
  reasons: string[];
  knownBy: string[];
  suggestedSender: string;
  signals: string[];
  status: string;
  url: string;
  linkedin: string;
};

export function summary(net: Network, c: Contact): PersonSummary {
  const a = analyse(net, c);
  return {
    id: c.id,
    name: c.name,
    title: c.position,
    company: a.company.name,
    businessId: a.company.businessId,
    group: GROUP[c.group].label,
    fit: c.fit,
    approach: c.approach,
    score: c.score,
    reasons: a.reasons.map((r) => `${r.text} [${r.source}, ${r.provenance}]`),
    knownBy: c.knownBy.map((k) => `${k.ownerName} (${fmtDate(k.connectedOn)})`),
    suggestedSender: c.sender.ownerName,
    signals: [...new Set(c.signals.map((s) => SIGNAL_TYPES[s.type].label))],
    status: STATUS_LABEL[c.status?.status ?? "none"],
    url: appUrl(`/people/${c.id}`),
    linkedin: c.url,
  };
}

// ---------- industries ----------

export type IndustryRow = {
  group: GroupId;
  label: string;
  contacts: number;
  decisionMakers: number;
  strong: number;
  possible: number;
  knownByTwo: number;
  companiesWithSignal: number;
  score: number;
  top: PersonSummary[];
};

/** Score per industry: 3 per strong fit, 1 per possible, 2 per fit known by two teammates, 2 per company with a signal. */
export function rankIndustries(net: Network, opts: { owner?: string } = {}): IndustryRow[] {
  const contacts = contactsFor(net, ownerId(net, opts.owner));
  const rows = GROUPS.filter((g) => !g.grey).map((g) => {
    const cs = contacts.filter((c) => c.group === g.id);
    const fits = cs.filter((c) => c.fit && c.status?.status !== "not_fit");
    const companiesWithSignal = new Set(cs.filter((c) => c.signals.length && c.rule).map((c) => c.companyId)).size;
    const strong = fits.filter((c) => c.fit === "strong").length;
    const possible = fits.length - strong;
    const knownByTwo = fits.filter((c) => c.knownBy.length > 1).length;
    return {
      group: g.id,
      label: g.label,
      contacts: cs.length,
      decisionMakers: cs.filter((c) => c.role.decisionMaker).length,
      strong,
      possible,
      knownByTwo,
      companiesWithSignal,
      score: strong * 3 + possible + knownByTwo * 2 + companiesWithSignal * 2,
      top: fits.slice(0, 3).map((c) => summary(net, c)),
    };
  });
  return rows.sort((a, b) => b.score - a.score || b.contacts - a.contacts);
}

// ---------- people ----------

export type PeopleFilter = {
  industries?: string[];
  tol_prefixes?: string[];
  roles?: string[];
  fit?: "strong" | "possible" | "any";
  known_by?: string;
  has_signal?: boolean;
  /** Reacted to a teammate's post in the last 30 days. */
  reacted?: boolean;
  town?: string;
  approach?: string;
  status?: Status;
  limit?: number;
};

export function findPeople(net: Network, f: PeopleFilter = {}): { total: number; people: PersonSummary[] } {
  const groups = groupIds(f.industries);
  const town = f.town ? fold(f.town).toLowerCase() : "";
  let cs = contactsFor(net, ownerId(net, f.known_by));
  cs = cs.filter((c) => {
    if (f.fit === "strong" && c.fit !== "strong") return false;
    if (f.fit === "possible" && c.fit !== "possible") return false;
    if ((!f.fit || f.fit === "any") && !c.fit && !f.roles?.length && !f.approach) return false;
    if (groups && !groups.includes(c.group)) return false;
    if (f.tol_prefixes?.length && !f.tol_prefixes.some((p) => c.match?.company?.tol?.startsWith(p.replace(/\D/g, "")))) return false;
    if (f.roles?.length && !f.roles.some((r) => matchTerm(c.position, r))) return false;
    if (f.has_signal && !c.signals.length) return false;
    if (f.reacted && !postsWithin(c, net.today, RECENT_DAYS)) return false;
    if (town && !fold(c.match?.company?.town ?? "").toLowerCase().includes(town)) return false;
    if (f.approach && c.approach !== f.approach) return false;
    if (f.status && (c.status?.status ?? "none") !== f.status) return false;
    return true;
  });
  return { total: cs.length, people: cs.slice(0, Math.min(f.limit ?? 20, 100)).map((c) => summary(net, c)) };
}

export type ThemePerson = PersonSummary & { themeApproach: "invite" | "ask_intro" | "skip"; why: string };

/** The LLM maps a theme to industries; this only filters and orders. */
export function peopleForTheme(net: Network, args: { theme: string; industries: string[]; roles?: string[]; limit?: number }): { theme: string; industries: string[]; total: number; people: ThemePerson[] } {
  const groups = groupIds(args.industries) ?? [];
  const cs = net.contacts.filter((c) => groups.includes(c.group) && c.status?.status !== "not_fit" && (!args.roles?.length || c.role.decisionMaker || args.roles.some((r) => matchTerm(c.position, r))));
  const people = cs
    .map((c) => {
      const inRoles = args.roles?.length ? args.roles.some((r) => matchTerm(c.position, r)) : c.role.decisionMaker;
      const themeApproach: ThemePerson["themeApproach"] = c.rule && inRoles && c.role.decisionMaker ? "invite" : c.rule ? "ask_intro" : "skip";
      const why = themeApproach === "invite" ? `Decision-maker at ${c.match?.company ? shortName(c.match.company.name) : c.company}` : themeApproach === "ask_intro" ? "Works at a target company; can point you to who decides" : "Outside your target industries";
      return { ...summary(net, c), themeApproach, why };
    })
    .filter((p) => p.themeApproach !== "skip")
    .sort((a, b) => (a.themeApproach === b.themeApproach ? b.score - a.score : a.themeApproach === "invite" ? -1 : 1));
  return { theme: args.theme, industries: groups.map((g) => GROUP[g].label), total: people.length, people: people.slice(0, Math.min(args.limit ?? 20, 100)) };
}

export function getPerson(net: Network, id: string): (Analysis & { appUrl: string }) | null {
  const c = net.byId.get(id);
  return c ? { ...analyse(net, c), appUrl: appUrl(`/people/${c.id}`) } : null;
}

// ---------- companies ----------

export function findCompany(net: Network, q: { business_id?: string; name?: string }) {
  if (q.business_id) return net.companies.get(q.business_id.trim()) ?? null;
  if (q.name) {
    const k = fold(q.name).toLowerCase().trim();
    const all = [...net.companies.values()];
    return all.find((c) => fold(c.name).toLowerCase() === k || c.rawNames.some((r) => fold(r).toLowerCase() === k)) ?? all.find((c) => fold(c.name).toLowerCase().includes(k)) ?? null;
  }
  return null;
}

export function getCompany(net: Network, q: { business_id?: string; name?: string }) {
  const co = findCompany(net, q);
  if (!co) return null;
  const people = co.contactIds.map((id) => net.byId.get(id)!).sort((a, b) => b.score - a.score);
  return {
    id: co.id,
    name: co.name,
    businessId: co.businessId,
    namesInNetwork: co.rawNames,
    matchStatus: co.status,
    prh: co.prh ? { form: co.prh.form, formCode: co.prh.formCode, tol: co.prh.tol, industry: co.prh.industry, town: co.prh.town, registered: co.prh.registrationDate, website: co.prh.website, source: ytjUrl(co.prh.businessId) } : null,
    group: GROUP[co.group].label,
    inProfile: !!co.rule,
    headcount: "Missing: not in PRH open data",
    signals: co.signals.map((s) => ({ type: SIGNAL_TYPES[s.type].label, date: s.date, notice: s.recordNumber, source: ytjUrl(s.businessId) })),
    people: people.map((c) => summary(net, c)),
    url: appUrl(`/companies/${co.id}`),
  };
}

// ---------- radar ----------

export type RadarRow = {
  businessId: string;
  company: string;
  group: GroupId;
  groupLabel: string;
  tol?: string;
  industry?: string;
  town?: string;
  signals: { type: SignalType; label: string; date: string; recordNumber: string }[];
  latest: string;
  score: number;
  known: { id: string; name: string; title: string; fit: Fit | null; knownBy: string[]; url: string }[];
  source: string;
  url: string;
};

/** Weight of each signal type, x1 within 30 days, x0.75 within 60, x0.5 older. One count per type. */
export function radarScore(signals: { type: SignalType; date: string }[], now: string): number {
  const best = new Map<SignalType, number>();
  for (const s of signals) {
    const age = (Date.parse(now) - Date.parse(s.date)) / 86_400_000;
    const f = age <= 30 ? 1 : age <= 60 ? 0.75 : 0.5;
    best.set(s.type, Math.max(best.get(s.type) ?? 0, SIGNAL_TYPES[s.type].weight * f));
  }
  return Math.round([...best.values()].reduce((a, b) => a + b, 0) * 100) / 100;
}

export type RadarFilter = { types?: SignalType[]; industries?: string[]; days?: number; known?: "known" | "unknown"; limit?: number; owner?: string };

export function getRadar(net: Network, f: RadarFilter = {}): { window: { start: string; end: string; fetchedAt: string } | null; total: number; warm: number; rows: RadarRow[] } {
  if (!net.signals) return { window: null, total: 0, warm: 0, rows: [] };
  const groups = groupIds(f.industries);
  const since = f.days ? addDays(net.today, -f.days) : net.signals.start;
  const owner = ownerId(net, f.owner);
  const byCo = new Map<string, CompanySignal[]>();
  for (const s of net.signals.signals) {
    if (s.date < since) continue;
    if (f.types?.length && !f.types.includes(s.type)) continue;
    if (!industryRule(s.tol, net.profile)) continue;
    const list = byCo.get(s.businessId);
    if (list) list.push(s);
    else byCo.set(s.businessId, [s]);
  }
  let rows: RadarRow[] = [];
  for (const [businessId, sigs] of byCo) {
    const first = sigs[0];
    const lower = industryRule(first.tol, net.profile)?.lowerPriority;
    const group = groupForTol(first.tol);
    if (groups && !groups.includes(group)) continue;
    const co = net.companies.get(businessId);
    const known = (co?.contactIds ?? [])
      .map((id) => net.byId.get(id)!)
      .filter((c) => !owner || c.knownBy.some((k) => k.owner === owner))
      .sort((a, b) => b.score - a.score)
      .map((c) => ({ id: c.id, name: c.name, title: c.position, fit: c.fit, knownBy: c.knownBy.map((k) => k.ownerName), url: appUrl(`/people/${c.id}`) }));
    const uniq = new Map<string, CompanySignal>();
    for (const s of sigs) if (!uniq.has(`${s.type}|${s.recordNumber}`)) uniq.set(`${s.type}|${s.recordNumber}`, s);
    const list = [...uniq.values()].sort((a, b) => b.date.localeCompare(a.date));
    rows.push({
      businessId,
      company: first.company,
      group,
      groupLabel: GROUP[group].label,
      tol: first.tol,
      industry: first.industry,
      town: first.town,
      signals: list.map((s) => ({ type: s.type, label: SIGNAL_TYPES[s.type].label, date: s.date, recordNumber: s.recordNumber })),
      latest: list[0].date,
      // Lower-priority industries count half.
      score: radarScore(list, net.today) * (lower ? 0.5 : 1),
      known,
      source: ytjUrl(businessId),
      url: appUrl(`/companies/${businessId}`),
    });
  }
  if (f.known === "known") rows = rows.filter((r) => r.known.length);
  if (f.known === "unknown") rows = rows.filter((r) => !r.known.length);
  rows.sort((a, b) => (b.known.length ? 1 : 0) - (a.known.length ? 1 : 0) || b.score - a.score || b.latest.localeCompare(a.latest));
  return {
    window: { start: since, end: net.signals.end, fetchedAt: net.signals.fetchedAt },
    total: rows.length,
    warm: rows.filter((r) => r.known.length).length,
    rows: rows.slice(0, Math.min(f.limit ?? 50, 500)),
  };
}

// ---------- messages ----------

export const TONE_RULES = [
  "Write in Finnish unless the person's name, title or company suggests another language; Swedish for Finland-Swedish companies is fine.",
  "Short: three to five sentences, under 80 words.",
  "Concrete: name one thing from the facts below, never a generic compliment.",
  "One clear ask, easy to say yes or no to (a 20-minute call, an intro, an invite).",
  "No buzzwords (no 'revolutionary', 'game-changing', 'synergy', 'leverage', 'disruptive').",
  "Never invent facts. Use only the facts listed here. Do not mention headcount, revenue or anything marked missing.",
  "Never mention that they reacted to or liked a post.",
  "The message is sent by the suggested sender, from their own LinkedIn or email. This app sends nothing.",
];

// Examples use made-up companies on purpose: the message must take its facts
// from `facts`, never from an example.
const EXAMPLES: Record<"direct" | "ask_intro" | "event_invite", string[]> = {
  direct: [
    "Hei Laura, näin että Esimerkki Konepajalla vaihtui hiljattain toimitusjohtaja. Teemme Velhossa tekoälyä tuotannon suunnitteluun ja tarjouslaskentaan suomalaisille valmistajille. Olisiko sinulla 20 minuuttia ensi viikolla? Kerron kahdesta lyhyestä esimerkistä. Ihan ok sanoa ei.",
    "Hej Erik, jag såg att Exempel Ab nyligen registrerat en fusion. Vi på Velho hjälper industriföretag att få ut mer av sina system med AI. Har du 20 minuter för ett kort samtal nästa vecka?",
  ],
  ask_intro: [
    "Hei Jussi, pitkästä aikaa! Pieni pyyntö: kuka Esimerkki Oy:llä vastaa tuotannon kehittämisestä? Haluaisin esitellä Velhon tekoälytyötä valmistajille lyhyesti. Jos tiedät oikean ihmisen, esittely olisi iso apu.",
    "Hei Anna, tiedätkö kuka teillä päättää ERP- ja tuotantodatan kehityksestä? Velho tekee juuri sellaista, ja haluaisin kysyä häneltä 20 minuuttia. Kiitos jo etukäteen!",
  ],
  event_invite: [
    "Hei Matti, järjestämme marraskuussa Helsingissä pienen aamiaispyöreän pöydän logistiikan johtajille: kahdeksan osallistujaa, aiheena tekoäly kuljetussuunnittelussa. Ajattelin, että sinulla olisi tähän paljon annettavaa. Lähetänkö kutsun?",
    "Hei Tiina, kokoamme tuotantojohtajien pyöreän pöydän tekoälystä valmistavassa teollisuudessa. Ei myyntipuheita, vain kokemusten vaihtoa. Olisitko kiinnostunut?",
  ],
};

export function messageContext(net: Network, args: { person_id: string; type: "direct" | "ask_intro" | "event_invite"; theme?: string }) {
  const c = net.byId.get(args.person_id);
  if (!c) return null;
  const a = analyse(net, c);
  const facts = [
    `Name: ${c.name}`,
    c.position ? `Title (LinkedIn): ${c.position}` : null,
    `Company: ${a.company.name}${a.company.industry ? `, ${a.company.industry}` : ""}${a.company.town ? `, ${a.company.town}` : ""}${a.company.matchStatus === "inferred" ? " (company match not confirmed)" : ""}`,
    ...a.reasons.filter((r) => r.kind === "signal").map((r) => `${r.text} (PRH)`),
    c.colleagues ? `The team knows ${c.colleagues} other people at ${a.company.name}.` : null,
    `Sender: ${c.sender.ownerName}, connected ${fmtDate(c.sender.connectedOn)}${c.knownBy.length > 1 ? `; also known by ${c.knownBy.slice(1).map((k) => k.ownerName).join(", ")}` : ""}.`,
    args.theme ? `Theme or event: ${args.theme}` : null,
    "About Velho: a small Finnish AI and software consultancy that helps SMEs with physical operations use AI and automation in planning, quoting, reporting and their existing systems.",
  ].filter(Boolean) as string[];
  return {
    person: { id: c.id, name: c.name, url: appUrl(`/people/${c.id}`) },
    type: args.type,
    sender: c.sender.ownerName,
    facts,
    mustNotUse: ["Headcount (missing)", "Revenue (missing)", "Reactions to posts", ...a.missing.map((m) => `${m.label}: ${m.text}`)],
    tone: TONE_RULES,
    examples: EXAMPLES[args.type],
    note: "Write the message from these facts only. The server never calls an LLM and never sends anything.",
  };
}

// ---------- reactions ----------

export type ReactionInput = {
  post: string;
  /** YYYY-MM-DD, the day the post went out. Default today. */
  postDate?: string;
  /** Owner id or name of whose post it was. */
  author?: string;
  /** The reactions list as copied from LinkedIn. */
  text?: string;
  /** People read from a screenshot. */
  entries?: ParsedReaction[];
  names?: string[];
  /** Names a teammate resolved in the review: the person they confirmed. */
  picks?: { name: string; person_id: string }[];
  /** false: match only, store nothing. */
  save?: boolean;
};

/**
 * Parses and matches reactions to one of the team's posts, and stores the
 * matches (as inferred) and the picks. Names in review are stored only once
 * someone picks; names with no match are returned once and never stored.
 */
export function addReactions(net: Network, input: ReactionInput) {
  const author = input.author ? ownerId(net, input.author) : undefined;
  const authorId = author && author !== "__none__" ? author : undefined;
  const seen = new Set<string>();
  const all: ParsedReaction[] = [...(input.entries ?? []), ...(input.text ? parseReactions(input.text) : []), ...(input.names ?? []).map((n) => ({ name: cleanName(n) }))];
  const entries = all.filter((e) => {
    const k = `${nameKey(e.name)}|${e.headline ?? ""}`;
    if (!nameKey(e.name) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const res = matchReactions(net, entries, { author: authorId });
  const picks = (input.picks ?? []).filter((p) => net.byId.has(p.person_id));
  const picked = new Set(picks.map((p) => nameKey(p.name)));
  const at = new Date().toISOString();
  const postDate = isoDate(input.postDate) || net.today;
  const base = { post: input.post.trim() || "Untitled post", postDate, author: authorId, at };
  const rows: Reaction[] = [
    ...res.matched.filter((m) => !picked.has(nameKey(m.entry.name))).map((m) => ({ ...base, contactId: m.contactId, name: m.entry.name, how: m.how })),
    ...picks.map((p) => ({ ...base, contactId: p.person_id, name: cleanName(p.name), how: "picked" as const })),
  ];
  const saved = input.save === false ? 0 : rows.length ? addReactionRows(rows) : 0;
  const person = (id: string) => {
    const c = net.byId.get(id)!;
    return { id, name: c.name, title: c.position, company: candidateOf(c).company, fit: c.fit, url: appUrl(`/people/${id}`) };
  };
  return {
    post: base.post,
    postDate,
    author: authorId ? net.owners.find((o) => o.id === authorId)?.name : undefined,
    read: entries.length,
    stored: input.save !== false,
    saved,
    matched: rows.map((r) => ({ name: r.name, how: r.how, person: person(r.contactId) })),
    review: res.review.filter((r) => !picked.has(nameKey(r.entry.name))).map((r) => ({ name: r.entry.name, headline: r.entry.headline, degree: r.entry.degree, candidates: r.candidates.map((c) => ({ ...c, url: appUrl(`/people/${c.id}`) })) })),
    unmatched: res.unmatched.map((u) => ({ name: u.entry.name, why: u.why })),
    note: "Names in 'unmatched' are not stored. Names in 'review' are stored only after someone picks the right person.",
  };
}
