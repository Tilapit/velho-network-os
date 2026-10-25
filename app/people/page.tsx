import Link from "next/link";
import { loadNetwork } from "@/lib/network.ts";
import { GROUP, type GroupId } from "@/lib/industry.ts";
import { SIGNAL_TYPES } from "@/lib/signals.ts";
import { STATUS_LABEL } from "@/lib/state.ts";
import { shortName } from "@/lib/analysis.ts";
import { PeopleTable, type Row } from "@/components/PeopleTable";
import { FirstRun } from "@/components/FirstRun";
import { postsWithin, RECENT_DAYS, REACTION_DAYS } from "@/lib/reactions.ts";
import { FUNNEL_STEPS, funnelPeople, ownerId, type FunnelList } from "@/lib/queries.ts";

// The funnel on the Network page links here, one list per step.
const STEP_TEXT: Record<FunnelList, { title: string; lede: (n: number) => string }> = {
  all: { title: "Everyone in your networks", lede: (n) => `${n.toLocaleString("en-US")} people, merged by profile URL.` },
  found: { title: "Company found in PRH", lede: (n) => `${n.toLocaleString("en-US")} people whose company name matched one Finnish company in the trade register: exactly (verified) or by one close name (check).` },
  unmatched: { title: "Company not found in PRH", lede: (n) => `${n.toLocaleString("en-US")} people with no company in LinkedIn, a name with several or no matches in PRH, or a company abroad. Pick the right company under Settings → PRH matches.` },
  industries: { title: "Everyone at a company in your industries", lede: (n) => `${n.toLocaleString("en-US")} people work at a matched company in your target industries. Decision-makers are on the list; the rest can introduce you.` },
  other: { title: "In other industries", lede: (n) => `${n.toLocaleString("en-US")} people at a company found in PRH whose line of business is outside your profile, or that the team marked as not a target.` },
  fits: { title: "Decision-makers who fit", lede: (n) => `${n.toLocaleString("en-US")} decision-makers at matched companies in your target industries.` },
  intro: { title: "Can introduce", lede: (n) => `${n.toLocaleString("en-US")} people at companies in your industries whose title does not decide: students, trainees, specialists and others. They can introduce you to who does.` },
};

export const dynamic = "force-dynamic";

export default async function People({ searchParams }: { searchParams: Promise<{ all?: string; reacted?: string; industry?: string; step?: string; owner?: string }> }) {
  const { all, reacted, industry, step: rawStep, owner } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  // From the Network page: one industry's decision-makers.
  const group = industry && industry in GROUP ? GROUP[industry as GroupId] : undefined;
  const step = (FUNNEL_STEPS as readonly string[]).includes(rawStep ?? "") ? (rawStep as FunnelList) : undefined;
  const who = owner ? net.owners.find((o) => o.id === ownerId(net, owner)) : undefined;
  const list = (step ? funnelPeople(net, step, owner) : reacted ? net.contacts.filter((c) => postsWithin(c, net.today, RECENT_DAYS)) : all ? net.contacts.filter((c) => c.rule) : net.contacts.filter((c) => c.fit)).filter((c) => !group || c.group === group.id);
  const rows: Row[] = list.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.position,
    company: c.match?.company && !c.match.foreign && (c.match.status === "verified" || c.match.status === "inferred") ? shortName(c.match.company.name) : c.company,
    group: GROUP[c.group].label,
    fit: c.fit ?? "",
    approach: c.approach,
    score: c.score,
    knownBy: c.knownBy.map((k) => k.ownerName).join(", "),
    sender: c.sender.ownerName,
    signal: [...new Set(c.signals.map((s) => SIGNAL_TYPES[s.type].short))].join(", "),
    status: c.status ? STATUS_LABEL[c.status.status] : "",
    match: c.match?.status ?? "",
    reacted: postsWithin(c, net.today, REACTION_DAYS),
  }));
  return (
    <main className="page wide">
      <h1>
        {step ? STEP_TEXT[step].title : reacted ? "Reacted to the team's posts" : all ? "Everyone at a company in your industries" : "Decision-makers who fit"}
        {group ? `: ${group.label}` : ""}
        {who ? ` (${who.name === "You" ? "your" : `${who.name}'s`} network)` : ""}
      </h1>
      <p className="lede">
        {step
          ? STEP_TEXT[step].lede(rows.length)
          : reacted
          ? `${rows.length} people reacted to one of the team's posts in the last ${RECENT_DAYS} days, matched by name from pasted reactions lists, ordered by the score.`
          : all
            ? `${rows.length} people work at a matched company in your target industries. Decision-makers are on the list; the rest can introduce you.`
            : `${rows.length} decision-makers at matched companies in your target industries, ordered by the score (code, not AI).`}{" "}
        <Link href={all || reacted || group || step ? "/people" : "/people?all=1"} className="link">
          {group ? "All industries" : all || reacted || step ? "Only decision-makers who fit" : "Show everyone at target companies"}
        </Link>
        {" · "}
        <a href="/api/export.csv" className="link">
          Export CSV for your CRM
        </a>
      </p>
      <PeopleTable rows={rows} />
    </main>
  );
}
