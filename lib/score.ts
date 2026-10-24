// Deterministic opportunity score. Every point comes with a reason and the
// record it came from. The score is a prioritisation heuristic, not a
// probability of buying.
import type { Company, Person, Provenance, Signal, SourceRef, Topic } from "./types.ts";
import { daysBetween, isDecisionMaker, today } from "./normalize.ts";
import type { Model } from "./build.ts";

export const RELEVANT_TOPICS: Topic[] = ["legacy-systems", "ai-automation", "operations"];
export const TOPIC_LABEL: Record<Topic, string> = {
  "legacy-systems": "Legacy systems",
  "ai-automation": "AI automation",
  operations: "Operations",
  hiring: "Hiring",
  "founder-journey": "Founder journey",
  "ai-news": "AI news",
  other: "Other",
};

export type Reason = { text: string; points: number; provenance: Provenance; source?: SourceRef };
export type Part = { key: "relationship" | "engagement" | "fit" | "timing"; label: string; points: number; max: number; reasons: Reason[] };

export type Status = "recommend" | "hold" | "customer" | "low";

export type Opportunity = {
  person: Person;
  company?: Company;
  total: number;
  parts: Part[];
  status: Status;
  statusReason?: string;
  confidence: "high" | "medium" | "low";
  missing: string[];
  signals: Signal[];
};

export const SIGNAL_WEIGHT: Record<Signal["type"], number> = {
  erp_modernization: 15,
  expansion: 12,
  new_business_unit: 10,
  operational_hiring: 9,
  funding: 8,
  acquisition: 8,
  leadership_change: 6,
  new_product: 5,
};

export const SIGNAL_LABEL: Record<Signal["type"], string> = {
  erp_modernization: "ERP or systems modernisation",
  expansion: "Expansion",
  new_business_unit: "New business unit",
  operational_hiring: "Operational hiring",
  funding: "Funding",
  acquisition: "Acquisition",
  leadership_change: "Leadership change",
  new_product: "New product",
};

const cap = (n: number, max: number) => Math.min(max, Math.round(n * 10) / 10);

