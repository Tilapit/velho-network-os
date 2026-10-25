// Read and write operations shared by the web app and the MCP server. All
// ranking and filtering is here, in code; an LLM only picks the arguments.
import { analyse, fmtDate, shortName, type Analysis } from "./analysis.ts";
import { GROUP, GROUPS, groupForTol, industryRule, type GroupId } from "./industry.ts";
import { matchTerm } from "./roles.ts";
import { SIGNAL_TYPES, addDays, signalLabel, type CompanySignal, type SignalType } from "./signals.ts";
import { addReactionRows, setStatus, STATUS_LABEL, type Reaction, type Status } from "./state.ts";
import { daysBetween, fold, isoDate } from "./normalize.ts";
import { candidateOf, cleanName, matchReactions, nameKey, postsWithin, readReactions, RECENT_DAYS, type ParsedReaction } from "./reactions.ts";
import { COOLDOWN_DAYS, contactsFor, isOyj, loadNetwork, SNOOZE_DAYS, type Contact, type Fit, type Network } from "./network.ts";
import { ytjUrl } from "./prh.ts";

export const appUrl = (p: string) => `${(process.env.APP_BASE_URL || "http://localhost:3100").replace(/\/$/, "")}${p}`;

/** Resolves an owner given by id or name ("You", "co-founder"). */
export function ownerId(net: Network, owner?: string): string | undefined {
  if (!owner) return undefined;
  const o = fold(owner).toLowerCase().trim();
  return net.owners.find((x) => x.id === o || fold(x.name).toLowerCase() === o)?.id ?? "__none__";
}

/** Accepts group ids ("metal") or labels ("Metal and machinery", "logistics"). */
export function groupIds(list?: string[]): GroupId[] | undefined {
  if (!list?.length) return undefined;
  const out = new Set<GroupId>();
  for (const x of list) {
    const k = fold(x).toLowerCase().trim();
    for (const g of GROUPS) if (g.id === k || fold(g.label).toLowerCase().includes(k) || k.includes(g.id)) out.add(g.id);
  }
  return [...out];
}

export type PersonSummary = {
  id: string;
  name: string;
  title: string;
  company: string;
  businessId?: string;
  group: string;
  fit: Fit | null;
  approach: string;
  score: number;
  reasons: string[];
  knownBy: string[];
  suggestedSender: string;
  signals: string[];
  status: string;
  /** Sent, waiting for a reply: when a follow-up is due. */
  followUp?: string;
  snoozedUntil?: string;
  /** "Colleague contacted 20 Oct (Arttu Lehto)": others at the company rank lower for 30 days. */
  cooldown?: string;
  url: string;
  linkedin: string;
};

export function summary(net: Network, c: Contact): PersonSummary {
  const a = analyse(net, c);
  return {
    id: c.id,
    name: c.name,
    title: c.position,
    company: a.company.name,
    businessId: a.company.businessId,
    group: GROUP[c.group].label,
    fit: c.fit,
    approach: c.approach,
    score: c.score,
    reasons: a.reasons.map((r) => `${r.text} [${r.source}, ${r.provenance}]`),
    knownBy: c.knownBy.map((k) => `${k.ownerName} (${fmtDate(k.connectedOn)})`),
    suggestedSender: c.sender.ownerName,
    signals: [...new Set(c.signals.map((s) => SIGNAL_TYPES[s.type].label))],
    status: STATUS_LABEL[c.status?.status ?? "none"],
    ...(c.outreach.followUpOn ? { followUp: `${c.outreach.followUpDue ? "Due since" : "Due on"} ${fmtDate(c.outreach.followUpOn)}` } : {}),
    ...(c.outreach.until && c.outreach.hidden ? { snoozedUntil: c.outreach.until } : {}),
    ...(c.outreach.cooldown ? { cooldown: cooldownText(c) } : {}),
    url: appUrl(`/people/${c.id}`),
    linkedin: c.url,
  };
}

/** "Colleague contacted 20 Oct (Arttu Lehto)". */
export function cooldownText(c: Contact): string {
  const cd = c.outreach.cooldown;
  return cd ? `Colleague contacted ${dayMonth(cd.on)} (${cd.name})` : "";
}

// ---------- industries ----------

export type IndustryRow = {
  group: GroupId;
  label: string;
  contacts: number;
  decisionMakers: number;
  strong: number;
  possible: number;
  knownByTwo: number;
  companiesWithSignal: number;
  score: number;
  top: PersonSummary[];
};

