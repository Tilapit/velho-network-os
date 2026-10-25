# Overnight build: Velho Network, ready to demo in the morning

You have the whole night (about 8 hours) and nobody to ask. The hackathon
(Aaltoes, Oct 25) continues tomorrow with little time, so by morning this must
be a working, good-looking demo. Read this file to the end before starting.

Read also: `CLAUDE.md`, `MOCK_DATA_PROMPT.md`, `NETWORK_DEMO_PROMPT.md` (data
layer spec), `PRODUCTION_MCP_PROMPT.md` (MCP spec), `design/` (visual spec).
**This file wins on any conflict.** Your earlier plan and decisions 1–5 still
apply unless this file says otherwise.

## The product, after talking to Velho's founder

Velho's founders go through their LinkedIn networks by hand to find people who
could need Velho (AI and automation for Finnish SMEs with physical operations).
Velho Network does it for the whole team:

1. **The founders' network (bread and butter).** Everyone the team knows, in
   one picture: which industries they are in, who the decision-makers are, who
   in the team knows them, and why each could need Velho.
2. **Signal radar (its own view).** Finnish companies in Velho's industries
   where the trade register shows something that often means a need for
   Velho: new managing director, board change, share capital increase or share
   issue (new money), merger. Inside and outside the network; if the team
   knows someone there, that is the warm path.
3. **Themes and events (secondary).** "We are hosting a logistics roundtable,
   who should we invite?" A list with approach per person. Useful, not the core.

Daily use will happen in the founders' own Claude through an MCP connector.
The web app is where they set things up, see the whole network, and check why
something was suggested. Every answer in Claude links to a page here.

## Rules for tonight

- Do not wait for me. Decide, and write each decision in `PROGRESS.md`.
- Keep `PROGRESS.md` current after every step: done, decisions, next step, open
  issues. If your context is compacted, re-read `PROGRESS.md` and this file and
  continue.
- Work on a branch `overnight`. Commit after each step with a clear message.
  Before each commit: `npm test` and typecheck must pass.
- `data/sources/`, `data/cache/`, `data/state.json`, `.env*` stay out of git
  (add `data/cache/` to `.gitignore`).
- Each step has a time budget. If you exceed it, ship the simpler version, note
  it, move on. A working simple thing beats a half-built clever one.
- If PRH or anything external fails, use the cache or a fixture, note it, go on.
- Hard rules: no LinkedIn scraping, nothing is sent to anyone, no email
  guessing, the ranking is code (the LLM only picks filters and writes text),
  invented people only in demo data.

## Steps

### 1. Mock data (45 min)
`MOCK_DATA_PROMPT.md` as planned (~1,500 rows, "You"), plus
`data/demo/Connections-cofounder.csv` (~860 rows, ~270 people overlapping the
first file by profile URL, same rules), plus `Connections-board.csv` (~300
rows, a board member, ~60 overlapping). Include in the target segment some
companies that will have PRH signals in the last 90 days, so the radar and the
network meet.

### 2. Data layer (2 h)
As in `NETWORK_DEMO_PROMPT.md` with these changes:
- Several networks, each tagged with an owner. Merge by profile URL only.
  `knownBy: [{owner, connectedOn}]`. Suggested sender = earliest connection.
- PRH YTJ matching with cache (your plan), PRH registered changes for the last
  90 days as signals (read the docs first, cache).
- Fit (Strong / Possible) as in your decision 3. Approach per person:
  `direct` (decision-maker), `ask_intro` (at a target company, not a
  decision-maker), `skip`.
- Industry groups: map TOL codes to about 10 readable groups (Metal and
  machinery, Electrical and electronics, Plastics and chemicals, Food, Wood and
  building products, Construction, Logistics and transport, Maritime,
  Wholesale, Other). Every contact belongs to one group, including "Not
  matched" and "Abroad".
- Status per person in `data/state.json` (none, to_contact, sent, replied,
  meeting, not_fit) with timestamps and owner. No UI beyond buttons in the
  person view.
- Unit tests for merge, fit, approach, industry mapping, signal scoring.

### 3. Signal radar (1 h 15 min)
Read the PRH docs for the registered notices API and find how to get notices
by date and type. Signal types and default weights: managing director change
(high), share capital increase or share issue (high, label it "new money"),
merger or demerger (medium), board change (medium). Exclude bankruptcy and
liquidation. Filter to Velho's target TOL codes.
- If notices can be queried by date across all companies: do that for the last
  90 days.
- If not: build the candidate list from YTJ for target TOL codes (cap at a few
  thousand companies, cache), fetch notices per company politely overnight in
  the background, and keep what you have by morning.
- Business Finland funding decisions: include only if they are published as
  open data with a clear license; otherwise note it as a future source.
- Each radar row: company, industry group, signal, date, source link, and
  "who we know there" (from the merged networks, with link) or "no one yet".
