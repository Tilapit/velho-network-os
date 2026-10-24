# Overnight progress

Branch `overnight`. Brief: `OVERNIGHT_PROMPT.md` (wins on conflict), then
`NETWORK_DEMO_PROMPT.md`, `MOCK_DATA_PROMPT.md`, `PRODUCTION_MCP_PROMPT.md`
and `design/`.

## Part 2 (night of 25 Oct): working log

Brief: `OVERNIGHT_2_PROMPT.md`. Started 00:32. `git tag demo-v1` is on
b935098, the part-1 demo, so a working demo always exists.

| Step | Budget | Status |
| --- | --- | --- |
| 1. Network drawing as a neural network | 2 h | done 01:20 |
| 2. Real-data proof | 1 h | |
| 3. Reactions | 1 h | |
| 4. This week + Write in Claude | 45 min | |
| 5. claude.ai and Claude Desktop | 45 min | |
| 6. Polish and hand-over | 45 min+ | |

Decisions (part 2):

- **Port.** 3000 and 3100 are taken by other apps; everything tonight runs on
  3310 (`APP_TODAY=2026-10-24 APP_BASE_URL=http://localhost:3310 PRH_OFFLINE=1
  npx next dev -p 3310`).
- **Screenshots and video** use `playwright-core` with the system Chrome
  (`channel: "chrome"`), installed in a scratch folder, not in the project.
- **Drawing layout** (`components/NetworkDrawing.tsx`):
  - Target bands are the industry groups where someone is in the profile.
    The rest (Other industries, Not matched, Abroad) share 26% of the height
    at the bottom, drawn smaller and dimmer, under "Outside your industries".
  - Each band is a cloud: best-candidate (blue-noise) sampling inside a
    rounded blob, seeded per group, so it is organic but never random-looking.
    Fits lean to the right of their cloud, towards their industry.
  - Every link is a bezier stroked on its own with `lighter` blending, so
    dense flows add up and glow. Grey links are batched and nearly invisible.
    Link and glow alpha scale with 1/sqrt(people) above 2,600 people, so a
    15,000-person network glows without burning out.
  - Decision-makers who fit zigzag through 2–4 sub-columns over the full
    height, in band order, so their links barely cross. The top 8 are
    labelled; every other node has a tooltip.
  - Industry node size is relative to the group with the most fits.
- **Motion.** A 1.5 s pulse sweeps left to right once, on first load. A
  selected person gets particles along their path. Both are off with
  prefers-reduced-motion.
- **Zoom.** Ctrl or Cmd + scroll (and trackpad pinch) zooms around the
  pointer; plain scroll keeps scrolling the page. Buttons for +, − and Reset.
  Drag pans when zoomed. Layers re-render crisp 140 ms after a gesture.
- **Touch.** The first tap shows who it is and lights the path, the second
  opens the person. Below 760 px the drawing uses short labels and no
  name labels; below 1024 px the page is one column: title and filters,
  drawing, panel, table.
- **Before and after.** The part-1 images are kept in `screens/part1/`.

## Morning report

**Status: demo-ready.**
- All six steps are done and committed on `overnight` (one commit per step,
  plus fixes).
- `npm test` passes: 18 tests.
- `npx tsc --noEmit` is clean and `npm run build` passes.
- No console errors on any page at 1440 px or 390 px.

How to start the demo, with a 3-minute script: `docs/DEMO.md`.

### What works

- **Mock data.** Three seeded mock LinkedIn exports, with invented people at
  real companies:

  | Owner | Rows | Shared with the others |
  | --- | --- | --- |
  | You | 1,500 | |
  | Co-founder | 860 | 270 |
  | Board member | 300 | 60 |

  - Merged, that is 2,333 people.
  - 158 target SMEs, each verified in PRH. Eight of them were chosen because
    PRH shows a recent change, so the radar and the network meet.
  - Every row parses.
