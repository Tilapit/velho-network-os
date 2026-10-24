# Overnight progress

Branch `overnight`. Brief: `OVERNIGHT_PROMPT.md` (wins on conflict), then
`NETWORK_DEMO_PROMPT.md`, `MOCK_DATA_PROMPT.md`, `PRODUCTION_MCP_PROMPT.md`
and `design/`.

## Morning report, part 2 (night of 24–25 Oct)

**Status: all six steps done and committed on `overnight`.** `npm test`
passes (37 tests, 19 of them new), `npx tsc --noEmit` is clean and `npm run build`
passes. No console errors on any page at 1440 or 390 px. Nothing was
reverted; `demo-v1` still tags the part-1 demo.

Start the demo: `docs/DEMO.md` (3 minutes). Video of the app part:
`media/demo-walkthrough.webm` (86 s, 1440×900).

### What changed tonight

1. **The network drawing** (`components/NetworkDrawing.tsx`), rebuilt:
   - Owners → contacts → industries → decision-makers who fit, left to
     right. Every contact is a node, in an organic seeded cloud per
     industry; your industries get 74% of the height, the rest is
     compressed below in grey.
   - Every link is drawn, additively, so dense flows glow and sparse ones
     fade.
   - The 192 decision-makers zigzag through three sub-columns over the
     full height; the strongest 8 are labelled; everything has a tooltip.
   - A 1.5 s pulse on first load, particles along a selected person's
     path, nothing moving with reduced motion.
   - Zoom (Ctrl/⌘ + scroll, or the + − buttons) and drag to pan.
   - At 390 px it scales to the width, uses short labels, and a tap shows
     who it is (a second tap opens them). Title and filters now come
     before the list.
2. **Real-data proof.** Stress files of 5,000 and 10,000 rows (and the
   whole team at that scale, 15,547 people): first frame of the drawing in
   0.2–0.3 s, hover redraws ≤1 ms, 60 fps with particles. The importer
   handles BOM, CRLF, the preamble or none, reordered or extra columns,
   quoted commas and newlines, Excel's semicolon re-save with Finnish
   dates, and old exports without URLs (9 new importer tests). The import form
   tells you how long PRH will take before you upload.
3. **Reactions.** Settings → Post reactions: paste a post's reactions list
   as copied from LinkedIn → Match names → check the few that two people
   share → Save. Unmatched names are shown once and never stored. A
   reaction is a reason with a "Reaction" pill, 5 points (+2 per further
   post), and the drawing's **Reacted recently** toggle. The demo ships two
   posts (42 reactions). MCP `add_reactions` uses the same parser and
   matcher, from pasted text or from names Claude reads off a screenshot.
4. **This week** at the top of the Network panel: five people chosen by
   code (fresh registered changes and reactions first, nobody already
   contacted, one per company, senders spread). **Write in Claude** on
   every person copies a prompt for your own Claude; **Draft here** appears
   with an API key. MCP has `this_week` too.
5. **claude.ai and Claude Desktop.** Optional `MCP_TOKEN`: the connector
   then needs the bearer token, and pages answer only on this machine.
   `npm run tunnel` opens a Cloudflare quick tunnel and prints the URL and
   header. `npm run skill:zip` and Settings → Connect to Claude give the
   skill zip.
6. **Hand-over.** Screenshots of every page at 1440 and 390 in `screens/`,
   the demo video, the demo script, README and CLAUDE.md.

### Before and after

Side by side: `screens/before-after-network.png`.

| Before (part 1) | After |
| --- | --- |
| `screens/part1/network-1440.png` | `screens/network-1440.png` |
| `screens/part1/network-390.png` | `screens/network-390.png` |
| `screens/part1/network-person-1440.png` | `screens/network-person-1440.png` |
| | `screens/network-industry-hover-*.png`, `screens/network-reacted-*.png` |

Compared honestly:
- **Better.**
  - It reads as a network now: glowing flows from the three of you into
    industry clouds, through the industries, out to the decision-makers.
  - Your industries fill the picture; the 1,746 people outside them are
    three dim clouds at the bottom instead of most of the space.
  - The decision-makers span the full height in three staggered columns
    instead of one bar of dots.
  - At 390 px the whole drawing is visible instead of cropped.
