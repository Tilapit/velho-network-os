# Velho Network

Who in your team's network could need Velho, and why.

Velho's founders go through their LinkedIn networks by hand to find people at
Finnish SMEs with physical operations who could use AI and automation. Velho
Network does it for the whole team:

- **Network.** Each teammate's LinkedIn Connections export is merged by
  profile URL. Company names are matched to the Finnish trade register (PRH),
  and titles are read against your target profile. The result is one picture
  of who the team knows, who decides, and why each person could need Velho:
  a canvas drawing with every contact as a node, flowing from the teammates
  to industries to the decision-makers who fit. At rest only This week's
  five are lit; click an industry to list its decision-makers.
- **This week.** Five people to reach, chosen by code: fresh registered
  changes and reactions first, nobody already contacted, senders spread
  across the team. "Write in Claude" copies a prompt for your own Claude.
- **Reactions.** Paste a post's reactions list from LinkedIn; names are
  matched to the network and count in the ranking.
- **LinkedIn API (EU).** Instead of a CSV, a teammate in the EEA can fetch
  their connections with LinkedIn's Member Data Portability API and their
  own token: `npm run linkedin:sync -- --owner "Name" --dry-run` first, then
  with `DATA_DIR=data-real` to import next to the demo.
- **Signal radar.** Companies in your industries where the trade register
  shows a new managing director, new money, a merger or a board change in the
  last 90 days. Warm rows come first: someone in the team knows a person
  there.
- **Themes.** "We are hosting a logistics roundtable, who should we invite?"
- **Claude connector.** The same data as an MCP server, used from your own
  Claude. Ranking and filtering stay in code; Claude picks the filters and
  writes the text. It works both ways: tell Claude you sent a message and,
  after asking, it records the status, so nobody recommends that person
  again. A week without a reply puts them under "Follow-up due".

Nothing is sent to anyone. Statuses only record what the team did.

## How AI is used, and where it is not

**Finding and ranking people uses no LLM.** It is plain TypeScript with unit tests (`lib/`, `tests/`), so the same data always gives the same list, and every reason can be traced:

1. **Import:** LinkedIn connections (official DMA API or CSV) are parsed and merged across teammates by profile URL.
2. **Company match:** each company name is looked up in PRH's open YTJ API. Exact normalised name = verified; one close candidate = "check"; several or none = unmatched. Nothing is guessed.
3. **Filters:** line of business (TOL code) against the target profile; Employer Register (no employees = too small); a not-target list for large groups; decision-maker titles from a keyword list (Finnish, Swedish, English), with student, trainee and association roles excluded.
4. **Score:** fixed weights: strong fit, people known by two or more teammates, recent PRH registered changes (new managing director and new money weigh 3, merger and board 2, less for older notices), and reactions to the team's posts (+5, +2 per further post). The industry table, This week and the radar all use the same scores.
5. **Approach:** decision-maker → direct message; colleague at a target company → ask for an intro; not in the network but reacted to a post → connection request.

**Claude is used for language only:**
- In the team's own Claude, through the MCP server (`/api/mcp`) and the skill (`claude/velho-network/`). Claude turns a Finnish question into tool calls with filters, gets ranked facts back, and writes the answer and the message. It cannot change the ranking.
- Message drafts use only the facts from `message_context` plus the voice rules in `config/velho-voice.md` (short, Finnish, one ask, never mention registers or invent facts). Without an API key, templates in the same voice are used.

**How it was built:** with Claude Code, from written prompts. They are in `docs/prompts/` (spec, mock data, two overnight builds), and `PROGRESS.md` logs every decision.

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
place. `docs/DEMO.md` is a 3-minute demo script.

## Your own data

1. Each teammate: LinkedIn → Settings → Data privacy → Get a copy of your data
   → Connections. LinkedIn emails a zip.
2. Settings → Networks: import each `Connections.csv` with the owner's name.
   A real network replaces the demo.
3. Company names are looked up in PRH in the background: about 0.5 s per
   name, three at a time, names with decision-makers first. The import form
   shows the wait before you upload (from the file's distinct company names)
   and after; the progress bar shows time left. The drawing fills in as
   matches arrive. The importer takes the export as LinkedIn ships it, or
   re-saved by Excel (semicolons, Finnish dates).
4. Settings → PRH matches to check: pick the right company for names that did
   not match exactly, enter a business ID, or mark the name as not Finnish.
   Nothing is guessed.
5. Settings → Target profile: TOL codes (with a lower-priority flag),
   decision-maker titles and a note.

6. Settings → Post reactions: paste a post's reactions list (select it on
   LinkedIn, copy). Matches are stored; names two people share go to a short
   review; names that match no one are shown once and never stored.

