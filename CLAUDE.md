# Velho Network OS

Hackathon prototype (Aaltoes Operations Hackathon, 24–25 Oct 2026) for Velho, a
small Finnish AI and software consultancy. It answers one question for Velho's
founder: who should I talk to this week, why now, and what should I say?

Relationship-first, not spam-first. The goal is better conversations through
the founder's existing network and LinkedIn presence, not more outreach.

## Product rules (do not break these)

- Never fabricate connections, reactions, comments or customer relationships.
- Every fact has a provenance: verified, imported, inferred or missing
  (`lib/types.ts`). The UI shows it next to the fact with its source file and row.
- No LinkedIn scraping and no assumed API access. Data comes from LinkedIn's own
  Connections.csv export and hand-prepared CSV files.
- A name alone never merges two people. Profile URL match is verified,
  name + company is inferred, anything else stays separate and is shown as a
  possible match (`lib/build.ts`).
- The score is deterministic TypeScript (`lib/score.ts`) and a prioritisation
  heuristic, not a probability. The LLM never sets or changes a score.
- The action is chosen in code (`lib/recommend.ts`). Claude only rewrites the
  draft from the evidence (`lib/claude.ts`), and the app works without a key.
- Nothing is sent from the app. Approve records the founder's decision; the
  founder sends the message themselves.
- Know when not to recommend: two or more unanswered messages puts someone on
  hold; customers are connectors, not prospects; under 35 points means no
  credible reason yet.
- Company signals come from a separate pipeline as `signals.json`. Do not
  rebuild lead discovery here.
- Content attribution: a customer counts as coming from a post only when its
  customer record says so. Engagement before becoming a customer is shown as a
  correlation.

## Code map

- `lib/ingest.ts`: parsers for every source, each returns records and an import report
- `lib/normalize.ts`: company, name and profile URL keys, dates, decision-maker roles
- `lib/build.ts`: one de-duplicated model of people and companies
- `lib/score.ts`: relationship 35, engagement 25, company fit 25, timing 15
- `lib/recommend.ts`: next action, template drafts, reputation safeguards
- `lib/engine.ts`: loads `data/sources/`, caches the model, content analytics
- `lib/graph.ts`: nodes and edges for the Network page, ring layout
- `lib/state.ts`: founder decisions in `data/state.json`
- `app/`: Overview, people/[id], network, engagement, opportunities, intelligence, data
- `data/demo/`: synthetic demo data, copied to `data/sources/` on first run

## Commands

- `npm run dev` on port 3100
- `npm test` runs `tests/engine.test.ts` against the demo data with `APP_TODAY=2026-10-24`
- `APP_TODAY=2026-10-24 npm run dev` freezes "today" so the demo reads the same every time
- Delete `data/sources` (or use "Load demo data" on the Data sources page) to restore the demo

## Design

taste-skill app sheet "Achromatic ledger": Geist, ink-only chrome, one hue
(#1d5fbf) on the main data element (the score), flat surfaces, no gradients,
no shadows at rest, no icon cards, sentence case, words of the trade.
Tokens are in `app/globals.css`.