- **Still true.**
  - The decision-maker column is dense: 192 dots in about 550 px. Names
    are in the tooltips and in the list, not on the canvas.
  - At 15,000 people the clouds become a texture; the drawing still reads,
    but individual dots are tiny. Zoom helps.
  - When zoomed in, labels grow with the drawing, like a map.
  - The pulse is subtle on a fast machine: it is over in 1.5 s.
  - The counts for Other industries (899 → 859) and Abroad (106 → 146)
    differ between the two images, but not because of tonight: the part-1
    image predates part 1's last matching fix. The `demo-v1` code gives
    859 and 146 on today's data too.

### Performance (production build, Chrome, DPR 2, this Mac)

| Network | People | Model, cold | First frame | Hover redraw (p95) | Frame with particles |
| --- | --- | --- | --- | --- | --- |
| Demo | 2,333 | 131 ms | 93 ms | 1 ms | 16.7 ms |
| 5,000 rows | 5,000 | 273 ms | 157 ms | 1 ms | 16.7 ms |
| 10,000 rows | 10,000 | 268 ms | 205 ms | 1 ms | 16.7 ms |
| Whole team at 10k scale | 15,547 | 363 ms | 306 ms | 1 ms | 16.7 ms |

PRH lookups for a real import: 0.53 s per company name not yet looked up,
from part 1's cold run. The mock 10k file has 1,045 distinct names (about 9
minutes cold); a real 10,000-row export probably has 3,000–5,000, so 25–45
minutes in the background. The import form shows the real number before
upload.

### What is untested

- **claude.ai custom connector.** No public URL tonight: `cloudflared` is
  not installed and the brief said not to open a tunnel. Anthropic's help
  article (checked tonight) says the custom connector dialog has
  Authentication "No sign in" and a Request headers field for a bearer
  token, and that Claude connects from Anthropic's cloud. The steps in
  Settings, the README and the tunnel script follow it; it has not been
  tried end to end.
- **Claude Desktop** via `npx mcp-remote … --header`: written down, not run.
- **Draft here**: no `ANTHROPIC_API_KEY` on this machine; the prompt
  building is unit-tested (no name in what is sent), the API call is not.
- **Real LinkedIn copy text.** The reactions fixtures follow LinkedIn's
  reactions list as I know it (name twice or "View … profile", "· 1st",
  headline, buttons). Paste one real list in the morning to confirm.
- **Real exports of 5,000+ rows**: only the mock generator's files.
- **Browsers**: Chrome only (desktop and mobile emulation). Not Safari,
  Firefox or a real phone.

### Code review

An independent review of tonight's diff (`demo-v1..HEAD`) ran in the
background at the end; its findings and what was fixed are in the working
log under "Code review".

### Next steps

- Paste a real reactions list and import a real export; check the review
  list and the PRH matches.
- Install `cloudflared` (`brew install cloudflared`), run `npm run tunnel`,
  and add the connector in claude.ai with the printed URL and header. For
  more than the founders, replace the shared token with OAuth.
- Hosting, OAuth, CRM integration, LinkedIn DMA connector, REST API and
  webhooks remain out of scope, as in part 1.

## Part 2 (night of 25 Oct): working log

Brief: `OVERNIGHT_2_PROMPT.md`. Started 00:32. `git tag demo-v1` is on
b935098, the part-1 demo, so a working demo always exists.