- **Network page (`/`).**
  - A canvas drawing of every contact: owners → industry bands → industry
    groups → the 192 decision-makers who fit.
  - The strongest 8 are lit and labelled.
  - Hover an industry to light it. Click a person for their path and
    analysis.
  - Owner filter, the "Strongest 8 of 192" list, and a sortable industry
    table with a score bar.
- **Person analysis** (side panel and `/people/[id]`):
  - who knows them and the suggested sender
  - reasons with source pills (LinkedIn title, PRH, PRH notices, Your network,
    Your team)
  - what we don't know (headcount always, plus a note when PRH lists the
    company as an Oyj)
  - fit and why, approach, a "Possible angle" labelled Inferred, and status
    buttons
- **PRH matching** against YTJ, cached, never blocking a page:
  - exact name → verified
  - one close candidate → "check"
  - several or none → unmatched, until someone picks a company, enters a
    business ID or marks the name "not Finnish" in Settings
- **Signal radar (`/radar`).** PRH registered notices from the last 90 days:
  MD change, new money, merger, board.
  - 3,151 companies in the target industries; 35 have a warm path.
  - Filters for type, industry, known or unknown, and 30 or 90 days.
- **Other pages.**
  - `/themes`: invite or ask for an intro.
  - `/companies/[id]`: PRH facts, notices, who we know there, and a "Not a
    target company" button.
  - `/settings`: networks per owner (upload or delete), load demo, target
    profile, PRH matches to check, CSV export, MCP info, "Delete my data".
- **MCP server** (`/api/mcp`, stateless Streamable HTTP) with all 8 tools.
  Every item has a URL back into the app.
  - `claude/velho-network/SKILL.md` covers which tool to use, the
    workflows, Velho's tone and privacy.
  - Tested with a real `claude mcp add` and three questions: weekly review in
    Finnish, logistics roundtable, logistics radar. All three answered
    correctly, using only the tools. See `docs/mcp-transcripts.md` (about
    $0.30–0.55 per question on Claude Code).
- **Offline demo.** PRH match and radar snapshots ship in `data/demo/`, so
  the demo works on a fresh clone, without network, or after "Delete my
  data".

### Import timing

These figures are for the 1,500-row "You" export with an empty cache.

| | Time |
| --- | --- |
| Parse and model | 49 ms |
| PRH matching, cold | 4 min 45 s (545 company names, 531 requests, 3 in flight) |
| Everything, cached | 65 ms |

- The page is usable during a cold import: it fills in as matches land, with
  names that have decision-makers first.
- All three networks cold: about 4 minutes. That run had the target SMEs
  already cached.
- The radar fetch is about 6 minutes (604 pages) and is cached per page.

### Matches in the demo network

- **Company names:** 702 distinct.
  - 444 matched exactly
  - 50 close matches ("check")
  - 40 with several candidates
  - 158 not in PRH, of which 33 look international
  - 10 not a company (self-employed and similar)
- **Needing a look in Settings:** 207 names, covering 832 people and 135
  decision-makers. Most are startups' brand names, universities, ecosystem
  organisations and taglines, which is realistic. The target SMEs all match.

### Steps for the founder tonight (real data)

1. Each person: LinkedIn → Settings → Data privacy → Get a copy of your data
   → tick only **Connections** → wait for the email (usually minutes) → unzip.
2. `APP_TODAY` is not needed for real data:
   - `npm run dev` (port 3100)
   - or `npx next dev -p 3310` with `APP_BASE_URL=http://localhost:3310` if
     3100 is taken
3. Settings → Networks: import your `Connections.csv` as "You". The demo
   networks are replaced. Then add the co-founder's under their name.
4. Wait about 4–5 minutes per 1,500 rows for the PRH lookups. A progress bar
   shows on the Network page. The drawing and list fill in as matches land.
5. Settings → PRH matches to check: work through the top of the list. It is
   ordered by decision-makers, so the first 20–30 are what matter.
