# Task: from demo to a production pilot, with an MCP server Velho uses from their own Claude

Do this after the data layer from NETWORK_DEMO_PROMPT.md works and its tests pass.

## Why

The founder wants to ask the network questions in plain language ("I'm hosting a
logistics roundtable in November, who should we invite?", "rank industries by
how strong our way in is") and wants the AI to run on **their own Claude
subscription**, not on an API key we pay for. Claude supports custom connectors
(remote MCP servers) on all plans; on Team/Enterprise an Owner adds them under
Organization settings > Connectors. So: the app exposes its data as an MCP
server, and their Claude does the talking and the writing.

Rule that does not change: ranking and filtering are deterministic code. The
MCP tools return facts with provenance; the LLM chooses arguments and writes
text. No tool sends anything to anyone.

## 1. MCP server (read tools first)

Read the current MCP TypeScript SDK docs before writing code. Serve Streamable
HTTP at `/api/mcp` from the same app, reusing `lib/`. Tools:

- `rank_industries({ owner? })` → per industry group (TOL): decision-makers,
  strong fits, people known by two or more teammates, companies with a recent
  registered change, top 3 people. Sorted by a documented, code-defined score.
- `find_people({ industries?, tol_prefixes?, roles?, fit?, known_by?, has_signal?, town?, limit })`
  → people with fit, reasons (with source), suggested sender, CRM status if known.
- `people_for_theme({ theme, industries, roles?, limit })` → same as above plus a
  per-person `approach`: `invite` (decision-maker), `ask_intro` (works at a
  target company but does not decide), `skip`. The LLM maps the theme to
  industries; the tool does not guess.
- `get_person({ id })` → full analysis object (reasons, missing, who knows them).
- `get_company({ business_id | name })` → PRH facts, signals, everyone the team
  knows there.
- `message_context({ person_id, type: "direct" | "ask_intro" | "event_invite", theme? })`
  → the facts the message may use, Velho's tone rules (short, Finnish by
  default, no buzzwords, no invented facts, one clear ask) and two examples.
  Claude writes the message on the user's side. The server never calls an LLM
  for this.
- `add_reactions({ post_label, names[] })` (write) → matches pasted names of
  people who reacted to a post against the merged network, stores them as a
  `reacted` signal with date. Names only; unmatched names are returned, never
  stored.

Tool descriptions must say exactly what each returns and that all data is
from LinkedIn exports, PRH and the team's own feedback.

Test locally with the MCP Inspector and with `claude mcp add --transport http`.

## 2. Signals back in

PRH registered changes (last 90 days, cached) count as a signal again: new
managing director, board change, share capital, merger. Shown with date and
source. Job postings stay out until we have a permitted source.

## 3. Hosting and auth (pilot)

- EU region only (app and database). Move JSON storage to Postgres in an EU
  region; keep the same repository interfaces.
- Pilot auth: a fixed bearer token sent as a request header, configured by
  their Claude Team Owner when adding the connector, plus app login for the
  web UI. Note in README: on Team plans a header credential is shared by all
  members, so before wider use switch to per-user OAuth (pick a provider whose
  docs cover MCP; read them first).
- The server must be reachable from Anthropic's IP ranges.

## 4. Privacy

Same rules as CLAUDE.md, plus: per-owner delete removes that owner's
connections and anything derived only from them; no emails stored; logs
contain ids, never names; README lists every processor (hosting, database,
PRH, Anthropic via their own Claude) and a short legitimate-interest note.

## 5. Web UI additions

- "By industry" view backed by `rank_industries`.
- A theme box ("Who should we invite to …") backed by `people_for_theme`; on
  the site this is a form, not a chat. Chat lives in their Claude.

## 6. Data out: their own agents and systems

One core (data + scoring in `lib/`), three ways out, same permissions:

1. **MCP** (section 1): for any MCP-capable agent, not only Claude.
2. **REST API**, same functions as the MCP tools, under `/api/v1/`, with an
   OpenAPI spec at `/api/v1/openapi.json`. API keys per agent or integration,
   each with scopes (`read`, `write:signals`, `write:notes`), revocable, rate
   limited. Write endpoints let their agents add things, e.g.
   `POST /api/v1/signals` (an external agent found a job posting or news item,
   with source URL) and `POST /api/v1/people/{id}/notes`. Nothing can send
   messages.
3. **Webhooks**: they register a URL; we POST when a person becomes a strong
   fit, a new signal lands on a company they know, or a reply is detected.
   Signed payloads (HMAC), retries, ids and facts only.
4. **Export**: CSV and JSON download of the list and analysis, and a full
   export of everything stored about one owner (also serves GDPR access).

Every read and write by an agent is written to an audit log (which key, which
tool, which person ids, when), visible on a Settings page. Build MCP first, then
REST + keys, then webhooks, then export.

## Process

Plan first (endpoints, SDK version, hosting choice, auth), then build 1 → 5,
commit after each, report what was tested with a real Claude connector.