| Step | Budget | Status |
| --- | --- | --- |
| 1. Network drawing as a neural network | 2 h | done 00:51 |
| 2. Real-data proof | 1 h | done 00:58 |
| 3. Reactions | 1 h | done 01:09 |
| 4. This week + Write in Claude | 45 min | done 01:17 |
| 5. claude.ai and Claude Desktop | 45 min | done 01:24 |
| 6. Polish and hand-over | 45 min+ | done 01:40, then the code review |

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
- **Stress files.** `node scripts/generate-mock-connections.mjs --rows 10000
  --seed 10010 --out data/stress/10k` (and 5,000 with seed 5005) scales all
  three mock networks; `data/stress/` is gitignored. Measured on this Mac,
  production build (`next start`), Chrome at DPR 2:

  | Network | Rows | People | Parse | Model, cold | First frame of the drawing | Hover redraw (p95) | Frame with particles |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Demo | 2,660 | 2,333 | 10 ms | 131 ms | 93 ms | 1 ms | 16.7 ms |
  | 5k, "You" only | 5,000 | 5,000 | 14 ms | 273 ms | 157 ms | 1 ms | 16.7 ms |
  | 10k, "You" only | 10,000 | 10,000 | 23 ms | 268 ms | 205 ms | 1 ms | 16.7 ms |
  | 10k, whole team | 17,733 | 15,547 | 43 ms | 363 ms | 306 ms | 1 ms | 16.7 ms |

  First frame is from navigation start, with the model already built (it is
  memoised per file change; the first request after a server start adds the
  "model, cold" column). No long tasks while sweeping the mouse over the
  drawing. Canvas timings in JS exclude GPU rasterisation; the steady 16.7 ms
  frames with particles show it is not a bottleneck. Nothing needed fixing.
- **Importer.** Header found by its cells (any column order, quoted, after
  the Notes preamble or first), delimiter guessed (comma, semicolon, tab),
  BOM and CR stripped. Required: First Name, Last Name, Company, Position.
  URL and Connected On are optional with a warning (an older export still
  imports; its people never merge). Dates also accept `24.10.2026` and
  `10/24/2026`. Fixtures in `tests/fixtures/`, tests in
  `tests/ingest.test.ts`.