/** Score per industry: 3 per strong fit, 1 per possible, 2 per fit known by two teammates, 2 per company with a signal. */
export function rankIndustries(net: Network, opts: { owner?: string } = {}): IndustryRow[] {
  const contacts = contactsFor(net, ownerId(net, opts.owner));
  const rows = GROUPS.filter((g) => !g.grey).map((g) => {
    const cs = contacts.filter((c) => c.group === g.id);
    const fits = cs.filter((c) => c.fit && c.status?.status !== "not_fit");
    const companiesWithSignal = new Set(cs.filter((c) => c.signals.length && c.rule).map((c) => c.companyId)).size;
    const strong = fits.filter((c) => c.fit === "strong").length;
    const possible = fits.length - strong;
    const knownByTwo = fits.filter((c) => c.knownBy.length > 1).length;
    return {
      group: g.id,
      label: g.label,
      contacts: cs.length,
      decisionMakers: cs.filter((c) => c.role.decisionMaker).length,
      strong,
      possible,
      knownByTwo,
      companiesWithSignal,
      score: strong * 3 + possible + knownByTwo * 2 + companiesWithSignal * 2,
      top: fits.slice(0, 3).map((c) => summary(net, c)),
    };
  });
  return rows.sort((a, b) => b.score - a.score || b.contacts - a.contacts);
}

// ---------- people ----------

export type PeopleFilter = {
  industries?: string[];
  tol_prefixes?: string[];
  roles?: string[];
  fit?: "strong" | "possible" | "any";
  known_by?: string;
  has_signal?: boolean;
  /** Reacted to a teammate's post in the last 30 days. */
  reacted?: boolean;
  town?: string;
  approach?: string;
  status?: Status;
  /** Also people the team already contacted, snoozed or marked not a fit (for lookups). */
  include_contacted?: boolean;
  limit?: number;
};

export function findPeople(net: Network, f: PeopleFilter = {}): { total: number; people: PersonSummary[] } {
  const groups = groupIds(f.industries);
  const town = f.town ? fold(f.town).toLowerCase() : "";
  let cs = contactsFor(net, ownerId(net, f.known_by));
  cs = cs.filter((c) => {
    // The one rule for recommendations: contacted, snoozed and not-a-fit people stay out unless asked for.
    if (c.outreach.hidden && !f.include_contacted && !f.status) return false;
    if (f.fit === "strong" && c.fit !== "strong") return false;
    if (f.fit === "possible" && c.fit !== "possible") return false;
    if ((!f.fit || f.fit === "any") && !c.fit && !f.roles?.length && !f.approach) return false;
    if (groups && !groups.includes(c.group)) return false;
    if (f.tol_prefixes?.length && !f.tol_prefixes.some((p) => c.match?.company?.tol?.startsWith(p.replace(/\D/g, "")))) return false;
    if (f.roles?.length && !f.roles.some((r) => matchTerm(c.position, r))) return false;
    if (f.has_signal && !c.signals.length) return false;
    if (f.reacted && !postsWithin(c, net.today, RECENT_DAYS)) return false;
    if (town && !fold(c.match?.company?.town ?? "").toLowerCase().includes(town)) return false;
    if (f.approach && c.approach !== f.approach) return false;
    if (f.status && (c.status?.status ?? "none") !== f.status) return false;
    return true;
  });
  return { total: cs.length, people: cs.slice(0, Math.min(f.limit ?? 20, 100)).map((c) => summary(net, c)) };
}

export type ThemePerson = PersonSummary & { themeApproach: "invite" | "ask_intro" | "skip"; why: string };

