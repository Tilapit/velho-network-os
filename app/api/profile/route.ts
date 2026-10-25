import { NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/state.ts";
import { PROFILE_PRESETS, type PresetId, type Profile } from "@/lib/industry.ts";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as (Profile & { reset?: boolean; preset?: PresetId }) | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  // A preset (or reset, the default one) keeps the companies marked as not a target and the Employer Register filter.
  const preset = b.reset ? "default" : b.preset && b.preset in PROFILE_PRESETS ? b.preset : null;
  if (preset) {
    const p: Profile = { ...PROFILE_PRESETS[preset], excluded: getProfile().excluded, requireEmployer: getProfile().requireEmployer };
    setProfile(p);
    return NextResponse.json(p);
  }
  // Only the Employer Register switch: the rest of the profile stays.
  if (!b.industries && typeof b.requireEmployer === "boolean") {
    const p: Profile = { ...getProfile(), requireEmployer: b.requireEmployer };
    setProfile(p);
    return NextResponse.json(p);
  }
  const industries = (b.industries ?? []).map((r) => ({ code: String(r.code).replace(/\s/g, ""), label: String(r.label || r.code).slice(0, 60), lowerPriority: !!r.lowerPriority })).filter((r) => /^\d{2}-\d{2}$|^\d{2,5}$/.test(r.code));
  const roles = (b.roles ?? []).map((r) => String(r).trim()).filter(Boolean).slice(0, 60);
  const p: Profile = { industries, roles, note: String(b.note ?? "").slice(0, 2000), excluded: getProfile().excluded, requireEmployer: typeof b.requireEmployer === "boolean" ? b.requireEmployer : getProfile().requireEmployer };
  setProfile(p);
  return NextResponse.json(p);
}
