// Industry groups (readable bands over TOL 2008 codes) and the target profile:
// which TOL codes Velho goes after and which titles count as decision-makers.

export type GroupId =
  | "metal"
  | "electrical"
  | "plastics"
  | "food"
  | "wood"
  | "construction"
  | "logistics"
  | "maritime"
  | "wholesale"
  | "other_industrial"
  | "other"
  | "not_matched"
  | "abroad";

export type Group = { id: GroupId; label: string; grey?: boolean; rule: string };

/** Order is the order of the bands in the network drawing. */
export const GROUPS: Group[] = [
  { id: "metal", label: "Metal and machinery", rule: "TOL 24, 25, 28, 29, 30 (not boats), 33 (not ship repair)" },
  { id: "electrical", label: "Electrical and electronics", rule: "TOL 26, 27" },
  { id: "plastics", label: "Plastics and chemicals", rule: "TOL 19–22" },
  { id: "food", label: "Food", rule: "TOL 01–03, 10–12" },
  { id: "wood", label: "Wood and building products", rule: "TOL 16, 17, 23, 31" },
  { id: "construction", label: "Construction", rule: "TOL 41–43" },
  { id: "logistics", label: "Logistics and transport", rule: "TOL 49, 51–53" },
  { id: "maritime", label: "Maritime", rule: "TOL 301, 3315, 50" },
  { id: "wholesale", label: "Wholesale", rule: "TOL 46" },
  { id: "other_industrial", label: "Other industrial", rule: "TOL 05–09, 13–15, 18, 32, 35–39" },
  { id: "other", label: "Other industries", rule: "Any other line of business in PRH" },
  { id: "not_matched", label: "Not matched", grey: true, rule: "No single company in PRH for this name" },
  { id: "abroad", label: "Abroad", grey: true, rule: "Foreign company form or a known international company, not in PRH" },
];

export const GROUP: Record<GroupId, Group> = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, Group>;

/** TOL code (e.g. "28300") -> industry group. */
export function groupForTol(tol: string | undefined): GroupId {
  if (!tol || !/^\d{2}/.test(tol)) return "other";
  const d = Number(tol.slice(0, 2));
  if (tol.startsWith("301") || tol.startsWith("3315") || d === 50) return "maritime";
  if ([24, 25, 28, 29, 30, 33].includes(d)) return "metal";
  if (d === 26 || d === 27) return "electrical";
  if (d >= 19 && d <= 22) return "plastics";
  if ((d >= 1 && d <= 3) || (d >= 10 && d <= 12)) return "food";
  if ([16, 17, 23, 31].includes(d)) return "wood";
  if (d >= 41 && d <= 43) return "construction";
  if (d === 49 || (d >= 51 && d <= 53)) return "logistics";
  if (d === 46) return "wholesale";
  if ((d >= 5 && d <= 9) || (d >= 13 && d <= 15) || d === 18 || d === 32 || (d >= 35 && d <= 39)) return "other_industrial";
  return "other";
}

// ---------- target profile ----------

/** A TOL rule: a range of two-digit divisions ("10-33") or a code prefix ("2811"). */
export type IndustryRule = { code: string; label: string; lowerPriority?: boolean };

export type Profile = {
  industries: IndustryRule[];
  roles: string[];
  note: string;
  /** Companies the team has marked as not a target (business IDs), e.g. large groups. */
  excluded?: { businessId: string; name: string }[];
};

export const DEFAULT_PROFILE: Profile = {
  industries: [
    { code: "10-33", label: "Manufacturing" },
    { code: "41-43", label: "Construction" },
    { code: "46", label: "Wholesale" },
    { code: "49-53", label: "Transport and logistics" },
    { code: "4932", label: "Taxis", lowerPriority: true },
    { code: "01-09", label: "Agriculture and mining", lowerPriority: true },
    { code: "35-39", label: "Energy, water and waste", lowerPriority: true },
  ],
  roles: ["CEO", "COO", "CFO", "CTO", "founder", "managing director", "director", "head of", "toimitusjohtaja", "johtaja", "tuotantojohtaja", "operations", "production"],
  note: "Finnish SMEs with physical operations, about 20–300 people: manufacturing, industrial, logistics, construction, wholesale, maritime.",
};