/** The LLM maps a theme to industries; this only filters and orders. */
export function peopleForTheme(net: Network, args: { theme: string; industries: string[]; roles?: string[]; limit?: number }): { theme: string; industries: string[]; total: number; people: ThemePerson[] } {
  const groups = groupIds(args.industries) ?? [];
  const cs = net.contacts.filter((c) => groups.includes(c.group) && !c.outreach.hidden && (!args.roles?.length || c.role.decisionMaker || args.roles.some((r) => matchTerm(c.position, r))));
  const people = cs
    .map((c) => {
      const inRoles = args.roles?.length ? args.roles.some((r) => matchTerm(c.position, r)) : c.role.decisionMaker;
      const themeApproach: ThemePerson["themeApproach"] = c.rule && inRoles && c.role.decisionMaker ? "invite" : c.rule ? "ask_intro" : "skip";
      const why = themeApproach === "invite" ? `Decision-maker at ${c.match?.company ? shortName(c.match.company.name) : c.company}` : themeApproach === "ask_intro" ? "Works at a target company; can point you to who decides" : "Outside your target industries";
      return { ...summary(net, c), themeApproach, why };
    })
    .filter((p) => p.themeApproach !== "skip")
    .sort((a, b) => (a.themeApproach === b.themeApproach ? Number(!!a.cooldown) - Number(!!b.cooldown) || b.score - a.score : a.themeApproach === "invite" ? -1 : 1));
  return { theme: args.theme, industries: groups.map((g) => GROUP[g].label), total: people.length, people: people.slice(0, Math.min(args.limit ?? 20, 100)) };
}

// ---------- this week ----------

export type WeekPick = PersonSummary & { kind: "signal" | "reaction" | "fit"; why: string; sender: string; prompt: string };

