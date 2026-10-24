import Link from "next/link";
import { contentAnalytics } from "@/lib/engine.ts";
import { TOPIC_LABEL } from "@/lib/score.ts";

export default function EngagementPage() {
  const { posts, topics, customers } = contentAnalytics();
  const sorted = [...posts].sort((a, b) => b.post.postedOn.localeCompare(a.post.postedOn));
  const best = topics.find((t) => t.icp > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Engagement</h1>
          <p>Who engages with your posts, not how many. A decision-maker at a 20–300 person operational company counts; a like from a student does not.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Posts</h2>
            <span className="muted small">From the engagement you imported for selected posts</span>
          </div>
          <div className="panel-body" style={{ paddingTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th className="r">Engaged</th>
                  <th className="r">Comments</th>
                  <th className="r">Decision-makers who fit</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((x) => (
                  <tr key={x.post.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{x.post.title}</div>
                      <div className="muted small">
                        {x.post.postedOn} · {TOPIC_LABEL[x.post.topic]}
                      </div>
                      {x.icp.length ? (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {x.icp.map((p) => (
                            <Link key={p.id} href={`/people/${p.id}`} className="pill hue">
                              {p.name}
                              {p.commented ? ", commented" : ""}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="r num">{x.engagers}</td>
                    <td className="r num">{x.comments}</td>
                    <td className="r num" style={{ fontWeight: 600, color: x.icp.length ? "var(--hue)" : "var(--muted)" }}>
                      {x.icp.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>What to write about next</h2>
            </div>
            <div className="panel-body">
              {best ? (
                <p style={{ marginTop: 0 }}>
                  <strong>{best.label}</strong> brings the most fitting decision-makers per post: {(best.icp / best.posts).toFixed(1)} on average across {best.posts} post
                  {best.posts > 1 ? "s" : ""}.
                </p>
              ) : null}
              <table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th className="r">Posts</th>
                    <th className="r">Engaged</th>
                    <th className="r">Fit per post</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t) => (
                    <tr key={t.topic}>
                      <td>{t.label}</td>
                      <td className="r num">{t.posts}</td>
                      <td className="r num">{t.engagers}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>
                        {(t.icp / t.posts).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small" style={{ margin: "12px 0 0" }}>
                Based on {posts.length} posts. A pattern, not proof: a few posts can swing it.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Customers and your content</h2>
            </div>
            <div className="panel-body">
              {customers.map((c) => (
                <div key={c.company} className="reason">
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.company}</div>
                    <div className="muted">Lead source on record: {c.leadSource || "not recorded"}</div>
                    {c.engagedBefore.map((e, i) => (
                      <div key={i} className="small" style={{ marginTop: 4 }}>
                        {e.person} {e.kind === "comment" ? "commented on" : "reacted to"} “{e.post}” on {e.on}
                      </div>
                    ))}
                  </div>
                  <span className={`pill ${c.attribution === "confirmed" ? "positive" : c.attribution === "correlation" ? "warning" : ""}`}>
                    {c.attribution === "confirmed" ? "Confirmed by record" : c.attribution === "correlation" ? "Engaged first, not confirmed" : "No content link"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
