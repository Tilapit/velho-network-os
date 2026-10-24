# Demo: 3 minutes

A recording of the app part (86 s, no sound) is in
`media/demo-walkthrough.webm`.

## Before you start (2 minutes)

```sh
cd velho-network-os
npm install                      # once
APP_TODAY=2026-10-24 APP_BASE_URL=http://localhost:3310 npx next dev -p 3310 -H 127.0.0.1
```

- **Port.** Another app had 3100 overnight, so everything below uses 3310.
  If 3100 is free, `APP_TODAY=2026-10-24 npm run dev` works too; then use
  3100 everywhere.
- **Load the demo.** Open http://localhost:3310. If it asks to bring in
  networks, click **Load demo data**. It loads instantly, even offline: PRH
  matches, the radar and two posts' reactions ship with the repo.
- **Claude Code connector**, once per machine:
  ```sh
  claude mcp add --transport http velho http://localhost:3310/api/mcp
  ```
  Skill: Settings → Connect to Claude → **Download velho-network-skill.zip**,
  or copy `claude/velho-network/` into `~/.claude/skills/`.
- **claude.ai instead (untested).** Needs a public URL and the production
  server: `export MCP_TOKEN=$(openssl rand -hex 24)`, `npm run build`, then
  `npm start` in one terminal and `npm run tunnel` in another (needs
  `cloudflared`; both on port 3100). In claude.ai:
  Customize → Connectors → + Add → Add custom connector, the printed URL,
  Authentication "No sign in", Request headers `Authorization` = `Bearer
  <token>`. Settings → Connect to Claude has the steps.
- Don't click "Delete my data" before the demo.

## Script

1. **The network (40 s).** Open the Network page and let the pulse run.
   "This is everyone the three of us know on LinkedIn: 2,333 people, merged
   by profile URL. Every dot is a person."
   - Point left to right: the three of us → people, in a cloud per industry
     → industries → the 192 decision-makers who fit.
   - "Bright blue is a strong fit. White rings: two of us know them. The
     grey clouds at the bottom are outside our industries."
   - Hover **Metal and machinery**: its people and links light up.
   - Click **Co-founder** in the owner filter, then **Whole team**.

2. **This week (30 s).** The panel on the right.
   - "Five people to reach this week, chosen by code, not by AI: a new
     managing director at Specim, a board change at Satron, two people who
     reacted to our posts, and Tiina Koski at Honkarakenne. Nobody we
     already contacted, and the writing is spread across the three of us."
   - Click **Write in Claude** on one: "this copies a prompt for my own
     Claude, which has the connector."

3. **A person (30 s).** Click **Aleksi Sirviö** (first in This week).
   - The path lights up and particles run: Co-founder and Board member →
     him → Electrical and electronics → the decision-makers column.
   - Panel: who knows him and the suggested sender; reasons, each with its
     source (LinkedIn title, PRH, PRH notices, Your network); what we don't
     know (headcount, always); the Message buttons; the status buttons.
     "Nothing is sent from here."

4. **Reactions (30 s).** Click **← All**, then **Reacted recently · 40**.
   - "40 people reacted to our last two posts. We copy the reactions list on
     LinkedIn and paste it here; nothing is scraped."
   - Settings → **Post reactions**. Paste a reactions list (for example
     `data/demo/reactions/post-1.txt`), click **Match names**: "Will be
     stored", "Check these" (two people share the name), "Not in your
     networks: shown once, never stored." Click **Back**.

5. **Radar (20 s).** **Signal radar**, then **Someone we know**: "Companies
   in our industries with a new managing director, new money, a merger or a
   board change in the last 90 days. Warm rows first."

6. **In Claude (30 s).** In Claude Code with the connector, paste the
   prompt from step 2, or ask:
   > Who should we reach this week?
   - Claude calls `this_week` (the same five) and `message_context`, and
     writes short Finnish drafts from the facts only, with the sender for
     each. Click a person link: it opens the same analysis in the app.
   - "Claude picks the filters and writes. The list and the ranking are
     code."

## If something goes wrong

- **The page is empty:** Settings → Load demo data.
- **"Looking up" bar:** PRH lookups are running in the background (real
  networks only). The page fills in as they land; the bar shows time left.
- **Claude can't see the tools:** `claude mcp list` should show
  `velho ... ✔ Connected`. Check the port. With `MCP_TOKEN` set, add
  `--header "Authorization: Bearer $MCP_TOKEN"`.
- **Recorded answers:** `docs/mcp-transcripts.md`.
- **Screenshots of every page:** `screens/` (part 1's network in
  `screens/part1/`).
