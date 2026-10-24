# Overnight progress

Branch `overnight`. Brief: `OVERNIGHT_PROMPT.md` (wins on conflict), then
`NETWORK_DEMO_PROMPT.md`, `MOCK_DATA_PROMPT.md`, `PRODUCTION_MCP_PROMPT.md`, `design/`.

## Morning report

(written at the end)

## Steps

| Step | Budget | Status |
| --- | --- | --- |
| 1. Mock data (3 networks) | 45 min | done 23:41 |
| 2. Data layer | 2 h | done 00:00 |
| 3. Signal radar | 1 h 15 | data fetched 23:33 (21,080 signals, 604 pages, 6 min); radar queries in lib/queries.ts |
| 4. Web app UI | 2 h 30 | |
| 5. MCP server + skill | 1 h 30 | |
| 6. Verify and hand over | 45 min | |

## Decisions

- **Port.** The app already runs on 3100 (`npm run dev`). `APP_BASE_URL`
  defaults to `http://localhost:3100`, and the `claude mcp add` command uses
  3100, not 3000.
- **PRH endpoints.** YTJ: `GET /opendata-ytj-api/v3/companies?name=` and
  `?businessId=`. Registered notices: `GET
  /opendata-registerednotices-api/v3/?entryCode=&noticeRegistrationDateStart=&noticeRegistrationDateEnd=&page=`.
  This works across all companies, 50 per page, and includes each company's
  TOL code, so the radar is one pass per entry code. No per-company crawl is
  needed.
- **Signal codes** (from `/description?code=EC`):

  | Signal | Weight | Entry codes |
  | --- | --- | --- |
  | Managing director changed | 3 | TOIM |
  | New money | 3 | ANTIP (decision to issue shares), KOROI (capital increase), OANTI/OANKO (new shares) |
  | Merger or demerger | 2 | SULLOP, SULSUU, JAKLOP, JAKSUU |
  | Board changed | 2 | HAL |

  OPO ("share capital", about 6,800 in 90 days) is left out because it is
  mostly form conversions, not new money.
- **Excluded from signals.** Companies in bankruptcy, liquidation or
  restructuring (KONK, SELTILA, SANE), notices carrying a bankruptcy or
  liquidation code, and housing or property companies (forms 2, 10).
- **Signals are a snapshot.** `data/cache/prh/signals.json` holds the window
  and fetch time. The app never fetches during a demo; "Refresh signals" runs
  the fetch.
- **PRH concurrency.** 3 in flight, starts 250 ms apart, back-off on 429/503.
- **Owners in the mock.** "You" (1,500 rows), "Co-founder" (~860),
  "Board member" (~300). These are role labels, not invented names for real
  people.
- **Titles at real companies.** No CEO, toimitusjohtaja, VD, managing
  director, owner or founder titles for invented people at any real company,
  since headcount can't be checked. Those titles appear only on
  stealth/self-employed rows.
- **Carried over from the plan.**
  - Story demo files and the 57-row file move to `data/demo/story/` for the
    old tests.
  - Dark tokens app-wide.
  - Fit: Strong = senior title in a CEO, operations or production role at a
    target industry not flagged lower priority. Possible = the rest.
  - Default industries: manufacturing 10–33, construction 41–43, wholesale
    46, transport 49–53. Lower priority: 01–09, 35–39.
  - PRH has no headcount, so it is always shown as Missing.

- **Data layer.**
  - Networks live in `data/sources/networks/<owner>.csv` plus `owners.json`.
  - People merge by profile URL only. Rows without a URL stay separate.
  - The suggested sender is the earliest connection.
  - Contact ids are a sha1 of the profile key, so no names appear in URLs or logs.
- **Matching never blocks a page.** The model reads the PRH cache only. A
  background job (3 workers) looks up uncached names, those with
  decision-makers first.
  - Cold run for all three mock networks (about 700 names, most target SMEs
    already cached): 3 min 54 s.
- **"Abroad".** Not in PRH (or only a close match) and either a foreign company
  form (AB, OÜ, GmbH, AG, SE, Inc, LLC; "Ab" only without "Oy") or a short list
  of well-known international employers.
- **Titles.**
  - C-level and owner titles always count as decision-makers.
  - Other titles need a profile term plus a manager-or-higher level. Junior
    words (planner, engineer, specialist, worker) veto at manager level.
  - Finnish and Swedish forms are matched (tuotanto-, -johtaja, -direktör,
    -chef). "Työnjohtaja", "puheenjohtaja" and "Product Owner" are excluded.
- **Score** (`lib/network.ts` WEIGHTS, for ordering only):

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
  - `claude-opus-5-5` at low effort with the server-side refusal fallback.
  - It receives role and company facts only, never the person's name.
- **Message examples** in `message_context` use made-up companies, so no real
  company gets an invented fact.

## Open issues

- PRH has no headcount. A director at a large group's subsidiary can show as
  Strong.

## Next step

Step 4, the web app UI. Read `design/*.dc.html` first.
