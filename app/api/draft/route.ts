import { NextResponse } from "next/server";
import { getOpportunity, loadModel } from "@/lib/engine.ts";
import { nextAction, safeguards } from "@/lib/recommend.ts";
import { rewriteDraft } from "@/lib/claude.ts";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const { personId, draft } = await req.json();
  const o = getOpportunity(personId);
  if (!o) return NextResponse.json({ error: "Unknown person" }, { status: 404 });
  // ?check=1 only re-runs the safeguards on the founder's own edits.
  if (url.searchParams.get("check")) return NextResponse.json({ checks: safeguards(o, String(draft || ""), loadModel().model) });
  const action = nextAction(o, loadModel().model);
  const out = await rewriteDraft(o, action);
  return NextResponse.json({ ...out, checks: safeguards(o, out.draft, loadModel().model) });
}
