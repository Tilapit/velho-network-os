import { NextResponse } from "next/server";
import { loadNetwork } from "@/lib/network.ts";
import { setStatus, type Status } from "@/lib/state.ts";

const OK: Status[] = ["none", "to_contact", "sent", "replied", "meeting", "not_fit"];

/** Records what the team did. Nothing is sent to anyone. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: Status; by?: string };
  const net = await loadNetwork();
  if (!net.byId.has(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!body.status || !OK.includes(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  const by = net.owners.find((o) => o.name === body.by)?.name ?? net.owners[0]?.name ?? "You";
  setStatus(id, body.status, by);
  return NextResponse.json({ ok: true, status: body.status, by });
}
