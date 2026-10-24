import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Offline, against a throwaway data dir. Every person is invented.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vnet-react-"));
process.env.DATA_DIR = dir;
process.env.APP_TODAY = "2026-10-24";
process.env.PRH_OFFLINE = "1";

const { parseReactions, matchReactions, cleanName } = await import("../lib/reactions.ts");
const { buildNetwork } = await import("../lib/network.ts");
const { DEFAULT_PROFILE } = await import("../lib/industry.ts");
const { looseKey } = await import("../lib/prh.ts");
const { addReactions } = await import("../lib/queries.ts");
const { analyse } = await import("../lib/analysis.ts");
type Owner = import("../lib/store.ts").Owner;
type Resolved = import("../lib/matching.ts").Resolved;
type PrhCompany = import("../lib/prh.ts").PrhCompany;

const fx = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");
const HEAD = "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n";
const owner = (id: string, name: string): Owner => ({ id, name, file: `${id}.csv`, original: `${id}.csv`, importedAt: "2026-10-24T10:00:00Z", rows: 0, accepted: 0, skipped: 0, noCompany: 0, noUrl: 0, demo: true });
const co = (businessId: string, name: string, tol: string): PrhCompany => ({ businessId, name, otherNames: [], tol, industry: `Industry ${tol}`, town: "TAMPERE", registrationDate: "2000-01-01", active: true, situations: [], formCode: "16" });
const res = (raw: string, company: PrhCompany): Resolved => ({ raw, key: looseKey(raw), status: "verified", company, candidates: [company], note: "", by: "rule", foreign: false });

const YOU = HEAD + [
  "Laura,Mäkelä,https://www.linkedin.com/in/laura-makela,,Lunawood,Operations Director,12 Apr 2019",
  "Mika,Laine,https://www.linkedin.com/in/mika-laine,,Lunawood Oy,Production Planner,01 Mar 2024",
  "Mikko,Korhonen,https://www.linkedin.com/in/mikko-korhonen-11,,Reaktor,Software Developer,05 May 2021",
  "Anna,Virtanen,https://www.linkedin.com/in/anna-virtanen,,Kumera Drives Oy,Head of Production,10 Oct 2025",
  "Sara,Holm,https://www.linkedin.com/in/sara-holm,,Spotify AB,Engineer,10 Oct 2025",
].join("\n");
const CO = HEAD + ["Mikko,Korhonen,https://www.linkedin.com/in/mikko-korhonen-22,,Hydroline,CFO,05 May 2022"].join("\n");
const LUNA = co("0606363-5", "Oy Lunawood Ltd", "16239");
const resolved = new Map<string, Resolved>([
  ["Lunawood", res("Lunawood", LUNA)],
  ["Lunawood Oy", res("Lunawood Oy", LUNA)],
  ["Reaktor", res("Reaktor", co("1234567-8", "Reaktor Innovations Oy", "62010"))],
  ["Hydroline", res("Hydroline", co("2417546-2", "Hydroline Oy", "28120"))],
  ["Kumera Drives Oy", res("Kumera Drives Oy", co("1536748-9", "Kumera Drives Oy", "28150"))],
]);
const build = (reactions: import("../lib/state.ts").Reaction[] = []) =>
  buildNetwork({
    networks: [
      { owner: owner("you", "You"), text: YOU },
      { owner: owner("cofounder", "Co-founder"), text: CO },
    ],
    resolved,
    state: { version: 2, status: {}, overrides: {}, reactions, angles: {} },
    profile: DEFAULT_PROFILE,
    signals: null,
    today: "2026-10-24",
  });
const net = build();
const idOf = (name: string, company: string) => net.contacts.find((c) => c.name === name && c.company === company)!.id;

test("reactions parser: LinkedIn's copied list with repeats, markers, headlines and buttons", () => {
  const r = parseReactions(fx("reactions-linkedin.txt"));
  assert.deepEqual(
    r.map((x) => [x.name, x.degree ?? null, x.headline ?? null]),
    [
      ["Laura Mäkelä", "1st", "Operations Director at Lunawood"],
      ["Mikko Korhonen", "2nd", "CFO | Hydroline"],
      ["Production Manager", "3rd", "Production Manager"],
      ["Sara Holm", "1st", "Engineer at Spotify AB"],
      ["Anna Virtanen", "1st", "Head of Production, Gearboxes"],
      ["Erkki Esimerkki", "2nd", "Plant Manager"],
      ["Mika Laine", "1st", "Production Planner at Lunawood Oy"],
    ],
  );
});

