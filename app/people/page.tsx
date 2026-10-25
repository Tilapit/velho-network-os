import Link from "next/link";
import { loadNetwork } from "@/lib/network.ts";
import { GROUP, type GroupId } from "@/lib/industry.ts";
import { SIGNAL_TYPES } from "@/lib/signals.ts";
import { STATUS_LABEL } from "@/lib/state.ts";
import { shortName } from "@/lib/analysis.ts";
import { PeopleTable, type Row } from "@/components/PeopleTable";
import { FirstRun } from "@/components/FirstRun";
import { postsWithin, RECENT_DAYS, REACTION_DAYS } from "@/lib/reactions.ts";

export const dynamic = "force-dynamic";

export default async function People({ searchParams }: { searchParams: Promise<{ all?: string; reacted?: string; industry?: string }> }) {
  const { all, reacted, industry } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  // From the Network page: one industry's decision-makers.
  const group = industry && industry in GROUP ? GROUP[industry as GroupId] : undefined;
  const list = (reacted ? net.contacts.filter((c) => postsWithin(c, net.today, RECENT_DAYS)) : all ? net.contacts.filter((c) => c.rule) : net.contacts.filter((c) => c.fit)).filter((c) => !group || c.group === group.id);
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
        {reacted ? "Reacted to the team's posts" : all ? "Everyone at a company in your industries" : "Decision-makers who fit"}
        {group ? `: ${group.label}` : ""}
      </h1>
      <p className="lede">
        {reacted
          ? `${rows.length} people reacted to one of the team's posts in the last ${RECENT_DAYS} days, matched by name from pasted reactions lists, ordered by the score.`
          : all
            ? `${rows.length} people work at a matched company in your target industries. Decision-makers are on the list; the rest can introduce you.`
            : `${rows.length} decision-makers at matched companies in your target industries, ordered by the score (code, not AI).`}{" "}
        <Link href={all || reacted || group ? "/people" : "/people?all=1"} className="link">
          {group ? "All industries" : all || reacted ? "Only decision-makers who fit" : "Show everyone at target companies"}
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
