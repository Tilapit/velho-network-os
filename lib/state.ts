// The founder's decisions on suggested actions. Nothing is ever sent from the
// app: "approved" means the founder has signed off the draft and will send it
// themselves.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./engine.ts";

export type Decision = {
  personId: string;
  status: "approved" | "saved" | "dismissed";
  actionType: string;
  draft: string;
  at: string;
};

const FILE = path.join(DATA_DIR, "state.json");

export function readDecisions(): Record<string, Decision> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export function writeDecision(d: Decision) {
  const all = readDecisions();
  all[d.personId] = d;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export function clearDecision(personId: string) {
  const all = readDecisions();
  delete all[personId];
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}
