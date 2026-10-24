import Link from "next/link";
import { loadModel } from "@/lib/engine.ts";
import { SIGNAL_LABEL } from "@/lib/score.ts";
import { ago } from "@/lib/summary.ts";
import { Prov } from "@/components/ui";

export default function IntelligencePage() {
  const { model, ranked } = loadModel();
  const signals = [...model.signals].sort((a, b) => b.on.localeCompare(a.on));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Intelligence</h1>
          <p>
            Company signals from your discovery pipeline, joined to the people you know there. A signal on its own is a lead record; a signal next to someone who already talks
            to you is a reason to reach out.
          </p>
        </div>
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Company</th>
              <th>Who you know there</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => {
              const people = ranked.filter((o) => o.person.companyId === s.companyId);
              const c = model.companies.get(s.companyId);
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.title}</div>
                    <div className="muted small">
                      {SIGNAL_LABEL[s.type]} · {ago(s.on)}
                    </div>
                  </td>
                  <td>
                    {c?.name}
                    <div className="muted small">{[c?.employees ? `${c.employees.value} people` : null, c?.industry?.value].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    {people.length === 0 ? <span className="muted">No relationship yet</span> : null}
                    {people.map((o) => (
                      <div key={o.person.id}>
                        <Link href={`/people/${o.person.id}`} style={{ fontWeight: 600 }}>
                          {o.person.name}
                        </Link>
                        <span className="muted">
                          {" "}
                          · {o.person.connected ? "connected" : o.person.introPaths.length ? `via ${o.person.introPaths[0].viaName}` : "engaged, not connected"} · score {o.total}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Prov p="imported" />
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="small">
                          {s.sourceName}
                        </a>
                      ) : (
                        <span className="small">{s.sourceName}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="muted small">
        Signals come from <code>signals.json</code>, the output of the separate company-signal pipeline. This app does not search for companies itself.
      </p>
    </>
  );
}
