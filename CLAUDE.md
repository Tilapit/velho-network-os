# Velho Network

Prototype for Velho, a small Finnish AI and automation consultancy, built at
the Aaltoes Operations Hackathon (24–25 Oct 2026). It answers one question for
Velho's founders: who in the team's network could need Velho, and why. It also
has a signal radar of trade register changes and a theme finder for events.
The founders use it from their own Claude through an MCP connector.

## Product rules (do not break these)

- **Never fabricate.** No invented connections, reactions, comments, customer
  relationships or company facts. Demo people are invented and labelled as
  such. Message examples use made-up companies.
- **Every fact has a provenance** (`lib/types.ts`): verified, imported,
  inferred or missing. The UI shows its source next to it: LinkedIn title,
  PRH, PRH notices, Your network, Your team.
- **No scraping and no assumed API access.** Data comes from:
  - each teammate's LinkedIn Connections.csv export
  - PRH open data (YTJ companies, registered notices)
  - the team's own input
- **People merge by profile URL only.** A name alone never merges two people.
  Rows without a URL stay separate. Pasted reactions are matched by name;
  with several people of that name, only the company in the headline or the
  degree marker against the post's author may decide, otherwise a teammate
  picks. Names that match no one are never stored.
- **PRH matching never guesses.**
  - An exact normalised name is "verified".
  - One close candidate is "inferred" and shown as "check".
  - Several or none means unmatched, until someone picks a company in
    Settings.
- **Headcount is not in PRH.** It is always shown as Missing and never
  invented.
- **Fit, approach, score and radar order are deterministic code**
  (`lib/network.ts`, `lib/queries.ts`), and so is "This week". The LLM never
  sets or changes them. Claude only writes the one "Possible angle" sentence
  and the "Draft here" message (both labelled Inferred, `lib/claude.ts`),
  and only when a key is set. Through MCP, Claude picks filters and writes
  text.
- **Nothing is sent from the app.** Status buttons record what the team did.
- **Privacy.**
  - Only company names and business IDs go to PRH.
  - One person's role and company facts (never the name) go to Claude.
  - No emails are stored.
  - Logs contain ids, not names.
  - `data/sources`, `data/cache` and `data/state.json` are gitignored.

## Code map

- `lib/ingest.ts`: LinkedIn Connections.csv parser with an import report.
- `lib/store.ts`: one CSV per owner in `data/sources/networks/`, demo load,
  delete per owner and delete all.
- `lib/prh.ts`: PRH YTJ client (polite queue, disk cache) and the match rules
  (`decide`).
- `lib/matching.ts`: offline resolution from the cache, plus the background
  job that fills it. Demo snapshot fallback.
- `lib/signals.ts`: PRH registered notices as signals (MD change, new money,
  merger, board), one cross-company query per entry code, 90 days.
- `lib/roles.ts`: what a title says (level, area, decision-maker), in
  Finnish, Swedish and English.
- `lib/industry.ts`: TOL → industry groups, target profile and defaults,
  "abroad" detection.
- `lib/network.ts`: the merged model:
  - knownBy, and the suggested sender (who connected first)
  - fit, approach
  - score weights (`WEIGHTS`)
- `lib/analysis.ts`: per-person reasons, missing facts and the template
  angle.
- `lib/queries.ts`: this_week, rank_industries, find_people,
  people_for_theme, company, radar, message context, reactions. Shared by the
  UI and MCP.
- `lib/reactions.ts`: parser for LinkedIn's copied reactions list and the
  name matcher. `lib/demo.ts` seeds the demo's two posts.
- `lib/mcp.ts` + `app/api/mcp/route.ts`: MCP server (stateless Streamable
  HTTP). `lib/access.ts` + `middleware.ts`: optional `MCP_TOKEN`; with it,
  pages answer only on localhost.
- `claude/velho-network/SKILL.md`: the Claude skill for the connector.
- `app/`:
  - `/` network view: canvas drawing in `components/NetworkDrawing.tsx`
    (seeded layout, offscreen static layer, pulse, particles, zoom), This
    week, Reacted recently
  - `/people`, `/people/[id]`, `/companies/[id]`, `/radar`, `/themes`,
    `/settings`
- `data/demo/`: invented mock exports, PRH snapshots and two pasted
  reactions lists for offline demos. `data/stress/` (gitignored): 5k and
  10k stress files.
- `tests/fixtures/`: importer and reactions fixtures with exact bytes.

## Commands

- `APP_TODAY=2026-10-24 npm run dev` on port 3100 (freezes "today" so the
  demo reads the same). If 3100 is taken: `npx next dev -p 3310` with
  `APP_BASE_URL=http://localhost:3310`.
- `npm test` (node test runner, offline) and `npx tsc --noEmit`.
- Scripts:
  - `node scripts/fetch-signals.mjs`: refresh the radar
  - `node scripts/match-companies.mjs`: match all names now
  - `node scripts/generate-mock-connections.mjs`: regenerate the mock exports
  - `node scripts/snapshot-demo-data.mjs`: rebuild the demo snapshots
  - `node scripts/make-demo-reactions.mjs`: rebuild the demo's reactions
  - `npm run skill:zip`, `npm run tunnel` (claude.ai, needs `MCP_TOKEN`)

## Design

Dark, from `design/` (`Main.dc.html` is the reference).
- **Tokens:** in `app/globals.css`, applied app-wide.
- **Font:** Geist.
- **Colour:** one accent, #3d7bff, for what fits; #8db4ff when selected.
- **Copy:** plain and calm, sentence case, no hype words.
