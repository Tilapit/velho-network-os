// Builds one de-duplicated model of people and companies from all imports.
// Identity rules are deliberately conservative: a profile URL match is
// verified, a name + company match is inferred, a name-only match is never
// merged and is shown as a possible match instead.
import type { Company, Engagement, ImportReport, Person, Post, Signal } from "./types.ts";
import { companyKey, nameKey, profileKey, slug } from "./normalize.ts";
import type { ConnectionRow, CompanyRow, CustomerRow, InteractionRow, RelationshipRow } from "./ingest.ts";

export type Sources = {
  connections: ConnectionRow[];
  posts: Post[];
  engagement: Engagement[];
  customers: CustomerRow[];
  interactions: InteractionRow[];
  relationships: RelationshipRow[];
  companies: CompanyRow[];
  signals: Omit<Signal, "companyId">[];
  reports: ImportReport[];
};

export type Model = {
  people: Person[];
  byId: Map<string, Person>;
  companies: Map<string, Company>;
  signals: Signal[];
  posts: Post[];
  reports: ImportReport[];
  matching: { byUrl: number; byNameCompany: number; notMerged: number; unknown: number };
};

/** "COO at Rautio Industrial" / "CEO, Nordtek Components" -> role and company. */
export function splitHeadline(h: string | undefined): { role?: string; company?: string } {
  if (!h) return {};
  const at = h.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { role: at[1].trim(), company: at[2].trim() };
  const comma = h.match(/^(.*?),\s*(.+)$/);
  if (comma) return { role: comma[1].trim(), company: comma[2].trim() };
  return { role: h.trim() };
}

function sameCompany(a?: string, b?: string): boolean {
  const ka = companyKey(a);
  const kb = companyKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // "Rautio Industrial" inside "Rautio Industrial Group", on word boundaries only.
  const [short, long] = ka.length < kb.length ? [ka, kb] : [kb, ka];
  return short.length >= 5 && ` ${long} `.includes(` ${short} `);
}

