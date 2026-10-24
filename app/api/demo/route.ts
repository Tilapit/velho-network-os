import { NextResponse } from "next/server";
import { loadDemo } from "@/lib/store.ts";
import { ensureMatching, loadNetwork } from "@/lib/network.ts";

/** One click: the three invented demo networks. */
export async function POST() {
  const owners = loadDemo();
  ensureMatching(await loadNetwork());
  return NextResponse.json({ owners });
}
