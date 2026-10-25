// The demo in one call: the three invented networks, two posts' worth of
// pasted reactions (data/demo/reactions), so the reactions show out of the
// box, and the large groups the demo team marks as not a target.
import fs from "node:fs";
import path from "node:path";
import { loadDemo, type Owner } from "./store.ts";
import { loadNetwork } from "./network.ts";
import { addReactions } from "./queries.ts";
import { getProfile, setProfile } from "./state.ts";

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

export async function loadDemoWithReactions(): Promise<Owner[]> {
  const owners = loadDemo();
  seedDemoNotTargets();
  await seedDemoReactions();
  return owners;
}
