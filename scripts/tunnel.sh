#!/usr/bin/env bash
# Puts the local MCP endpoint on a public https URL for claude.ai's custom
# connector, through a Cloudflare quick tunnel (a random *.trycloudflare.com
# address, no account). Only /api/mcp answers through it, and only with the
# token; every page stays on this machine (see middleware.ts).
#
# Usage: scripts/tunnel.sh [port]        (default 3310)
# The app must run with the same token: MCP_TOKEN=<token> npm run dev
set -euo pipefail
PORT="${1:-3310}"

if ! command -v cloudflared >/dev/null 2>&1; then
  cat <<'TXT'
cloudflared is not installed. Install it, then run this script again:
  macOS:    brew install cloudflared
  Linux:    https://pkg.cloudflare.com/ (or the .deb/.rpm from the page below)
  Windows:  winget install --id Cloudflare.cloudflared
  Releases: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
No Cloudflare account is needed for a quick tunnel.
TXT
  exit 1
fi

if [ -z "${MCP_TOKEN:-}" ]; then
  TOKEN="$(openssl rand -hex 24)"
  cat <<TXT
No MCP_TOKEN set. Restart the app with this new token, then run this script
again with the same token:

  MCP_TOKEN=$TOKEN npm run dev            # in one terminal
  MCP_TOKEN=$TOKEN scripts/tunnel.sh      # in another

TXT
  exit 1
fi

# The app must be up and must refuse requests without the token.
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "http://localhost:$PORT/api/mcp" || true)"
if [ "$code" = "000" ]; then
  echo "Nothing answers on http://localhost:$PORT. Start the app first: MCP_TOKEN=\$MCP_TOKEN npm run dev"
  exit 1
fi
if [ "$code" != "401" ]; then
  echo "The app on port $PORT answered $code without a token: it is not running with MCP_TOKEN."
  echo "Restart it with MCP_TOKEN=\$MCP_TOKEN npm run dev, so the tunnel is not open to anyone with the URL."
  exit 1
fi

LOG="$(mktemp -t velho-tunnel)"
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -f "$LOG"' EXIT INT TERM
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "No tunnel URL after 60 s. cloudflared said:"
  cat "$LOG"
  exit 1
fi

cat <<TXT

Public MCP URL:  $URL/api/mcp
Header:          Authorization: Bearer $MCP_TOKEN

claude.ai (and Claude Desktop, which uses the same connectors):
  Customize -> Connectors -> + Add -> Add custom connector
  Name: Velho Network   URL: the one above   Authentication: No sign in
  Request headers: Authorization = Bearer $MCP_TOKEN
  (Untested end to end: it follows Anthropic's help article.)
Claude Code anywhere:
  claude mcp add --transport http velho $URL/api/mcp --header "Authorization: Bearer $MCP_TOKEN"

Pages and the other APIs answer only on this machine. Ctrl-C stops the tunnel.
TXT
wait $PID
