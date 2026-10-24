// Compact data for the network drawing: one small object per contact.
import { GROUPS, ruleLabel } from "./industry.ts";
import { contactsFor, type Network } from "./network.ts";

export function drawingData(net: Network) {
  const gIndex = new Map(GROUPS.map((g, i) => [g.id, i]));
  const oIndex = new Map(net.owners.map((o, i) => [o.id, i]));
  const nodes = contactsFor(net).map((c) => ({
    id: c.id,
    n: c.name,
    t: c.position,
    c: c.match?.company && !c.match.foreign && (c.match.status === "verified" || c.match.status === "inferred") ? c.match.company.name : c.company,
    g: gIndex.get(c.group)!,
    f: (c.fit === "strong" ? 2 : c.fit === "possible" ? 1 : 0) as 0 | 1 | 2,
    dm: c.role.decisionMaker,
    k: c.knownBy.reduce((m, k) => m | (1 << (oIndex.get(k.owner) ?? 0)), 0),
    s: c.score,
    sig: c.signals.length > 0,
    ip: !!c.rule,
    nf: c.status?.status === "not_fit",
    rx: c.reactions.length,
    co: c.companyId ?? "",
    via: c.knownBy.map((k) => k.ownerName),
    st: c.status?.status ?? "none",
  }));
  return {
    nodes,
    groups: GROUPS.map((g) => ({ id: g.id, label: g.label, short: g.short, grey: !!g.grey })),
    owners: net.owners.map((o) => ({ id: o.id, name: o.name })),
    chips: net.profile.industries.map((r) => `${ruleLabel(r)}${r.lowerPriority ? " (lower)" : ""}`),
    matched: net.contacts.filter((c) => c.companyId && !c.companyId.startsWith("x-")).length,
    noCompany: net.stats.noCompany,
  };
}