export function buildModel(src: Sources): Model {
  const companies = new Map<string, Company>();
  const people: Person[] = [];
  const byUrl = new Map<string, Person>();
  const byName = new Map<string, Person[]>();
  const ids = new Set<string>();
  const matching = { byUrl: 0, byNameCompany: 0, notMerged: 0, unknown: 0 };

  const company = (name: string | undefined): Company | undefined => {
    const k = companyKey(name);
    if (!k || !name) return undefined;
    const existing = [...companies.values()].find((c) => companyKey(c.name) === k || sameCompany(c.name, name));
    if (existing) return existing;
    const c: Company = { id: slug(k), name, employees: null, industry: null, physicalOperations: null };
    companies.set(c.id, c);
    return c;
  };

  // Enrichment from public sources goes first so names come out canonical.
  for (const r of src.companies) {
    const c = company(r.company)!;
    c.name = r.company;
    const source = { file: "companies.csv", row: r.row };
    if (r.employees) c.employees = { value: r.employees, provenance: "imported", source, note: r.source };
    if (r.industry) c.industry = { value: r.industry, provenance: "imported", source, note: r.source };
    if (r.physical !== undefined) c.physicalOperations = { value: r.physical, provenance: "imported", source, note: r.source };
    c.hq = r.hq;
  }

  const addPerson = (p: Omit<Person, "id" | "engagements" | "interactions" | "introPaths" | "possibleMatches" | "isCustomerContact"> & Partial<Person>): Person => {
    let id = slug(p.name) || "person";
    let n = 2;
    while (ids.has(id)) id = `${slug(p.name)}-${n++}`;
    ids.add(id);
    const person: Person = { engagements: [], interactions: [], introPaths: [], possibleMatches: [], isCustomerContact: false, ...p, id };
    people.push(person);
    const uk = profileKey(person.profileUrl);
    if (uk) byUrl.set(uk, person);
    const nk = nameKey(person.name);
    byName.set(nk, [...(byName.get(nk) || []), person]);
    return person;
  };

  // 1. First-degree connections from the LinkedIn export.
  for (const r of src.connections) {
    const c = company(r.company);
    addPerson({
      name: `${r.first} ${r.last}`.trim(),
      profileUrl: r.url || undefined,
      email: r.email || undefined,
      companyId: c?.id,
      companyName: c?.name ?? r.company,
      role: r.position || undefined,
      connected: { value: r.connectedOn, provenance: "verified", source: { file: "Connections.csv", row: r.row }, note: "LinkedIn export" },
    });
  }

  const findPerson = (name: string, url?: string, companyName?: string): { person?: Person; basis: "profile-url" | "name-and-company" | "none"; lookalikes: Person[] } => {
    const uk = profileKey(url);
    if (uk && byUrl.has(uk)) return { person: byUrl.get(uk), basis: "profile-url", lookalikes: [] };
    const same = byName.get(nameKey(name)) || [];
    if (companyName) {
      const hit = same.filter((p) => sameCompany(p.companyName, companyName));
      if (hit.length === 1) return { person: hit[0], basis: "name-and-company", lookalikes: [] };
    }
    // A profile URL that differs from the stored one is a different person.
    return { basis: "none", lookalikes: same };
  };

  // 2. Customers.
  for (const r of src.customers) {
    const c = company(r.company)!;
    c.customer = { status: r.status, since: r.since, project: r.project, leadSource: r.leadSource, source: { file: "customers.csv", row: r.row } };
    if (r.contactName) {
      const { person } = findPerson(r.contactName, r.contactUrl, r.company);
      const p = person ?? addPerson({ name: r.contactName, profileUrl: r.contactUrl || undefined, companyId: c.id, companyName: c.name, connected: null });
      p.isCustomerContact = true;
      p.companyId ??= c.id;
    }
  }

  // 3. Post engagement.
  const strangers = new Map<string, Person>();
  for (const e of src.engagement) {
    const head = splitHeadline(e.headline);
    const { person, basis, lookalikes } = findPerson(e.name, e.profileUrl, head.company);
    if (person) {
      person.engagements.push({ ...e, matchBasis: basis });
      basis === "profile-url" ? matching.byUrl++ : matching.byNameCompany++;
      continue;
    }
    const key = profileKey(e.profileUrl) || `${nameKey(e.name)}|${companyKey(head.company)}`;
    let p = strangers.get(key);
    if (!p) {
      const c = company(head.company);
      p = addPerson({ name: e.name, profileUrl: e.profileUrl, companyId: c?.id, companyName: c?.name ?? head.company, role: head.role, connected: null });
      strangers.set(key, p);
      for (const l of lookalikes) {
        const reason = `Same name as your connection ${l.name} (${l.companyName || "no company"}), but a different profile and company. Not merged.`;
        p.possibleMatches.push({ name: l.name, headline: [l.role, l.companyName].filter(Boolean).join(", "), profileUrl: l.profileUrl, reason });
        l.possibleMatches.push({ name: e.name, headline: e.headline, profileUrl: e.profileUrl, reason: `Someone with the same name engaged as "${e.headline}". Not merged.` });
      }
      if (lookalikes.length) matching.notMerged++;
      else matching.unknown++;
    }
    p.engagements.push({ ...e, matchBasis: "none" });
  }

  // 4. The founder's own interaction log.
  for (const r of src.interactions) {
    const { person } = findPerson(r.personName, r.profileUrl);
    const candidates = byName.get(nameKey(r.personName)) || [];
    const p = person ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!p) {
      src.reports.find((x) => x.kind === "interactions")?.warnings.push(`No person found for "${r.personName}" (row ${r.source.row}).`);
      continue;
    }
    p.interactions.push({ on: r.on, channel: r.channel, direction: r.direction, summary: r.summary, gotReply: r.gotReply, source: r.source });
  }

  // 5. Introduction paths the founder has been told about.
  for (const r of src.relationships) {
    const from = findPerson(r.fromName, r.fromUrl).person ?? (byName.get(nameKey(r.fromName)) || [])[0];
    if (!from) {
      src.reports.find((x) => x.kind === "relationships")?.warnings.push(`No person found for "${r.fromName}" (row ${r.row}).`);
      continue;
    }
    const c = company(r.toCompany);
    const target = findPerson(r.toName, undefined, r.toCompany).person ?? addPerson({ name: r.toName, companyId: c?.id, companyName: c?.name ?? r.toCompany, connected: null });
    target.introPaths.push({
      viaPersonId: from.id,
      viaName: from.name,
      statement: r.statement || `${r.fromName} and ${r.toName}: ${r.relation}`,
      on: r.on,
      provenance: "imported",
      source: { file: "relationships.csv", row: r.row },
    });
  }

  // 6. Company signals from the pipeline.
  const signals: Signal[] = src.signals.map((s) => ({ ...s, companyId: company(s.companyName)!.id }));

  for (const p of people) {
    p.engagements.sort((a, b) => a.on.localeCompare(b.on));
    p.interactions.sort((a, b) => a.on.localeCompare(b.on));
  }

  return { people, byId: new Map(people.map((p) => [p.id, p])), companies, signals, posts: src.posts, reports: src.reports, matching };
}
