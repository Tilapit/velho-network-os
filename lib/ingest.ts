// Parsers for every import. Each returns clean records plus a report of what
// was accepted and why rows were skipped, so the Data Sources page can show
// coverage honestly.
import Papa from "papaparse";
import type { Engagement, ImportReport, Interaction, Post, Signal, Topic } from "./types.ts";
import { companyKey, isoDate, profileKey } from "./normalize.ts";

type Row = Record<string, string>;

function parse(text: string): Row[] {
  const res = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  return res.data;
}

function need(rows: Row[], cols: string[], report: ImportReport): boolean {
  const have = rows.length ? Object.keys(rows[0]) : [];
  const missing = cols.filter((c) => !have.includes(c));
  if (missing.length) report.warnings.push(`Missing columns: ${missing.join(", ")}`);
  return missing.length === 0;
}

export type ConnectionRow = { first: string; last: string; url: string; email: string; company: string; position: string; connectedOn: string; row: number };

/** LinkedIn "Get a copy of your data" → Connections.csv. Skips the Notes preamble. */
export function parseConnections(text: string, file = "Connections.csv") {
  const report: ImportReport = { kind: "connections", file, rows: 0, accepted: 0, warnings: [] };
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("First Name"));
  if (start < 0) {
    report.warnings.push("No 'First Name' header found. Is this LinkedIn's Connections.csv?");
    return { records: [] as ConnectionRow[], report };
  }
  const rows = parse(lines.slice(start).join("\n"));
  report.rows = rows.length;
  if (!need(rows, ["First Name", "Last Name", "URL", "Company", "Position", "Connected On"], report)) return { records: [], report };
  const records: ConnectionRow[] = [];
  let noUrl = 0;
  rows.forEach((r, i) => {
    const first = (r["First Name"] || "").trim();
    const last = (r["Last Name"] || "").trim();
    if (!first && !last) return;
    if (!profileKey(r["URL"])) noUrl++;
    records.push({
      first,
      last,
      url: (r["URL"] || "").trim(),
      email: (r["Email Address"] || "").trim(),
      company: (r["Company"] || "").trim(),
      position: (r["Position"] || "").trim(),
      connectedOn: isoDate(r["Connected On"]),
      row: start + i + 2,
    });
  });
  if (noUrl) report.warnings.push(`${noUrl} connections have no profile URL, so engagement can only match them by name and company.`);
  report.accepted = records.length;
  return { records, report };
}

const TOPICS: Topic[] = ["legacy-systems", "ai-automation", "operations", "hiring", "founder-journey", "ai-news", "other"];

export function parsePosts(text: string, file = "posts.csv") {
  const report: ImportReport = { kind: "posts", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["post_id", "posted_on", "title", "topic"], report)) return { records: [] as Post[], report };
  const records: Post[] = rows.map((r) => {
    const topic = (TOPICS.includes(r.topic as Topic) ? r.topic : "other") as Topic;
    if (topic === "other" && r.topic) report.warnings.push(`Unknown topic "${r.topic}" on ${r.post_id}, treated as other.`);
    return { id: r.post_id.trim(), postedOn: isoDate(r.posted_on), title: r.title.trim(), topic };
  });
  report.accepted = records.length;
  return { records, report };
}

export function parseEngagement(text: string, file = "engagement.csv") {
  const report: ImportReport = { kind: "engagement", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["post_id", "name", "type", "engaged_on"], report)) return { records: [] as Engagement[], report };
  const records: Engagement[] = [];
  rows.forEach((r, i) => {
    const kind = r.type?.trim() === "comment" ? "comment" : r.type?.trim() === "reaction" ? "reaction" : null;
    if (!kind || !r.name?.trim()) {
      report.warnings.push(`Row ${i + 2}: skipped (needs a name and type comment or reaction).`);
      return;
    }
    records.push({
      postId: r.post_id.trim(),
      kind,
      reaction: r.reaction?.trim() || undefined,
      comment: r.comment?.trim() || undefined,
      on: isoDate(r.engaged_on),
      name: r.name.trim(),
      profileUrl: r.profile_url?.trim() || undefined,
      headline: r.headline?.trim() || undefined,
      source: { file, row: i + 2 },
    });
  });
  report.accepted = records.length;
  return { records, report };
}

export type CustomerRow = { company: string; contactName: string; contactUrl: string; status: "current" | "previous" | "opportunity" | "lost"; since: string; project: string; leadSource: string; row: number };