export function scorePerson(p: Person, model: Model, now = today()): Opportunity {
  const company = p.companyId ? model.companies.get(p.companyId) : undefined;
  const posts = new Map(model.posts.map((x) => [x.id, x]));
  const missing: string[] = [];

  // Relationship
  const rel: Reason[] = [];
  if (p.connected) rel.push({ text: `Connected on LinkedIn since ${p.connected.value}`, points: 10, provenance: "verified", source: p.connected.source });
  const met = [...p.interactions].reverse().find((i) => ["meeting", "event", "call"].includes(i.channel) && i.gotReply);
  if (met) {
    const age = daysBetween(met.on, now);
    rel.push({ text: `${met.channel === "event" ? "Met at an event" : "Spoke"} ${age} days ago: ${met.summary}`, points: age <= 365 ? 10 : 5, provenance: "imported", source: met.source });
  }
  const twoWay = [...p.interactions].reverse().find((i) => i.direction === "inbound" && daysBetween(i.on, now) <= 180);
  if (twoWay) rel.push({ text: `Replied to you ${daysBetween(twoWay.on, now)} days ago: ${twoWay.summary}`, points: 8, provenance: "imported", source: twoWay.source });
  for (const path of p.introPaths) {
    rel.push({ text: `Introduction possible via ${path.viaName}: ${path.statement}`, points: p.connected ? 4 : 12, provenance: path.provenance, source: path.source });
  }
  if (!p.interactions.length) missing.push("No conversation history with you");

  // Engagement
  const eng: Reason[] = [];
  const relevant = p.engagements.filter((e) => RELEVANT_TOPICS.includes(posts.get(e.postId)?.topic ?? "other"));
  const comments = relevant.filter((e) => e.kind === "comment");
  const reactions = relevant.filter((e) => e.kind === "reaction");
  const prov = (e: Person["engagements"][number]): Provenance => (e.matchBasis === "profile-url" ? "verified" : e.matchBasis === "name-and-company" ? "inferred" : "imported");
  comments.slice(-2).forEach((e) =>
    eng.push({ text: `Commented on "${posts.get(e.postId)?.title}": "${e.comment}"`, points: 7, provenance: prov(e), source: e.source }),
  );
  reactions.slice(-3).forEach((e) =>
    eng.push({ text: `Reacted (${e.reaction || "like"}) to "${posts.get(e.postId)?.title}"`, points: 3, provenance: prov(e), source: e.source }),
  );
  if (relevant.length >= 3) eng.push({ text: `${relevant.length} engagements on posts about your services`, points: 4, provenance: "inferred" });
  const other = p.engagements.length - relevant.length;
  if (other > 0) eng.push({ text: `${other} reaction${other > 1 ? "s" : ""} on posts outside your services (hiring, news, founder story)`, points: Math.min(1, other * 0.5), provenance: "inferred" });
  const lastRelevant = relevant.at(-1);
  let engFactor = 1;
  if (lastRelevant && daysBetween(lastRelevant.on, now) > 120) {
    engFactor = 0.5;
    eng.push({ text: `Last relevant engagement was ${daysBetween(lastRelevant.on, now)} days ago, so engagement counts half`, points: 0, provenance: "inferred" });
  }

  // Company fit
  const fit: Reason[] = [];
  const emp = company?.employees;
  if (emp) {
    const inRange = emp.value >= 20 && emp.value <= 300;
    fit.push({ text: `${emp.value} employees${inRange ? ", inside your 20–300 range" : ", outside your 20–300 range"} (${emp.note})`, points: inRange ? 10 : 0, provenance: emp.provenance, source: emp.source });
  } else missing.push("Company size unknown");
  const phys = company?.physicalOperations;
  if (phys?.value) fit.push({ text: `${company?.industry?.value ?? "Industry"}: physical, operational business (${phys.note})`, points: 8, provenance: phys.provenance, source: phys.source });
  else if (phys && !phys.value) fit.push({ text: `${company?.industry?.value ?? "Industry"}: not an operational business`, points: 0, provenance: phys.provenance, source: phys.source });
  else missing.push("Industry unknown");
  if (p.role) {
    const dm = isDecisionMaker(p.role);
    fit.push({ text: dm ? `${p.role}: a decision-maker` : `${p.role}: probably not the budget owner`, points: dm ? 7 : 0, provenance: p.connected ? "verified" : "inferred" });
  } else missing.push("Role unknown");

  // Timing
  const tim: Reason[] = [];
  const signals = model.signals.filter((s) => s.companyId === p.companyId).sort((a, b) => b.on.localeCompare(a.on));
  signals.forEach((s, i) => {
    const age = daysBetween(s.on, now);
    let w = SIGNAL_WEIGHT[s.type];
    if (s.type === "leadership_change" && s.person && s.person === p.name) w = 12;
    const decay = age <= 60 ? 1 : age <= 120 ? 0.6 : 0.3;
    const pts = i === 0 ? w * decay : 3 * decay;
    tim.push({ text: `${SIGNAL_LABEL[s.type]}, ${age} days ago: ${s.title} (${s.sourceName})`, points: Math.round(pts * 10) / 10, provenance: "imported", source: s.source });
  });
  if (!signals.length) missing.push("No company signal from the pipeline");

  const sum = (r: Reason[]) => r.reduce((a, b) => a + b.points, 0);
  const parts: Part[] = [
    { key: "relationship", label: "Relationship", max: 35, reasons: rel, points: cap(sum(rel), 35) },
    { key: "engagement", label: "Engagement", max: 25, reasons: eng, points: cap(sum(eng) * engFactor, 25) },
    { key: "fit", label: "Company fit", max: 25, reasons: fit, points: cap(sum(fit), 25) },
    { key: "timing", label: "Timing", max: 15, reasons: tim, points: cap(sum(tim), 15) },
  ];
  const total = Math.round(parts.reduce((a, b) => a + b.points, 0));

  // Status: when not to recommend outreach.
  let status: Status = "recommend";
  let statusReason: string | undefined;
  const outbound = p.interactions.filter((i) => i.direction === "outbound");
  const lastInbound = [...p.interactions].reverse().find((i) => i.direction !== "outbound" && i.gotReply);
  const unanswered = outbound.filter((i) => !i.gotReply && (!lastInbound || i.on > lastInbound.on));
  if (p.isCustomerContact || company?.customer?.status === "current") {
    status = "customer";
    statusReason = "Already a customer. Shown as a connector for introductions, not as a prospect.";
  } else if (unanswered.length >= 2) {
    status = "hold";
    statusReason = `You have reached out ${unanswered.length} times since ${unanswered[0].on} without a reply. Wait for them to engage first.`;
  } else if (total < 35) {
    status = "low";
    statusReason = "Not enough evidence for a credible reason to reach out.";
  }

  const identityStrong = !!p.connected || p.engagements.some((e) => e.matchBasis === "profile-url");
  const fitKnown = [emp, phys, p.role].filter(Boolean).length;
  const confidence = identityStrong && fitKnown === 3 ? "high" : identityStrong || fitKnown >= 2 ? "medium" : "low";

  return { person: p, company, total, parts, status, statusReason, confidence, missing, signals };
}

export function rankAll(model: Model, now = today()): Opportunity[] {
  return model.people.map((p) => scorePerson(p, model, now)).sort((a, b) => b.total - a.total);
}

/** "Who should I talk to this week?": at most five, never a hold, never a customer. */
export function thisWeek(all: Opportunity[], n = 5): Opportunity[] {
  return all.filter((o) => o.status === "recommend").slice(0, n);
}
