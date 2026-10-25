// What the team decides in the app, in data/state.json: the target profile,
// a status per person, PRH matches picked by hand, reactions pasted in, and
// angles Claude wrote. Nothing here is ever sent anywhere.
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./store.ts";
import { DEFAULT_PROFILE, type Profile } from "./industry.ts";

export type Status = "none" | "to_contact" | "sent" | "replied" | "meeting" | "not_fit" | "snoozed";

export const STATUSES: { id: Status; label: string }[] = [
  { id: "to_contact", label: "To contact" },
  { id: "sent", label: "Sent" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "not_fit", label: "Not a fit" },
  { id: "snoozed", label: "Snoozed" },
];
export const STATUS_LABEL: Record<Status, string> = { none: "No status", ...Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) } as Record<Status, string>;

/** `until`: the day a snooze ends (YYYY-MM-DD). `note`: the team's own words, kept only here. */
export type StatusChange = { status: Status; at: string; by: string; note?: string; until?: string };
export type StatusEntry = StatusChange & { history: StatusChange[] };
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
  /** Business IDs from not-targets.json already added to the profile once, so one the team removes stays removed. */
  notTargetsApplied?: string[];
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

const notTargetsFile = () => path.join(process.env.DEMO_DIR || path.join(process.cwd(), "data", "demo"), "not-targets.json");

/** The large groups that are not the Finnish SMEs Velho is after (data/demo/not-targets.json). */
export function notTargetList(): { businessId: string; name: string }[] {
  try {
    const list = JSON.parse(fs.readFileSync(notTargetsFile(), "utf8")).companies as { businessId: string; name: string }[];
    return list.filter((x) => /^\d{7}-\d$/.test(x?.businessId ?? ""));
  } catch {
    return [];
  }
}

/**
 * Marks the listed companies as "Not a target company" in every data folder,
 * as the team would on each company page. Each one is added once: one the
 * team takes off the list stays off. `force` (the demo load) adds every one
 * that is missing. Returns how many were added.
 */
export function applyNotTargets(opts: { force?: boolean } = {}): number {
  const list = notTargetList();
  const s = readState();
  const applied = new Set(s.notTargetsApplied ?? []);
  const have = new Set((s.profile ?? DEFAULT_PROFILE).excluded?.map((x) => x.businessId) ?? []);
  const add = list.filter((x) => !have.has(x.businessId) && (opts.force || !applied.has(x.businessId)));
  const fresh = list.filter((x) => !applied.has(x.businessId));
  if (!add.length && !fresh.length) return 0;
  update((st) => {
    const p = st.profile ?? DEFAULT_PROFILE;
    if (add.length) st.profile = { ...p, excluded: [...(p.excluded ?? []), ...add.map((x) => ({ businessId: x.businessId, name: x.name }))] };
    st.notTargetsApplied = [...new Set([...(st.notTargetsApplied ?? []), ...list.map((x) => x.businessId)])];
  });
  return add.length;
}

export function setStatus(contactId: string, status: Status, by: string, extra: { note?: string; until?: string; at?: string } = {}) {
  const change: StatusChange = { status, at: extra.at ?? new Date().toISOString(), by, ...(extra.note ? { note: extra.note } : {}), ...(extra.until ? { until: extra.until } : {}) };
  update((s) => {
    const prev = s.status[contactId];
    const history = [...(prev?.history ?? []), change];
    if (status === "none") delete s.status[contactId];
    else s.status[contactId] = { ...change, history };
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
