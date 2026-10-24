// Loads the imported files, builds the model and caches it until a file
// changes. Server-only.
import fs from "node:fs";
import path from "node:path";
import { buildModel, type Model, type Sources } from "./build.ts";
import { parseCompanies, parseConnections, parseCustomers, parseEngagement, parseInteractions, parsePosts, parseRelationships, parseSignals } from "./ingest.ts";
import { rankAll, scorePerson, RELEVANT_TOPICS, TOPIC_LABEL, type Opportunity } from "./score.ts";
import { isDecisionMaker, today } from "./normalize.ts";
import type { ImportReport, Topic } from "./types.ts";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const SOURCES_DIR = path.join(DATA_DIR, "sources");
const DEMO_DIR = path.join(DATA_DIR, "demo");

export const SOURCE_FILES = [
  { kind: "connections", file: "Connections.csv", label: "LinkedIn connections", how: "LinkedIn → Settings → Data privacy → Get a copy of your data → Connections" },
  { kind: "posts", file: "posts.csv", label: "Your posts", how: "post_id, posted_on, title, topic" },
  { kind: "engagement", file: "engagement.csv", label: "Post engagement", how: "Prepared by hand for selected posts: post_id, name, profile_url, headline, type, reaction, comment, engaged_on" },
  { kind: "customers", file: "customers.csv", label: "Customers", how: "company, contact_name, contact_linkedin_url, status, since, project, lead_source" },
  { kind: "interactions", file: "interactions.csv", label: "Your conversations", how: "person_name, profile_url, date, channel, direction, summary, got_reply" },
  { kind: "relationships", file: "relationships.csv", label: "Introduction paths", how: "from_name, from_profile_url, to_name, to_company, relation, statement, date" },
  { kind: "companies", file: "companies.csv", label: "Company facts", how: "company, employees, industry, hq, physical_operations, source" },
  { kind: "signals", file: "signals.json", label: "Company signals", how: "JSON from the company-signal pipeline: company, type, title, date, source, url" },
] as const;

export function ensureSources() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
    for (const s of SOURCE_FILES) {
      const from = path.join(DEMO_DIR, s.file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(SOURCES_DIR, s.file));
    }
    fs.writeFileSync(path.join(SOURCES_DIR, ".demo"), "Loaded from data/demo. Synthetic data.\n");
  }
}

export function isDemo(): boolean {
  ensureSources();
  return fs.existsSync(path.join(SOURCES_DIR, ".demo"));
}

function read(file: string): string | null {
  const p = path.join(SOURCES_DIR, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function signature(): string {
  ensureSources();
  return SOURCE_FILES.map((s) => {
    const p = path.join(SOURCES_DIR, s.file);
    return fs.existsSync(p) ? `${s.file}:${fs.statSync(p).mtimeMs}` : `${s.file}:-`;
  }).join("|");
}

let cache: { sig: string; model: Model; ranked: Opportunity[] } | null = null;

export function loadModel(): { model: Model; ranked: Opportunity[] } {
  const sig = signature();
  if (cache && cache.sig === sig) return cache;
  const reports: ImportReport[] = [];
  const take = <T,>(file: string, fn: (t: string, f: string) => { records: T[]; report: ImportReport }, kind: string): T[] => {
    const text = read(file);
    if (text === null) {
      reports.push({ kind, file, rows: 0, accepted: 0, warnings: ["Not imported yet."] });
      return [];
    }
    const { records, report } = fn(text, file);
    reports.push(report);
    return records;
  };
  const src: Sources = {
    connections: take("Connections.csv", parseConnections, "connections"),
    posts: take("posts.csv", parsePosts, "posts"),
    engagement: take("engagement.csv", parseEngagement, "engagement"),
    customers: take("customers.csv", parseCustomers, "customers"),
    interactions: take("interactions.csv", parseInteractions, "interactions"),
    relationships: take("relationships.csv", parseRelationships, "relationships"),
    companies: take("companies.csv", parseCompanies, "companies"),
    signals: take("signals.json", parseSignals, "signals"),
    reports,
  };
  const model = buildModel(src);
  const ranked = rankAll(model);
  cache = { sig, model, ranked };
  return cache;
}

export function getOpportunity(id: string): Opportunity | undefined {
  const { model } = loadModel();
  const p = model.byId.get(id);
  return p ? scorePerson(p, model) : undefined;
}

/** A person counts as ICP when the company fits and they can decide. */
export function isIcp(o: Opportunity): boolean {
  const emp = o.company?.employees?.value;
  return !!emp && emp >= 20 && emp <= 300 && !!o.company?.physicalOperations?.value && isDecisionMaker(o.person.role);
}

export function contentAnalytics() {
  const { model, ranked } = loadModel();
  const byPerson = new Map(ranked.map((o) => [o.person.id, o]));
  const posts = model.posts.map((post) => {
    const engagers = model.people
      .map((p) => ({ p, es: p.engagements.filter((e) => e.postId === post.id) }))
      .filter((x) => x.es.length);
    const icp = engagers.filter((x) => isIcp(byPerson.get(x.p.id)!));
    return {
      post,
      engagers: engagers.length,
      comments: engagers.filter((x) => x.es.some((e) => e.kind === "comment")).length,
      connected: engagers.filter((x) => x.p.connected).length,
      icp: icp.map((x) => ({ id: x.p.id, name: x.p.name, role: x.p.role, company: x.p.companyName, commented: x.es.some((e) => e.kind === "comment") })),
    };
  });
  const topics = new Map<Topic, { posts: number; engagers: number; icp: number }>();
  for (const x of posts) {
    const t = topics.get(x.post.topic) || { posts: 0, engagers: 0, icp: 0 };
    t.posts++;
    t.engagers += x.engagers;
    t.icp += x.icp.length;
    topics.set(x.post.topic, t);
  }
  const customers = [...model.companies.values()]
    .filter((c) => c.customer)
    .map((c) => {
      const contacts = model.people.filter((p) => p.companyId === c.id && p.isCustomerContact);
      const before = contacts.flatMap((p) => p.engagements.filter((e) => !c.customer?.since || e.on <= c.customer.since).map((e) => ({ person: p.name, e })));
      const confirmed = /post|comment|linkedin/i.test(c.customer?.leadSource || "");
      return {
        company: c.name,
        status: c.customer!.status,
        leadSource: c.customer!.leadSource || "",
        engagedBefore: before.map((b) => ({ person: b.person, post: model.posts.find((p) => p.id === b.e.postId)?.title, on: b.e.on, kind: b.e.kind })),
        attribution: confirmed ? "confirmed" : before.length ? "correlation" : "none",
      };
    });
  return {
    posts,
    topics: [...topics.entries()].map(([topic, t]) => ({ topic, label: TOPIC_LABEL[topic], relevant: RELEVANT_TOPICS.includes(topic), ...t })).sort((a, b) => b.icp / b.posts - a.icp / a.posts),
    customers,
  };
}

export function asOf(): string {
  return today();
}
