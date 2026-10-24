import Link from "next/link";
import { loadNetwork } from "@/lib/network.ts";
import { GROUP } from "@/lib/industry.ts";
import { SIGNAL_TYPES } from "@/lib/signals.ts";
import { STATUS_LABEL } from "@/lib/state.ts";
import { shortName } from "@/lib/analysis.ts";
import { PeopleTable, type Row } from "@/components/PeopleTable";
import { FirstRun } from "@/components/FirstRun";

export const dynamic = "force-dynamic";

export default async function People({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  const list = all ? net.contacts.filter((c) => c.rule) : net.contacts.filter((c) => c.fit);
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
  }));
  return (
    <main className="page wide">
      <h1>{all ? "Everyone at a company in your industries" : "Decision-makers who fit"}</h1>
      <p className="lede">
        {all
          ? `${rows.length} people work at a matched company in your target industries. Decision-makers are on the list; the rest can introduce you.`
          : `${rows.length} decision-makers at matched companies in your target industries, ordered by the score (code, not AI).`}{" "}
        <Link href={all ? "/people" : "/people?all=1"} className="link">
          {all ? "Only decision-makers" : "Show everyone at target companies"}
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
