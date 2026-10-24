import { NextResponse } from "next/server";
import { setProfile } from "@/lib/state.ts";
import { DEFAULT_PROFILE, type Profile } from "@/lib/industry.ts";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as (Profile & { reset?: boolean }) | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (b.reset) {
    setProfile(DEFAULT_PROFILE);
    return NextResponse.json(DEFAULT_PROFILE);
  }
  const industries = (b.industries ?? []).map((r) => ({ code: String(r.code).replace(/\s/g, ""), label: String(r.label || r.code).slice(0, 60), lowerPriority: !!r.lowerPriority })).filter((r) => /^\d{2}-\d{2}$|^\d{2,5}$/.test(r.code));
  const roles = (b.roles ?? []).map((r) => String(r).trim()).filter(Boolean).slice(0, 60);
  const p: Profile = { industries, roles, note: String(b.note ?? "").slice(0, 2000) };
  setProfile(p);
  return NextResponse.json(p);
}
