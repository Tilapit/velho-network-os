"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Check = { ok: boolean; text: string };

export function ActionCard(props: {
  personId: string;
  actionType: string;
  title: string;
  why: string;
  channel: string;
  recipient: string;
  draft: string;
  checks: Check[];
  decision?: { status: string; draft: string; at: string };
  claude: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.decision?.draft || props.draft);
  const [checks, setChecks] = useState(props.checks);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function decide(status: "approved" | "saved" | "dismissed" | "undo") {
    setBusy(status);
    await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: props.personId, status, draft, actionType: props.actionType }) });
    setBusy(null);
    router.refresh();
  }

  async function rewrite() {
    setBusy("rewrite");
    setNote(null);
    const res = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: props.personId }) });
    const j = await res.json();
    setDraft(j.draft);
    setChecks(j.checks);
    setNote(j.by === "claude" ? "Rewritten by Claude from the evidence on this page. Read it before approving." : j.error ? `Claude unavailable: ${j.error}` : "No API key set, so this is the template.");
    setBusy(null);
  }

  async function recheck(text: string) {
    setDraft(text);
    const res = await fetch("/api/draft?check=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: props.personId, draft: text }) });
    if (res.ok) setChecks((await res.json()).checks);
  }

  const d = props.decision;
  const hasDraft = !!props.draft;

  return (
    <section className="panel" aria-label="Next action">
      <div className="panel-head">
        <h2>{props.title}</h2>
        {d ? <span className={`pill ${d.status === "approved" ? "positive" : ""}`}>{d.status === "approved" ? `Approved ${d.at.slice(0, 10)}` : d.status === "saved" ? "Saved for later" : "Dismissed"}</span> : null}
      </div>
      <div className="panel-body">
        <p style={{ margin: "0 0 14px" }}>{props.why}</p>
        {hasDraft ? (
          <>
            <div className="muted small" style={{ marginBottom: 6 }}>
              To {props.recipient} · {props.channel}
            </div>
            <textarea value={draft} onChange={(e) => recheck(e.target.value)} aria-label="Draft message" />
            {note ? <p className="muted small" style={{ margin: "8px 0 0" }}>{note}</p> : null}
            <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 6 }}>
              {checks.map((c) => (
                <li key={c.text} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span aria-hidden style={{ color: c.ok ? "var(--positive)" : "var(--negative)", fontWeight: 700 }}>
                    {c.ok ? "✓" : "!"}
                  </span>
                  <span className={c.ok ? "" : ""} style={{ color: c.ok ? undefined : "var(--negative)" }}>
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              {d?.status === "approved" ? (
                <>
                  <button
                    className="btn primary"
                    onClick={() => {
                      navigator.clipboard.writeText(draft);
                      setCopied(true);
                    }}
                  >
                    {copied ? "Copied" : "Copy message"}
                  </button>
                  <button className="btn" onClick={() => decide("undo")} disabled={!!busy}>
                    Undo approval
                  </button>
                </>
              ) : (
                <>
                  <button className="btn primary" onClick={() => decide("approved")} disabled={!!busy || !draft.trim()}>
                    {busy === "approved" ? "Approving…" : "Approve"}
                  </button>
                  <button className="btn" onClick={() => decide("saved")} disabled={!!busy}>
                    Save for later
                  </button>
                  <button className="btn" onClick={() => decide("dismissed")} disabled={!!busy}>
                    Dismiss
                  </button>
                  <button className="btn" onClick={rewrite} disabled={!!busy} title={props.claude ? "Rewrite in your voice with Claude" : "Set ANTHROPIC_API_KEY to enable"}>
                    {busy === "rewrite" ? "Writing…" : "Rewrite with Claude"}
                  </button>
                </>
              )}
            </div>
            <p className="muted small" style={{ margin: "12px 0 0" }}>
              Nothing is sent from here. Approving records your decision; you send the message yourself.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
