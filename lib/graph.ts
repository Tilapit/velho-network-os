// Graph for the Network page. Every edge corresponds to a record we have:
// a connection in the export, an engagement row, a customer record, an
// introduction path from the founder's notes. Shared employers are not edges.
import { loadModel } from "./engine.ts";
import { RELEVANT_TOPICS } from "./score.ts";

export type GNode = { id: string; label: string; kind: "founder" | "person" | "company" | "post"; status?: string; score?: number; href?: string; sub?: string; x?: number; y?: number };
export type GEdge = { id: string; source: string; target: string; kind: "connected" | "works_at" | "engaged" | "commented" | "intro" | "authored"; provenance: string };

export function graphData() {
  const { model, ranked } = loadModel();
  const scoreOf = new Map(ranked.map((o) => [o.person.id, o]));
  const relevantPosts = model.posts.filter((p) => RELEVANT_TOPICS.includes(p.topic));
  const relevantIds = new Set(relevantPosts.map((p) => p.id));

  // Keep the graph readable: people with something worth seeing.
  const people = model.people.filter((p) => {
    const o = scoreOf.get(p.id)!;
    return o.total >= 25 || p.isCustomerContact || p.introPaths.length > 0 || model.people.some((q) => q.introPaths.some((x) => x.viaPersonId === p.id));
  });
  const keep = new Set(people.map((p) => p.id));

  const nodes: GNode[] = [{ id: "founder", label: "You", kind: "founder" }];
  const edges: GEdge[] = [];
  const companyIds = new Set<string>();

  for (const p of people) {
    const o = scoreOf.get(p.id)!;
    nodes.push({ id: `p:${p.id}`, label: p.name, kind: "person", status: o.status, score: o.total, href: `/people/${p.id}`, sub: p.role });
    if (p.connected) edges.push({ id: `c:${p.id}`, source: "founder", target: `p:${p.id}`, kind: "connected", provenance: "verified" });
    if (p.companyId) {
      companyIds.add(p.companyId);
      edges.push({ id: `w:${p.id}`, source: `p:${p.id}`, target: `co:${p.companyId}`, kind: "works_at", provenance: p.connected ? "verified" : "inferred" });
    }
    for (const e of p.engagements) {
      if (!relevantIds.has(e.postId)) continue;
      edges.push({ id: `e:${p.id}:${e.postId}:${e.kind}:${e.on}`, source: `post:${e.postId}`, target: `p:${p.id}`, kind: e.kind === "comment" ? "commented" : "engaged", provenance: e.matchBasis === "profile-url" ? "verified" : "imported" });
    }
    for (const path of p.introPaths) {
      if (keep.has(path.viaPersonId)) edges.push({ id: `i:${p.id}:${path.viaPersonId}`, source: `p:${path.viaPersonId}`, target: `p:${p.id}`, kind: "intro", provenance: path.provenance });
    }
  }
  for (const id of companyIds) {
    const c = model.companies.get(id)!;
    const sig = model.signals.filter((s) => s.companyId === id).length;
    nodes.push({ id: `co:${id}`, label: c.name, kind: "company", status: c.customer?.status === "current" ? "customer" : sig ? "signal" : undefined, sub: [c.employees ? `${c.employees.value} people` : null, sig ? `${sig} signal${sig > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") });
  }
  for (const post of relevantPosts) {
    nodes.push({ id: `post:${post.id}`, label: post.title.length > 38 ? post.title.slice(0, 36) + "…" : post.title, kind: "post", sub: post.postedOn });
    edges.push({ id: `a:${post.id}`, source: "founder", target: `post:${post.id}`, kind: "authored", provenance: "imported" });
  }
  // Deterministic rings: you in the middle, posts close, people around, each
  // company just outside its people. Stable between reloads, no overlaps.
  const ring = (list: GNode[], r: number, offset = 0) =>
    list.forEach((n, i) => {
      const a = offset + (i / Math.max(1, list.length)) * Math.PI * 2;
      n.x = Math.cos(a) * r;
      n.y = Math.sin(a) * r;
    });
  const founder = nodes[0];
  founder.x = 0;
  founder.y = 0;
  const personNodes = nodes.filter((n) => n.kind === "person").sort((a, b) => (companyOf(a) || "").localeCompare(companyOf(b) || "") || (b.score ?? 0) - (a.score ?? 0));
  function companyOf(n: GNode) {
    return edges.find((e) => e.source === n.id && e.kind === "works_at")?.target;
  }
  ring(personNodes, 330, -Math.PI / 2);
  ring(nodes.filter((n) => n.kind === "post"), 140, -Math.PI / 2 + 0.3);
  for (const c of nodes.filter((n) => n.kind === "company")) {
    const ps = personNodes.filter((p) => companyOf(p) === c.id);
    const ax = ps.reduce((s, p) => s + (p.x ?? 0), 0) / Math.max(1, ps.length);
    const ay = ps.reduce((s, p) => s + (p.y ?? 0), 0) / Math.max(1, ps.length);
    const len = Math.hypot(ax, ay) || 1;
    c.x = (ax / len) * 470;
    c.y = (ay / len) * 470;
  }
  return { nodes, edges };
}
