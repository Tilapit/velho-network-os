import Link from "next/link";
import { loadModel, contentAnalytics, isIcp } from "@/lib/engine.ts";
import { thisWeek, RELEVANT_TOPICS } from "@/lib/score.ts";
import { nextAction } from "@/lib/recommend.ts";
import { readDecisions } from "@/lib/state.ts";
import { engagementLine, lastComment, relationshipLine, whyNowLine } from "@/lib/summary.ts";
import { Confidence, Mark, ScoreBar } from "@/components/ui";

export default function Overview() {
  const { model, ranked } = loadModel();
  const week = thisWeek(ranked);
  const decisions = readDecisions();
  const held = ranked.filter((o) => o.status === "hold");
  const content = contentAnalytics();
  const relevantPosts = model.posts.filter((p) => RELEVANT_TOPICS.includes(p.topic));
  const icpEngaged = ranked.filter((o) => isIcp(o) && o.person.engagements.some((e) => relevantPosts.some((p) => p.id === e.postId)));
  const inConversation = icpEngaged.filter((o) => o.person.interactions.some((i) => i.gotReply));
  const confirmed = content.customers.filter((c) => c.attribution === "confirmed");
  const engagements = model.people.reduce((n, p) => n + p.engagements.length, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Who should I talk to this week?</h1>
          <p>
            {week.length} people, picked from {model.people.filter((p) => p.connected).length} connections, {engagements} post engagements and {model.signals.length} company signals. Ranked by
            relationship, engagement, company fit and timing.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel" aria-label="This week">
          {week.length === 0 ? <div className="empty">Nobody has a credible reason to hear from you this week. Import more data on the Data sources page.</div> : null}
          {week.map((o, i) => {
            const a = nextAction(o, model);
            const d = decisions[o.person.id];
            const quote = lastComment(o);
            return (
              <article className="rec" key={o.person.id}>
                <div className="rec-rank">{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="rec-who">
                    <Mark name={o.person.name} />
                    <div>
                      <Link href={`/people/${o.person.id}`} className="name">
                        {o.person.name}
                      </Link>
                      <div className="muted">
                        {o.person.role} · {o.company?.name ?? o.person.companyName}
                        {o.company?.employees ? ` · ${o.company.employees.value} people` : ""}
                      </div>
                    </div>
                  </div>
                  <dl className="rec-facts">
                    <dt>Relationship</dt>
                    <dd>{relationshipLine(o)}</dd>
                    <dt>Engagement</dt>
                    <dd>
                      {engagementLine(o, model)}
                      {quote ? <div className="muted" style={{ marginTop: 2 }}>“{quote}”</div> : null}
                    </dd>
                    <dt>Why now</dt>
                    <dd>{whyNowLine(o)}</dd>
                  </dl>
                  <div className="rec-next">
                    <span style={{ fontWeight: 600 }}>{a.title}</span>
                    {d ? <span className={`pill ${d.status === "approved" ? "positive" : ""}`}>{d.status === "approved" ? "Approved" : d.status === "saved" ? "Saved for later" : "Dismissed"}</span> : null}
                  </div>
                </div>
                <div className="rec-side">
                  <ScoreBar total={o.total} parts={o.parts} />
                  <Confidence c={o.confidence} />
                  <Link className="btn sm" href={`/people/${o.person.id}`}>
                    Review
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>From your posts to customers</h2>
            </div>
            <div className="panel-body">
              <table>
                <tbody>
                  <Row k="Posts about your services" v={relevantPosts.length} />
                  <Row k="Decision-makers at fitting companies who engaged" v={icpEngaged.length} />
                  <Row k="Of them, in a two-way conversation with you" v={inConversation.length} />
                  <Row k="Customers whose record names a post as the source" v={confirmed.length} />
                </tbody>
              </table>
              <p className="muted small" style={{ margin: "12px 0 0" }}>
                Counts only what the imported files show. A customer is attributed to content only when its customer record says so.{" "}
                <Link href="/engagement">See posts</Link>
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Held back</h2>
              <span className="muted num">{held.length}</span>
            </div>
            <div className="panel-body">
              {held.length === 0 ? <p className="muted" style={{ margin: 0 }}>No one is on hold.</p> : null}
              {held.map((o) => (
                <div key={o.person.id} style={{ display: "flex", gap: 12, padding: "6px 0" }}>
                  <Mark name={o.person.name} size={32} />
                  <div>
                    <Link href={`/people/${o.person.id}`} style={{ fontWeight: 600 }}>
                      {o.person.name}
                    </Link>
                    <div className="muted">{o.statusReason}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <tr>
      <td style={{ paddingLeft: 0 }}>{k}</td>
      <td className="r num" style={{ paddingRight: 0, fontSize: 18, fontWeight: 500 }}>
        {v}
      </td>
    </tr>
  );
}
