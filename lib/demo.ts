// The demo in one call: the three invented networks plus two posts' worth of
// pasted reactions (data/demo/reactions), so the reactions show out of the box.
import fs from "node:fs";
import path from "node:path";
import { loadDemo, type Owner } from "./store.ts";
import { loadNetwork } from "./network.ts";
import { addReactions } from "./queries.ts";

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

export async function loadDemoWithReactions(): Promise<Owner[]> {
  const owners = loadDemo();
  await seedDemoReactions();
  return owners;
}
