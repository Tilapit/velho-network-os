import Link from "next/link";
import { graphData } from "@/lib/graph.ts";
import { loadModel } from "@/lib/engine.ts";
import { NetworkGraph } from "@/components/NetworkGraph";
import { Prov } from "@/components/ui";

export default function NetworkPage() {
  const { nodes, edges } = graphData();
  const { model, ranked } = loadModel();
  const intros = model.people.flatMap((p) => p.introPaths.map((path) => ({ p, path })));
  const hidden = model.people.length - nodes.filter((n) => n.kind === "person").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Network</h1>
          <p>
            You, your posts about your services, and the people and companies around them. Every line is a record: a LinkedIn connection, an engagement, a customer, or an
            introduction someone offered. A shared employer is not a line. Click a person to open their profile.
          </p>
        </div>
      </div>
      <div className="grid-2">
        <section className="panel">
          <NetworkGraph nodes={nodes} edges={edges} />
        </section>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Key</h2>
            </div>
            <div className="panel-body" style={{ display: "grid", gap: 8 }}>
              <Key swatch={<Dot c="#1d5fbf" />} text="Recommended this week, larger means a higher score" />
              <Key swatch={<Dot c="#2e7d32" />} text="Customer contact" />
              <Key swatch={<Dot c="#fff" b="#c4242a" dashed />} text="On hold" />
              <Key swatch={<Line c="#0a0a0a" w={2} />} text="Commented on your post" />
              <Key swatch={<Line c="#9aa1ab" dashed />} text="Reacted to your post" />
              <Key swatch={<Line c="#1d5fbf" w={3} />} text="Introduction offered" />
              <Key swatch={<Square c="#f2f4f7" b="#0a0a0a" />} text="Company with a fresh signal" />
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                {hidden} people with too little evidence are left out to keep this readable. They are all on the <Link href="/opportunities?tab=all">Opportunities</Link> page.
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Introduction paths</h2>
            </div>
            <div className="panel-body">
              {intros.length === 0 ? <p className="muted" style={{ margin: 0 }}>None imported yet. Add them in relationships.csv.</p> : null}
              {intros.map(({ p, path }) => {
                const o = ranked.find((x) => x.person.id === p.id)!;
                return (
                  <div key={p.id + path.viaPersonId} className="reason">
                    <div>
                      <div>
                        <strong>{path.viaName}</strong> → <Link href={`/people/${p.id}`}>{p.name}</Link>, {p.companyName}
                      </div>
                      <div className="muted">{path.statement}</div>
                      <div style={{ marginTop: 4 }}>
                        <Prov p={path.provenance} />
                      </div>
                    </div>
                    <span className="pts">{o.total}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

const Key = ({ swatch, text }: { swatch: React.ReactNode; text: string }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <span style={{ width: 28, display: "inline-flex", justifyContent: "center" }}>{swatch}</span>
    <span>{text}</span>
  </div>
);
const Dot = ({ c, b, dashed }: { c: string; b?: string; dashed?: boolean }) => <span style={{ width: 14, height: 14, borderRadius: 7, background: c, border: `1.5px ${dashed ? "dashed" : "solid"} ${b ?? c}` }} />;
const Square = ({ c, b }: { c: string; b: string }) => <span style={{ width: 14, height: 14, borderRadius: 3, background: c, border: `2px solid ${b}` }} />;
const Line = ({ c, w = 1.5, dashed }: { c: string; w?: number; dashed?: boolean }) => <span style={{ width: 26, borderTop: `${w}px ${dashed ? "dashed" : "solid"} ${c}` }} />;
