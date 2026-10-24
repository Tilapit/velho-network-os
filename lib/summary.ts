// Small text helpers shared by pages, so the same fact reads the same way everywhere.
import type { Opportunity } from "./score.ts";
import { RELEVANT_TOPICS, SIGNAL_LABEL } from "./score.ts";
import { daysBetween, today } from "./normalize.ts";
import type { Model } from "./build.ts";

export function relationshipLine(o: Opportunity): string {
  const p = o.person;
  const bits: string[] = [];
  if (p.connected) bits.push(`Connected since ${monthYear(p.connected.value)}`);
  else bits.push("Not connected");
  const last = p.interactions.at(-1);
  if (last) bits.push(`last contact ${ago(last.on)} (${last.channel.replace("_", " ")})`);
  if (!p.connected && p.introPaths[0]) bits.push(`introduction possible via ${p.introPaths[0].viaName}`);
  return bits.join(", ");
}

export function engagementLine(o: Opportunity, model: Model): string {
  const posts = new Map(model.posts.map((x) => [x.id, x]));
  const rel = o.person.engagements.filter((e) => RELEVANT_TOPICS.includes(posts.get(e.postId)?.topic ?? "other"));
  if (!rel.length) return o.person.engagements.length ? "Only engages with posts outside your services" : "No engagement with your posts";
  const c = rel.filter((e) => e.kind === "comment").length;
  const r = rel.length - c;
  const parts = [c ? `${c} comment${c > 1 ? "s" : ""}` : "", r ? `${r} reaction${r > 1 ? "s" : ""}` : ""].filter(Boolean);
  return `${parts.join(" and ")} on posts about your services, latest ${ago(rel.at(-1)!.on)}`;
}

export function lastComment(o: Opportunity): string | undefined {
  return [...o.person.engagements].reverse().find((e) => e.kind === "comment")?.comment;
}

export function whyNowLine(o: Opportunity): string {
  const s = o.signals[0];
  if (!s) return "No company signal";
  return `${SIGNAL_LABEL[s.type]}: ${s.title} (${ago(s.on)})`;
}

export function ago(iso: string): string {
  const d = daysBetween(iso, today());
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${Math.round(d / 30)} months ago`;
  return `${Math.round(d / 365)} year${d >= 730 ? "s" : ""} ago`;
}

export function monthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
