# Overnight progress

Branch `overnight`. Brief: `OVERNIGHT_PROMPT.md` (wins on conflict), then
`NETWORK_DEMO_PROMPT.md`, `MOCK_DATA_PROMPT.md`, `PRODUCTION_MCP_PROMPT.md`, `design/`.

## Morning report

(written at the end)

## Steps

| Step | Budget | Status |
| --- | --- | --- |
| 1. Mock data (3 networks) | 45 min | in progress (started 23:25) |
| 2. Data layer | 2 h | |
| 3. Signal radar | 1 h 15 | fetch started early (23:27), see below |
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

## Open issues

- PRH has no headcount. A director at a large group's subsidiary can show as
  Strong.

## Next step

Write `scripts/generate-mock-connections.mjs`.
