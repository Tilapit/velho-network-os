// Streamable HTTP MCP endpoint, stateless: a fresh server and transport per
// request. Local only for now: no auth, so do not expose this port.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp.ts";

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
