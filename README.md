# Velho Network

Who in your team's network could need Velho, and why.

Velho's founders go through their LinkedIn networks by hand to find people at
Finnish SMEs with physical operations who could use AI and automation. Velho
Network does it for the whole team:

- **Network.** Each teammate's LinkedIn Connections export is merged by
  profile URL. Company names are matched to the Finnish trade register (PRH),
  and titles are read against your target profile. The result is one picture
  of who the team knows, who decides, and why each person could need Velho.
- **Signal radar.** Companies in your industries where the trade register
  shows a new managing director, new money, a merger or a board change in the
  last 90 days. Warm rows come first: someone in the team knows a person
  there.
- **Themes.** "We are hosting a logistics roundtable, who should we invite?"
- **Claude connector.** The same data as an MCP server, used from your own
  Claude. Ranking and filtering stay in code; Claude picks the filters and
  writes the text.

Nothing is sent to anyone. Statuses only record what the team did.

## Run

```sh
npm install
APP_TODAY=2026-10-24 npm run dev        # http://localhost:3100
```

On the first page, either import a `Connections.csv` or click **Load demo
data**.
- The demo is three invented networks at real companies: You (1,500),
  Co-founder (860) and Board member (300).
- It works offline: the PRH matches and the radar ship as snapshots in
  `data/demo/`.

Optional: put `ANTHROPIC_API_KEY` in `.env.local` and Claude writes the
"Possible angle" sentence from the facts in the analysis. Without a key, a
template by industry is used.

If port 3100 is taken, run `npx next dev -p 3310` and set
`APP_BASE_URL=http://localhost:3310` so links from Claude point to the right
place.

## Your own data

1. Each teammate: LinkedIn → Settings → Data privacy → Get a copy of your data
   → Connections. LinkedIn emails a zip.
2. Settings → Networks: import each `Connections.csv` with the owner's name.
   A real network replaces the demo.
3. Company names are looked up in PRH in the background: about 1–2 s per
   name, three at a time, names with decision-makers first. The drawing fills
   in as matches arrive.
4. Settings → PRH matches to check: pick the right company for names that did
   not match exactly, enter a business ID, or mark the name as not Finnish.
   Nothing is guessed.
5. Settings → Target profile: TOL codes (with a lower-priority flag),
   decision-maker titles and a note.

To refresh the radar: `node scripts/fetch-signals.mjs`. It takes about 6
minutes and caches each page.

## Use it from Claude (MCP)

```sh
claude mcp add --transport http velho http://localhost:3100/api/mcp
```

Tools: `rank_industries`, `find_people`, `people_for_theme`, `get_person`,
`get_company`, `get_radar`, `message_context`, `add_reactions`.

The skill in `claude/velho-network/SKILL.md` tells Claude which tool to use
when, and how Velho writes messages. Example sessions are in
`docs/mcp-transcripts.md`.

It runs locally only. There is no login, so don't expose the port.

## Data and privacy

- **What stays local.** These stay on this machine and are gitignored:
  - `data/sources/`: the exports
  - `data/cache/`: PRH responses
  - `data/state.json`: profile, statuses and picks
- **What goes out.**
  - Only company names, and any business IDs you pick, go to PRH open data.
  - One person's role and company facts go to the Claude API, only when a key
    is set. Their name never does.
- **What is never done.**
  - No emails are stored or exported.
  - No scraping.
  - Pasted reactions are matched by name only, and only unique matches are
    stored.
- **Deleting.** Settings → Delete my data removes networks, statuses and the
  PRH lookups of your company names. Each teammate's network can also be
  deleted on its own.

Sources: your LinkedIn Connections exports, and PRH YTJ and registered notices
open data (CC BY 4.0, https://avoindata.prh.fi).

## Test

```sh
npm test            # merge, fit, approach, titles, groups, signals, matching, offline demo
npx tsc --noEmit
```

Scripts:

| Script | What it does |
| --- | --- |
| `scripts/generate-mock-connections.mjs` | Seeded mock exports |
| `scripts/match-companies.mjs` | Match every company name now and time it |
| `scripts/fetch-signals.mjs` | Fetch the radar |
| `scripts/snapshot-demo-data.mjs` | Rebuild the demo snapshots |
