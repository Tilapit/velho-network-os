// The analysis of one person: reasons with their source, what we don't know,
// fit, approach and a possible angle. Every sentence is built from facts in
// the model; nothing here is guessed.
import type { Provenance } from "./types.ts";
import { GROUP, ruleLabel, type GroupId } from "./industry.ts";
import type { Area } from "./roles.ts";
import { SIGNAL_TYPES } from "./signals.ts";
import { ytjUrl } from "./prh.ts";
import { STATUS_LABEL, type Status } from "./state.ts";
import type { Approach, Contact, Fit, Network } from "./network.ts";

export type Pill = "LinkedIn title" | "PRH" | "PRH notices" | "Your network" | "LinkedIn" | "Your team" | "Pasted reactions";

export type Reason = { kind: "role" | "company" | "signal" | "network" | "team" | "reaction"; label: string; text: string; source: Pill; provenance: Provenance; link?: string };
export type MissingFact = { label: string; text: string };

export type Analysis = {
  id: string;
  name: string;
  firstName: string;
  url: string;
  title: string;
  company: {
    id: string | null;
    name: string;
    raw: string;
    businessId?: string;
    link?: string;
    industry?: string;
    tol?: string;
    town?: string;
    group: GroupId;
    groupLabel: string;
    matchStatus: string;
    matchNote: string;
  };
  fit: Fit | null;
  fitLabel: string;
  fitWhy: string;
  approach: Approach;
  approachLabel: string;
  approachWhy: string;
  knownBy: { owner: string; ownerName: string; connectedOn: string }[];
  sender: { ownerName: string; connectedOn: string; why: string };
  reasons: Reason[];
  missing: MissingFact[];
  angle: { text: string; by: "template" | "claude"; note: string };
  score: number;
  parts: { label: string; points: number; why: string }[];
  status: Status;
  statusLabel: string;
  statusBy?: string;
  statusAt?: string;
};

