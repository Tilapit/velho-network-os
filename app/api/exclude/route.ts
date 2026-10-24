import { NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/state.ts";

/** Marks a company as not a target (or undoes it). Its people leave the list; nothing else changes. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { businessId?: string; name?: string; exclude?: boolean };
  if (!b.businessId || !/^\d{7}-\d$/.test(b.businessId)) return NextResponse.json({ error: "Missing business ID" }, { status: 400 });
  const p = getProfile();
  const rest = (p.excluded ?? []).filter((x) => x.businessId !== b.businessId);
  setProfile({ ...p, excluded: b.exclude ? [...rest, { businessId: b.businessId, name: String(b.name ?? b.businessId).slice(0, 120) }] : rest });
  return NextResponse.json({ ok: true });
}
