import { ensureMatching, loadNetwork } from "@/lib/network.ts";
import { drawingData } from "@/lib/view.ts";
import { matchJob } from "@/lib/matching.ts";
import { NetworkView } from "@/components/NetworkView";
import { MatchProgress } from "@/components/MatchProgress";
import { FirstRun } from "@/components/FirstRun";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const net = await loadNetwork();
  if (!net.owners.length) return <FirstRun />;
  ensureMatching(net);
  const d = drawingData(net);
  const job = matchJob();
  return (
    <>
      <MatchProgress initial={{ ...job }} />
      <NetworkView {...d} initial={p && net.byId.has(p) ? p : undefined} />
    </>
  );
}