const SHORT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))} ${SHORT_MON[Number(iso.slice(5, 7)) - 1]}`;

/** The prompt "Write in Claude" copies: the user's own Claude, with the connector, writes the message. */
export function claudePrompt(c: Pick<Contact, "name" | "id" | "approach">): string {
  return `Using Velho Network, write a Finnish LinkedIn message to ${c.name} (${c.id}), approach ${c.approach === "ask_intro" ? "ask_intro" : "direct"}.`;
}

/** A registered change as words: "a new managing director", "a demerger". */
function changeText(s: CompanySignal): string {
  if (s.type === "md_change") return "a new managing director";
  if (s.type === "board_change") return "a board change";
  if (s.type === "new_money") return "a share issue or capital increase";
  return `a ${signalLabel(s).toLowerCase()}`;
}

/** One sentence on why this person, this week: what changed at which company and when, a reaction, or the fit alone. */
export function weekWhy(net: Network, c: Contact): { kind: WeekPick["kind"]; why: string } {
  const company = c.match?.company && !c.match.foreign ? shortName(c.match.company.name) : c.company;
  const title = c.position.length > 60 ? `${c.position.slice(0, 59).trim()}…` : c.position;
  const role = title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : "Decision-maker";
  const sig = c.signals.filter((s) => daysBetween(s.date, net.today) <= 30).sort((a, b) => SIGNAL_TYPES[b.type].weight - SIGNAL_TYPES[a.type].weight || b.date.localeCompare(a.date))[0];
  if (sig) return { kind: "signal", why: `${company} registered ${changeText(sig)} on ${dayMonth(sig.date)} (PRH).` };
  const r = c.reactions.filter((x) => daysBetween(x.postDate ?? x.at.slice(0, 10), net.today) <= RECENT_DAYS).sort((a, b) => (b.postDate ?? b.at).localeCompare(a.postDate ?? a.at))[0];
  if (r) {
    const author = r.author ? net.owners.find((o) => o.id === r.author)?.name : undefined;
    return { kind: "reaction", why: `Reacted to ${!author || author === "You" ? "your" : `${author}'s`} post on ${dayMonth(r.postDate ?? r.at.slice(0, 10))}. ${role} at ${company}.` };
  }
  return { kind: "fit", why: `${role} at ${company}. No fresh change or reaction.` };
}

/**
 * Five people for this week, chosen by code. Strong fits always come before
 * possible fits: a possible fit appears only when fewer than five strong ones
 * are left. Within each, people with a registered change or a reaction in the
 * last 30 days first, and anyone whose colleague was contacted in the last 30
 * days last. Contacted, snoozed and not-a-fit people are out (`outreach`). One
 * per company; while it works, at most two per industry and the suggested
 * senders spread across the team. With an owner, only that teammate's network.
 */
export function thisWeek(net: Network, n = 5, owner?: string): WeekPick[] {
  const fresh = (c: Contact) => c.signals.some((s) => daysBetween(s.date, net.today) <= 30);
  const reacted = (c: Contact) => postsWithin(c, net.today, RECENT_DAYS) > 0;
  const timely = (c: Contact) => fresh(c) || reacted(c);
  const cool = (c: Contact) => !!c.outreach.cooldown;
  const week = (c: Contact) => c.score + (fresh(c) ? 12 : 0) + (reacted(c) ? 10 : 0) + (c.fit === "strong" ? 10 : 0);
  // At an equal score, an Oyj (usually a large group) after the rest.
  const order = (a: Contact, b: Contact) => Number(a.fit !== "strong") - Number(b.fit !== "strong") || Number(cool(a)) - Number(cool(b)) || week(b) - week(a) || Number(isOyj(a)) - Number(isOyj(b)) || a.name.localeCompare(b.name, "fi");
  const pool = contactsFor(net, ownerId(net, owner))
    .filter((c) => c.fit && !c.outreach.hidden)
    .sort(order);
  const perSender = Math.max(1, Math.ceil(n / Math.max(1, net.owners.length)));
  const picks: Contact[] = [];
  const take = (from: Contact[], pred: (c: Contact) => boolean, strict: boolean) => {
    const c = from.find((x) => {
      if (picks.includes(x) || !pred(x)) return false;
      if (x.companyId && picks.some((p) => p.companyId === x.companyId)) return false;
      if (!strict) return true;
      return picks.filter((p) => p.group === x.group).length < 2 && picks.filter((p) => p.sender.owner === x.sender.owner).length < perSender;
    });
    if (c) picks.push(c);
    return !!c;
  };
  for (const fit of ["strong", "possible"] as const) {
    const tier = pool.filter((c) => c.fit === fit);
    // One slot each for a fresh change and a reaction, then the rest of the
    // timely ones, then the others; anyone whose colleague was just contacted
    // last. A reason to write now comes before the spread.
    if (fit === "strong") {
      take(tier, (c) => fresh(c) && !cool(c), true);
      take(tier, (c) => reacted(c) && !cool(c), true);
    }
    for (const pred of [(c: Contact) => timely(c) && !cool(c), (c: Contact) => !cool(c), () => true]) {
      while (picks.length < n && take(tier, pred, true));
      while (picks.length < n && take(tier, pred, false));
    }
  }
  return picks.sort(order).map((c) => ({ ...summary(net, c), ...weekWhy(net, c), sender: c.sender.ownerName, prompt: claudePrompt(c) }));
}

// ---------- status: what the team did ----------

export type FollowUp = PersonSummary & { sentOn: string; sentBy: string; followUpOn: string; daysSinceSent: number };

/**
 * People marked sent at least 7 days ago with no reply recorded, oldest
 * first. A nudge for whoever sent, not a new recommendation. With an owner,
 * only what that teammate sent.
 */
export function followUps(net: Network, owner?: string): { today: string; total: number; people: FollowUp[]; note: string } {
  const id = ownerId(net, owner);
  const name = id ? net.owners.find((o) => o.id === id)?.name ?? "__none__" : undefined;
  const people = net.contacts
    .filter((c) => c.outreach.followUpDue && (!name || c.status?.by === name))
    .sort((a, b) => a.status!.at.localeCompare(b.status!.at))
    .map((c) => {
      const sentOn = c.status!.at.slice(0, 10);
      return { ...summary(net, c), sentOn, sentBy: c.status!.by, followUpOn: c.outreach.followUpOn!, daysSinceSent: daysBetween(sentOn, net.today) };
    });
  return {
    today: net.today,
    total: people.length,
    people,
    note: "Marked sent at least 7 days ago with no reply recorded. Follow up, or record how it went: replied, meeting, not_fit or snoozed.",
  };
}

/** What a status means for recommendations, in one sentence. */
export function statusMeaning(c: Contact): string {
  const s = c.status?.status ?? "none";
  const o = c.outreach;
  if (s === "sent") return o.followUpDue ? `Won't be recommended while waiting for a reply; a follow-up has been due since ${fmtDate(o.followUpOn!)}.` : `Won't be recommended while waiting for a reply; follow-up due on ${fmtDate(o.followUpOn!)} if no reply is recorded.`;
  if (s === "replied" || s === "meeting" || s === "not_fit") return "Won't be recommended again.";
  if (s === "snoozed") return o.hidden ? `Hidden from recommendations until ${fmtDate(o.until!)}.` : `The snooze ended on ${fmtDate(o.until!)}; back in recommendations.`;
  if (s === "to_contact") return "Marked to contact; stays in recommendations.";
  return "No status: in recommendations as usual.";
}

export const STATUS_IDS = ["none", "to_contact", "sent", "replied", "meeting", "not_fit", "snoozed"] as const satisfies readonly Status[];

/**
 * Records what the team did with a person, as the app's status buttons do,
 * with the time and the teammate (default: the suggested sender). Snoozes
 * last 90 days unless `snooze_days` says otherwise. Nothing is sent.
 */
export async function recordStatus(net: Network, a: { person_id: string; status: Status; owner?: string; note?: string; snooze_days?: number }) {
  const c = net.byId.get(a.person_id);
  if (!c) return { error: `No person with id ${a.person_id}.` };
  const id = a.owner ? ownerId(net, a.owner) : c.sender.owner;
  const by = net.owners.find((o) => o.id === id)?.name;
  if (!by) return { error: `No teammate called "${a.owner}". Teammates: ${net.owners.map((o) => o.name).join(", ")}.` };
  const until = a.status === "snoozed" ? addDays(net.today, Math.round(a.snooze_days ?? SNOOZE_DAYS)) : undefined;
  const note = a.note?.trim().slice(0, 500) || undefined;
  setStatus(c.id, a.status, by, { note, until });
  const after = (await loadNetwork()).byId.get(c.id) ?? c;
  const company = summary(net, c).company;
  const colleagues = a.status === "sent" || a.status === "replied" || a.status === "meeting" ? c.colleagues : 0;
  return {
    person: { id: c.id, name: c.name, company, url: appUrl(`/people/${c.id}`) },
    status: a.status,
    label: STATUS_LABEL[a.status],
    by,
    at: after.status?.at ?? new Date().toISOString(),
    ...(note ? { note } : {}),
    ...(until ? { until } : {}),
    ...(after.outreach.followUpOn ? { followUpOn: after.outreach.followUpOn } : {}),
    means: statusMeaning(after) + (colleagues ? ` The ${colleagues} other${colleagues > 1 ? "s" : ""} the team knows at ${company} rank lower for ${COOLDOWN_DAYS} days.` : ""),
  };
}

export function getPerson(net: Network, id: string): (Analysis & { appUrl: string }) | null {
  const c = net.byId.get(id);
  return c ? { ...analyse(net, c), appUrl: appUrl(`/people/${c.id}`) } : null;
}

// ---------- companies ----------

export function findCompany(net: Network, q: { business_id?: string; name?: string }) {
  if (q.business_id) return net.companies.get(q.business_id.trim()) ?? null;
  if (q.name) {
    const k = fold(q.name).toLowerCase().trim();
    const all = [...net.companies.values()];
    return all.find((c) => fold(c.name).toLowerCase() === k || c.rawNames.some((r) => fold(r).toLowerCase() === k)) ?? all.find((c) => fold(c.name).toLowerCase().includes(k)) ?? null;
  }
  return null;
}

export function getCompany(net: Network, q: { business_id?: string; name?: string }) {
  const co = findCompany(net, q);
  if (!co) return null;
  const people = co.contactIds.map((id) => net.byId.get(id)!).sort((a, b) => b.score - a.score);
  return {
    id: co.id,
    name: co.name,
    businessId: co.businessId,
    namesInNetwork: co.rawNames,
    matchStatus: co.status,
    prh: co.prh ? { form: co.prh.form, formCode: co.prh.formCode, tol: co.prh.tol, industry: co.prh.industry, town: co.prh.town, registered: co.prh.registrationDate, website: co.prh.website, source: ytjUrl(co.prh.businessId) } : null,
    group: GROUP[co.group].label,
    inProfile: !!co.rule,
    headcount: "Missing: not in PRH open data",
    signals: co.signals.map((s) => ({ type: SIGNAL_TYPES[s.type].label, date: s.date, notice: s.recordNumber, source: ytjUrl(s.businessId) })),
    people: people.map((c) => summary(net, c)),
    url: appUrl(`/companies/${co.id}`),
  };
}

// ---------- radar ----------

export type RadarRow = {
  businessId: string;
  company: string;
  group: GroupId;
  groupLabel: string;
  tol?: string;
  industry?: string;
  town?: string;
  signals: { type: SignalType; label: string; date: string; recordNumber: string }[];
  latest: string;
  score: number;
  known: { id: string; name: string; title: string; fit: Fit | null; knownBy: string[]; url: string }[];
  source: string;
  url: string;
};

/** Weight of each signal type, x1 within 30 days, x0.75 within 60, x0.5 older. One count per type. */
export function radarScore(signals: { type: SignalType; date: string }[], now: string): number {
  const best = new Map<SignalType, number>();
  for (const s of signals) {
    const age = (Date.parse(now) - Date.parse(s.date)) / 86_400_000;
    const f = age <= 30 ? 1 : age <= 60 ? 0.75 : 0.5;
    best.set(s.type, Math.max(best.get(s.type) ?? 0, SIGNAL_TYPES[s.type].weight * f));
  }
  return Math.round([...best.values()].reduce((a, b) => a + b, 0) * 100) / 100;
}

export type RadarFilter = { types?: SignalType[]; industries?: string[]; days?: number; known?: "known" | "unknown"; limit?: number; owner?: string };

export function getRadar(net: Network, f: RadarFilter = {}): { window: { start: string; end: string; fetchedAt: string } | null; total: number; warm: number; rows: RadarRow[] } {
  if (!net.signals) return { window: null, total: 0, warm: 0, rows: [] };
  const groups = groupIds(f.industries);
  const since = f.days ? addDays(net.today, -f.days) : net.signals.start;
  const owner = ownerId(net, f.owner);
  // Companies the team marked as not a target stay off the radar too.
  const excluded = new Set((net.profile.excluded ?? []).map((x) => x.businessId));
  const byCo = new Map<string, CompanySignal[]>();
  for (const s of net.signals.signals) {
    if (s.date < since) continue;
    if (f.types?.length && !f.types.includes(s.type)) continue;
    if (!industryRule(s.tol, net.profile) || excluded.has(s.businessId)) continue;
    const list = byCo.get(s.businessId);
    if (list) list.push(s);
    else byCo.set(s.businessId, [s]);
  }
  let rows: RadarRow[] = [];
  for (const [businessId, sigs] of byCo) {
    const first = sigs[0];
    const lower = industryRule(first.tol, net.profile)?.lowerPriority;
    const group = groupForTol(first.tol);
    if (groups && !groups.includes(group)) continue;
    const co = net.companies.get(businessId);
    const known = (co?.contactIds ?? [])
      .map((id) => net.byId.get(id)!)
      .filter((c) => !owner || c.knownBy.some((k) => k.owner === owner))
      .sort((a, b) => b.score - a.score)
      .map((c) => ({ id: c.id, name: c.name, title: c.position, fit: c.fit, knownBy: c.knownBy.map((k) => k.ownerName), url: appUrl(`/people/${c.id}`) }));
    const uniq = new Map<string, CompanySignal>();
    for (const s of sigs) if (!uniq.has(`${s.type}|${s.recordNumber}`)) uniq.set(`${s.type}|${s.recordNumber}`, s);
    const list = [...uniq.values()].sort((a, b) => b.date.localeCompare(a.date));
    rows.push({
      businessId,
      company: first.company,
      group,
      groupLabel: GROUP[group].label,
      tol: first.tol,
      industry: first.industry,
      town: first.town,
      signals: list.map((s) => ({ type: s.type, label: SIGNAL_TYPES[s.type].label, date: s.date, recordNumber: s.recordNumber })),
      latest: list[0].date,
      // Lower-priority industries count half.
      score: radarScore(list, net.today) * (lower ? 0.5 : 1),
      known,
      source: ytjUrl(businessId),
      url: appUrl(`/companies/${businessId}`),
    });
  }
  if (f.known === "known") rows = rows.filter((r) => r.known.length);
  if (f.known === "unknown") rows = rows.filter((r) => !r.known.length);
  // At an equal score, an Oyj (usually a large group) after the rest.
  const oyj = (r: RadarRow) => Number((net.companies.get(r.businessId)?.prh?.formCode ?? (/\boyj\b/i.test(r.company) ? "17" : "")) === "17");
  rows.sort((a, b) => (b.known.length ? 1 : 0) - (a.known.length ? 1 : 0) || b.score - a.score || oyj(a) - oyj(b) || b.latest.localeCompare(a.latest));
  return {
    window: { start: since, end: net.signals.end, fetchedAt: net.signals.fetchedAt },
    total: rows.length,
    warm: rows.filter((r) => r.known.length).length,
    rows: rows.slice(0, Math.min(f.limit ?? 50, 500)),
  };
}

// ---------- messages ----------

export const TONE_RULES = [
  "Write in Finnish unless the person's name, title or company suggests another language; Swedish for Finland-Swedish companies is fine.",
  "Short: three to five sentences, under 80 words.",
  "Concrete: name one thing from the facts below, never a generic compliment.",
  "One clear ask, easy to say yes or no to (a 20-minute call, an intro, an invite).",
  "No buzzwords (no 'revolutionary', 'game-changing', 'synergy', 'leverage', 'disruptive').",
  "Never invent facts. Use only the facts listed here. Do not mention headcount, revenue or anything marked missing.",
  "Never mention that they reacted to or liked a post.",
  "The message is sent by the suggested sender, from their own LinkedIn or email. This app sends nothing.",
];

// Examples use made-up companies on purpose: the message must take its facts
// from `facts`, never from an example.
const EXAMPLES: Record<"direct" | "ask_intro" | "event_invite", string[]> = {
  direct: [
    "Hei Laura, näin että Esimerkki Konepajalla vaihtui hiljattain toimitusjohtaja. Teemme Velhossa tekoälyä tuotannon suunnitteluun ja tarjouslaskentaan suomalaisille valmistajille. Olisiko sinulla 20 minuuttia ensi viikolla? Kerron kahdesta lyhyestä esimerkistä. Ihan ok sanoa ei.",
    "Hej Erik, jag såg att Exempel Ab nyligen registrerat en fusion. Vi på Velho hjälper industriföretag att få ut mer av sina system med AI. Har du 20 minuter för ett kort samtal nästa vecka?",
  ],
  ask_intro: [
    "Hei Jussi, pitkästä aikaa! Pieni pyyntö: kuka Esimerkki Oy:llä vastaa tuotannon kehittämisestä? Haluaisin esitellä Velhon tekoälytyötä valmistajille lyhyesti. Jos tiedät oikean ihmisen, esittely olisi iso apu.",
    "Hei Anna, tiedätkö kuka teillä päättää ERP- ja tuotantodatan kehityksestä? Velho tekee juuri sellaista, ja haluaisin kysyä häneltä 20 minuuttia. Kiitos jo etukäteen!",
  ],
  event_invite: [
    "Hei Matti, järjestämme marraskuussa Helsingissä pienen aamiaispyöreän pöydän logistiikan johtajille: kahdeksan osallistujaa, aiheena tekoäly kuljetussuunnittelussa. Ajattelin, että sinulla olisi tähän paljon annettavaa. Lähetänkö kutsun?",
    "Hei Tiina, kokoamme tuotantojohtajien pyöreän pöydän tekoälystä valmistavassa teollisuudessa. Ei myyntipuheita, vain kokemusten vaihtoa. Olisitko kiinnostunut?",
  ],
};

export function messageContext(net: Network, args: { person_id: string; type: "direct" | "ask_intro" | "event_invite"; theme?: string }) {
  const c = net.byId.get(args.person_id);
  if (!c) return null;
  const a = analyse(net, c);
  const facts = [
    `Name: ${c.name}`,
    c.position ? `Title (LinkedIn): ${c.position}` : null,
    `Company: ${a.company.name}${a.company.industry ? `, ${a.company.industry}` : ""}${a.company.town ? `, ${a.company.town}` : ""}${a.company.matchStatus === "inferred" ? " (company match not confirmed)" : ""}`,
    ...a.reasons.filter((r) => r.kind === "signal").map((r) => `${r.text} (PRH)`),
    c.colleagues ? `The team knows ${c.colleagues} other people at ${a.company.name}.` : null,
    `Sender: ${c.sender.ownerName}, connected ${fmtDate(c.sender.connectedOn)}${c.knownBy.length > 1 ? `; also known by ${c.knownBy.slice(1).map((k) => k.ownerName).join(", ")}` : ""}.`,
    args.theme ? `Theme or event: ${args.theme}` : null,
    "About Velho: a small Finnish AI and software consultancy that helps SMEs with physical operations use AI and automation in planning, quoting, reporting and their existing systems.",
  ].filter(Boolean) as string[];
  return {
    person: { id: c.id, name: c.name, url: appUrl(`/people/${c.id}`) },
    type: args.type,
    sender: c.sender.ownerName,
    facts,
    mustNotUse: ["Headcount (missing)", "Revenue (missing)", "Reactions to posts", ...a.missing.map((m) => `${m.label}: ${m.text}`)],
    tone: TONE_RULES,
    examples: EXAMPLES[args.type],
    note: "Write the message from these facts only. The server never calls an LLM and never sends anything.",
  };
}

// ---------- reactions ----------

export type ReactionInput = {
  post: string;
  /** YYYY-MM-DD, the day the post went out. Default today. */
  postDate?: string;
  /** Owner id or name of whose post it was. */
  author?: string;
  /** Whose LinkedIn the list was copied from: the "1st"/"2nd" markers are relative to them. Default: the author. */
  copiedBy?: string;
  /** The reactions list as copied from LinkedIn. */
  text?: string;
  /** People read from a screenshot. */
  entries?: ParsedReaction[];
  names?: string[];
  /** Names a teammate resolved in the review: the person they confirmed. */
  picks?: { name: string; person_id: string }[];
  /** false: match only, store nothing. */
  save?: boolean;
};

/**
 * Parses and matches reactions to one of the team's posts, and stores the
 * matches (as inferred) and the picks. Names in review are stored only once
 * someone picks; names with no match are returned once and never stored.
 */
export function addReactions(net: Network, input: ReactionInput) {
  const own = (x?: string) => {
    const id = x ? ownerId(net, x) : undefined;
    return id && id !== "__none__" ? id : undefined;
  };
  const authorId = own(input.author);
  const viewer = own(input.copiedBy) ?? authorId;
  const seen = new Set<string>();
  const read = input.text ? readReactions(input.text) : { entries: [], unread: [] };
  const all: ParsedReaction[] = [...(input.entries ?? []), ...read.entries, ...(input.names ?? []).map((n) => ({ name: cleanName(n) }))];
  const entries = all.filter((e) => {
    const k = `${nameKey(e.name)}|${e.headline ?? ""}`;
    if (!nameKey(e.name) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const res = matchReactions(net, entries, { viewer });
  // A pick must be someone with that name: a pick never moves a reaction to another person.
  const ignoredPicks: { name: string; person_id: string; why: string }[] = [];
  const picks = (input.picks ?? []).filter((p) => {
    const c = net.byId.get(p.person_id);
    const why = !c ? "No person with this id" : nameKey(c.name) !== nameKey(p.name) ? "The picked person does not have this name" : "";
    if (why) ignoredPicks.push({ ...p, why });
    return !why;
  });
  const picked = new Set(picks.map((p) => nameKey(p.name)));
  const at = new Date().toISOString();
  const postDate = isoDate(input.postDate) || net.today;
  const base = { post: input.post.trim() || "Untitled post", postDate, author: authorId, at };
  // Two people of one name can both react: a pick never drops another
  // match; only the same person twice is collapsed.
  const rows: Reaction[] = [];
  for (const r of [
    ...res.matched.map((m) => ({ ...base, contactId: m.contactId, name: m.entry.name, how: m.how })),
    ...picks.map((p) => ({ ...base, contactId: p.person_id, name: cleanName(p.name), how: "picked" as const })),
  ])
    if (!rows.some((x) => x.contactId === r.contactId)) rows.push(r);
  const saved = input.save === false ? 0 : rows.length ? addReactionRows(rows) : 0;
  const person = (id: string) => {
    const c = net.byId.get(id)!;
    return { id, name: c.name, title: c.position, company: candidateOf(c).company, fit: c.fit, url: appUrl(`/people/${id}`) };
  };
  return {
    post: base.post,
    postDate,
    author: authorId ? net.owners.find((o) => o.id === authorId)?.name : undefined,
    read: entries.length,
    stored: input.save !== false,
    saved,
    matched: rows.map((r) => ({ name: r.name, how: r.how, person: person(r.contactId) })),
    review: res.review.filter((r) => !picked.has(nameKey(r.entry.name))).map((r) => ({ name: r.entry.name, headline: r.entry.headline, degree: r.entry.degree, candidates: r.candidates.map((c) => ({ ...c, url: appUrl(`/people/${c.id}`) })) })),
    unmatched: res.unmatched.map((u) => ({ name: u.entry.name, why: u.why })),
    // Lines of the paste read as nobody: shown once, so a missed person can be spotted. Not stored.
    unread: read.unread.slice(0, 50),
    ...(ignoredPicks.length ? { ignoredPicks } : {}),
    note: "Names in 'unmatched' are not stored. Names in 'review' are stored only after someone picks the right person. 'unread' lists lines read as nobody; check them for a missed person.",
  };
}
