import Link from "next/link";
import { loadModel } from "@/lib/engine.ts";
import { nextAction } from "@/lib/recommend.ts";
import { Confidence, Mark, ScoreBar, StatusPill } from "@/components/ui";

const TABS = [
  { key: "recommend", label: "Recommended" },
  { key: "hold", label: "On hold" },
  { key: "customer", label: "Customers" },
  { key: "low", label: "Not yet" },
  { key: "all", label: "Everyone" },
] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "recommend" } = await searchParams;
  const { model, ranked } = loadModel();
  const rows = tab === "all" ? ranked : ranked.filter((o) => o.status === tab);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Opportunities</h1>
          <p>Everyone in your imported data, ranked. The score adds up four parts: relationship (35), engagement (25), company fit (25) and timing (15).</p>
        </div>
      </div>
      <nav className="tabs" aria-label="Filter">
        {TABS.map((t) => (
          <Link key={t.key} href={`/opportunities?tab=${t.key}`} className={tab === t.key ? "active" : ""}>
            {t.label} <span className="num">{t.key === "all" ? ranked.length : ranked.filter((o) => o.status === t.key).length}</span>
          </Link>
        ))}
      </nav>
      <section className="panel">
        {rows.length === 0 ? <div className="empty">Nobody here.</div> : null}
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Next step</th>
                <th>Status</th>
                <th className="r">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((o) => {
                const a = nextAction(o, model);
                return (
                  <tr key={o.person.id}>
                    <td>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <Mark name={o.person.name} size={32} />
                        <div>
                          <Link href={`/people/${o.person.id}`} style={{ fontWeight: 600 }}>
                            {o.person.name}
                          </Link>
                          <div className="muted small">
                            {[o.person.role, o.company?.name ?? o.person.companyName].filter(Boolean).join(" · ") || "Unknown role and company"}
                            {o.person.connected ? "" : " · not connected"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{a.title}</div>
                      <div className="muted small">{o.statusReason ?? ""}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <StatusPill o={o} />
                        <Confidence c={o.confidence} />
                      </div>
                    </td>
                    <td className="r">
                      <div style={{ display: "inline-flex" }}>
                        <ScoreBar total={o.total} parts={o.parts} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>
    </>
  );
}
