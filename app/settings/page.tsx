import Link from "next/link";
import { ensureMatching, loadNetwork } from "@/lib/network.ts";
import { matchJob } from "@/lib/matching.ts";
import { readState } from "@/lib/state.ts";
import { appUrl } from "@/lib/queries.ts";
import { fmtDate } from "@/lib/analysis.ts";
import { DemoButton, UploadForm } from "@/components/FirstRun";
import { DeleteAll, DeleteOwner, MatchReview, ProfileForm, type Review } from "@/components/SettingsParts";
import { MatchProgress } from "@/components/MatchProgress";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const net = await loadNetwork();
  ensureMatching(net);
  const state = readState();
  // Names that need a look: one close candidate, several, or a Finnish-looking name with no match.
  const byKey = new Map<string, Review>();
  const people = new Map<string, { n: number; dms: number }>();
  for (const c of net.contacts) {
    if (!c.company) continue;
    const p = people.get(c.company) ?? { n: 0, dms: 0 };
    p.n++;
    if (c.role.decisionMaker) p.dms++;
    people.set(c.company, p);
  }
  for (const r of net.names.values()) {
    const picked = state.overrides[r.key];
    const look = picked ? true : r.status === "inferred" ? !r.foreign : r.status === "ambiguous" ? !r.foreign : r.status === "none" ? !r.foreign && r.by === "rule" : false;
    if (!look) continue;
    const p = people.get(r.raw) ?? { n: 0, dms: 0 };
    const it = byKey.get(r.key) ?? {
      name: r.raw,
      names: [],
      status: picked ? "picked" : r.status,
      note: picked ? (picked.notFinnish ? "You marked it as not Finnish" : `You picked ${r.company?.name ?? picked.businessId}`) : r.note,
      people: 0,
      dms: 0,
      candidates: r.candidates.slice(0, 6).map((c) => ({ businessId: c.businessId, name: c.name, industry: c.industry, tol: c.tol, town: c.town })),
      pick: picked?.businessId,
    };
    it.names.push(r.raw);
    it.people += p.n;
    it.dms += p.dms;
    byKey.set(r.key, it);
  }
  const reviews = [...byKey.values()].sort((a, b) => (a.status === "picked" ? 1 : 0) - (b.status === "picked" ? 1 : 0) || b.dms - a.dms || b.people - a.people);
  const needLook = reviews.filter((r) => r.status !== "picked");
  const s = net.stats;
  const job = matchJob();
  return (
    <>
      <MatchProgress initial={{ ...job }} />
      <main className="page" style={{ maxWidth: 1000 }}>
        <h1>Settings</h1>
        <p className="lede">Networks, the target profile, PRH matches to check, export and the Claude connector. Everything here stays on this machine.</p>

        <section className="section" id="networks">
          <h2>Networks</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>
            One LinkedIn Connections.csv per teammate. People are merged by profile URL only, never by name.
          </p>
          {net.owners.length ? (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>File</th>
                    <th className="num">Rows</th>
                    <th className="num">Imported</th>
                    <th className="num">Skipped</th>
                    <th className="num">No company</th>
                    <th className="num">No profile URL</th>
                    <th>Imported</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {net.owners.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.name}
                        {o.demo ? <span className="pill amber" style={{ marginLeft: 6 }}>invented people</span> : null}
                      </td>
                      <td className="small muted">{o.original}</td>
                      <td className="num">{o.rows.toLocaleString("en-US")}</td>
                      <td className="num">{o.accepted.toLocaleString("en-US")}</td>
                      <td className="num">{o.skipped}</td>
                      <td className="num">{o.noCompany}</td>
                      <td className="num">{o.noUrl}</td>
                      <td className="small">{fmtDate(o.importedAt.slice(0, 10))}</td>
                      <td>
                        <DeleteOwner id={o.id} name={o.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="small" style={{ marginBottom: 10 }}>
            {s.contacts.toLocaleString("en-US")} people after merging {s.rows.toLocaleString("en-US")} rows; {s.knownByTwo} known by two or more of you. Company names: {s.names.verified} matched exactly, {s.names.inferred} close (check), {s.names.ambiguous} with several candidates, {s.names.none} not in PRH ({s.names.foreign} look international), {s.names.skipped} not a company
            {s.names.pending ? `, ${s.names.pending} still being looked up` : ""}.
          </p>
          <div className="card stack">
            <UploadForm defaultOwner={net.owners.length ? "Co-founder" : "You"} compact />
            <div className="row small muted">
              <span>A real network replaces the demo networks.</span>
              <DemoButton label={net.demo ? "Reload demo data" : "Load demo data instead"} />
            </div>
          </div>
        </section>

        <section className="section" id="profile">
          <h2>Target profile</h2>
          <ProfileForm profile={net.profile} />
          <h3>Companies marked as not a target ({net.profile.excluded?.length ?? 0})</h3>
          {net.profile.excluded?.length ? (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {net.profile.excluded.map((x) => (
                <li key={x.businessId}>
                  <Link href={`/companies/${x.businessId}`}>{x.name}</Link> <span className="muted">· {x.businessId}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">None. On a company page, &quot;Not a target company&quot; takes its people off the list, for example a large group.</p>
          )}
        </section>

        <section className="section" id="matches">
          <h2>PRH matches to check ({needLook.length})</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Exact names are matched automatically. These were not: pick the right company, enter its business ID, or mark the name as not Finnish. Names with decision-makers first. Nothing is guessed.
          </p>
          <MatchReview items={reviews.slice(0, 80)} />
          {reviews.length > 80 ? <p className="small muted" style={{ marginTop: 8 }}>{reviews.length - 80} more with fewer people.</p> : null}
        </section>

        <section className="section" id="export">
          <h2>Export</h2>
          <p className="small" style={{ marginBottom: 8 }}>
            Everyone at a company in your target industries, with fit, approach, who knows them and status. For your CRM. No emails are stored or exported.
          </p>
          <a className="btn" href="/api/export.csv">
            Download CSV
          </a>
        </section>

        <section className="section" id="mcp">
          <h2>Use it from Claude</h2>
          <p className="small" style={{ marginBottom: 8 }}>
            The same data, as an MCP server, so you can ask in your own Claude: &quot;who should we invite to a logistics roundtable?&quot; Ranking and filtering stay in this app; Claude picks the filters and writes the text. Nothing is sent to anyone.
          </p>
          <pre className="card small" style={{ overflowX: "auto", margin: 0 }}>claude mcp add --transport http velho {appUrl("/api/mcp")}</pre>
          <p className="small muted" style={{ marginTop: 6 }}>Local only for now: no login, so do not expose this port to the internet.</p>
        </section>

        <section className="section" id="delete">
          <h2>Delete my data</h2>
          <p className="small" style={{ marginBottom: 10 }}>
            Deletes every network, every status and the PRH lookups made for your company names. Only company names were ever sent to PRH; one person&apos;s role and company facts go to Claude only when an API key is set.
          </p>
          <DeleteAll />
        </section>
      </main>
    </>
  );
}
