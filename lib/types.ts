// Shared types. Every fact carries a provenance so the UI can say where it
// came from and how sure we are about it.

export type Provenance =
  | "verified" // checked against an authoritative record (LinkedIn export URL match, customer record)
  | "imported" // came from a file the founder imported (CSV, notes, signal pipeline)
  | "inferred" // our own conclusion from other facts (name + company match, topic relevance)
  | "missing"; // we looked and the data is not there

export type SourceRef = { file: string; row?: number; url?: string };

export type Fact<T> = { value: T; provenance: Provenance; source: SourceRef; note?: string };

export type Topic = "legacy-systems" | "ai-automation" | "operations" | "hiring" | "founder-journey" | "ai-news" | "other";

export type Post = { id: string; postedOn: string; title: string; topic: Topic };

export type Engagement = {
  postId: string;
  kind: "comment" | "reaction";
  reaction?: string;
  comment?: string;
  on: string;
  name: string;
  profileUrl?: string;
  headline?: string;
  source: SourceRef;
};

export type Interaction = {
  on: string;
  channel: string;
  direction: "inbound" | "outbound" | "both";
  summary: string;
  gotReply: boolean;
  source: SourceRef;
};

export type Company = {
  id: string;
  name: string;
  employees: Fact<number> | null;
  industry: Fact<string> | null;
  hq?: string;
  physicalOperations: Fact<boolean> | null;
  customer?: { status: "current" | "previous" | "opportunity" | "lost"; since?: string; project?: string; leadSource?: string; source: SourceRef };
};

export type Signal = {
  id: string;
  companyId: string;
  companyName: string;
  type: "expansion" | "operational_hiring" | "leadership_change" | "erp_modernization" | "funding" | "acquisition" | "new_product" | "new_business_unit";
  title: string;
  on: string;
  sourceName: string;
  url?: string;
  person?: string;
  source: SourceRef;
};

/** How an engagement identity was tied to a person record. */
export type MatchBasis = "profile-url" | "name-and-company" | "none";

export type IntroPath = {
  viaPersonId: string;
  viaName: string;
  statement: string;
  on: string;
  provenance: Provenance;
  source: SourceRef;
};

export type Person = {
  id: string;
  name: string;
  profileUrl?: string;
  email?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  connected: Fact<string> | null; // connection date from the LinkedIn export
  engagements: (Engagement & { matchBasis: MatchBasis })[];
  interactions: Interaction[];
  introPaths: IntroPath[];
  isCustomerContact: boolean;
  /** Engagement identities that look like this person but were not merged. */
  possibleMatches: { name: string; headline?: string; profileUrl?: string; reason: string }[];
};

export type ImportReport = {
  kind: string;
  file: string;
  rows: number;
  accepted: number;
  warnings: string[];
};
