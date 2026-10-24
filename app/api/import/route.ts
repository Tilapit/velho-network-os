import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { SOURCE_FILES, SOURCES_DIR, ensureSources, loadModel } from "@/lib/engine.ts";

export async function POST(req: Request) {
  ensureSources();
  const form = await req.formData();
  const kind = String(form.get("kind"));
  const file = form.get("file");
  const target = SOURCE_FILES.find((s) => s.kind === kind);
  if (!target || !(file instanceof File)) return NextResponse.json({ error: "Choose a file and a source." }, { status: 400 });
  if (file.size > 10_000_000) return NextResponse.json({ error: "File is over 10 MB." }, { status: 400 });
  fs.writeFileSync(path.join(SOURCES_DIR, target.file), Buffer.from(await file.arrayBuffer()));
  // Once the founder imports real data the demo label comes off.
  fs.rmSync(path.join(SOURCES_DIR, ".demo"), { force: true });
  const report = loadModel().model.reports.find((r) => r.kind === kind);
  return NextResponse.json({ ok: true, report });
}
