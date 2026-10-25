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
  // "Owner Relations" is a function, not an owner.
  assert.equal(analyseTitle("Pricing and Owner Relations Analyst", DEFAULT_PROFILE.roles).decisionMaker, false);
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
  // No register data on these companies yet: nobody drops out as too small.
  assert.deepEqual(f.map((s) => s.count), [8, 7, 6, 6, 3]);
  assert.deepEqual(f.map((s) => s.rest?.count ?? 0), [0, 1, 1, 0, 3]);
  assert.match(f[2].rest!.label, /^1 in other industries/);
  assert.equal(f[3].label, "with employees registered");
  assert.equal(f[4].rest!.href, "/people?step=intro");
  assert.equal(funnelPeople(net, "nodm").length, 3);
  assert.equal(funnelPeople(net, "intro").length, 2, "nobody at an association introduces");
  assert.match(f[4].rest!.label, /^3 not decision-makers, 2 of them can introduce$/);
  assert.ok(funnel(net, "you").every((s) => s.href.includes("owner=you")));
});

test("can introduce: not decision-makers at target companies, where no one decides first", () => {
  const r = canIntroduce(net);
  assert.equal(r.total, 2);
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

test("Employer Register: no employees is never a fit, its own funnel step; with employees and new, early-stage", () => {
  const emp = (employer: boolean, extra: Partial<PrhCompany> = {}) => ({ registers: { employer, vat: true, ...(employer ? { employerSince: "2001-05-01" } : {}) }, ...extra });
  const rows = HEAD + [row("Eero", "Esko", "Yksin Oy", "Toimitusjohtaja"), row("Leena", "Lehto", "Iso Konepaja Oy", "Toimitusjohtaja"), row("Matti", "Mäki", "Uusi Valimo Oy", "COO"), row("Nina", "Niemi", "Yksin Oy", "Production Planner")].join("\n") + "\n";
  const resolved = new Map<string, Resolved>([
    ["Yksin Oy", res("Yksin Oy", co("3000001-1", "Yksin Oy", "25620", emp(false)))],
    ["Iso Konepaja Oy", res("Iso Konepaja Oy", co("3000002-2", "Iso Konepaja Oy", "28150", emp(true)))],
    ["Uusi Valimo Oy", res("Uusi Valimo Oy", co("3000003-3", "Uusi Valimo Oy", "24510", emp(true, { registrationDate: "2025-09-01" })))],
  ]);
  const build = (profile = DEFAULT_PROFILE) => buildNetwork({ networks: [{ owner: owner("you", "You"), text: rows }], resolved, state, profile, signals: null, today: "2026-10-24" });
  const n = build();
  const p = (first: string, nn = n) => nn.contacts.find((c) => c.name.startsWith(first))!;
  assert.equal(p("Eero").fit, null);
  assert.equal(p("Eero").tooSmall, true);
  assert.equal(p("Eero").approach, "skip");
  assert.equal(p("Nina").approach, "skip", "nobody to introduce at a one-person company");
  assert.match(analyse(n, p("Eero")).fitWhy, /Not in the Employer Register \(PRH\/YTJ\)/);
  assert.equal(p("Leena").fit, "strong");
  assert.equal(p("Matti").fit, "possible");
  assert.deepEqual(p("Matti").caps, ["early-stage, likely small"]);
  const f = funnel(n);
  assert.deepEqual(f.map((s) => [s.label, s.count, s.rest?.count ?? 0]), [["people", 4, 0], ["company found in PRH", 4, 0], ["in your industries", 4, 0], ["with employees registered", 2, 2], ["decision-makers who fit", 2, 0]]);
  assert.equal(f[3].rest!.label, "2 too small: no employees registered");
  assert.equal(f[3].rest!.href, "/people?step=small");
  // The source pill on the person card.
  const reason = analyse(n, p("Leena")).reasons.find((r) => r.label === "Employer Register")!;
  assert.equal(reason.source, "PRH/YTJ");
  assert.match(reason.text, /^Employer Register: yes, since 1 May 2001\. VAT register: yes\.$/);
  assert.match(analyse(n, p("Eero")).reasons.find((r) => r.label === "Employer Register")!.text, /^Employer Register: no\./);
  // Filter off in Settings: back on the list, Possible at most, and no funnel step.
  const off = build({ ...DEFAULT_PROFILE, requireEmployer: false });
  assert.equal(p("Eero", off).fit, "possible");
  assert.ok(p("Eero", off).caps.includes("no employees registered"));
  assert.ok(!funnel(off).some((s) => s.label === "with employees registered"));
});

test("can introduce: working roles only, ranked by seniority; never front-line, temporary or student staff", async () => {
  const { introRank } = await import("../lib/roles.ts");
  for (const t of ["Cashier", "Kassatyöntekijä", "Store Manager", "Myymäläpäällikkö", "Sales Associate", "Seasonal Worker", "Kesätyöntekijä", "Trainee", "Operations Intern", "Student", "Thesis Worker", "Production Worker", ""]) assert.equal(introRank(t), 0, t);
  assert.ok(introRank("Head of Marketing") > introRank("Sales Manager"));
  assert.ok(introRank("Sales Manager") > introRank("Sales Executive"));
  assert.ok(introRank("Senior Consultant") > introRank("Quality Engineer"));
  for (const t of ["Specialist", "Myyntiasiantuntija", "Team Lead", "Sales Executive", "Consultant", "Quality Engineer", "Production Planner"]) assert.ok(introRank(t) > 0, t);
  const rows = HEAD + [row("Iida", "Ilola", "Hiljainen Valimo Oy", "Quality Engineer"), row("Jari", "Jokela", "Toinen Valimo Oy", "Quality Manager"), row("Kaisa", "Kallio", "Kolmas Valimo Oy", "Cashier")].join("\n") + "\n";
  const resolved = new Map<string, Resolved>([["Hiljainen Valimo Oy", companies["Hiljainen Valimo Oy"]], ["Toinen Valimo Oy", res("Toinen Valimo Oy", co("1000007-7", "Toinen Valimo Oy", "24510"))], ["Kolmas Valimo Oy", res("Kolmas Valimo Oy", co("1000008-8", "Kolmas Valimo Oy", "24510"))]]);
  const n = buildNetwork({ networks: [{ owner: owner("you", "You"), text: rows }], resolved, state, profile: DEFAULT_PROFILE, signals: null, today: "2026-10-24" });
  const r = canIntroduce(n);
  assert.deepEqual(r.people.map((p) => p.name), ["Jari Jokela", "Iida Ilola"], "the manager first; the cashier never");
  assert.equal(n.contacts.find((c) => c.name === "Kaisa Kallio")!.approach, "skip");
});

test("this week: a reason from code, never 'No fresh change or reaction'", async () => {
  const { weekWhy } = await import("../lib/queries.ts");
  const two = buildNetwork({
    networks: [{ owner: owner("you", "You"), text }, { owner: owner("janne", "Janne"), text: HEAD + row("Aino", "Aalto", "Esimerkki Konepaja Oy", "Operations Director") + "\n" }],
    resolved: new Map(Object.entries({ ...companies, "Esimerkki Konepaja Oy": res("Esimerkki Konepaja Oy", co("1000001-1", "Esimerkki Konepaja Oy", "28150", { registers: { employer: true, employerSince: "2009-02-01", vat: true } })) })),
    state, profile: DEFAULT_PROFILE, signals: null, today: "2026-10-24",
  });
  const aino = two.contacts.find((c) => c.name === "Aino Aalto")!;
  const w = weekWhy(two, aino);
  assert.equal(w.kind, "fit");
  assert.equal(w.why, "Operations Director at Esimerkki Konepaja: metal and machinery, employer since 2009. Known by you and Janne.");
  for (const c of net.contacts.filter((x) => x.fit)) assert.doesNotMatch(weekWhy(net, c).why, /No fresh change/);
  assert.match(weekWhy(net, who("Sanna")).why, /early-stage/);
});

test("radar: the size rule and the not-target list hold there too", async () => {
  const { signalsFromPage } = await import("../lib/signals.ts");
  const page = { companies: [
    { businessId: { value: "4000001-1", registrationDate: "2001-01-01" }, names: [{ name: "Yksin Konepaja Oy", type: "1", version: 1 }], mainBusinessLine: { type: "28150" }, companyForms: [{ type: "16", version: 1 }], registeredEntries: [{ register: "6", type: "80" }], publicNotices: [{ registrationDate: "2026-10-10", recordNumber: "2026/50", entryCodes: ["TOIM"] }] },
    { businessId: { value: "4000002-2", registrationDate: "2001-01-01" }, names: [{ name: "Iso Konepaja Oy", type: "1", version: 1 }], mainBusinessLine: { type: "28150" }, companyForms: [{ type: "16", version: 1 }], registeredEntries: [{ register: "7", type: "41" }], publicNotices: [{ registrationDate: "2026-10-10", recordNumber: "2026/51", entryCodes: ["TOIM"] }] },
  ] };
  const sigs = signalsFromPage("md_change", page, "2026-07-26", "2026-10-24");
  assert.deepEqual(sigs.map((x) => [x.company, x.employer]), [["Yksin Konepaja Oy", false], ["Iso Konepaja Oy", true]]);
  const set = { fetchedAt: "2026-10-24T00:00:00Z", start: "2026-07-26", end: "2026-10-24", complete: true, pages: 1, signals: sigs };
  const build = (profile = DEFAULT_PROFILE) => buildNetwork({ networks: [{ owner: owner("you", "You"), text }], resolved: new Map(Object.entries(companies)), state, profile, signals: set, today: "2026-10-24" });
  assert.deepEqual(getRadar(build()).rows.map((r) => r.company), ["Iso Konepaja Oy"]);
  assert.equal(getRadar(build({ ...DEFAULT_PROFILE, requireEmployer: false })).rows.length, 2);
  assert.equal(getRadar(build({ ...DEFAULT_PROFILE, excluded: [{ businessId: "4000002-2", name: "Iso Konepaja Oy" }] })).rows.length, 0);
});

test("reactions: no label needed; the post is named after its author and day", async () => {
  const { addReactions } = await import("../lib/queries.ts");
  const r = addReactions(net, { post: "", postDate: "2026-10-20", author: "you", text: "Aino Aalto\nAino Aalto\n· 1st\nOperations Director at Esimerkki Konepaja", save: false });
  assert.equal(r.post, "Your post, 20 Oct 2026");
});

test("reactions: names ruled out only by '1st' are their own group, and a wrong 'Copied from' is flagged", async () => {
  const { addReactions } = await import("../lib/queries.ts");
  // Four invented people only Janne knows, one only You knows.
  const jText = HEAD + [row("Aaro", "Aalto", "Esimerkki Konepaja Oy", "COO"), row("Bea", "Berg", "Esimerkki Konepaja Oy", "CFO"), row("Cai", "Car", "Testi Metalli Oy", "CEO"), row("Dan", "Dahl", "Uusi Tehdas Oy", "COO")].join("\n") + "\n";
  const yText = HEAD + row("Eva", "Eklund", "Hiljainen Valimo Oy", "Quality Engineer") + "\n";
  const n = buildNetwork({ networks: [{ owner: owner("you", "You"), text: yText }, { owner: owner("janne", "Janne"), text: jText }], resolved: new Map(Object.entries(companies)), state, profile: DEFAULT_PROFILE, signals: null, today: "2026-10-24" });
  const paste = ["Aaro Aalto", "Bea Berg", "Cai Car", "Dan Dahl", "Eva Eklund"].map((x) => `${x}\n${x}\n· 1st\nSomething at Somewhere`).join("\n") + "\nNobody Known\nNobody Known\n· 2nd\nStudent";
  // Copied from Janne's LinkedIn, but matched as if from You's: four of six are ruled out by "1st".
  const wrong = addReactions(n, { post: "", author: "you", copiedBy: "you", text: paste, save: false });
  assert.equal(wrong.copiedBy, "You");
  assert.deepEqual(wrong.degreeMismatch.map((u) => u.name).sort(), ["Aaro Aalto", "Bea Berg", "Cai Car", "Dan Dahl"]);
  assert.deepEqual(wrong.unmatched.map((u) => u.name), ["Nobody Known"], "only names no one has are 'Not in your networks'");
  assert.equal(wrong.copiedByWarning?.suggest?.name, "Janne");
  assert.match(wrong.copiedByWarning!.text, /^4 of 6 names \(67%\)/);
  // As copied from Janne: they match, Eva is ruled out ("1st" for Janne, but only You knows her), no warning.
  const right = addReactions(n, { post: "", author: "you", copiedBy: "janne", text: paste, save: false });
  assert.equal(right.matched.length, 4);
  assert.deepEqual(right.degreeMismatch.map((u) => u.name), ["Eva Eklund"]);
  assert.equal(right.copiedByWarning, undefined, "one of six is under a fifth");
  // Without "Copied from", it is the post's owner.
  assert.equal(addReactions(n, { post: "", author: "janne", text: paste, save: false }).copiedBy, "Janne");
});
