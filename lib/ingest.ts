// LinkedIn's Connections.csv parser. Returns clean records plus a report of
// what was accepted and why rows were skipped, so the import can show
// coverage honestly.
import Papa from "papaparse";
import type { ImportReport } from "./types.ts";
import { isoDate, profileKey } from "./normalize.ts";

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
  if (noUrl) report.warnings.push(`${noUrl} connections have no profile URL, so they cannot be merged with teammates' connections.`);
  report.accepted = records.length;
  return { records, report };
}
