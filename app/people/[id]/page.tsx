import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunity, loadModel } from "@/lib/engine.ts";
import { nextAction, safeguards } from "@/lib/recommend.ts";
import { readDecisions } from "@/lib/state.ts";
import { claudeAvailable } from "@/lib/claude.ts";
import { SIGNAL_LABEL, TOPIC_LABEL } from "@/lib/score.ts";
import { ago } from "@/lib/summary.ts";
import { ActionCard } from "@/components/ActionCard";
import { Confidence, Mark, Prov, ScoreBar, Source, StatusPill } from "@/components/ui";
import type { Provenance, SourceRef } from "@/lib/types.ts";

type Event = { on: string; what: string; detail?: string; provenance: Provenance; source?: SourceRef };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = getOpportunity(id);
  if (!o) notFound();
  const { model } = loadModel();
  const p = o.person;
  const a = nextAction(o, model);
  const decision = readDecisions()[p.id];
  const posts = new Map(model.posts.map((x) => [x.id, x]));

  const events: Event[] = [];
  if (p.connected) events.push({ on: p.connected.value, what: "Connected on LinkedIn", provenance: "verified", source: p.connected.source });
  for (const e of p.engagements) {
    const post = posts.get(e.postId);
    events.push({
      on: e.on,
      what: e.kind === "comment" ? `Commented on "${post?.title}"` : `Reacted (${e.reaction || "like"}) to "${post?.title}"`,
      detail: e.comment,
      provenance: e.matchBasis === "profile-url" ? "verified" : e.matchBasis === "name-and-company" ? "inferred" : "imported",
      source: e.source,
    });
  }
  const CH: Record<string, string> = { event: "Met at an event", meeting: "Meeting", call: "Call", linkedin_dm: "LinkedIn message", email: "Email" };
  for (const i of p.interactions) {
    const ch = CH[i.channel] ?? i.channel;
    const who = i.channel === "event" || i.channel === "meeting" ? "" : i.direction === "outbound" ? (i.gotReply ? " from you" : " from you, no reply") : i.direction === "inbound" ? " from them" : "";
    events.push({ on: i.on, what: ch + who, detail: i.summary, provenance: "imported", source: i.source });
  }
  for (const s of o.signals) events.push({ on: s.on, what: `${SIGNAL_LABEL[s.type]} at ${o.company?.name}`, detail: s.title, provenance: "imported", source: s.source });
  for (const path of p.introPaths) events.push({ on: path.on, what: `Introduction path via ${path.viaName}`, detail: path.statement, provenance: path.provenance, source: path.source });
  events.sort((x, y) => y.on.localeCompare(x.on));

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Mark name={p.name} size={52} />
          <div>
            <h1>{p.name}</h1>
            <p style={{ marginTop: 2 }}>
              {p.role ?? "Role unknown"} · {o.company?.name ?? p.companyName ?? "Company unknown"}
              {p.profileUrl ? (
                <>
                  {" · "}
                  <a href={p.profileUrl} target="_blank" rel="noreferrer">
                    LinkedIn profile
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StatusPill o={o} />
          <Confidence c={o.confidence} />
          <ScoreBar total={o.total} parts={o.parts} />
        </div>
      </div>

      {o.status === "hold" || o.status === "customer" || o.status === "low" ? (
        <p className="notice" style={{ margin: "0 0 12px" }}>
          {o.statusReason}
        </p>
      ) : null}

      <div className="grid-2">
        <div className="stack">
          <ActionCard
            personId={p.id}
            actionType={a.type}
            title={a.title}
            why={a.why}
            channel={a.channel}
            recipient={a.recipient}
            draft={a.draft}
            checks={safeguards(o, a.draft, model)}
            decision={decision}
            claude={claudeAvailable()}
          />

          <section className="panel">
            <div className="panel-head">
              <h2>Why {o.total} points</h2>
              <span className="muted small">A prioritisation score, not a probability</span>
            </div>
            <div className="panel-body">
              {o.parts.map((part) => (
                <div key={part.key}>
                  <div className="part-head">
                    <h3>{part.label}</h3>
                    <span className="num muted">
                      {part.points} / {part.max}
                    </span>
                  </div>
                  {part.reasons.length === 0 ? <div className="reason"><span className="muted">Nothing found</span><Prov p="missing" /></div> : null}
                  {part.reasons.map((r, i) => (
                    <div className="reason" key={i}>
                      <div>
                        <div>{r.text}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                          <Prov p={r.provenance} />
                          <Source s={r.source} />
                        </div>
                      </div>
                      <span className="pts">+{r.points}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>{o.company?.name ?? "Company"}</h2>
              {o.company?.customer ? <span className="pill positive">{o.company.customer.status} customer</span> : null}
            </div>
            <div className="panel-body">
              <Fact k="People" v={o.company?.employees ? String(o.company.employees.value) : undefined} p={o.company?.employees?.provenance} />
              <Fact k="Industry" v={o.company?.industry?.value} p={o.company?.industry?.provenance} />
              <Fact k="Location" v={o.company?.hq} p={o.company?.hq ? "imported" : undefined} />
              <Fact k="Signals" v={o.signals.length ? o.signals.map((s) => s.title).join("; ") : undefined} p={o.signals.length ? "imported" : undefined} />
            </div>
          </section>

          {o.missing.length ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Missing information</h2>
              </div>
              <div className="panel-body">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {o.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {p.possibleMatches.length ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Possible duplicate, not merged</h2>
              </div>
              <div className="panel-body">
                {p.possibleMatches.map((m, i) => (
                  <p key={i} style={{ margin: "0 0 8px" }}>
                    <strong>{m.name}</strong>
                    {m.headline ? ` · ${m.headline}` : ""}
                    <br />
                    <span className="muted">{m.reason}</span>
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2>Timeline</h2>
            </div>
            <div className="panel-body">
              <ol className="timeline">
                {events.map((e, i) => (
                  <li key={i}>
                    <span className="muted num" title={e.on}>
                      {ago(e.on)}
                    </span>
                    <div>
                      <div>{e.what}</div>
                      {e.detail ? <div className="muted">{e.detail}</div> : null}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                        <Prov p={e.provenance} />
                        <Source s={e.source} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <p className="muted small">
            Topics engaged:{" "}
            {[...new Set(p.engagements.map((e) => TOPIC_LABEL[posts.get(e.postId)?.topic ?? "other"]))].join(", ") || "none"} · <Link href="/network">Show in network</Link>
          </p>
        </div>
      </div>
    </>
  );
}

function Fact({ k, v, p }: { k: string; v?: string; p?: Provenance }) {
  return (
    <div className="reason">
      <div>
        <div className="muted small">{k}</div>
        <div>{v ?? "Unknown"}</div>
      </div>
      <Prov p={v ? p ?? "imported" : "missing"} />
    </div>
  );
}