export const FIT_LABEL: Record<Fit, string> = { strong: "Strong fit", possible: "Possible fit" };
export const APPROACH_LABEL: Record<Approach, string> = { direct: "Talk directly", ask_intro: "Ask for an intro", skip: "Skip for now" };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso?: string) => (iso ? `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");

/** "Oy Lunawood Ltd" -> "Lunawood" for running text. */
export function shortName(n: string): string {
  let s = n.replace(/^(Oy|Ab)\s+/, "");
  while (/\s+(Oyj|Oy|Ab|Abp|Ltd|Plc|Ltd\.)$/.test(s)) s = s.replace(/\s+(Oyj|Oy|Ab|Abp|Ltd|Plc|Ltd\.)$/, "");
  return s.replace(/,$/, "").trim() || n;
}

const lc = (s?: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");

// What Velho could help with, by industry and by the person's area. Templates, labelled Inferred.
const USE: Record<GroupId, string> = {
  metal: "production planning, quoting and maintenance data",
  electrical: "test data, quality reporting and product documentation",
  plastics: "process data, quality deviations and production scheduling",
  food: "production planning, batch records and quality checks",
  wood: "production planning, order handling and delivery estimates",
  construction: "site reporting, procurement and cost tracking",
  logistics: "capacity planning, order handling and customer updates",
  maritime: "project planning, technical documentation and maintenance records",
  wholesale: "order handling, product data and demand forecasting",
  other_industrial: "operational reporting and planning",
  other: "reporting and routine office work",
  not_matched: "routine work around their systems",
  abroad: "routine work around their systems",
};
const AREA_USE: Partial<Record<Area, string>> = {
  finance: "reporting, invoicing and ERP data",
  technology: "connecting their systems and putting production data to use",
  sales: "quoting and order handling",
  people: "onboarding and work instructions",
  quality: "quality records and deviation reports",
};

export function templateAngle(c: Contact, companyName: string, industry?: string): string {
  const use = AREA_USE[c.role.area] ?? USE[c.group];
  const first = c.name.split(" ")[0];
  const where = industry ? `${companyName} works in ${lc(industry)}` : `${companyName} is in ${lc(GROUP[c.group].label)}`;
  return `${where}; as ${c.position || "a decision-maker"}, ${first} could be open to using AI for ${use}.`;
}

export function analyse(net: Network, c: Contact): Analysis {
  const prh = c.match && !c.match.foreign && (c.match.status === "verified" || c.match.status === "inferred") ? c.match.company : undefined;
  const companyName = prh ? shortName(prh.name) : c.company || "No company";
  const co = c.companyId ? net.companies.get(c.companyId) : undefined;
  const reasons: Reason[] = [];
  const missing: MissingFact[] = [];

  // Role, from the LinkedIn title.
  if (c.role.decisionMaker) reasons.push({ kind: "role", label: "Role", text: `"${c.position}". ${c.role.decides}`, source: "LinkedIn title", provenance: "imported" });
  else if (c.position) reasons.push({ kind: "role", label: "Role", text: `"${c.position}". The title does not say they decide; they could introduce you to someone who does.`, source: "LinkedIn title", provenance: "imported" });

  // Company, from PRH.
  if (prh) {
    const inProfile = c.rule ? ` In your profile: ${ruleLabel(c.rule)}${c.rule.lowerPriority ? ", lower priority" : ""}.` : " Not in your target industries.";
    const check = c.match!.status === "inferred" ? ` Matched "${c.company}" by a close name: check it.` : "";
    reasons.push({
      kind: "company",
      label: "Company",
      text: `${prh.name}: ${prh.industry ?? "line of business not given"}${prh.tol ? ` (TOL ${prh.tol})` : ""}${prh.town ? `, ${prh.town.charAt(0)}${prh.town.slice(1).toLowerCase()}` : ""}.${inProfile}${check}`,
      source: "PRH",
      provenance: c.match!.status === "verified" ? "verified" : "inferred",
      link: ytjUrl(prh.businessId),
    });
  }

  // Registered changes in the last 90 days.
  const byType = new Map<string, (typeof c.signals)[number]>();
  for (const s of c.signals) if (!byType.has(s.type) || byType.get(s.type)!.date < s.date) byType.set(s.type, s);
  for (const s of [...byType.values()].sort((a, b) => SIGNAL_TYPES[b.type].weight - SIGNAL_TYPES[a.type].weight || b.date.localeCompare(a.date))) {
    reasons.push({ kind: "signal", label: "Registered change", text: `${SIGNAL_TYPES[s.type].label}: registered ${fmtDate(s.date)} (notice ${s.recordNumber}).`, source: "PRH notices", provenance: "verified", link: ytjUrl(s.businessId) });
  }

  // Network: colleagues, or when they connected.
  if (c.colleagues && co) {
    const others = co.contactIds.filter((id) => id !== c.id).map((id) => net.byId.get(id)!).sort((a, b) => b.score - a.score);
    const names = others.slice(0, 3).map((o) => `${o.name}${o.position ? ` (${o.position})` : ""}`).join(", ");
    reasons.push({ kind: "network", label: "Network", text: `${c.colleagues} other connection${c.colleagues > 1 ? "s" : ""} at ${companyName}: ${names}${others.length > 3 ? ", …" : ""}.`, source: "Your network", provenance: "imported" });
  } else {
    reasons.push({ kind: "network", label: "Connected", text: `${c.sender.ownerName} connected on ${fmtDate(c.sender.connectedOn)}. No one else the team knows works there.`, source: "LinkedIn", provenance: "imported" });
  }

  // Who in the team knows them.
  if (c.knownBy.length > 1) {
    const list = c.knownBy.map((k) => `${k.ownerName} (${fmtDate(k.connectedOn)})`).join(", ");
    reasons.push({ kind: "team", label: "Team", text: `Known by ${list}.`, source: "Your team", provenance: "verified" });
  }
  for (const r of c.reactions) reasons.push({ kind: "reaction", label: "Reacted", text: `Reacted to "${r.post}" (pasted ${fmtDate(r.at.slice(0, 10))}, matched by name).`, source: "Pasted reactions", provenance: "inferred" });

  // What we don't know.
  missing.push({
    label: "Headcount",
    text: prh?.formCode === "17" ? "Not in PRH open data. It is a public limited company (Oyj, PRH), which is often a large group: check the size." : "Not in PRH open data. Check the size before you reach out.",
  });
  if (!c.position) missing.push({ label: "Title", text: "Empty in the LinkedIn export." });
  if (c.match?.status === "inferred" && !c.match.foreign) missing.push({ label: "Company match", text: `Close name only ("${c.company}"). Confirm it under Settings → PRH matches.` });
  if (!prh && c.company) missing.push({ label: "Company", text: c.match?.foreign ? "Not a Finnish company, so PRH has nothing on it." : c.match?.status === "pending" ? "Not looked up in PRH yet." : `"${c.company}" has no single match in PRH. ${c.match?.note ?? ""}`.trim() });
  if (!c.company) missing.push({ label: "Company", text: "Empty in the LinkedIn export." });
  missing.push({ label: "Current role", text: `The export shows the title on the day it was downloaded (${c.knownBy.map((k) => k.ownerName).join(", ")}).` });

  const excluded = prh && net.profile.excluded?.some((x) => x.businessId === prh.businessId);
  const fitWhy = !c.fit
    ? excluded
      ? "The team marked this company as not a target."
      : !c.rule
      ? "Not at a company in your target industries."
      : "Works at a target company, but the title is not a decision-maker role."
    : c.fit === "strong"
      ? `Senior ${c.role.area === "ceo" ? "management" : c.role.area} role at a company in ${ruleLabel(c.rule!)}.`
      : c.rule?.lowerPriority
        ? `Decision-maker, but ${c.rule.label.toLowerCase()} is lower priority in your profile.`
        : c.role.level === "manager"
          ? "Manager-level title: shapes decisions, rarely signs them off."
          : `Decision-maker in ${c.role.area === "other" ? "another area" : c.role.area}, not operations or production.`;
  const approachWhy = c.approach === "direct" ? `${c.sender.ownerName === "You" ? "you write" : `${c.sender.ownerName} writes`} to them.` : c.approach === "ask_intro" ? `Ask ${c.name.split(" ")[0]} who decides on operations at ${companyName}.` : "No reason to reach out yet.";

  return {
    id: c.id,
    name: c.name,
    firstName: c.name.split(" ")[0],
    url: c.url,
    title: c.position,
    company: {
      id: c.companyId,
      name: companyName,
      raw: c.company,
      businessId: prh?.businessId,
      link: prh ? ytjUrl(prh.businessId) : undefined,
      industry: prh?.industry,
      tol: prh?.tol,
      town: prh?.town,
      group: c.group,
      groupLabel: GROUP[c.group].label,
      matchStatus: c.match?.status ?? "none",
      matchNote: c.match?.note ?? "",
    },
    fit: c.fit,
    fitLabel: c.fit ? FIT_LABEL[c.fit] : "Not on the list",
    fitWhy,
    approach: c.approach,
    approachLabel: APPROACH_LABEL[c.approach],
    approachWhy,
    knownBy: c.knownBy.map((k) => ({ owner: k.owner, ownerName: k.ownerName, connectedOn: k.connectedOn })),
    sender: { ownerName: c.sender.ownerName, connectedOn: c.sender.connectedOn, why: "Connected first" },
    reasons,
    missing,
    angle: { text: templateAngle(c, companyName, prh?.industry), by: "template", note: "Written from the facts above only. Check before you use it." },
    score: c.score,
    parts: c.parts,
    status: c.status?.status ?? "none",
    statusLabel: STATUS_LABEL[c.status?.status ?? "none"],
    statusBy: c.status?.by,
    statusAt: c.status?.at,
  };
}
