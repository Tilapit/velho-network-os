// MCP server: the team's network as tools for the founders' own Claude.
// Ranking and filtering are code in lib/queries.ts; Claude picks the arguments
// and writes the text. No tool sends anything to anyone. Every result item has
// a `url` into the web app.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadNetwork } from "./network.ts";
import { GROUPS } from "./industry.ts";
import { addReactions, appUrl, findPeople, getCompany, getPerson, getRadar, messageContext, peopleForTheme, rankIndustries, thisWeek } from "./queries.ts";
import type { SignalType } from "./signals.ts";

const SOURCES = "All data comes from the team's own LinkedIn Connections exports, the Finnish trade register (PRH open data, CC BY 4.0) and the team's own feedback in the app. Nothing is scraped and nothing is sent to anyone.";
const INDUSTRIES = GROUPS.filter((g) => !g.grey).map((g) => `${g.id} (${g.label})`).join(", ");

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] });
const notFound = (what: string) => ({ content: [{ type: "text" as const, text: `${what} not found.` }], isError: true });

function log(tool: string, ids: string[] = []) {
  // Ids only, never names.
  console.log(`[mcp] ${new Date().toISOString()} ${tool}${ids.length ? ` ${ids.slice(0, 20).join(",")}` : ""}`);
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "velho-network", version: "0.2.0" }, { instructions: `Velho Network: who in the Velho team's LinkedIn networks could need Velho (AI and automation for Finnish SMEs with physical operations), and why. ${SOURCES} Ranking is deterministic code. Link to the 'url' of each item when you mention it.` });

  server.registerTool(
    "rank_industries",
    {
      title: "Rank industries by way in",
      description: `Per industry group (TOL-based): people, decision-makers, strong fits, fits known by two or more teammates, companies with a registered change (PRH, last 90 days), and the top 3 people. Sorted by score = 3 x strong + 1 x possible + 2 x known by two+ + 2 x companies with a signal. Optionally only one owner's network. ${SOURCES}`,
      inputSchema: { owner: z.string().optional().describe("Owner id or name, e.g. 'You' or 'Co-founder'. Omit for the whole team.") },
      annotations: { readOnlyHint: true },
    },
    async ({ owner }) => {
      const net = await loadNetwork();
      const rows = rankIndustries(net, { owner });
      log("rank_industries");
      return json({ industries: rows.map((r) => ({ ...r, url: appUrl("/") })) });
    },
  );

  server.registerTool(
    "this_week",
    {
      title: "This week",
      description: `The five people to reach this week, chosen by code (the same as the app's "This week"): strong fits and people with a registered change or a reaction in the last 30 days first; skips anyone already contacted or marked not a fit; one per company, at most two per industry, suggested senders spread across the team. Each has a one-line why, the suggested sender and a url. Use it for the weekly review, then message_context per person. ${SOURCES}`,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const picks = thisWeek(await loadNetwork());
      log("this_week", picks.map((p) => p.id));
      return json({ people: picks.map(({ prompt, ...p }) => p) });
    },
  );

  server.registerTool(
    "find_people",
    {
      title: "Find people",
      description: `People in the team's networks with fit (strong/possible), approach, reasons with their source, who knows them and the suggested sender (who connected first), registered changes at their company and status. By default only decision-makers who fit; pass roles or approach to widen. Industries: ${INDUSTRIES}. ${SOURCES}`,
      inputSchema: {
        industries: z.array(z.string()).optional().describe("Industry group ids or labels"),
        tol_prefixes: z.array(z.string()).optional().describe("TOL code prefixes, e.g. ['28', '2511']"),
        roles: z.array(z.string()).optional().describe("Title words, e.g. ['logistics', 'tuotantojohtaja']"),
        fit: z.enum(["strong", "possible", "any"]).optional(),
        known_by: z.string().optional().describe("Owner id or name"),
        has_signal: z.boolean().optional().describe("Only companies with a registered change in the last 90 days"),
        reacted: z.boolean().optional().describe("Only people who reacted to one of the team's posts in the last 30 days"),
        town: z.string().optional().describe("Company town in PRH, e.g. 'Tampere'"),
        approach: z.enum(["direct", "ask_intro", "skip"]).optional(),
        status: z.enum(["none", "to_contact", "sent", "replied", "meeting", "not_fit"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const r = findPeople(await loadNetwork(), args);
      log("find_people", r.people.map((p) => p.id));
      return json(r);
    },
  );

  server.registerTool(
    "people_for_theme",
    {
      title: "People for a theme or event",
      description: `For a theme, event or roundtable: people in the given industries with a per-person approach: 'invite' (decision-maker at a target company), 'ask_intro' (works at a target company but does not decide). You map the theme to industries; the tool does not guess. Industries: ${INDUSTRIES}. ${SOURCES}`,
      inputSchema: {
        theme: z.string().describe("The theme or event, in the user's words"),
        industries: z.array(z.string()).min(1).describe("Industry group ids or labels that fit the theme"),
        roles: z.array(z.string()).optional().describe("Optional title words to require for 'invite'"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const r = peopleForTheme(await loadNetwork(), args);
      log("people_for_theme", r.people.map((p) => p.id));
      return json(r);
    },
  );

  server.registerTool(
    "get_person",
    {
      title: "Person analysis",
      description: `The full analysis of one person: title, PRH company facts, reasons (each with source and provenance: verified, imported, inferred), what we don't know (always headcount), fit and why, approach, who in the team knows them and since when, suggested sender, a template angle (inferred), score parts and status. ${SOURCES}`,
      inputSchema: { id: z.string().describe("Person id from another tool") },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const p = getPerson(await loadNetwork(), id);
      log("get_person", [id]);
      return p ? json(p) : notFound(`Person ${id}`);
    },
  );

  server.registerTool(
    "get_company",
    {
      title: "Company brief",
      description: `One company: PRH facts (business ID, line of business, town, form, registration date), registered changes in the last 90 days, and everyone the team knows there with fit. Headcount is not in PRH. ${SOURCES}`,
      inputSchema: { business_id: z.string().optional().describe("Finnish business ID, e.g. 1234567-8"), name: z.string().optional().describe("Company name as people write it") },
      annotations: { readOnlyHint: true },
    },
    async (q) => {
      const net = await loadNetwork();
      const c = getCompany(net, q);
      if (!c && q.business_id) {
        const radar = getRadar(net, { limit: 500 }).rows.find((r) => r.businessId === q.business_id);
        if (radar) return json({ ...radar, people: [], note: "No one in the team's networks works here." });
      }
      log("get_company", c ? [c.id] : []);
      return c ? json(c) : notFound(`Company ${q.business_id ?? q.name}`);
    },
  );

  server.registerTool(
    "get_radar",
    {
      title: "Signal radar",
      description: `Companies in the target industries with a registered change in the trade register (PRH notices): md_change (managing director changed), new_money (share issue or capital increase), merger (merger or demerger), board_change. Warm rows first (someone in the team knows a person there, with links), then by score (type weight x recency). Company-level data only. ${SOURCES}`,
      inputSchema: {
        signal_types: z.array(z.enum(["md_change", "new_money", "merger", "board_change"])).optional(),
        industries: z.array(z.string()).optional().describe("Industry group ids or labels"),
        days: z.number().int().min(1).max(90).optional().describe("Only notices registered in the last N days"),
        known: z.enum(["known", "unknown"]).optional().describe("'known': someone in the team knows a person there"),
        owner: z.string().optional().describe("Only people known by this owner count as known"),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (a) => {
      const r = getRadar(await loadNetwork(), { types: a.signal_types as SignalType[] | undefined, industries: a.industries, days: a.days, known: a.known, owner: a.owner, limit: a.limit ?? 25 });
      log("get_radar", r.rows.map((x) => x.businessId));
      return json(r);
    },
  );

  server.registerTool(
    "message_context",
    {
      title: "Facts for a message",
      description: `The only facts a message to this person may use, Velho's tone rules (Finnish by default, short, concrete, one clear ask, no buzzwords, never invent facts) and two examples. You write the message for the user; the server never calls an LLM and never sends anything. The suggested sender sends it themselves.`,
      inputSchema: {
        person_id: z.string(),
        type: z.enum(["direct", "ask_intro", "event_invite"]),
        theme: z.string().optional().describe("For event_invite: the event or theme"),
      },
      annotations: { readOnlyHint: true },
    },
    async (a) => {
      const r = messageContext(await loadNetwork(), a);
      log("message_context", [a.person_id]);
      return r ? json(r) : notFound(`Person ${a.person_id}`);
    },
  );

  server.registerTool(
    "add_reactions",
    {
      title: "Add reactions to a post",
      description:
        "Stores who reacted to one of the team's LinkedIn posts, as a 'reacted' signal on each person. Give the reactions list as the user copied it from LinkedIn (`text`), or people you read from a screenshot the user shared (`reactions`, with headline and degree when visible), or plain `names`. The same parser and matcher as the app: a name with one match in the merged network is stored (inferred); ties are broken by the company in the headline and, with `author`, by the 1st/2nd degree marker; the rest come back in `review` with candidates and are stored only when you pass `picks` after the user confirms. Names in `unmatched` are not in the networks and are never stored. Never scrape LinkedIn to get these.",
      inputSchema: {
        post_label: z.string().describe("A short label for the post"),
        post_date: z.string().optional().describe("The day the post went out, YYYY-MM-DD. Default today."),
        author: z.string().optional().describe("Whose post: owner id or name, e.g. 'You' or 'Co-founder'"),
        text: z.string().max(200_000).optional().describe("The reactions list exactly as copied from LinkedIn"),
        reactions: z
          .array(z.object({ name: z.string(), headline: z.string().optional(), degree: z.enum(["1st", "2nd", "3rd"]).optional() }))
          .max(1000)
          .optional()
          .describe("People read from a screenshot"),
        names: z.array(z.string()).max(1000).optional().describe("Plain names, when nothing else is visible"),
        picks: z.array(z.object({ name: z.string(), person_id: z.string() })).max(200).optional().describe("For names in `review`: the person the user confirmed"),
        dry_run: z.boolean().optional().describe("Match only, store nothing"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (a) => {
      if (!a.text && !a.reactions?.length && !a.names?.length && !a.picks?.length) return { content: [{ type: "text" as const, text: "Give `text`, `reactions`, `names` or `picks`." }], isError: true };
      const r = addReactions(await loadNetwork(), { post: a.post_label, postDate: a.post_date, author: a.author, text: a.text, entries: a.reactions, names: a.names, picks: a.picks, save: !a.dry_run });
      log("add_reactions", r.matched.map((m) => m.person.id));
      return json(r);
    },
  );

  return server;
}