test("reactions parser: a plain list of names, one per line", () => {
  assert.deepEqual(parseReactions("Laura Mäkelä\nMikko Korhonen\n\nAnna Virtanen\n").map((x) => x.name), ["Laura Mäkelä", "Mikko Korhonen", "Anna Virtanen"]);
  assert.equal(cleanName("Dr. Aino Kallio, CSCP (she/her) 🌱"), "Aino Kallio");
});

test("reactions matcher: name, company in the headline, degree marker, review and unmatched", () => {
  const m = matchReactions(net, [
    { name: "Laura Mäkelä" },
    { name: "Mikko Korhonen", headline: "CFO | Hydroline" },
    { name: "Mikko Korhonen", degree: "1st" },
    { name: "Mikko Korhonen" },
    { name: "Nobody Here" },
  ], { author: "you" });
  assert.deepEqual(m.matched.map((x) => [x.entry.name, x.contactId, x.how]), [
    ["Laura Mäkelä", idOf("Laura Mäkelä", "Lunawood"), "name"],
    ["Mikko Korhonen", idOf("Mikko Korhonen", "Hydroline"), "name_company"],
    ["Mikko Korhonen", idOf("Mikko Korhonen", "Reaktor"), "name_degree"],
  ]);
  assert.equal(m.review.length, 1);
  assert.equal(m.review[0].candidates.length, 2);
  assert.deepEqual(m.unmatched.map((x) => x.entry.name), ["Nobody Here"]);
});

test("reactions: stored with a weight in the score, a Reaction reason, and unmatched names never stored", () => {
  const r = addReactions(net, { post: "Kolme oppia pilotista", postDate: "2026-10-14", author: "You", text: fx("reactions-linkedin.txt") });
  assert.equal(r.unmatched.length, 2, "Production Manager and Erkki Esimerkki are in no network");
  // "· 2nd" on your own post rules out the Mikko you know: the co-founder's Mikko at Hydroline.
  assert.ok(r.matched.some((x) => x.name === "Mikko Korhonen" && x.person.id === idOf("Mikko Korhonen", "Hydroline") && x.how === "name_degree"));
  const state = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
  const names = state.reactions.map((x: { name: string }) => x.name);
  assert.ok(!names.includes("Erkki Esimerkki") && !JSON.stringify(state).includes("Erkki"), "unmatched names leave no trace");
  // Pasting the same post again stores nothing new.
  assert.equal(addReactions(net, { post: "Kolme oppia pilotista", postDate: "2026-10-14", author: "You", text: fx("reactions-linkedin.txt") }).saved, 0);
  // A second post: 5 points for one post, +2 for the second.
  const second = { post: "Hackathon", postDate: "2026-10-21", contactId: idOf("Laura Mäkelä", "Lunawood"), name: "Laura Mäkelä", at: "2026-10-22T08:00:00Z", how: "name" as const };
  const n2 = build([...state.reactions, second]);
  const laura = n2.byId.get(idOf("Laura Mäkelä", "Lunawood"))!;
  assert.equal(laura.parts.find((p) => p.label === "Reacted")?.points, 7);
  const a = analyse(n2, laura);
  const reasons = a.reasons.filter((x) => x.kind === "reaction");
  assert.equal(reasons.length, 2);
  assert.equal(reasons[0].source, "Reaction");
  assert.match(reasons[1].text, /Reacted to your post "Kolme oppia pilotista" on 14 Oct 2026/);
  // Reactions older than 90 days no longer count.
  const old = build([{ ...second, postDate: "2026-06-01" }]).byId.get(laura.id)!;
  assert.equal(old.parts.find((p) => p.label === "Reacted"), undefined);
});

test("demo: two posts' reactions are seeded out of the box", async () => {
  const { loadDemoWithReactions } = await import("../lib/demo.ts");
  const { loadNetwork } = await import("../lib/network.ts");
  fs.rmSync(path.join(dir, "state.json"), { force: true });
  await loadDemoWithReactions();
  const demo = await loadNetwork();
  const reacted = demo.contacts.filter((c) => c.reactions.length);
  assert.ok(reacted.length >= 35, `reacted: ${reacted.length}`);
  assert.ok(reacted.some((c) => c.reactions.length === 2), "some reacted to both posts");
  assert.ok(reacted.some((c) => c.fit), "some who fit reacted");
  assert.equal(new Set(demo.contacts.flatMap((c) => c.reactions.map((r) => r.post))).size, 2);
});