- **Cold PRH estimate.** 0.53 s per company name not yet looked up (the
  demo's cold run: 545 names in 4 min 45 s). The import form reads the file
  in the browser and shows the worst case before upload; after the import
  it shows how many names are really left; the progress bar shows time
  left at the job's own pace. Note: the mock 10k file reuses a pool of
  about 1,000 companies; a real 10,000-row export likely has 3,000–5,000
  distinct names, which is 25–45 minutes cold.
- **Reactions** (`lib/reactions.ts`, Settings → Post reactions, MCP
  `add_reactions`):
  - The parser anchors on what LinkedIn's copied list always has after a
    name: its repeat, a "View … profile" line or a degree marker ("· 1st",
    "• 2nd", "3rd+", "1st degree connection"). The first line after the
    marker is the headline. Reaction counts, buttons (Connect, Follow,
    Message, Load more), status lines and pronouns are dropped; credentials
    after a comma and emoji are cleaned off names. Without any of those
    anchors, each name-like line is a person (a plain list).
  - Matching never guesses. Same name key (folded, letters only) first.
    With the post's author known, "1st" keeps only people the author knows
    and "2nd"/"3rd" only people they do not. With several left, the company
    in the headline decides. Otherwise it goes to review: the team picks one
    or none. Unmatched names are returned once, never stored or logged.
  - Paste → "Match names" (nothing stored) → review → "Save". The same
    person on the same post is stored once.
  - Score: 5 for reacting to one post in the last 90 days, +2 per further
    post, at most 9 (`WEIGHTS.reacted*`). "Reacted recently" in the drawing
    and the list is the last 30 days.
  - The analysis shows each reaction as "Reacted to your post "X" on date"
    with a "Reaction" pill: inferred when matched by the matcher, imported
    when a teammate picked the person.
  - Demo: `node scripts/make-demo-reactions.mjs` wrote two posts' copied
    lists (`data/demo/reactions/`, 28 and 20 people, invented, some in no
    network, some sharing a name). "Load demo data" seeds them: 42
    reactions on 40 people.
  - MCP `add_reactions` takes `text` (as copied), `reactions` (read from a
    screenshot), `names`, `picks` and `dry_run`. `find_people` has
    `reacted`.
- **This week** (`thisWeek` in `lib/queries.ts`, also the MCP tool
  `this_week`):
  - Pool: everyone who fits, minus Sent, Replied, Meeting and Not a fit.
    "To contact" stays in: planned is not contacted.
  - Order: the ranking score, +12 for a registered change in the last 30
    days, +10 for a reaction in the last 30 days, +10 for a strong fit.
  - One slot is kept for a fresh change and one for a reaction, if any.
    One person per company, at most two per industry, and at most
    ceil(5 / teammates) per suggested sender; if that leaves fewer than
    five, the spread rules are dropped.
  - The why line is the strongest of: the registered change, the reaction,
    the role and who knows them.
- **Write in Claude** copies "Using Velho Network, write a Finnish LinkedIn
  message to <name> (<id>), approach <direct|ask_intro>." Skip-approach
  people get "direct". The skill tells Claude to call `message_context`
  with that id.
- **Draft here** (only with `ANTHROPIC_API_KEY`): `message_context` goes to
  Claude with the name replaced by `[FIRST_NAME]`, which is put back
  locally, so the privacy rule (no names to Claude) holds. Untested against
  the live API tonight: no key on this machine.
- **MCP token** (`lib/access.ts`, `middleware.ts`): with `MCP_TOKEN` set,
  `/api/mcp` needs `Authorization: Bearer <token>` from everyone (401 and
  `WWW-Authenticate` otherwise; constant-time compare). Every other page
  and API then answers only to localhost without Cloudflare headers, so a
  tunnel exposes the connector and nothing else. Without `MCP_TOKEN`
  nothing changes. Checked with curl (no header 401, wrong 401, right 200,
  page through a tunnel host 403, connector through a tunnel host with the
  token 200) and with Claude Code: `claude mcp add --transport http
  --header "Authorization: Bearer …"` in a scratch project, then
  `claude -p` called `this_week` and got the same five as the app
  ($0.20).
- **Tunnel.** `npm run tunnel` (`scripts/tunnel.sh`): refuses to start
  without `MCP_TOKEN`, or if the app answers `/api/mcp` without it; then a
  Cloudflare quick tunnel, and it prints the URL and the header.
  `cloudflared` is not installed here, so only the "how to install" branch
  ran. No tunnel was opened tonight.
- **Skill zip.** `npm run skill:zip` writes `dist/velho-network-skill.zip`
  (gitignored); Settings also serves it at `/api/skill.zip`, built in
  memory by a 60-line stored-zip writer (`lib/zip.ts`), checked with
  `unzip -t`.
- **Claude Desktop** without a tunnel: `npx -y mcp-remote <url> --header
  …` in its config. Written down, untested.
- `.env.example` is outside what this session may read, so `MCP_TOKEN` is
  documented in the README and Settings instead.
- **Step 6 polish.**
  - Every page checked at 1440 and 390 for horizontal overflow (a script
    lists elements wider than the viewport). The new reactions form
    overflowed by 18 px at 390 (grid min-content); fixed globally with
    `min-width: 0` on stack children and `max-width: 100%` on inputs.
  - On mobile the zoom buttons covered the decision-maker column; the
    compact layout now keeps a strip for them.
  - People has a `?reacted=1` view and a Reacted column; the Network
    panel's "Show all" follows the toggle. The CSV export has
    `reacted_posts_90d`.
  - Names in pasted reactions lose taglines after " | " or " – " and
    anything in brackets, on both sides of the match.
  - The network page is screenshotted with a tall viewport, not a
    full-page capture: Playwright's full-page capture resized the canvas
    mid-shot once and caught a stretched frame.
  - The video (`media/demo-walkthrough.webm`) is Playwright's recording
    with a drawn cursor (headless video has none), 86 s at 1440×900.
  - The part-1 network image shows Other industries 899 and Abroad 106;
    today it is 859 and 146. Not from tonight: the `demo-v1` code gives
    859 and 146 on the same data. Part 1's screenshots were taken before
    its last matching fix (international brand names never verified by
    name alone).
  - Mid widths (640–900 px of drawing, a 1024–1280 px window) use the full
    layout with short industry names; below 640 px the phone layout.

## Morning report, part 1

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
