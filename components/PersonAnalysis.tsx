"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Analysis } from "@/lib/analysis.ts";
import { FitTag, Source } from "./ui";

const STATUSES = [
  { id: "to_contact", label: "To contact" },
  { id: "sent", label: "Sent" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "not_fit", label: "Not a fit" },
];

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso: string) => (iso ? `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "date unknown");

export type PersonPayload = Analysis & { claude: boolean; savedAngle?: string; owners: { id: string; name: string }[] };

export function PersonAnalysis({ data, onBack, standalone }: { data: PersonPayload; onBack?: () => void; standalone?: boolean }) {
  const [status, setStatus] = useState(data.status);
  const [statusBy, setStatusBy] = useState(data.statusBy);
  const [angle, setAngle] = useState<{ text: string; by: string; error?: string }>(data.savedAngle ? { text: data.savedAngle, by: "claude" } : { text: data.angle.text, by: "template" });
  const [busy, setBusy] = useState(false);
  const by = data.owners.find((o) => o.id === data.knownBy[0]?.owner)?.name ?? data.owners[0]?.name ?? "You";

  useEffect(() => {
    setStatus(data.status);
    setStatusBy(data.statusBy);
    setAngle(data.savedAngle ? { text: data.savedAngle, by: "claude" } : { text: data.angle.text, by: "template" });
    if (data.claude && !data.savedAngle && data.fit) {
      let live = true;
      fetch(`/api/people/${data.id}/angle`, { method: "POST" })
        .then((r) => r.json())
        .then((a) => live && setAngle(a))
        .catch(() => {});
      return () => {
        live = false;
      };
    }
  }, [data]);

  async function save(next: string) {
    setBusy(true);
    const s = next === status ? "none" : next;
    const r = await fetch(`/api/people/${data.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: s, by }) });
    if (r.ok) {
      setStatus(s as Analysis["status"]);
      setStatusBy(by);
    }
    setBusy(false);
  }

  const senderOwner = data.sender.ownerName;
  return (
    <div>
      {onBack ? (
        <button type="button" className="link" onClick={onBack} style={{ height: 32 }}>
          ← All
        </button>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginTop: 4 }}>
        {standalone ? <h1>{data.name}</h1> : <h2 style={{ fontSize: 24, margin: 0 }}>{data.name}</h2>}
        <FitTag fit={data.fit} status={status} />
      </div>
      <div className="muted">
        {data.title || "No title"} · {data.company.id && !data.company.id.startsWith("x-") ? <Link href={`/companies/${data.company.id}`}>{data.company.name}</Link> : data.company.name}
      </div>
      <div className="xs faint" style={{ marginTop: 2 }}>
        {[data.company.industry, data.company.town ? data.company.town.charAt(0) + data.company.town.slice(1).toLowerCase() : "", data.company.businessId].filter(Boolean).join(" · ")}
        {data.company.businessId ? " · PRH" : ""}
        {data.url ? (
          <>
            {" · "}
            <a href={data.url} target="_blank" rel="noreferrer" className="faint">
              LinkedIn profile
            </a>
          </>
        ) : null}
      </div>

      <h3>Who knows them</h3>
      {data.knownBy.map((k) => (
        <div key={k.owner} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
          <span>
            <b style={{ fontWeight: 600 }}>{k.ownerName}</b> <span className="muted small">· connected {month(k.connectedOn)}</span>
          </span>
          {k.ownerName === senderOwner ? <span className="pill accent">Suggested sender</span> : null}
        </div>
      ))}
      <div className="small muted" style={{ paddingTop: 2 }}>
        {data.knownBy.length > 1 ? `${data.knownBy.length} of you know them. ${senderOwner} connected first.` : `Only ${senderOwner === "You" ? "you know" : `${senderOwner} knows`} them.`} {data.approachLabel}: {data.approachWhy}
      </div>

      <h3>Why Velho could matter to them</h3>
      <ol className="reasons">
        {data.reasons.map((r, i) => (
          <li key={i}>
            <span>
              {r.text}
              {r.link ? (
                <>
                  {" "}
                  <a href={r.link} target="_blank" rel="noreferrer">
                    source
                  </a>
                </>
              ) : null}
            </span>
            <Source source={r.source} provenance={r.provenance} />
          </li>
        ))}
      </ol>

      <h3>What we don't know</h3>
      <ul className="reasons">
        {data.missing.map((m, i) => (
          <li key={i} style={{ color: "var(--text-2)" }}>
            <span>
              <b style={{ fontWeight: 500 }}>{m.label}.</b> {m.text}
            </span>
            <span className="pill missing">Missing</span>
          </li>
        ))}
      </ul>

      <div className="small muted" style={{ marginTop: 10 }}>
        <b style={{ color: "var(--text-2)", fontWeight: 500 }}>{data.fitLabel}.</b> {data.fitWhy}
      </div>

      <div className="angle">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Possible angle for Velho</span>
          <span className="pill inferred">Inferred</span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 14 }}>{angle.text}</p>
        <p className="xs muted" style={{ marginTop: 6 }}>
          Written from the facts above only{angle.by === "claude" ? " by Claude" : " (template)"}. Check before you use it.{angle.error ? ` ${angle.error}.` : ""}
        </p>
      </div>

      <div role="group" aria-label="Status" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16 }}>
        {STATUSES.map((s) => (
          <button key={s.id} type="button" className="btn small" aria-pressed={status === s.id} disabled={busy} onClick={() => save(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="xs faint" style={{ marginTop: 6 }}>
        {status !== "none" && statusBy ? `Marked by ${statusBy}. ` : ""}A status only records what the team did. Nothing is sent from here.
      </p>
      {!standalone ? (
        <p className="small" style={{ marginTop: 12 }}>
          <Link href={`/people/${data.id}`} className="link">
            Open as a page →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