To refresh the radar: `node scripts/fetch-signals.mjs`. It takes about 6
minutes and caches each page.

### The team's real data (private)

The team's real networks, statuses and PRH cache live in a separate private
repository, `velho-network-data`, cloned into `data-real/` (which this repo
gitignores). It holds real personal data: never share it, and never use it
when showing the app to judges; the demo in `data/` is invented.

```sh
# once, inside this repo (needs access to the private repo)
gh repo clone Tilapit/velho-network-data data-real

# run on the real data
DATA_DIR=data-real npm run dev

# after a session: commit what changed (statuses, imports, lookups)
git -C data-real add -A && git -C data-real commit -m "Update" && git -C data-real push
# before you start: get the others' changes
git -C data-real pull
```

`state.json` is one file for the whole team, so pull before you work and
push after, and avoid two people editing at once. Tokens such as
`LINKEDIN_DMA_TOKEN` stay in each person's own `.env.local`, never in
`data-real/`.

## Use it from Claude (MCP)

```sh
claude mcp add --transport http velho http://localhost:3100/api/mcp
```

Tools: `this_week`, `rank_industries`, `find_people`, `people_for_theme`,
`get_person`, `get_company`, `get_radar`, `message_context`,
`add_reactions`.

The skill in `claude/velho-network/SKILL.md` tells Claude which tool to use
when, and how Velho writes messages. `npm run skill:zip` (or Settings →
Connect to Claude) gives the zip to upload to Claude. Example sessions are in
`docs/mcp-transcripts.md`.

**claude.ai and Claude Desktop** need a public URL (untested):

```sh
export MCP_TOKEN=$(openssl rand -hex 24)
npm run build
npm start          # terminal 1: the production server on 127.0.0.1:3100
npm run tunnel     # terminal 2: a Cloudflare quick tunnel; prints the URL and header
```

In claude.ai: Customize → Connectors → + Add → Add custom connector, the
printed URL, Authentication "No sign in", and under Request headers
`Authorization` = `Bearer <token>`. Claude Desktop uses the same connectors.
Claude connects from Anthropic's cloud, hence the public URL.

With `MCP_TOKEN` set, `/api/mcp` needs `Authorization: Bearer <token>` and
every page answers only on this machine, so the tunnel exposes the connector
and nothing else. The tunnel script refuses the dev server, which answers
some of its own endpoints before any check runs. `npm run dev` and `npm
start` listen on 127.0.0.1 only, and other websites open in your browser
cannot change anything in the app.

## Data and privacy

- **What stays local.** These stay on this machine and are gitignored:
  - `data/sources/`: the exports
  - `data/cache/`: PRH responses
  - `data/state.json`: profile, statuses and picks
- **What goes out.**
  - Only company names, and any business IDs you pick, go to PRH open data.
  - One person's role and company facts go to the Claude API, only when a key
    is set: for the "Possible angle", and for "Draft here", where the name is
    replaced by a placeholder and put back on this machine. Their name never
    goes.
- **What is never done.**
  - No emails are stored or exported.
  - No scraping.
  - Pasted reactions are matched by name. With several people of that name,
    the company in their headline or the degree marker against the post's
    author decides; otherwise a teammate picks. Names that match no one are
    never stored.
- **Deleting.** Settings → Delete my data removes networks, statuses and the
  PRH lookups of your company names. Each teammate's network can also be
  deleted on its own.

Sources: your LinkedIn Connections exports, and PRH YTJ and registered notices
open data (CC BY 4.0, https://avoindata.prh.fi).

## Test

```sh
npm test            # merge, fit, approach, titles, groups, signals, matching, importer, reactions, this week, offline demo
npx tsc --noEmit
```

Scripts:

| Script | What it does |
| --- | --- |
| `scripts/generate-mock-connections.mjs` | Seeded mock exports; `--rows 10000 --seed 10010 --out data/stress/10k` for stress files |
| `scripts/make-demo-reactions.mjs` | The demo's two pasted reactions lists |
| `scripts/tunnel.sh` (`npm run tunnel`) | Cloudflare quick tunnel for claude.ai, only with `MCP_TOKEN` |
| `scripts/match-companies.mjs` | Match every company name now and time it |
| `scripts/fetch-signals.mjs` | Fetch the radar |
| `scripts/snapshot-demo-data.mjs` | Rebuild the demo snapshots |
