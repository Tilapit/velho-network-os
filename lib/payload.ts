// What the person view gets: the analysis plus whether Claude can write the angle.
import { analyse } from "./analysis.ts";
import { claudeAvailable } from "./claude.ts";
import { readState } from "./state.ts";
import type { Network } from "./network.ts";

export function personPayload(net: Network, id: string) {
  const c = net.byId.get(id);
  if (!c) return null;
  const saved = readState().angles[id];
  return {
    ...analyse(net, c),
    claude: claudeAvailable(),
    savedAngle: saved?.text,
    owners: net.owners.map((o) => ({ id: o.id, name: o.name })),
  };
}
