import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The PRH client against hand-made answers: what a failure looks like, what
// is retried, and that a failed lookup is never silent. No request leaves
// this process; the company is a made-up one in the documented YTJ shape.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vnet-prh-"));
process.env.DATA_DIR = dir;
process.env.PRH_GAP_MS = "0";

const { transport, politeGet, searchYtj, matchCompany, PrhError } = await import("../lib/prh.ts");
const { startMatching, matchingDone } = await import("../lib/matching.ts");

type Reply = { status: number; body: string; headers?: Record<string, string> } | Error;
const sleeps: number[] = [];
transport.sleep = async (ms: number) => void sleeps.push(ms);
/** Answers from `replies` in order (the last one repeats) and counts requests. */
function answer(replies: Reply[]) {
  let calls = 0;
  transport.fetch = async () => {
    const r = replies[Math.min(calls++, replies.length - 1)];
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: (n: string) => r.headers?.[n.toLowerCase()] ?? null }, text: async () => r.body };
  };
  return () => calls;
}

const company = {
  businessId: { value: "1234567-8" },
  names: [{ name: "Esimerkki Viestintä Oy", type: "1", version: 1 }],
  companyForms: [{ type: "16", version: 1, descriptions: [{ languageCode: "3", description: "Limited company" }] }],
  mainBusinessLine: { type: "73300", descriptions: [{ languageCode: "3", description: "Public relations and communication activities" }] },
  registrationDate: "2001-03-19",
  addresses: [{ type: 1, postOffices: [{ city: "HELSINKI", languageCode: "1" }] }],
};
const ok = (companies: unknown[]) => ({ status: 200, body: JSON.stringify({ totalResults: companies.length, companies }) });
const fetchFailed = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });

test("a 200 that is not JSON (a gateway or maintenance page) is retried, then reported as such", async () => {
  const calls = answer([{ status: 200, body: "<html><body>Service temporarily unavailable</body></html>" }]);
  await assert.rejects(politeGet("https://prh.test/a"), (e: unknown) => e instanceof PrhError && e.reason === "not JSON" && /after 5 tries/.test(e.message));
  assert.equal(calls(), 5);
});

test("502, 504 and network errors are retried like 429 and 503", async () => {
  for (const first of [{ status: 502, body: "Bad Gateway" }, { status: 504, body: "" }, fetchFailed]) {
    const calls = answer([first, ok([company])]);
    const raw = (await politeGet("https://prh.test/b")) as { totalResults: number };
    assert.equal(raw.totalResults, 1);
    assert.equal(calls(), 2);
  }
});

test("a 403 fails at once, with the status and the start of the body", async () => {
  const calls = answer([{ status: 403, body: "Forbidden: too many requests" }]);
  await assert.rejects(politeGet("https://prh.test/c"), (e: unknown) => e instanceof PrhError && e.reason === "HTTP 403" && /too many requests/.test(e.message));
  assert.equal(calls(), 1);
});

test("Retry-After is honoured", async () => {
  sleeps.length = 0;
  answer([{ status: 429, body: "", headers: { "retry-after": "7" } }, ok([company])]);
  await politeGet("https://prh.test/d");
  assert.ok(sleeps.includes(7000));
});

test("odd fields in a company (not lists, nulls) never fail the search", async () => {
  answer([ok([{ ...company, companySituations: null, addresses: { type: 1 }, companyForms: "16" }, null, "x"])]);
  const r = await searchYtj("Esimerkki Viestintä shape");
  assert.equal(r?.companies.length, 1);
  assert.equal(r?.companies[0].name, "Esimerkki Viestintä Oy");
  assert.deepEqual(r?.companies[0].situations, []);
});

test("a failed lookup is not cached, so the next run asks again", async () => {
  answer([{ status: 403, body: "" }]);
  await assert.rejects(matchCompany("Esimerkki Viestintä"));
  answer([ok([company])]);
  assert.equal((await matchCompany("Esimerkki Viestintä")).status, "verified");
});

test("the background job counts failures by reason, with example names", async () => {
  answer([{ status: 200, body: "<html>maintenance</html>" }]);
  startMatching(["Esimerkki Yksi", "Esimerkki Kaksi", "Esimerkki Kolme"]);
  const job = await matchingDone();
  assert.equal(job.failed, 3);
  assert.equal(job.failures["not JSON"].count, 3);
  assert.deepEqual([...job.failures["not JSON"].examples].sort(), ["Esimerkki Kaksi", "Esimerkki Kolme", "Esimerkki Yksi"]);
});
