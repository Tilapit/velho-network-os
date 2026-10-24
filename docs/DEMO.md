# Demo: 3 minutes

## Before you start (2 minutes)

```sh
cd velho-network-os
npm install                      # once
APP_TODAY=2026-10-24 npm run dev # http://localhost:3100
```

- **If 3100 is taken.** Last night another app was running on it. Use:
  ```sh
  APP_TODAY=2026-10-24 APP_BASE_URL=http://localhost:3310 npx next dev -p 3310
  ```
  Then use 3310 everywhere below.
- **Load the demo.** Open the app. If it asks to bring in networks, click
  **Load demo data**. It loads instantly, even offline: the PRH matches and the
  radar ship as snapshots.
- **Claude connector**, once per machine:
  ```sh
  claude mcp add --transport http velho http://localhost:3100/api/mcp
  ```
  Add the skill by copying `claude/velho-network/` into `~/.claude/skills/`, or
  paste `SKILL.md` into a Claude project.
- **Optional:** `ANTHROPIC_API_KEY` in `.env.local` makes the "Possible
  angle" a Claude sentence. Without it, a template is used.

Don't click "Delete my data" before the demo. The demo still works after it,
from the snapshots, but the PRH lookups would run again in the background.

## Script

1. **Network (45 s).** "This is everyone the three of us know on LinkedIn:
   2,333 people after merging by profile URL. Company names are matched to the
   trade register, and titles are read against our profile."
   - Point left to right: owners → people in industry bands → industries →
     the 192 decision-makers who fit.
   - Hover **Metal and machinery** in the drawing or the table: its people
     light up.
   - Switch the owner filter to **Co-founder**, then back to **Whole team**.

2. **Person (40 s).** Click **Aleksi Sirviö** (Supply Chain Director,
   Specim) in "Strongest 8".
   - His path lights up: Co-founder and Board member → Specim → Electrical and
     electronics → him.
   - Panel:
     - **Who knows him:** the suggested sender is the co-founder, who
       connected first.
     - **Reasons**, each with its source: LinkedIn title, PRH, PRH notices
       (managing director changed 13 Oct), Your network.
     - **What we don't know:** headcount, always.
     - **Possible angle**, labelled Inferred.
   - Click **To contact**: "this only records it; nothing is sent."

3. **By industry (15 s).** Scroll to the table. "Score is code: strong fits,
   people two of us know, recent changes in the register."

4. **Radar (30 s).** **Signal radar**, then **Someone we know**.
   - "Companies in our industries with a new managing director, new money, a
     merger or a board change in the last 90 days. Warm rows first: Nokeval,
     Saalasti, Satron."
   - Open a company: PRH facts, the notices, who we know there.

5. **The same question in Claude (40 s).** In Claude (with the connector):
   > We're hosting a logistics roundtable in Helsinki in November. Who should
   > we invite, and who should we ask for an intro?
   - Claude calls `people_for_theme` and answers "invite" vs "ask for an
     intro", with the sender for each.
   - Ask for a Finnish invite to one person. It calls `message_context` and
     writes it from the facts only.

6. **Back to the app (10 s).** Click a person link in Claude's answer: it
   opens `/people/<id>`, the same analysis. "Claude chooses the filters and
   writes; the list and the ranking are code."

## If something goes wrong

- **The page is empty:** Settings → Load demo data.
- **"Looking up" bar:** PRH lookups are running in the background (real
  networks only). The page fills in as they land.
- **Claude can't see the tools:** `claude mcp list` should show
  `velho ... ✔ Connected`. Check that the port matches.
- **Recorded answers:** `docs/mcp-transcripts.md`.
- **Screenshots of every page:** `screens/`.
