import { NextResponse } from "next/server";
import { clearDecision, writeDecision } from "@/lib/state.ts";
import { getOpportunity } from "@/lib/engine.ts";

export async function POST(req: Request) {
  const { personId, status, draft, actionType } = await req.json();
  if (!getOpportunity(personId)) return NextResponse.json({ error: "Unknown person" }, { status: 404 });
  if (status === "undo") clearDecision(personId);
  else if (["approved", "saved", "dismissed"].includes(status)) writeDecision({ personId, status, draft: String(draft || ""), actionType: String(actionType || ""), at: new Date().toISOString() });
  else return NextResponse.json({ error: "Bad status" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
