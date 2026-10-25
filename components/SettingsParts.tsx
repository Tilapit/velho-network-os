"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { presetOf, requiresEmployer, type PresetId, type Profile } from "@/lib/industry.ts";

export function DeleteOwner({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return sure ? (
    <span className="row" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn small danger"
        onClick={async () => {
          await fetch(`/api/networks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
          router.refresh();
        }}
      >
        Delete {name}&apos;s network
      </button>
      <button type="button" className="link small" onClick={() => setSure(false)}>
        Cancel
      </button>
    </span>
  ) : (
    <button type="button" className="btn small" onClick={() => setSure(true)}>
      Delete
    </button>
  );
}

export function DeleteAll() {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return sure ? (
    <span className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          await fetch("/api/delete-all", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
      >
        Yes, delete everything
      </button>
      <button type="button" className="link" onClick={() => setSure(false)}>
        Cancel
      </button>
    </span>
  ) : (
    <button type="button" className="btn danger" onClick={() => setSure(true)}>
      Delete my data
    </button>
  );
}

/** Presets and the Employer Register switch: the choices a founder makes. TOL codes are under Advanced. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [employer, setEmployer] = useState(requiresEmployer(profile));
  const [msg, setMsg] = useState("");
  const active = presetOf(profile);
  async function post(body: object, done: string) {
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const p = (await r.json()) as Profile;
    setEmployer(requiresEmployer(p));
    setMsg(done);
    router.refresh();
  }
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="small muted">Industries</span>
        <div className="seg" role="group" aria-label="Profile preset">
          <button type="button" aria-pressed={active === "default"} onClick={() => post({ preset: "default" }, "Velho default on: physical operations.")} title="Finnish SMEs with physical operations: manufacturing, construction, wholesale, logistics">
            Velho default: physical operations
          </button>
          <button type="button" aria-pressed={active === "broad"} onClick={() => post({ preset: "broad" }, "Broad profile on: every Finnish company.")} title="Every Finnish company in PRH apart from public administration, associations and households">
            Broad: all Finnish SMEs
          </button>
        </div>
        {!active ? <span className="pill">Edited under Advanced</span> : null}
      </div>
      <p className="small muted">{profile.note}</p>
      <label className="small" style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: 820 }}>
        <input
          type="checkbox"
          checked={employer}
          onChange={(e) => {
            setEmployer(e.target.checked);
            post({ requireEmployer: e.target.checked }, e.target.checked ? "Companies with no employees registered are hidden." : "Companies with no employees registered are shown, as Possible at most.");
          }}
        />
        <span style={{ flex: 1 }}>Hide companies with no employees registered: not in the Employer Register (PRH/YTJ), so most likely one-person companies. Their people are never a fit.</span>
      </label>
      <span className="small muted" role="status">
        {msg}
      </span>
      <p className="small muted">
        <span className="pill missing">Missing</span> Headcount is not in PRH open data. The Employer Register says only whether a company has regular employees.
      </p>
    </div>
  );
}

/** TOL codes, decision-maker titles and the note, for whoever wants to tune the rules. */
export function ProfileRules({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [rows, setRows] = useState(profile.industries);
  const [roles, setRoles] = useState(profile.roles.join(", "));
  const [note, setNote] = useState(profile.note);
  const [msg, setMsg] = useState("");
  async function save() {
    const r = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ industries: rows, roles: roles.split(",").map((s) => s.trim()), note }) });
    const p = (await r.json()) as Profile;
    setRows(p.industries);
    setRoles(p.roles.join(", "));
    setNote(p.note);
    setMsg("Saved. The list and the drawing use it now.");
    router.refresh();
  }
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TOL codes</th>
              <th>Label</th>
              <th>Lower priority</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input value={r.code} aria-label="TOL range or prefix" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} style={{ width: 110 }} />
                </td>
                <td>
                  <input value={r.label} aria-label="Label" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ width: "100%", minWidth: 160 }} />
                </td>
                <td>
                  <input type="checkbox" aria-label="Lower priority" checked={!!r.lowerPriority} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, lowerPriority: e.target.checked } : x)))} />
                </td>
                <td>
                  <button type="button" className="link small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="btn small" onClick={() => setRows([...rows, { code: "", label: "" }])}>
          Add TOL codes
        </button>
        <span className="xs muted" style={{ marginLeft: 10 }}>
          A range of two-digit divisions (28-30) or a code prefix (2811). A specific prefix wins over a broad range.
        </span>
      </div>
      <label className="field">
        <span>Decision-maker titles (comma-separated; Finnish and Swedish forms of production, operations, director and CEO match too; C-level always counts)</span>
        <textarea value={roles} onChange={(e) => setRoles(e.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => save()}>
          Save rules
        </button>
        <span className="small muted" role="status">
          {msg}
        </span>
      </div>
    </div>
  );
}
export type Review = { name: string; names: string[]; status: string; note: string; people: number; dms: number; candidates: { businessId: string; name: string; industry?: string; tol?: string; town?: string }[]; pick?: string };

export function MatchReview({ items }: { items: Review[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  async function send(name: string, body: object) {
    setBusy(name);
    const r = await fetch("/api/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, ...body }) });
    const j = await r.json().catch(() => ({}));
    setErr({ ...err, [name]: r.ok ? "" : j.error ?? "Failed" });
    setBusy(null);
    router.refresh();
  }
  return (
    <div className="stack">
      {items.map((it) => (
        <div key={it.name} className="card" style={{ opacity: busy === it.name ? 0.6 : 1 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b style={{ fontWeight: 600 }}>{it.names.join(" · ")}</b>
              <div className="small muted">
                {it.people} {it.people === 1 ? "person" : "people"}
                {it.dms ? `, ${it.dms} decision-maker${it.dms > 1 ? "s" : ""}` : ""} · {it.note}
              </div>
            </div>
            <span className={`pill ${it.status === "inferred" ? "inferred" : it.status === "picked" ? "green" : "amber"}`}>{it.status === "inferred" ? "Check" : it.status === "picked" ? "Picked by you" : it.status === "ambiguous" ? "Several" : "No match"}</span>
          </div>
          {it.candidates.length ? (
            <div className="stack" style={{ gap: 6, marginTop: 10 }}>
              {it.candidates.map((c) => (
                <div key={c.businessId} className="row small" style={{ justifyContent: "space-between", gap: 8 }}>
                  <span>
                    {c.name} <span className="muted">· {c.businessId} · {c.industry} {c.tol ? `(${c.tol})` : ""} {c.town ? `· ${c.town.charAt(0)}${c.town.slice(1).toLowerCase()}` : ""}</span>
                  </span>
                  <button type="button" className="btn small" aria-pressed={it.pick === c.businessId} onClick={() => send(it.name, { businessId: c.businessId })}>
                    {it.pick === c.businessId ? "Picked" : "This one"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <form
            className="row small"
            style={{ marginTop: 10, gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("bid");
              send(it.name, { businessId: String(v) });
            }}
          >
            <input name="bid" placeholder="Business ID, e.g. 1234567-8" style={{ width: 210, minHeight: 32, padding: "4px 8px" }} aria-label="Business ID" />
            <button className="btn small">Use ID</button>
            <button type="button" className="btn small" onClick={() => send(it.name, { notFinnish: true })}>
              Not a Finnish company
            </button>
            {it.status === "picked" ? (
              <button type="button" className="link small" onClick={() => send(it.name, { clear: true })}>
                Undo
              </button>
            ) : null}
            {err[it.name] ? <span className="small" style={{ color: "var(--red)" }}>{err[it.name]}</span> : null}
          </form>
        </div>
      ))}
    </div>
  );
}