- Company level only. Store no personal data about people outside the networks.

### 4. Web app UI (2 h 30 min)
Dark design from `design/`: bg #0b0d10, panel #0e1115, card #14181d, raised
#181c22, border #1d2128, text #e8eaed, muted #8b929c, faint text #6f7782, dim
node #2a3039, faint line #1a1f26, accent #3d7bff, selected #8db4ff, green
#8fe0a6 on #12301c, amber #e0b46a on #2b2314. Font Geist (bundle it, e.g. the
`geist` package or next/font). Tokens in `globals.css`, applied app-wide.
Plain, calm, no hype words in copy. Check 1440 px and 390 px widths.

Routes:
- `/` **Network** (the core, most effort here):
  - Header: "Who in your team's network could need Velho", owner filter
    (Whole team / each owner), profile chips.
  - **The network drawing, with every contact as a node.** Layered, left to
    right, deterministic (no physics):
    1. Owners: one large node per teammate.
    2. Contacts: all of them (~2,300 after merge), small dots packed in
       vertical bands, one band per industry group ("Not matched" and "Abroad"
       bands in grey at the bottom), ordered by fit inside each band.
       Decision-makers slightly larger; Strong fits in accent blue; people known
       by two or more teammates with a white ring.
    3. Industry groups: one node each, sized by decision-makers, with counts.
    4. Decision-makers who fit (~80–100): a column of nodes; the top 8 always
       labelled, others labelled on hover.
    Edges: owner → contact (very faint), contact → industry (faint), industry
    → decision-maker (faint). Interaction: hover a node for a tooltip; hover an
    industry to light its contacts and edges; click a person to light their
    full path (owner → contact → industry → decision-maker) and open the
    person panel; owner filter dims other owners' contacts. Column headers show
    counts that always add up to the number of contacts.
    Build it on a `<canvas>` with devicePixelRatio scaling, a quadtree for hit
    testing (d3-quadtree is fine), and redraw only on interaction. It must stay
    smooth with 3,000 nodes. Respect prefers-reduced-motion.
  - Right panel: "Strongest N of M" list; clicking opens the person analysis
    (who knows them + suggested sender, reasons with source pills, what we
    don't know, possible angle labelled Inferred, approach, status buttons).
  - Below the drawing: industry breakdown table (decision-makers, strong,
    known by two+, signals, score bar), sortable.
- `/people/[id]`: the same person analysis as a standalone page. This is
  what links from Claude open.
- `/companies/[businessId]`: PRH facts, signals, everyone the team knows there.
- `/radar`: signal radar table with filters (signal type, industry group,
  known/unknown), warm rows first.
- `/themes`: a simple form: theme text, industry groups, roles → people with
  approach. Secondary; keep it small.
- `/settings`: networks (upload a CSV per owner, counts, delete per owner),
  target profile (industry groups, TOL codes, roles, lower-priority flag),
  PRH matches to review (pick candidate or "not Finnish"), CSV export of the
  list (for their CRM), MCP connection info, delete all data.
- Remove from navigation everything not listed here.

### 5. MCP server + Claude skill (1 h 30 min)
Section 1 of `PRODUCTION_MCP_PROMPT.md`, locally only (no hosting, no auth):
`rank_industries`, `find_people`, `people_for_theme`, `get_person`,
`get_company`, `get_radar` (new: filters by signal type, industry, days,
known/unknown), `message_context`, `add_reactions`. Every result item includes
`url`, a deep link into the web app (`APP_BASE_URL`, default
http://localhost:3000).
Write `claude/velho-network/SKILL.md`: when to use which tool; workflows
(weekly review: five people with reasons and message drafts; before a meeting:
company brief; radar review; theme/event invites; add reactions from a
pasted list or a screenshot the user drops in); Velho's tone for messages
(Finnish by default, short, concrete, one clear ask, no buzzwords, never invent
facts, use only `message_context`); privacy (no sending, no data about people
outside the networks).
Test: `claude mcp add --transport http velho http://localhost:3000/api/mcp`,
then ask three questions (weekly review, logistics roundtable, radar for
logistics). Save the transcripts to `docs/mcp-transcripts.md`.

### 6. Verify and hand over (remaining time, at least 45 min)
- Playwright screenshots of every route at 1440 and 390 into `screens/`,
  including the network with a person selected and an industry hovered.
- Fix anything ugly you see in the screenshots.
- `npm test`, typecheck, `npm run build` all pass.
- `docs/DEMO.md`: a 3-minute demo script (network → person → industry table →
  radar → same question in Claude via MCP → link back to the person page) and
  exact commands to start it.
- Top of `PROGRESS.md`: morning report. What works, what is partial, decisions
  made, open issues, how long a cold and a cached import take.

## Not tonight
Hosting, OAuth, CRM integration, LinkedIn DMA connector, webhooks, REST API,
in-app chat. Note them as next steps in `PROGRESS.md`.
