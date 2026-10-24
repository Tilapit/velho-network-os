// Normalisation helpers used for de-duplication and identity matching.

const SUFFIXES = /\b(oyj|oy|ab|ltd|limited|inc|gmbh|llc|as|a\/s|aps|plc|co|corp|group)\b\.?/g;

export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "Rautio Industrial Oy" and "rautio industrial" give the same key. */
export function companyKey(name: string | undefined): string {
  if (!name) return "";
  return fold(name).replace(SUFFIXES, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function nameKey(name: string | undefined): string {
  if (!name) return "";
  return fold(name).replace(/[^a-z]+/g, " ").trim();
}

/** https://www.linkedin.com/in/Kaisa-Rinne/?x=1 -> linkedin.com/in/kaisa-rinne */
export function profileKey(url: string | undefined): string {
  if (!url) return "";
  const m = url.trim().toLowerCase().match(/linkedin\.com\/in\/([^/?#]+)/);
  return m ? `linkedin.com/in/${decodeURIComponent(m[1])}` : "";
}

export function slug(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Accepts ISO dates and LinkedIn's "12 Apr 2026". Returns YYYY-MM-DD or "". */
export function isoDate(s: string | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    const d = new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function today(): string {
  return process.env.APP_TODAY || new Date().toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const DECISION = /\b(ceo|coo|cfo|cto|chief|founder|co-founder|owner|managing director|md|director|head of|vp|vice president|general manager|toimitusjohtaja|johtaja)\b/i;
export function isDecisionMaker(role: string | undefined): boolean {
  return !!role && DECISION.test(role);
}
