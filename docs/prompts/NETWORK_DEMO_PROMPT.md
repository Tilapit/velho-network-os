# Task: Velho Network, scoped to the network and the analysis

Velho's founder said he already does this semi-manually and would use it right
away. He arrives around 19:00–20:00. By then this app must take **his
LinkedIn Connections export** (or the 1,500-row mock from
`MOCK_DATA_PROMPT.md`) and show **who in his network could need Velho, and
why**. Nothing else for now. We expand later.

Read `CLAUDE.md` first. Its product rules still hold: provenance on every
fact, no scraping, nothing sent anywhere automatically, the ranking is code
and the LLM only writes one labelled sentence.

## In scope

1. **Import.** The Data sources page accepts `Connections.csv` (parser in
   `lib/ingest.ts`). Test it against the 1,500-row mock: empty company,
   emoji, commas in titles, missing URL. Show an import summary: rows,
   rows with no company, rows skipped.
2. **Company matching against PRH open data (YTJ).** Read the current docs at
   https://avoindata.prh.fi first; do not guess endpoints. For each distinct
   company name store business ID, official name, company form, main line of
   business (TOL code and text), town and registration date. Cache in
   `data/cache/`, rate-limit politely. Rules: exact normalised name =
   verified; one fuzzy candidate = inferred, shown as "check"; several or
   none = unmatched, with a way to pick the right one or mark "not a Finnish
   company". Never guess.
3. **Target profile.** A small settings page: target industries (TOL codes or
   prefixes, with an optional "lower priority" flag), decision-maker titles
   (defaults: CEO, COO, CFO, CTO, founder, managing director, director, head
   of, toimitusjohtaja, johtaja, tuotantojohtaja, operations, production) and a
   free-text note. Headcount is not in PRH: show it as Missing, never invent it.
4. **The analysis, per person.** For every connection who is a decision-maker
   at a matched company in a target industry, build:
   - **Reasons**, each with its source pill:
     - role: what the title says they decide (`LinkedIn title`)
     - company: line of business and why it is in the profile (`PRH`)
     - network: how many other connections he has at the same company, if
       any (`Your network`); otherwise when they connected (`LinkedIn`)
   - **What we don't know**: a short list with `Missing` pills (headcount
     always; anything else the rules could not establish).
   - **Fit**: `Strong fit` = decision-maker title in an operations, production
     or CEO role, at a company in a non-lower-priority target industry.
     `Possible fit` = the rest of the list (e.g. CFO, manager-level, lower
     priority industry). Deterministic code, unit-tested.
   - **Possible angle for Velho**: one sentence, labelled `Inferred`, written
     by Claude only from the facts above when `ANTHROPIC_API_KEY` is set;
     otherwise a template by industry. Under it: "Written from the facts above
     only. Check before you use it."
   - **Feedback**: "Good fit" / "Not a fit" buttons, saved in
     `data/state.json`. Nothing else happens with them yet.
5. **The main view.** One page, dark, in this order:
   - Header: "Who in your network could need Velho", one line under it, and
     the profile shown as small chips.
   - Left: a layered network drawing, left to right: Sources (LinkedIn
     connections, Trade register (PRH)) → Finnish companies matched →
     Companies in your industries → Decision-makers there. Each column has
     its count and the rule under it ("matched by name in PRH", "PRH line of
     business", "title matches your roles"). Draw a sample of dots per column
     (about 40 / 28 / 24), not every row. The 8 strongest people are drawn as
     labelled, clickable nodes in the last column with their full path lit in
     blue; everything else is dim. Clicking a person brightens only their path.
   - Right: "Strongest 8 of 61" (real count) as a list. Clicking a row or a
     node opens the person analysis in the same panel, with "← All".
   - A "Show all" link to a plain sortable table of every person in the list.
   - Colors: bg #0b0d10, panel #0e1115, card #14181d, border #1d2128, text
     #e8eaed, muted #8b929c, dim node #2a3039, faint line #1a1f26, accent
     #3d7bff, selected #8db4ff. Font Geist. Plain absolute-positioned SVG or
     divs are fine; no graph library needed.
6. **Remove what is not in scope** from navigation: old network graph,
   engagement analytics, intelligence page, opportunity tabs, drafts,
   approve/copy. Keep code only if it is cheap to keep.
7. **Privacy.** `data/sources/`, `data/cache/`, `data/state.json` gitignored
   (check). Only company names go to PRH; one person's facts go to the Claude
   API only when a key is set. "Delete my data" button on the Data sources
   page, with one line saying this.
8. **Demo safety.** The mock data loads with one click and is labelled as
   invented people.

## Out of scope for now (do not build)

- PRH registered-change signals (KREK), "this week" timing, message drafts,
  approve/copy, any sending.
- LinkedIn DMA API connector.
- Anything that reads reactions or comments. No scraping, ever.

## Process

1. Read `CLAUDE.md`, `lib/` and the PRH YTJ docs. Show me a short plan with
   the endpoints before writing code.
2. Build in this order: matching with cache, profile, analysis + fit rules
   with tests, main view, person panel, cleanup, privacy. Commit after each.
3. Run the 1,500-row mock end to end and `npm test`.
4. Update `CLAUDE.md` and the README to this scope.
5. Report: what works, how long the 1,500-row import takes cold and cached,
   how many companies matched / need a look, and the exact steps for the
   founder tonight.
