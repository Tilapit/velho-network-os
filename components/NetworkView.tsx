"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { NetworkDrawing, type DGroup, type DNode, type DOwner } from "./NetworkDrawing";
import { PersonAnalysis, type PersonPayload } from "./PersonAnalysis";
import { FitTag } from "./ui";

export type ViewNode = DNode & { co: string; via: string[]; st: string };

const fmt = (n: number) => n.toLocaleString("en-US");

export function NetworkView(props: { nodes: ViewNode[]; groups: DGroup[]; owners: DOwner[]; chips: string[]; matched: number; noCompany: number; initial?: string }) {
  const { nodes, groups, owners, chips } = props;
  const [owner, setOwner] = useState(-1);
  const [selected, setSelected] = useState<string | null>(props.initial ?? null);
  const [person, setPerson] = useState<PersonPayload | null>(null);
  const [hoverGroup, setHoverGroup] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const side = useRef<HTMLElement>(null);

  const bit = owner >= 0 ? 1 << owner : 0;
  const vis = useMemo(() => nodes.filter((n) => !bit || n.k & bit), [nodes, bit]);
  const fits = useMemo(() => vis.filter((n) => n.f), [vis]);
  // Server order: strong, possible, "not a fit" last, then score.
  const ranked = useMemo(() => fits.filter((n) => !n.nf), [fits]);
  const top = useMemo(() => ranked.slice(0, 8), [ranked]);
  const topIds = useMemo(() => top.map((n) => n.id), [top]);
  const listed = hoverGroup !== null ? ranked.filter((n) => n.g === hoverGroup) : top;
  const main = chips.filter((c) => !c.endsWith("(lower)"));
  const lower = chips.filter((c) => c.endsWith("(lower)"));

  function choose(id: string) {
    setSelected(id);
    // When the panel sits below the drawing, bring it into view.
    if (side.current && window.matchMedia("(max-width: 1023px)").matches) side.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!selected) {
      setPerson(null);
      return;
    }
    let live = true;
    fetch(`/api/people/${selected}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => live && setPerson(p))
      .catch(() => {});
    const url = new URL(window.location.href);
    url.searchParams.set("p", selected);
    window.history.replaceState(null, "", url);
    return () => {
      live = false;
    };
  }, [selected]);

  function back() {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    window.history.replaceState(null, "", url);
  }

  const counts = useMemo(() => {
    const present = new Set(vis.map((n) => n.g));
    return { contacts: vis.length, groups: present.size, fits: fits.length };
  }, [vis, fits]);

  const industries = useMemo(() => {
    const rows = groups
      .map((g, i) => {
        const cs = vis.filter((n) => n.g === i);
        const f = cs.filter((n) => n.f && !n.nf);
        const strong = f.filter((n) => n.f === 2).length;
        const two = f.filter((n) => n.k & (n.k - 1)).length;
        const sig = new Set(cs.filter((n) => n.sig && n.ip).map((n) => n.co)).size;
        return { i, label: g.label, grey: g.grey, people: cs.length, dms: cs.filter((n) => n.dm).length, strong, possible: f.length - strong, two, sig, score: strong * 3 + (f.length - strong) + two * 2 + sig * 2 };
      })
      .filter((r) => r.people);
    const k = sort.key as keyof (typeof rows)[number];
    return rows.sort((a, b) => (a.grey !== b.grey ? (a.grey ? 1 : -1) : ((a[k] as number) - (b[k] as number)) * sort.dir || b.people - a.people));
  }, [groups, vis, sort]);
  const maxScore = Math.max(1, ...industries.map((r) => r.score));
  const th = (key: string, label: string, num = true) => (
    <th className={num ? "num" : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => setSort({ key, dir: sort.key === key ? ((-sort.dir) as 1 | -1) : -1 })}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="netpage">
      <header className="net-head">
        <h1>Who in your team&apos;s network could need Velho</h1>
        <p className="lede">
          {owners.map((o) => o.name).join(", ")}: LinkedIn connections matched to Finnish companies in the trade register (PRH) and filtered by your profile. Every line is a real link.
        </p>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="seg" role="group" aria-label="Whose network">
            <button type="button" aria-pressed={owner < 0} onClick={() => setOwner(-1)}>
              Whole team
            </button>
            {owners.map((o, i) => (
              <button key={o.id} type="button" aria-pressed={owner === i} onClick={() => setOwner(i)}>
                {o.name}
              </button>
            ))}
          </div>
          <div className="row small" style={{ gap: 6 }}>
            <span className="muted">Profile:</span>
            {main.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
            {lower.length ? (
              <span className="chip" title={lower.join(", ")}>
                +{lower.length} lower priority
              </span>
            ) : null}
            <Link href="/settings#profile" className="link small">
              Edit
            </Link>
          </div>
        </div>
      </header>

      <section className="net-draw" aria-label="Your team's network">
        <NetworkDrawing nodes={nodes} groups={groups} owners={owners} owner={owner} topIds={topIds} selected={selected} onSelect={choose} hoverGroup={hoverGroup} onHoverGroup={setHoverGroup} counts={counts} />
        <div className="legend">
          <span><i className="lg-strong" />Strong fit</span>
          <span><i className="lg-possible" />Possible fit</span>
          <span><i className="lg-other" />Others in your industries</span>
          <span><i className="lg-grey" />Outside your industries, not matched or abroad</span>
          <span><i className="lg-ring" />Known by two or more of you</span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          <span className="hover-only">Hover a dot for who it is. Hover or click an industry to light its people. Click anyone for the analysis. </span>
          <span className="touch-only">Tap a dot for who it is, tap again to open. Tap an industry to light its people. </span>
          {fmt(props.matched)} of {fmt(nodes.length)} people matched to a Finnish company by name in PRH. {props.noCompany ? `${props.noCompany} have no company in LinkedIn. ` : ""}Nothing is guessed: names with no single match stay unmatched until you pick one in <Link href="/settings#matches">Settings</Link>.
        </p>
      </section>

      <aside className="side net-side" aria-label="Analysis" ref={side}>
        {person && selected ? (
          <PersonAnalysis data={person} onBack={back} />
        ) : (
          <>
            <h2>{hoverGroup !== null ? `${groups[hoverGroup].label}: ${listed.length} who fit` : `Strongest ${top.length} of ${fits.length}`}</h2>
            <p className="small muted" style={{ marginBottom: 14 }}>
              Strong fit: decides on operations, production or the whole company, at a company in your industries. Ordered by code, not by AI.
            </p>
            {listed.slice(0, 12).map((n) => (
              <button key={n.id} type="button" className={`prow${n.nf ? " dim" : ""}`} onClick={() => choose(n.id)}>
                <span className="top-line">
                  <span className="name">{n.n}</span>
                  <FitTag fit={n.f === 2 ? "strong" : n.f === 1 ? "possible" : null} status={n.st} />
                </span>
                <span className="small muted">
                  {n.t || "No title"} · {n.c}
                </span>
                <span className="small" style={{ color: "var(--text-2)" }}>
                  Known by {n.via.join(" and ")}
                  {n.sig ? " · registered change" : ""}
                </span>
              </button>
            ))}
            {selected && !person ? <p className="muted small">Loading…</p> : null}
            <p className="small" style={{ marginTop: 8 }}>
              <Link href="/people" className="link">
                Show all {fits.length} →
              </Link>
            </p>
          </>
        )}
      </aside>

      <section className="net-table section" aria-label="By industry">
        <h2>By industry</h2>
        <p className="small muted" style={{ marginBottom: 10 }}>
          Score is code: 3 per strong fit, 1 per possible fit, 2 per fit known by two or more of you, 2 per company in your industries with a registered change in the last 90 days.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th("label", "Industry", false)}
                {th("people", "People")}
                {th("dms", "Decision-makers")}
                {th("strong", "Strong")}
                {th("two", "Known by 2+")}
                {th("sig", "Signals")}
                {th("score", "Score")}
              </tr>
            </thead>
            <tbody>
              {industries.map((r) => (
                <tr key={r.i} onMouseEnter={() => !r.grey && setHoverGroup(r.i)} onMouseLeave={() => setHoverGroup(null)} style={{ cursor: "default", opacity: r.grey ? 0.6 : 1 }}>
                  <td>{r.label}</td>
                  <td className="num">{fmt(r.people)}</td>
                  <td className="num">{r.dms}</td>
                  <td className="num">{r.strong}</td>
                  <td className="num">{r.two}</td>
                  <td className="num">{r.sig}</td>
                  <td style={{ minWidth: 120 }}>
                    {r.grey ? (
                      <span className="faint xs">not scored</span>
                    ) : (
                      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <div className="bar" style={{ flex: 1 }}>
                          <div style={{ width: `${(100 * r.score) / maxScore}%` }} />
                        </div>
                        <span className="num xs muted">{r.score}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
