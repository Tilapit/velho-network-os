import fs from "node:fs";
import { NextResponse } from "next/server";
import { SOURCES_DIR, ensureSources } from "@/lib/engine.ts";

/** Restores the synthetic demo data. */
export async function POST() {
  fs.rmSync(SOURCES_DIR, { recursive: true, force: true });
  ensureSources();
  return NextResponse.json({ ok: true });
}
