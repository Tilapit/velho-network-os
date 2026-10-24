import type { Provenance, SourceRef } from "@/lib/types.ts";
import type { Opportunity, Part } from "@/lib/score.ts";

function hueOf(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** A stable initial on a pale tint of the person's own hue. */
export function Mark({ name, size = 36 }: { name: string; size?: number }) {
  const h = hueOf(name);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="mark" style={{ width: size, height: size, background: `hsl(${h} 40% 93%)`, color: `hsl(${h} 45% 28%)`, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

const PROV: Record<Provenance, { label: string; cls: string; title: string }> = {
  verified: { label: "Verified", cls: "positive", title: "Checked against your LinkedIn export or customer records" },
  imported: { label: "Imported", cls: "", title: "From a file you imported" },
  inferred: { label: "Inferred", cls: "warning", title: "Our conclusion from other facts. Check before relying on it." },
  missing: { label: "Missing", cls: "missing", title: "Not in any imported source" },
};

export function Prov({ p }: { p: Provenance }) {
  const x = PROV[p];
  return (
    <span className={`pill ${x.cls}`} title={x.title}>
      {x.label}
    </span>
  );
}

export function Source({ s }: { s?: SourceRef }) {
  if (!s) return null;
  return (
    <span className="src">
      {s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer">
          {s.file}
          {s.row ? `, row ${s.row}` : ""}
        </a>
      ) : (
        <>
          {s.file}
          {s.row ? `, row ${s.row}` : ""}
        </>
      )}
    </span>
  );
}

export function ScoreBar({ total, parts }: { total: number; parts: Part[] }) {
  return (
    <div className="score" title={parts.map((p) => `${p.label} ${p.points}/${p.max}`).join(" · ")}>
      <span className="score-num">{total}</span>
      <span className="bar" aria-hidden>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.points}%` }} />
        ))}
      </span>
    </div>
  );
}

export function StatusPill({ o }: { o: Opportunity }) {
  if (o.status === "hold") return <span className="pill negative">On hold</span>;
  if (o.status === "customer") return <span className="pill positive">Customer</span>;
  if (o.status === "low") return <span className="pill">Not yet</span>;
  return <span className="pill hue">Recommended</span>;
}

export function Confidence({ c }: { c: Opportunity["confidence"] }) {
  return (
    <span className={`pill ${c === "high" ? "" : c === "medium" ? "" : "warning"}`} title="How complete and certain the data behind this is">
      {c === "high" ? "High confidence" : c === "medium" ? "Medium confidence" : "Low confidence"}
    </span>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0a0a0a" />
      <circle cx="10" cy="20" r="3" fill="#fff" />
      <circle cx="22" cy="10" r="3" fill="#1d5fbf" />
      <circle cx="23" cy="22" r="2.4" fill="#fff" />
      <path d="M12.4 18.4 L19.8 11.8 M12.8 20.6 L20.6 21.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
