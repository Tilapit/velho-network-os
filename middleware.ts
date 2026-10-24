// With MCP_TOKEN set the app may sit behind a tunnel for claude.ai. Then only
// /api/mcp (which checks the token) answers from outside; every page and the
// other APIs answer only on this machine, so the network never leaks through
// the tunnel. Without MCP_TOKEN nothing changes.
import { NextResponse, type NextRequest } from "next/server";

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function middleware(req: NextRequest) {
  if (!process.env.MCP_TOKEN?.trim() || req.nextUrl.pathname === "/api/mcp") return NextResponse.next();
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  // Cloudflare's tunnel adds these; Next itself adds x-forwarded-for, so that one says nothing.
  const proxied = req.headers.has("cf-connecting-ip") || req.headers.has("cf-ray");
  if (LOCAL.has(host) && !proxied) return NextResponse.next();
  return new NextResponse("Velho Network answers only on this machine. Through the tunnel, only /api/mcp is open, with the token.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
