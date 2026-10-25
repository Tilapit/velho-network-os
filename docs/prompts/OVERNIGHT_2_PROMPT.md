# Overnight, part 2: make it beautiful, real-data proof and Claude-ready

Part 1 is done and demo-ready (see PROGRESS.md). You have until about 07:00
and nobody to ask. Same rules as OVERNIGHT_PROMPT.md: don't wait, log every
decision in PROGRESS.md, commit after each step on `overnight`, `npm test`,
typecheck and `npm run build` must pass before each commit, no scraping,
nothing is sent, invented people only. Port 3100 is taken by another app: use
3310 for everything tonight. Do not install anything system-wide (no brew);
npm packages are fine.

**First:** `git tag demo-v1` on the current commit, so a working demo always
exists. If a step breaks the demo and you can't fix it within its budget,
revert that step and note it.

Priorities, in order. Budgets are hard: when one runs out, ship the simpler
version and move on.

## 1. The network drawing as a real neural network (2 h, the most important)

The founder asked for a dark "neural network of contacts" with as many nodes
as contacts. Part 1 has every node, but it does not look like one yet. From
`screens/network-1440.png`:
- the 192 decision-makers collapse into one vertical bar of dots at the right;
- contacts are a rectangular grid, which reads as a spreadsheet;
- contact → industry edges are almost invisible, so the middle is empty;
- grey groups (Other industries, Not matched, Abroad: 1,746 of 2,333) take
  most of the space;
- at 390 px the drawing is cropped.

Rework it so a first-time viewer sees a glowing network flowing left to right
and understands it in five seconds:
- **Layers:** owners → contacts → industry groups → decision-makers who fit.
  Keep it deterministic (seeded), no physics.
- **Contacts:** circles in an organic, seeded jitter inside each industry
  band, not a grid. Target-industry bands get most of the height; grey bands
  are compressed and drawn smaller and dimmer, but every contact is still a
  node. Decision-makers a bit larger, strong fits in accent blue, people known
  by two or more of you with a white ring.
- **Edges:** draw every edge (owner → contact, contact → industry,
  industry → decision-maker) as a soft bezier with very low alpha and
  additive blending (`globalCompositeOperation = 'lighter'`), so dense flows
  glow and sparse ones fade. Grey groups' edges are nearly invisible.
- **Decision-makers:** spread over the full height in 2–4 staggered
  sub-columns, ordered by industry so their edges don't cross much. The top 8
  are labelled; any other node shows a label on hover.
- **Motion:** on first load, a 1.5 s pulse travels owners → contacts →
  industries → decision-makers. When a person is selected, small particles
  flow along their lit path. Nothing moves with prefers-reduced-motion.
- **Interaction:** hover any node for a tooltip; click any contact (not only
  decision-makers) to open the person panel; hover an industry to light its
  contacts and edges; the owner filter dims other owners' contacts and edges.
  Optional if time allows: wheel zoom and drag pan, with a reset button.
- **Performance:** render static layers once to offscreen canvases and draw
  highlights on top. It must stay smooth with 10,000 contacts (see step 2).
- **Small screens:** at 390 px the drawing scales to the width (simplified
  labels, tap instead of hover), and the page title and filters come before
  the list.
- Keep the column counts adding up to the number of contacts.
- Take before and after screenshots and compare them honestly. Iterate on the
  look at least twice from screenshots before moving on.

## 2. Real-data proof (1 h)

The founder may have 5,000 or more connections.
- Generate stress files of 5,000 and 10,000 rows (same generator, new seed,
  not committed to `data/demo`). Measure parse, model, first paint of the
  drawing, and interaction frame time. Targets: first paint under 1.5 s,
  interactions smooth. Fix what misses.
- Importer robustness with fixtures: UTF-8 BOM, CRLF, the "Notes:" preamble
  present or missing, extra or reordered columns, quoted commas and newlines,
  empty company, emoji, and very long titles. Add tests.
- Cold PRH estimate on the import screen for the real number of distinct
  company names, so the founder knows how long to wait.

## 3. Reactions, the founder's top wish (1 h)

No scraping. The founder opens a post's reactions list on LinkedIn, selects
it, copies, and pastes it into the app (or drops a screenshot into Claude,
which calls `add_reactions` with the names).
- A "Post reactions" panel (Settings, or its own small page): post label and
  date, then a paste box. Parse LinkedIn's copied text robustly: names, the
  repeated name lines, degree markers ("· 1st", "2nd"), headlines and button
  text. Write realistic fixtures yourself, using invented names from the mock
  networks plus some that are not in them.
- Match to the merged network by name, using the headline's company to break
  ties. Ambiguous matches go to a short review. Unmatched names are shown once
  and never stored.
- A stored reaction is a signal on the person ("Reacted to your post X on
  date"), counts in ranking with a documented weight, shows in the person
  analysis with a "Reaction" source pill, and the drawing gets a "Reacted
  recently" highlight toggle.
- Update `add_reactions` in MCP to use the same parser and matcher. Seed the
  demo with two posts' worth of reactions, so it shows something out of the box.

## 4. "This week" and the bridge to Claude (45 min)

- A "This week" block at the top of the Network page's right panel: five
  people chosen by code. Mix strong fits, recent signals and reactions; skip
  anyone already contacted or marked not a fit; balance senders across owners.
  Each card shows one line saying why.
- On every person: **"Write in Claude"** copies a short prompt to the
  clipboard ("Using Velho Network, write a Finnish LinkedIn message to <name>
  (<id>), approach <approach>.") so the user's own Claude, with the connector,
  writes it on their subscription. If `ANTHROPIC_API_KEY` is set, also offer
  "Draft here" (uses `message_context` and the tone rules).

## 5. Ready for claude.ai and Claude Desktop (45 min)

A custom connector in claude.ai needs a public URL; localhost only works in
Claude Code.
- Optional bearer-token auth on `/api/mcp` (`MCP_TOKEN` env). When it is set,
  requests without `Authorization: Bearer <token>` get 401. Test with curl and
  with Claude Code's header option.
- `scripts/tunnel.sh`: if `cloudflared` is installed, start a quick tunnel to
  3310 and print the public MCP URL and the token. If it is not installed,
  print how to install it. Do not run a tunnel tonight.
- `npm run skill:zip` builds `dist/velho-network-skill.zip` from
  `claude/velho-network/` for upload to Claude.
- Settings → "Connect to Claude": the steps for Claude Code (`claude mcp add
  ...`) and for claude.ai (Settings → Connectors → add custom connector, URL,
  header with the token), plus the skill zip. Mark that the claude.ai path is
  untested.

## 6. Polish and hand-over (remaining time, at least 45 min)

- Fresh screenshots of every route at 1440 and 390, including the network
  at rest, with an industry hovered, with a person selected, and with
  "Reacted recently" on.
- Record the demo flow from `docs/DEMO.md` with Playwright video at 1440×900
  (about 60–90 s, slow deliberate moves) to `media/demo-walkthrough.webm`.
- Update `docs/DEMO.md` for the new things (reactions, This week, Write in
  Claude, claude.ai path), still within 3 minutes.
- New morning report at the top of `PROGRESS.md`: what changed tonight, the
  before/after screenshots, the performance numbers, what is untested, and
  anything you reverted.

## Not tonight
Hosting, OAuth, CRM integration, LinkedIn DMA connector, REST API, webhooks.