6. Settings → Target profile: adjust the TOL codes and titles. On company
   pages, mark large groups as "Not a target company".
7. Optional: `ANTHROPIC_API_KEY` in `.env.local` for Claude-written angles.
8. Optional: `claude mcp add --transport http velho http://localhost:3100/api/mcp`
   and the skill from `claude/velho-network/`.

### Open issues

- **No headcount in PRH.**
  - Directors at large groups' Finnish subsidiaries can still show as Strong
    fits; Valmet Automation, KONE Industrial and Kemira appear in the demo.
  - Mitigations: the Oyj note in "What we don't know", and "Not a target
    company" per company.
- **The radar is company-level only**, and PRH notices name no people.
  - Board changes are frequent (8,552 in 90 days) and weak on their own.
  - A managing-director notice is shown as "changed", because the API does not
    say whether someone was appointed or left.
- **Pick lists.** For very common names, the review list can only show
  candidates from PRH's first result page. Typing the business ID always
  works.
- **Port 3100.** Another project (Mindy, `next-server`) was running on 3100
  overnight. I left it alone and used 3310.
- **Local only.** The MCP endpoint has no auth.
- **Business Finland funding decisions.** No open dataset with a clear
  licence was found, so they are left for later.

### Next steps (not tonight, per the brief)

- **Hosting** in an EU region, with Postgres behind the same interfaces.
- **Auth:** a bearer token for the connector, and app login. Per-user OAuth
  before wider use.
- **Integrations:** a REST API under `/api/v1` with scoped keys, webhooks,
  an audit log of agent calls, CRM integration and per-owner GDPR export.
- **Data:** the LinkedIn DMA connector, and job postings once a permitted
  source exists.

## Steps

All times are Helsinki time, night of 24–25 Oct 2026.

| Step | Budget | Status |
| --- | --- | --- |
| 1. Mock data (3 networks) | 45 min | done 23:41 |
| 2. Data layer | 2 h | done 00:00 |
| 3. Signal radar | 1 h 15 | fetched 23:33; queries done 00:00; page and fixes 00:16 |
| 4. Web app UI | 2 h 30 | done 00:11 |
| 5. MCP server + skill | 1 h 30 | done 00:14; Claude test 00:15–00:20 |
| 6. Verify and hand over | 45 min | done; screenshots in `screens/`, `docs/DEMO.md` |

## Decisions

- **Port.** The app stays on 3100 (`npm run dev`). `APP_BASE_URL` defaults
  to `http://localhost:3100`. 3100 was taken by another app overnight, so
  the testing ran on 3310.
- **PRH endpoints.**
  - YTJ: `GET /opendata-ytj-api/v3/companies?name=` and `?businessId=`.
  - Registered notices:
    `GET /opendata-registerednotices-api/v3/?entryCode=&noticeRegistrationDateStart=&noticeRegistrationDateEnd=&page=`.
    This works across all companies, 50 per page, and includes each company's
    TOL code, so the radar is one pass per entry code. No per-company crawl is
    needed.
- **Signal codes** (from `/description?code=EC`):

  | Signal | Weight | Entry codes |
  | --- | --- | --- |
  | Managing director changed | 3 | TOIM |
  | New money | 3 | ANTIP, KOROI, OANTI, OANKO |
  | Merger or demerger | 2 | SULLOP, SULSUU, JAKLOP, JAKSUU |
  | Board changed | 2 | HAL |

  OPO ("share capital", about 6,800 in 90 days) is left out because it is
  mostly form conversions.
- **Excluded from signals:**
  - companies in bankruptcy, liquidation or restructuring
  - housing and property companies
  - companies founded in the window or the 30 days before it, since their
    "new MD" is the founding. This cut MD changes from 4,609 to 2,158.
- **Radar.**
  - Taxis (TOL 4932) are lower priority by default.
  - Lower-priority rows count half.
  - Score is the weight of each change type × recency (1, 0.75 or 0.5).
