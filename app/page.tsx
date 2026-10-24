import { ensureMatching, loadNetwork } from "@/lib/network.ts";
import { drawingData } from "@/lib/view.ts";
import { matchJob } from "@/lib/matching.ts";
import { NetworkView } from "@/components/NetworkView";
import { MatchProgress } from "@/components/MatchProgress";
import { FirstRun } from "@/components/FirstRun";
import { thisWeek } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  ensureMatching(net);
  const d = drawingData(net);
  const week = thisWeek(net).map(({ id, name, title, company, fit, status, kind, why, sender, prompt }) => ({ id, name, title, company, fit, status, kind, why, sender, prompt }));
  const job = matchJob();
  return (
    <>
      <MatchProgress initial={{ ...job }} />
      <NetworkView {...d} week={week} initial={p && net.byId.has(p) ? p : undefined} />
    </>
  );
}
