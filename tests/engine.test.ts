import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Run against a throwaway copy of the demo data with a fixed date.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vnos-"));
fs.cpSync(path.join(process.cwd(), "data/demo"), path.join(dir, "demo"), { recursive: true });
process.env.DATA_DIR = dir;
process.env.APP_TODAY = "2026-10-24";

const { loadModel } = await import("../lib/engine.ts");
const { thisWeek } = await import("../lib/score.ts");
const { nextAction, safeguards } = await import("../lib/recommend.ts");
const { parseConnections } = await import("../lib/ingest.ts");
const { companyKey, isoDate } = await import("../lib/normalize.ts");

const { model, ranked } = loadModel();
const byName = (n: string) => ranked.find((o) => o.person.name === n)!;

test("LinkedIn export: preamble skipped, dates parsed", () => {
  const text = fs.readFileSync(path.join(dir, "demo/Connections.csv"), "utf8");
  const { records, report } = parseConnections(text);
  assert.equal(records.length, 57);
  assert.equal(report.warnings.length, 0);
  assert.equal(isoDate("12 Apr 2026"), "2026-04-12");
});

test("company names normalise", () => {
  assert.equal(companyKey("Rautio Industrial Oy"), companyKey("Rautio Industrial"));
  assert.notEqual(companyKey("Pohjola Pumps Oy"), companyKey("Pohjoinen Ventures"));
});

test("engagement matched by profile URL is verified, name-only is never merged", () => {
  const kaisa = byName("Kaisa Rinne");
  assert.equal(kaisa.person.engagements.length, 3);
  assert.ok(kaisa.person.engagements.every((e) => e.matchBasis === "profile-url"));
  const lauras = model.people.filter((p) => p.name === "Laura Niemi");
  assert.equal(lauras.length, 2, "two different Laura Niemis stay separate");
  assert.ok(lauras.every((p) => p.possibleMatches.length === 1));
});

test("this week: top five, no holds, no customers", () => {
  const week = thisWeek(ranked);
  assert.equal(week.length, 5);
  assert.equal(week[0].person.name, "Kaisa Rinne");
  assert.ok(week.every((o) => o.status === "recommend"));
  assert.ok(!week.some((o) => o.person.name === "Sami Lehto"));
  assert.ok(!week.some((o) => o.person.name === "Jari Koski"));
});

test("three unanswered messages put a contact on hold", () => {
  const sami = byName("Sami Lehto");
  assert.equal(sami.status, "hold");
  assert.equal(nextAction(sami, model).type, "hold");
});

test("intro path via a customer becomes an intro ask to the customer", () => {
  const antti = byName("Antti Laine");
  const a = nextAction(antti, model);
  assert.equal(a.type, "intro");
  assert.equal(a.recipient, "Jari Koski");
});

test("score is the sum of its parts and every point has a reason", () => {
  for (const o of ranked.slice(0, 10)) {
    const sum = Math.round(o.parts.reduce((s, p) => s + p.points, 0));
    assert.equal(o.total, sum);
    for (const p of o.parts) if (p.points > 0) assert.ok(p.reasons.length > 0, `${o.person.name} ${p.key}`);
  }
});

test("safeguards flag a draft that mentions reactions", () => {
  const o = byName("Mikko Salo");
  const checks = safeguards(o, "Hi Mikko, I saw you liked my post. Want to talk?");
  assert.equal(checks[1].ok, false);
});

test("print ranking", () => {
  for (const o of ranked.slice(0, 12)) console.log(o.total, o.status, o.person.name, "|", o.parts.map((p) => `${p.key}:${p.points}`).join(" "), "|", nextAction(o, model).type);
});