export function tolMatches(tol: string | undefined, code: string): boolean {
  if (!tol) return false;
  const c = code.replace(/\s/g, "");
  const range = c.match(/^(\d{2})-(\d{2})$/);
  if (range) {
    const d = Number(tol.slice(0, 2));
    return d >= Number(range[1]) && d <= Number(range[2]);
  }
  return /^\d+$/.test(c) && tol.startsWith(c);
}

/** The most specific rule that covers this TOL code, or null when it is outside the profile. */
export function industryRule(tol: string | undefined, profile: Profile): IndustryRule | null {
  const hits = profile.industries.filter((r) => tolMatches(tol, r.code));
  if (!hits.length) return null;
  // A specific prefix ("2811", lower priority) wins over a broad range ("10-33").
  return hits.sort((a, b) => b.code.replace(/-.*/, "").length - a.code.replace(/-.*/, "").length || (a.code.includes("-") ? 1 : -1))[0];
}

/** Shown as chips: "Manufacturing 10–33". */
export function ruleLabel(r: IndustryRule): string {
  return `${r.label} ${r.code.replace("-", "–")}`;
}

// ---------- abroad ----------

// Company forms that are not Finnish. "Ltd" and "Plc" are left out: Finnish
// companies use them as the English form of Oy and Oyj. "Ab" counts only
// without "Oy", since Finland-Swedish companies are often "Oy X Ab".
const FOREIGN_FORM = /(^|[\s,])(aktiebolag|oü|ou|as|a\/s|aps|asa|gmbh|ag|se|kg|bv|b\.v\.|nv|sa|sas|sarl|srl|spa|s\.p\.a\.|sp\. z o\.o\.|inc\.?|llc|l\.l\.c\.|pty|kk)$/i;

// Well-known international employers that people list without a company form.
// Used only when PRH has no single Finnish company for the name.
const INTERNATIONAL = new Set(
  ("google|alphabet|microsoft|amazon|aws|amazon web services|apple|meta|facebook|netflix|spotify|klarna|ericsson|volvo|volvo cars|scania|" +
    "h and m|h and m group|ikea|king|epidemic sound|northvolt|bolt|pipedrive|wise|veriff|skype|starship technologies|skeleton technologies|" +
    "zalando|sap|siemens|bosch|robert bosch|n26|celonis|personio|delivery hero|salesforce|nvidia|databricks|stripe|openai|anthropic|" +
    "oracle|ibm|intel|amd|cisco|deloitte|mckinsey|mckinsey and company|bcg|boston consulting group|bain|ey|kpmg|pwc|" +
    "abb|atlas copco|sandvik|electrolux|hilti|philips|shell|bp|unilever|nestle|maersk|novo nordisk|lego|carlsberg|equinor|dnb|" +
    "airbnb|uber|linkedin|github|gitlab|atlassian|shopify|booking com|tesla").split("|"),
);

/** "Spotify AB", "Bolt Technology OÜ", "Siemens AG". */
export function hasForeignForm(name: string): boolean {
  const n = name.trim();
  return FOREIGN_FORM.test(n) || (/(^|\s)ab$/i.test(n) && !/(^|\s)oyj?(\s|$)/i.test(n));
}

/** "Google", "Klarna AB": a well-known international employer. `key` is the matcher's looseKey. */
export function knownInternational(key: string): boolean {
  return INTERNATIONAL.has(key) || INTERNATIONAL.has(key.replace(/ (group|inc|corporation|company)$/, ""));
}

/** `key` is the matcher's looseKey of the name (folded, "&" as "and"). */
export function looksForeign(name: string, key: string): boolean {
  return hasForeignForm(name) || knownInternational(key);
}
