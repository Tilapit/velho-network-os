import { NextResponse } from "next/server";
import { loadNetwork } from "@/lib/network.ts";
import { messageContext } from "@/lib/queries.ts";
import { writeDraft } from "@/lib/claude.ts";

export const dynamic = "force-dynamic";

/**
 * "Draft here": a message drafted by Claude from message_context, only when
 * ANTHROPIC_API_KEY is set. The person's name is replaced before sending and
 * put back locally. Nothing is sent to the person: the team copies the draft.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { type } = (await req.json().catch(() => ({}))) as { type?: "direct" | "ask_intro" | "event_invite" };
  const net = await loadNetwork();
  const c = net.byId.get(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = messageContext(net, { person_id: id, type: type ?? (c.approach === "ask_intro" ? "ask_intro" : "direct") })!;
  const r = await writeDraft(ctx, { name: c.name, sender: c.sender.ownerName, owners: net.owners.map((o) => o.name) });
  console.log(`[draft] ${new Date().toISOString()} ${id} ${"error" in r ? "failed" : "ok"}`);
  return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json({ ...r, type: ctx.type, sender: ctx.sender });
}
