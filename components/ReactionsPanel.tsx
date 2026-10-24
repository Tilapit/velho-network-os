"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Person = { id: string; name: string; title: string; company: string; fit?: string | null; url?: string };
type Result = {
  post: string;
  postDate: string;
  read: number;
  saved: number;
  matched: { name: string; how?: string; person: Person }[];
  review: { name: string; headline?: string; degree?: string; candidates: (Person & { knownBy: string[] })[] }[];
  unmatched: { name: string; why: string }[];
};
type Post = { post: string; postDate?: string; author?: string; people: number };

const HOW: Record<string, string> = { name: "Name", name_company: "Name and company", name_degree: "Name and degree", picked: "Picked" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso?: string) => (iso ? `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");

/** Paste a post's reactions list from LinkedIn, check the matches, save. */
export function ReactionsPanel({ owners, posts, today }: { owners: { id: string; name: string }[]; posts: Post[]; today: string }) {
  const router = useRouter();
  const [post, setPost] = useState("");
  const [date, setDate] = useState(today);
  const [author, setAuthor] = useState(owners[0]?.id ?? "");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function send(save: boolean) {
    setBusy(true);
    setMsg("");
    const chosen = Object.entries(picks)
      .filter(([, id]) => id && id !== "none")
      .map(([name, person_id]) => ({ name, person_id }));
    const r = await fetch("/api/reactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post, postDate: date, author, text, picks: save ? chosen : [], save }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Failed");
    if (!save) {
      setResult(j);
      setPicks({});
      return;
    }
    // Saved: the unmatched names were shown once and are gone now.
    setMsg(`Saved ${j.matched.length} reaction${j.matched.length === 1 ? "" : "s"} to "${j.post}"${j.saved < j.matched.length ? ` (${j.matched.length - j.saved} were already there)` : ""}. They count in the ranking now.`);
    setResult(null);
    setText("");
    setPost("");
    router.refresh();
  }

  async function remove(p: Post) {
    await fetch(`/api/reactions?post=${encodeURIComponent(p.post)}${p.postDate ? `&date=${p.postDate}` : ""}`, { method: "DELETE" });
    router.refresh();
  }

  const toSave = result ? result.matched.length + Object.values(picks).filter((v) => v && v !== "none").length : 0;
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      {!result ? (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            send(false);
          }}
        >
          <div className="row" style={{ alignItems: "end" }}>
            <label className="field" style={{ flex: "1 1 260px" }}>
              <span>Post</span>
              <input value={post} onChange={(e) => setPost(e.target.value)} placeholder="A short label, e.g. AI in production planning" required />
            </label>
            <label className="field">
              <span>Posted on</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>Whose post</span>
              <select value={author} onChange={(e) => setAuthor(e.target.value)}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>The reactions list, as copied from LinkedIn</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"On LinkedIn, open the post's reactions, select the whole list and copy it. Names, '· 1st' markers, headlines and button text are all fine.\n\nAino Kallio\nAino Kallio\n· 1st\nTuotantojohtaja at Esimerkki Oy"} required />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy || !text.trim()}>
              {busy ? "Matching…" : "Match names"}
            </button>
            <span className="small muted">Nothing is stored until you save.</span>
          </div>
        </form>
      ) : (
        <div className="card stack">
          <div className="small muted">
            &quot;{result.post}&quot;, {day(result.postDate)}: {result.read} people read from the paste.
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Will be stored ({result.matched.length})</h3>
            {result.matched.length ? (
              <ul className="reasons">
                {result.matched.map((m, i) => (
                  <li key={i}>
                    <span>
                      <Link href={`/people/${m.person.id}`}>{m.person.name}</Link>{" "}
                      <span className="small muted">
                        · {m.person.title || "No title"}
                        {m.person.company ? ` · ${m.person.company}` : ""}
                      </span>
                    </span>
                    <span className="pill inferred">{HOW[m.how ?? "name"]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No one matched on their own.</p>
            )}
          </div>
          {result.review.length ? (
            <div>
              <h3>Check these ({result.review.length})</h3>
              <p className="small muted">Two or more people in your networks have this name, and the headline does not settle it. Pick one, or leave it out.</p>
              {result.review.map((r) => (
                <fieldset key={r.name} className="review">
                  <legend>
                    <b>{r.name}</b>
                    <span className="small muted">
                      {r.degree ? ` · ${r.degree}` : ""}
                      {r.headline ? ` · "${r.headline}"` : ""}
                    </span>
                  </legend>
                  {r.candidates.map((c) => (
                    <label key={c.id} className="small row" style={{ gap: 8 }}>
                      <input type="radio" name={r.name} checked={picks[r.name] === c.id} onChange={() => setPicks({ ...picks, [r.name]: c.id })} />
                      <span>
                        {c.name} · {c.title || "No title"}
                        {c.company ? ` · ${c.company}` : ""} <span className="muted">· known by {c.knownBy.join(" and ")}</span>
                      </span>
                    </label>
                  ))}
                  <label className="small row" style={{ gap: 8 }}>
                    <input type="radio" name={r.name} checked={!picks[r.name] || picks[r.name] === "none"} onChange={() => setPicks({ ...picks, [r.name]: "none" })} />
                    <span>None of these</span>
                  </label>
                </fieldset>
              ))}
            </div>
          ) : null}
          {result.unmatched.length ? (
            <div>
              <h3>Not in your networks ({result.unmatched.length})</h3>
              <p className="small muted">
                Shown this once and not stored: {result.unmatched.map((u) => u.name).join(", ")}.
              </p>
            </div>
          ) : null}
          <div className="row">
            <button type="button" className="btn primary" disabled={busy || !toSave} onClick={() => send(true)}>
              {busy ? "Saving…" : `Save ${toSave} reaction${toSave === 1 ? "" : "s"}`}
            </button>
            <button type="button" className="link" onClick={() => setResult(null)}>
              Back
            </button>
          </div>
        </div>
      )}
      {msg ? (
        <p className="small" role="status">
          {msg}
        </p>
      ) : null}
      <div>
        <h3>Posts ({posts.length})</h3>
        {posts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Posted</th>
                  <th>By</th>
                  <th className="num">People</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={`${p.post}|${p.postDate}`}>
                    <td>{p.post}</td>
                    <td className="small">{day(p.postDate)}</td>
                    <td className="small">{owners.find((o) => o.id === p.author)?.name ?? ""}</td>
                    <td className="num">{p.people}</td>
                    <td>
                      <button type="button" className="link small" onClick={() => remove(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">No reactions yet.</p>
        )}
      </div>
    </div>
  );
}