- **Signals are a snapshot.** It is stored with its window and fetch time and
  refreshed with `node scripts/fetch-signals.mjs`. The app never fetches
  during a demo.
- **PRH concurrency.** 3 in flight, starts 250 ms apart, back-off on 429/503.
- **Matching fallbacks.**
  - For more than 100 hits: `<name> Oy`, `Oy <name>`, `<name> Oyj` and
    `<name> Ab`. This finds KONE Oyj among 11,942 "KONE" hits.
  - Without generic words ("RELEX Solutions" → "RELEX"). Those matches are
    inferred only.
  - Well-known international names ("Amazon", "Stripe") are never verified
    by name alone.
- **Titles at real companies in the mock.** No CEO, toimitusjohtaja, VD,
  managing director, owner or founder titles for invented people at any real
  company. Those appear only on stealth or self-employed rows.
- **Owners in the mock** are role labels: "You", "Co-founder", "Board member".
- **Data layer.**
  - Networks are stored in `data/sources/networks/<owner>.csv` plus
    `owners.json`.
  - People merge by profile URL only. Rows without a URL stay separate.
  - The suggested sender is the earliest connection.
  - Contact ids are a sha1 of the profile key, so no names appear in URLs or
    logs.
- **Matching never blocks a page.** The model reads the PRH cache only. A
  background job (3 workers) looks up uncached names, those with
  decision-makers first.
- **Industry groups.** 11 groups, plus "Not matched" and "Abroad" (grey).
  Every contact is in exactly one, so the band counts add up to the total.
- **"Abroad".** Not in PRH, or only a close match, and either a foreign
  company form (AB, OÜ, GmbH, AG, SE, Inc, LLC; "Ab" only without "Oy") or a
  well-known international employer.
- **Titles.**
  - C-level and owner titles always count as decision-makers.
  - Other titles need a profile term plus a manager-or-higher level. Junior
    words (planner, engineer, specialist, worker) veto at manager level.
  - Finnish and Swedish forms are matched (tuotanto-, -johtaja, -direktör,
    -chef). "Työnjohtaja", "puheenjohtaja" and "Product Owner" don't count.
- **Fit.**
  - Strong: an exec or director title in a CEO, operations or production
    role, at a company in a target industry that is not lower priority.
  - Possible: every other decision-maker at a target company.
  - A company marked "Not a target company" takes its people off the list.
- **Approach:** direct (fit), ask_intro (at a target company, not a
  decision-maker), skip.
- **Score** (`lib/network.ts` WEIGHTS) is for ordering only:

  | Factor | Points |
  | --- | --- |
  | Fit | strong 40, possible 20 |
  | Verified match | 10 |
  | Level | exec 15, director 10, board 6, manager 4 |
  | Signal | 4 × weight of the strongest, +2 per extra type |
  | Known by 2+ teammates | 8 |
  | Colleagues at the company | 3 each, max 9 |
  | Connected in the last year | 3 |
  | Reacted | 5 |
- **Old prototype removed.** Score, recommendations, drafts, engagement,
  intelligence, the cytoscape graph, the story demo and its tests. Nothing in
  the new scope used them. `Connections-small.csv` is kept and parsed by a
  test.
- **Claude angle.**
  - `claude-opus-5-5` at low effort, with the server-side refusal fallback.
  - It receives role and company facts only, never the person's name.
  - It runs when a person who fits is opened and a key is set, and is cached
    in `state.json`.
- **Message examples** in `message_context` use made-up companies, so no real
  company gets an invented fact.
- **Reactions** (`add_reactions`) match by full name. Only names with exactly
  one match in the network are stored, as inferred. Anything else is
  returned and never stored.
- **"Delete my data"** removes networks, `state.json` and the PRH lookups of
  the team's company names. It keeps the radar snapshot, which is public data
  not derived from anyone's network.
