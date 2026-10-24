import { SOURCE_FILES, isDemo, loadModel } from "@/lib/engine.ts";
import { Importer, ResetDemo } from "@/components/Importer";
import { Prov } from "@/components/ui";

export default function DataPage() {
  const { model } = loadModel();
  const demo = isDemo();
  const connected = model.people.filter((p) => p.connected).length;
  const engaged = model.people.filter((p) => p.engagements.length).length;
  const companies = [...model.companies.values()];
  const withSize = companies.filter((c) => c.employees).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Data sources</h1>
          <p>Everything this app knows comes from these files. Nothing is scraped and nothing is synced from LinkedIn in the background.</p>
        </div>
        <ResetDemo />
      </div>
      {demo ? (
        <p className="notice" style={{ margin: "0 0 12px" }}>
          You are looking at synthetic demo data. Every person, company and post is invented. Replace a file below to use your own.
        </p>
      ) : null}

      <div className="grid-2">
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th className="r">Rows</th>
                <th className="r">Used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_FILES.map((s) => {
                const r = model.reports.find((x) => x.kind === s.kind);
                return (
                  <tr key={s.kind}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.label}</div>
                      <div className="muted small">
                        <code>{s.file}</code> · {s.how}
                      </div>
                      {r?.warnings.map((w, i) => (
                        <div key={i} className="small" style={{ color: "var(--pill-warning-ink)", marginTop: 4 }}>
                          {w}
                        </div>
                      ))}
                    </td>
                    <td className="r num">{r?.rows ?? 0}</td>
                    <td className="r num">{r?.accepted ?? 0}</td>
                    <td className="r">
                      <Importer kind={s.kind} accept={s.file.endsWith(".json") ? ".json,application/json" : ".csv,text/csv"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Identity matching</h2>
            </div>
            <div className="panel-body">
              <table>
                <tbody>
                  <tr>
                    <td style={{ paddingLeft: 0 }}>Engagements matched by profile URL</td>
                    <td className="r num">{model.matching.byUrl}</td>
                    <td className="r" style={{ paddingRight: 0 }}><Prov p="verified" /></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 0 }}>Matched by name and company</td>
                    <td className="r num">{model.matching.byNameCompany}</td>
                    <td className="r" style={{ paddingRight: 0 }}><Prov p="inferred" /></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 0 }}>Same name, different person: kept apart</td>
                    <td className="r num">{model.matching.notMerged}</td>
                    <td className="r" style={{ paddingRight: 0 }}><Prov p="imported" /></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 0 }}>Engaged, not a connection</td>
                    <td className="r num">{model.matching.unknown}</td>
                    <td className="r" style={{ paddingRight: 0 }}><Prov p="imported" /></td>
                  </tr>
                </tbody>
              </table>
              <p className="muted small" style={{ margin: "12px 0 0" }}>A name alone never merges two records. Profile URLs in the engagement file make matching exact.</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Coverage</h2>
            </div>
            <div className="panel-body">
              <table>
                <tbody>
                  <tr><td style={{ paddingLeft: 0 }}>Connections</td><td className="r num" style={{ paddingRight: 0 }}>{connected}</td></tr>
                  <tr><td style={{ paddingLeft: 0 }}>People who engaged with a post</td><td className="r num" style={{ paddingRight: 0 }}>{engaged}</td></tr>
                  <tr><td style={{ paddingLeft: 0 }}>Companies with a known size</td><td className="r num" style={{ paddingRight: 0 }}>{withSize} of {companies.length}</td></tr>
                  <tr><td style={{ paddingLeft: 0 }}>Company signals</td><td className="r num" style={{ paddingRight: 0 }}>{model.signals.length}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Later</h2>
            </div>
            <div className="panel-body muted">
              Google Contacts, Gmail and Calendar metadata, and approved LinkedIn API access would plug in as further sources with the same provenance labels. None of them is
              connected in this prototype.
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
