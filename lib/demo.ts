// The demo in one call: the three invented networks, two posts' worth of
// pasted reactions (data/demo/reactions), so the reactions show out of the
// box, the large groups the demo team marks as not a target, and two of the
// demo team's own status records (a follow-up due, a colleague contacted).
import fs from "node:fs";
import path from "node:path";
import { loadDemo, type Owner } from "./store.ts";
import { loadNetwork } from "./network.ts";
import { addReactions } from "./queries.ts";
import { getProfile, readState, setProfile, setStatus, type StatusChange } from "./state.ts";

const demoDir = () => process.env.DEMO_DIR || path.join(process.cwd(), "data", "demo");

export async function seedDemoReactions(): Promise<number> {
  let saved = 0;
  try {
    const dir = path.join(demoDir(), "reactions");
    const posts = JSON.parse(fs.readFileSync(path.join(dir, "posts.json"), "utf8")) as { file: string; label: string; date: string; author: string }[];
    for (const p of posts) {
      const net = await loadNetwork();
      saved += addReactions(net, { post: p.label, postDate: p.date, author: p.author, text: fs.readFileSync(path.join(dir, p.file), "utf8") }).saved;
    }
  } catch {
    // No reaction fixtures: the demo works without them.
  }
  return saved;
}

/**
 * Marks the demo's large groups (data/demo/not-targets.json) as "Not a
 * target company", as the team would on each company page. Keeps any the
 * team marked already. Returns how many were added.
 */
export function seedDemoNotTargets(): number {
  let list: { businessId: string; name: string }[] = [];
  try {
    list = JSON.parse(fs.readFileSync(path.join(demoDir(), "not-targets.json"), "utf8")).companies;
  } catch {
    return 0;
  }
  const p = getProfile();
  const have = new Set((p.excluded ?? []).map((x) => x.businessId));
  const add = list.filter((x) => /^\d{7}-\d$/.test(x.businessId) && !have.has(x.businessId));
  if (add.length) setProfile({ ...p, excluded: [...(p.excluded ?? []), ...add.map((x) => ({ businessId: x.businessId, name: x.name }))] });
  return add.length;
}

/**
 * The demo team's status records (data/demo/statuses.json), with their
 * original dates. Someone who already has a status keeps it. Returns how
 * many were added.
 */
export function seedDemoStatuses(): number {
  let list: { id: string; history: StatusChange[] }[] = [];
  try {
    list = JSON.parse(fs.readFileSync(path.join(demoDir(), "statuses.json"), "utf8")).statuses;
  } catch {
    return 0;
  }
  const have = readState().status;
  let added = 0;
  for (const p of list) {
    if (have[p.id] || !p.history?.length) continue;
    for (const h of p.history) setStatus(p.id, h.status, h.by, { at: h.at, note: h.note, until: h.until });
    added++;
  }
  return added;
}

export async function loadDemoWithReactions(): Promise<Owner[]> {
  const owners = loadDemo();
  seedDemoNotTargets();
  seedDemoStatuses();
  await seedDemoReactions();
  return owners;
}
