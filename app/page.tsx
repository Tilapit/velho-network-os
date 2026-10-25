import { ensureMatching, loadNetwork } from "@/lib/network.ts";
import { drawingData } from "@/lib/view.ts";
import { matchJob } from "@/lib/matching.ts";
import { NetworkView } from "@/components/NetworkView";
import { MatchProgress } from "@/components/MatchProgress";
import { FirstRun } from "@/components/FirstRun";
import { followUps, thisWeek, type FollowUp, type WeekPick } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  ensureMatching(net);
  const d = drawingData(net);
  const slim = ({ id, name, title, company, fit, status, kind, why, sender, prompt, cooldown }: WeekPick) => ({ id, name, title, company, fit, status, kind, why, sender, prompt, cooldown });
  const due = ({ id, name, title, company, sentOn, sentBy, followUpOn }: FollowUp) => ({ id, name, title, company, sentOn, sentBy, followUpOn });
  // The whole team's five, and each teammate's for the owner filter.
  const week = thisWeek(net).map(slim);
  const weekBy = net.owners.map((o) => thisWeek(net, 5, o.id).map(slim));
  // Follow-ups due: the team's, and what each teammate sent.
  const follow = followUps(net).people.map(due);
  const followBy = net.owners.map((o) => followUps(net, o.id).people.map(due));
  const job = matchJob();
  return (
    <>
      <MatchProgress initial={{ ...job }} />
      <NetworkView {...d} week={week} weekBy={weekBy} follow={follow} followBy={followBy} initial={p && net.byId.has(p) ? p : undefined} />
    </>
  );
}
