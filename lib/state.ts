// What the team decides in the app, in data/state.json: the target profile,
// a status per person, PRH matches picked by hand, reactions pasted in, and
// angles Claude wrote. Nothing here is ever sent anywhere.
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./store.ts";
import { DEFAULT_PROFILE, type Profile } from "./industry.ts";

export type Status = "none" | "to_contact" | "sent" | "replied" | "meeting" | "not_fit";

export const STATUSES: { id: Status; label: string }[] = [
  { id: "to_contact", label: "To contact" },
  { id: "sent", label: "Sent" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "not_fit", label: "Not a fit" },
];
export const STATUS_LABEL: Record<Status, string> = { none: "No status", ...Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) } as Record<Status, string>;

export type StatusEntry = { status: Status; at: string; by: string; history: { status: Status; at: string; by: string }[] };
/** Keyed by the matcher's loose company key, so every spelling of a name follows the pick. */
export type Override = { name: string; businessId?: string; notFinnish?: boolean; at: string };
/**
 * Someone reacted to a teammate's post. `how` says how the pasted name was
 * matched: by name alone, name plus the company in their headline, name plus
 * the degree marker, or picked by a teammate in the review.
 */
export type Reaction = { post: string; postDate?: string; author?: string; contactId: string; name: string; at: string; how?: "name" | "name_company" | "name_degree" | "picked" };
export type Angle = { text: string; at: string; model: string };

export type State = {
  version: 2;
  profile?: Profile;
  status: Record<string, StatusEntry>;
  overrides: Record<string, Override>;
  reactions: Reaction[];
  angles: Record<string, Angle>;
};

const file = () => path.join(dataDir(), "state.json");
const empty = (): State => ({ version: 2, status: {}, overrides: {}, reactions: [], angles: {} });

export function readState(): State {
  try {
    const s = JSON.parse(fs.readFileSync(file(), "utf8"));
    // Files from the earlier prototype have another shape; start fresh.
    if (s?.version !== 2) return empty();
    return { ...empty(), ...s };
  } catch {
    return empty();
  }
}

export function stateSignature(): string {
  try {
    return String(fs.statSync(file()).mtimeMs);
  } catch {
    return "-";
  }
}

function update(fn: (s: State) => void): State {
  const s = readState();
  fn(s);
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(s, null, 2));
  return s;
}

export function getProfile(): Profile {
  return readState().profile ?? DEFAULT_PROFILE;
}

export function setProfile(p: Profile) {
  update((s) => {
    s.profile = p;
  });
}

export function setStatus(contactId: string, status: Status, by: string) {
  const at = new Date().toISOString();
  update((s) => {
    const prev = s.status[contactId];
    const history = [...(prev?.history ?? []), { status, at, by }];
    if (status === "none") delete s.status[contactId];
    else s.status[contactId] = { status, at, by, history };
  });
}

export function setOverride(key: string, o: Omit<Override, "at"> | null) {
  update((s) => {
    if (!o) delete s.overrides[key];
    else s.overrides[key] = { ...o, at: new Date().toISOString() };
  });
}

const postKey = (r: Pick<Reaction, "post" | "postDate">) => `${r.post}|${r.postDate ?? ""}`;

/** Stores reactions; the same person on the same post is stored once. Returns how many were new. */
export function addReactionRows(rows: Reaction[]): number {
  let added = 0;
  update((s) => {
    const seen = new Set(s.reactions.map((r) => `${postKey(r)}|${r.contactId}`));
    for (const r of rows) {
      const k = `${postKey(r)}|${r.contactId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      s.reactions.push(r);
      added++;
    }
  });
  return added;
}

export type Post = { post: string; postDate?: string; author?: string; people: number; at: string };

/** The posts reactions were pasted for, newest first. */
export function listPosts(state: State = readState()): Post[] {
  const m = new Map<string, Post>();
  for (const r of state.reactions) {
    const p = m.get(postKey(r)) ?? { post: r.post, postDate: r.postDate, author: r.author, people: 0, at: r.at };
    p.people++;
    m.set(postKey(r), p);
  }
  return [...m.values()].sort((a, b) => (b.postDate ?? b.at).localeCompare(a.postDate ?? a.at));
}

export function deletePost(post: string, postDate?: string) {
  update((s) => {
    s.reactions = s.reactions.filter((r) => postKey(r) !== postKey({ post, postDate }));
  });
}

export function saveAngle(contactId: string, a: Angle) {
  update((s) => {
    s.angles[contactId] = a;
  });
}

/** After an owner is deleted: drop decisions about people no longer in any network. */
export function pruneState(keep: Set<string>) {
  update((s) => {
    for (const id of Object.keys(s.status)) if (!keep.has(id)) delete s.status[id];
    for (const id of Object.keys(s.angles)) if (!keep.has(id)) delete s.angles[id];
    s.reactions = s.reactions.filter((r) => keep.has(r.contactId));
  });
}