export function parseCustomers(text: string, file = "customers.csv") {
  const report: ImportReport = { kind: "customers", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["company", "status"], report)) return { records: [] as CustomerRow[], report };
  const ok = ["current", "previous", "opportunity", "lost"];
  const records: CustomerRow[] = [];
  rows.forEach((r, i) => {
    const status = r.status?.trim().toLowerCase();
    if (!ok.includes(status)) {
      report.warnings.push(`Row ${i + 2}: unknown status "${r.status}".`);
      return;
    }
    records.push({
      company: r.company.trim(),
      contactName: r.contact_name?.trim() || "",
      contactUrl: r.contact_linkedin_url?.trim() || "",
      status: status as CustomerRow["status"],
      since: isoDate(r.since),
      project: r.project?.trim() || "",
      leadSource: r.lead_source?.trim() || "",
      row: i + 2,
    });
  });
  report.accepted = records.length;
  return { records, report };
}

export type InteractionRow = Interaction & { personName: string; profileUrl?: string };

export function parseInteractions(text: string, file = "interactions.csv") {
  const report: ImportReport = { kind: "interactions", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["person_name", "date", "channel", "summary"], report)) return { records: [] as InteractionRow[], report };
  const records: InteractionRow[] = rows.map((r, i) => ({
    personName: r.person_name.trim(),
    profileUrl: r.profile_url?.trim() || undefined,
    on: isoDate(r.date),
    channel: r.channel.trim(),
    direction: (["inbound", "outbound", "both"].includes(r.direction?.trim()) ? r.direction.trim() : "both") as Interaction["direction"],
    summary: r.summary.trim(),
    gotReply: /^(yes|y|true|1)$/i.test(r.got_reply?.trim() || ""),
    source: { file, row: i + 2 },
  }));
  report.accepted = records.length;
  return { records, report };
}

export type CompanyRow = { company: string; employees?: number; industry?: string; hq?: string; physical?: boolean; source: string; row: number };

export function parseCompanies(text: string, file = "companies.csv") {
  const report: ImportReport = { kind: "companies", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["company"], report)) return { records: [] as CompanyRow[], report };
  const records: CompanyRow[] = rows.map((r, i) => ({
    company: r.company.trim(),
    employees: r.employees ? Number(r.employees) || undefined : undefined,
    industry: r.industry?.trim() || undefined,
    hq: r.hq?.trim() || undefined,
    physical: r.physical_operations ? /^(yes|true|1)$/i.test(r.physical_operations.trim()) : undefined,
    source: r.source?.trim() || "Public source",
    row: i + 2,
  }));
  report.accepted = records.length;
  return { records, report };
}

const SIGNAL_TYPES: Signal["type"][] = ["expansion", "operational_hiring", "leadership_change", "erp_modernization", "funding", "acquisition", "new_product", "new_business_unit"];

/**
 * Adapter for the separate company-signal pipeline. It emits a JSON array of
 * {company, type, title, date, source, url?, person?}. Unknown types are kept
 * out rather than guessed.
 */
export function parseSignals(text: string, file = "signals.json") {
  const report: ImportReport = { kind: "signals", file, rows: 0, accepted: 0, warnings: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    report.warnings.push("Not valid JSON.");
    return { records: [] as Omit<Signal, "companyId">[], report };
  }
  const arr = Array.isArray(raw) ? raw : [];
  report.rows = arr.length;
  const records: Omit<Signal, "companyId">[] = [];
  arr.forEach((s: Record<string, string>, i) => {
    if (!s.company || !SIGNAL_TYPES.includes(s.type as Signal["type"])) {
      report.warnings.push(`Item ${i + 1}: skipped (unknown type "${s.type}" or no company).`);
      return;
    }
    records.push({
      id: `sig-${i + 1}`,
      companyName: s.company,
      type: s.type as Signal["type"],
      title: s.title || s.type,
      on: isoDate(s.date),
      sourceName: s.source || "Signal pipeline",
      url: s.url,
      person: s.person,
      source: { file, row: i + 1, url: s.url },
    });
  });
  report.accepted = records.length;
  return { records, report };
}

export { companyKey };

export type RelationshipRow = { fromName: string; fromUrl?: string; toName: string; toCompany: string; relation: string; statement: string; on: string; row: number };

/** Introduction paths the founder has been told about (founder-authored notes). */
export function parseRelationships(text: string, file = "relationships.csv") {
  const report: ImportReport = { kind: "relationships", file, rows: 0, accepted: 0, warnings: [] };
  const rows = parse(text);
  report.rows = rows.length;
  if (!need(rows, ["from_name", "to_name", "to_company"], report)) return { records: [] as RelationshipRow[], report };
  const records: RelationshipRow[] = rows.map((r, i) => ({
    fromName: r.from_name.trim(),
    fromUrl: r.from_profile_url?.trim() || undefined,
    toName: r.to_name.trim(),
    toCompany: r.to_company.trim(),
    relation: r.relation?.trim() || "knows",
    statement: r.statement?.trim() || "",
    on: isoDate(r.date),
    row: i + 2,
  }));
  report.accepted = records.length;
  return { records, report };
}
