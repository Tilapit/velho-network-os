"use client";
// The team's network on a canvas, every contact a node, laid out left to right:
// owners -> contacts (bands per industry group) -> industry groups -> the
// decision-makers who fit. Deterministic layout, no physics. A static layer is
// drawn once per filter and size; hover and selection draw on top of it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DNode = {
  id: string;
  n: string; // name
  t: string; // title
  c: string; // company
  g: number; // group index
  f: 0 | 1 | 2; // 0 not on the list, 1 possible, 2 strong
  dm: boolean;
  k: number; // owner bitmask
  s: number; // score
  sig: boolean;
  nf: boolean; // marked not a fit
};
export type DGroup = { id: string; label: string; grey: boolean };
export type DOwner = { id: string; name: string };

type P = { x: number; y: number; r: number };
type Hit = { kind: "contact" | "fit" | "group" | "owner" | "label"; i: number };

const C = {
  bg: "#0e1115",
  dim: "#2a3039",
  grey: "#1f242b",
  faint: "rgba(150,160,180,0.035)",
  faintGroup: "rgba(150,160,180,0.045)",
  accent: "#3d7bff",
  accentDim: "#24406f",
  sel: "#8db4ff",
  text: "#e8eaed",
  text2: "#c3c8cf",
  muted: "#8b929c",
  faintText: "#6f7782",
  white: "#e8eaed",
};

const TOP = 70;
// Canvas fonts cannot read CSS variables; resolved from the page once mounted.
let FF = "system-ui, sans-serif";
const BOTTOM = 18;

function layout(nodes: DNode[], groups: DGroup[], owners: DOwner[], W: number, H: number, visible: (n: DNode) => boolean, topIds: string[]) {
  const xs = { owner: W * 0.06, c0: W * 0.14, c1: W * 0.41, group: W * 0.5, fit: W * 0.76, label: W * 0.795 };
  const avail = H - TOP - BOTTOM;
  // Owners: evenly spaced in the middle third.
  const ownerPos: P[] = owners.map((_, i) => ({ x: xs.owner, y: TOP + avail * ((i + 1) / (owners.length + 1)), r: 11 }));
  // Contacts: one band per group, packed in rows.
  const byGroup = groups.map(() => [] as number[]);
  nodes.forEach((n, i) => byGroup[n.g].push(i));
  const present = groups.map((_, g) => byGroup[g].length > 0);
  const nPresent = present.filter(Boolean).length;
  const gap = 10;
  const bandW = xs.c1 - xs.c0;
  let s = 9;
  for (; s > 2.4; s -= 0.1) {
    const cols = Math.max(1, Math.floor(bandW / s));
    const h = byGroup.reduce((a, l) => a + (l.length ? Math.ceil(l.length / cols) * s : 0), 0) + gap * (nPresent - 1);
    if (h <= avail) break;
  }
  const cols = Math.max(1, Math.floor(bandW / s));
  const contactPos: P[] = new Array(nodes.length);
  const band: { y0: number; y1: number }[] = groups.map(() => ({ y0: 0, y1: 0 }));
  let y = TOP;
  const used = byGroup.reduce((a, l) => a + (l.length ? Math.ceil(l.length / cols) * s : 0), 0) + gap * (nPresent - 1);
  y += Math.max(0, (avail - used) / 2);
  groups.forEach((_, g) => {
    const list = byGroup[g];
    if (!list.length) return;
    band[g].y0 = y;
    list.forEach((ni, j) => {
      const n = nodes[ni];
      contactPos[ni] = { x: xs.c0 + (j % cols) * s + s / 2, y: y + Math.floor(j / cols) * s + s / 2, r: n.f ? Math.min(3, s * 0.42) : n.dm ? Math.min(2.6, s * 0.36) : Math.min(2.2, s * 0.3) };
    });
    y += Math.ceil(list.length / cols) * s;
    band[g].y1 = y;
    y += gap;
  });
  // Industry nodes at their band centre, pushed apart so labels never overlap.
  const gIdx = groups.map((_, g) => g).filter((g) => present[g]);
  const gy = gIdx.map((g) => (band[g].y0 + band[g].y1) / 2);
  const minGap = 34;
  const bottom = TOP + avail - 10;
  for (let i = 1; i < gy.length; i++) gy[i] = Math.max(gy[i], gy[i - 1] + minGap);
  for (let i = gy.length - 1; i >= 0; i--) gy[i] = Math.min(gy[i], i === gy.length - 1 ? bottom : gy[i + 1] - minGap);
  for (let i = 0; i < gy.length; i++) gy[i] = Math.max(gy[i], i ? gy[i - 1] + minGap : TOP + 10);
  const groupPos: P[] = groups.map(() => ({ x: xs.group, y: 0, r: 0 }));
  const dmsPerGroup = groups.map((_, g) => byGroup[g].filter((i) => nodes[i].f && visible(nodes[i])).length);
  gIdx.forEach((g, i) => (groupPos[g] = { x: xs.group, y: gy[i], r: 4 + Math.sqrt(dmsPerGroup[g]) * 1.6 }));
  // Decision-makers who fit: one column, in group order then score.
  const fits = nodes.map((n, i) => i).filter((i) => nodes[i].f && visible(nodes[i]));
  fits.sort((a, b) => nodes[a].g - nodes[b].g || nodes[b].s - nodes[a].s);
  const twoCols = fits.length * 4 > avail;
  const perCol = twoCols ? Math.ceil(fits.length / 2) : fits.length;
  const step = Math.min(14, avail / Math.max(1, perCol));
  const y0 = TOP + Math.max(0, (avail - perCol * step) / 2);
  const fitPos = new Map<number, P>();
  fits.forEach((ni, j) => {
    const col = twoCols ? j % 2 : 0;
    const row = twoCols ? Math.floor(j / 2) : j;
    fitPos.set(ni, { x: xs.fit + (col ? 9 : 0), y: y0 + row * step + step / 2, r: 3 });
  });
  // Top 8: labels in their own lane, in the order of their dots.
  const tops = topIds.map((id) => nodes.findIndex((n) => n.id === id)).filter((i) => i >= 0 && fitPos.has(i));
  tops.sort((a, b) => fitPos.get(a)!.y - fitPos.get(b)!.y);
  const lane = Math.min(64, avail / Math.max(1, tops.length));
  const ly0 = TOP + Math.max(0, (avail - lane * tops.length) / 2);
  const labels = tops.map((ni, j) => ({ ni, x: xs.label + 18, y: ly0 + j * lane + lane / 2, w: W - xs.label - 24 }));
  return { xs, ownerPos, contactPos, groupPos, present, fitPos, labels, s, band, dmsPerGroup };
}

type L = ReturnType<typeof layout>;

function line(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
  ctx.moveTo(a.x, a.y);
  // A gentle curve keeps crossing bundles readable.
  const mx = (a.x + b.x) / 2;
  ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
}

function dot(ctx: CanvasRenderingContext2D, p: P, r = p.r) {
  ctx.moveTo(p.x + r, p.y);
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
}

function ellipsis(ctx: CanvasRenderingContext2D, s: string, w: number) {
  if (ctx.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t + "…";
}

export function NetworkDrawing(props: {
  nodes: DNode[];
  groups: DGroup[];
  owners: DOwner[];
  owner: number; // -1 whole team, else owner index
  topIds: string[];
  selected: string | null;
  onSelect: (id: string) => void;
  hoverGroup: number | null;
  onHoverGroup: (g: number | null) => void;
  counts: { contacts: number; groups: number; fits: number; owners: string };
}) {
  const { nodes, groups, owners, owner, topIds, selected, onSelect, hoverGroup, onHoverGroup, counts } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const staticLayer = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ W: 1000, H: 700 });
  const [hover, setHover] = useState<Hit | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; html: React.ReactNode } | null>(null);
  const bit = owner >= 0 ? 1 << owner : 0;
  const visible = useCallback((n: DNode) => !bit || (n.k & bit) !== 0, [bit]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const W = Math.max(920, el.clientWidth);
      setSize({ W, H: Math.round(Math.max(620, Math.min(820, W * 0.62))) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L: L = useMemo(() => layout(nodes, groups, owners, size.W, size.H, visible, topIds), [nodes, groups, owners, size, visible, topIds]);

  // Grid hash for hit testing (a quadtree would do the same; this is simpler).
  const grid = useMemo(() => {
    const cell = 14;
    const m = new Map<string, Hit[]>();
    const add = (p: P, h: Hit, r = 6) => {
      for (let gx = Math.floor((p.x - r) / cell); gx <= Math.floor((p.x + r) / cell); gx++)
        for (let gy = Math.floor((p.y - r) / cell); gy <= Math.floor((p.y + r) / cell); gy++) {
          const k = `${gx},${gy}`;
          (m.get(k) ?? m.set(k, []).get(k)!).push(h);
        }
    };
    L.contactPos.forEach((p, i) => p && add(p, { kind: "contact", i }, Math.max(3, L.s / 2)));
    L.fitPos.forEach((p, i) => add(p, { kind: "fit", i }, 6));
    L.groupPos.forEach((p, i) => L.present[i] && add(p, { kind: "group", i }, Math.max(10, p.r + 4)));
    L.ownerPos.forEach((p, i) => add(p, { kind: "owner", i }, 16));
    return { cell, m };
  }, [L]);

  const posOf = (h: Hit): P | null => (h.kind === "contact" ? L.contactPos[h.i] : h.kind === "fit" ? L.fitPos.get(h.i) ?? null : h.kind === "group" ? L.groupPos[h.i] : h.kind === "owner" ? L.ownerPos[h.i] : null);

  function find(x: number, y: number): Hit | null {
    for (const lb of L.labels) if (x >= lb.x - 22 && x <= lb.x + lb.w && Math.abs(y - lb.y) <= 16) return { kind: "label", i: lb.ni };
    const list = grid.m.get(`${Math.floor(x / grid.cell)},${Math.floor(y / grid.cell)}`) ?? [];
    let best: Hit | null = null;
    let bd = Infinity;
    for (const h of list) {
      const p = posOf(h);
      if (!p) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2 - (h.kind === "group" ? 60 : h.kind === "owner" ? 120 : h.kind === "fit" ? 10 : 0);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  // Static layer: all edges and dots for this filter and size.
  useEffect(() => {
    const { W, H } = size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const off = staticLayer.current ?? document.createElement("canvas");
    staticLayer.current = off;
    off.width = W * dpr;
    off.height = H * dpr;
    const ctx = off.getContext("2d")!;
    FF = getComputedStyle(document.body).fontFamily || FF;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // Column headers. Contacts add up to the total: every contact is in one band.
    ctx.textBaseline = "alphabetic";
    const head = (x: number, a: string, b: string, c: string) => {
      ctx.fillStyle = C.text;
      ctx.font = `600 19px ${FF}`;
      ctx.fillText(a, x, 30);
      ctx.fillStyle = C.text2;
      ctx.font = `13px ${FF}`;
      ctx.fillText(b, x, 47);
      ctx.fillStyle = C.faintText;
      ctx.font = `12px ${FF}`;
      ctx.fillText(c, x, 62);
    };
    head(14, String(owners.length), owners.length === 1 ? "network" : "networks", "LinkedIn exports");
    head(L.xs.c0, counts.contacts.toLocaleString("en-US"), "people", "merged by profile URL");
    head(L.xs.group - 8, String(counts.groups), "industry groups", "PRH line of business");
    head(L.xs.fit - 4, String(counts.fits), "decision-makers who fit", "title matches your roles");
    // Edges: owner -> contact, contact -> industry, industry -> fit.
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    nodes.forEach((n, i) => {
      if (!visible(n)) return;
      owners.forEach((_, o) => {
        if (n.k & (1 << o) && (!bit || bit === 1 << o)) line(ctx, L.ownerPos[o], L.contactPos[i]);
      });
    });
    ctx.stroke();
    ctx.strokeStyle = C.faintGroup;
    ctx.beginPath();
    nodes.forEach((n, i) => visible(n) && line(ctx, L.contactPos[i], L.groupPos[n.g]));
    ctx.stroke();
    ctx.strokeStyle = "rgba(61,123,255,0.16)";
    ctx.beginPath();
    L.fitPos.forEach((p, i) => line(ctx, L.groupPos[nodes[i].g], p));
    ctx.stroke();
    // Contacts.
    const paint = (color: string, pick: (n: DNode) => boolean) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      nodes.forEach((n, i) => pick(n) && dot(ctx, L.contactPos[i]));
      ctx.fill();
    };
    paint("#171b21", (n) => !visible(n));
    paint(C.grey, (n) => visible(n) && groups[n.g].grey);
    paint(C.dim, (n) => visible(n) && !groups[n.g].grey && !n.f);
    paint(C.accentDim, (n) => visible(n) && n.f === 1);
    paint(C.accent, (n) => visible(n) && n.f === 2);
    // Known by two or more teammates: a white ring.
    ctx.strokeStyle = "rgba(232,234,237,0.6)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    nodes.forEach((n, i) => visible(n) && n.k & (n.k - 1) && dot(ctx, L.contactPos[i], L.contactPos[i].r + 0.9));
    ctx.stroke();
    // Owners.
    owners.forEach((o, i) => {
      const p = L.ownerPos[i];
      ctx.globalAlpha = bit && bit !== 1 << i ? 0.3 : 1;
      ctx.fillStyle = C.white;
      ctx.beginPath();
      dot(ctx, p);
      ctx.fill();
      ctx.fillStyle = C.text2;
      ctx.font = `13px ${FF}`;
      ctx.fillText(o.name, p.x - 30 < 0 ? 4 : p.x - 30, p.y + 28);
      ctx.fillStyle = C.faintText;
      ctx.font = `12px ${FF}`;
      ctx.fillText(`${nodes.filter((n) => n.k & (1 << i)).length.toLocaleString("en-US")}`, p.x - 30 < 0 ? 4 : p.x - 30, p.y + 43);
      ctx.globalAlpha = 1;
    });
    // Industry groups.
    groups.forEach((g, i) => {
      if (!L.present[i]) return;
      const p = L.groupPos[i];
      const total = nodes.filter((n) => n.g === i && visible(n)).length;
      ctx.fillStyle = g.grey ? "#3a414b" : L.dmsPerGroup[i] ? C.text2 : C.dim;
      ctx.beginPath();
      dot(ctx, p);
      ctx.fill();
      ctx.font = `13px ${FF}`;
      ctx.fillStyle = "rgba(14,17,21,0.82)";
      ctx.fillRect(p.x + p.r + 5, p.y - 14, ctx.measureText(g.label).width + 6, 31);
      ctx.fillStyle = g.grey ? C.muted : C.text2;
      ctx.fillText(g.label, p.x + p.r + 8, p.y - 1);
      ctx.fillStyle = C.faintText;
      ctx.font = `12px ${FF}`;
      ctx.fillText(`${total.toLocaleString("en-US")} people${L.dmsPerGroup[i] ? ` · ${L.dmsPerGroup[i]} fit` : ""}`, p.x + p.r + 8, p.y + 13);
    });
    // Decision-makers who fit.
    L.fitPos.forEach((p, i) => {
      ctx.fillStyle = nodes[i].nf ? "#5a3a3a" : nodes[i].f === 2 ? C.accent : C.accentDim;
      ctx.beginPath();
      dot(ctx, p);
      ctx.fill();
    });
  }, [L, size, nodes, groups, owners, bit, visible, counts]);

  // Overlay: lit paths, hover, selection, labels.
  useEffect(() => {
    const cv = canvas.current;
    const off = staticLayer.current;
    if (!cv || !off) return;
    const { W, H } = size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const path = (i: number, color: string, width: number) => {
      const n = nodes[i];
      const cp = L.contactPos[i];
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      owners.forEach((_, o) => n.k & (1 << o) && (!bit || bit === 1 << o) && line(ctx, L.ownerPos[o], cp));
      line(ctx, cp, L.groupPos[n.g]);
      const fp = L.fitPos.get(i);
      if (fp) line(ctx, L.groupPos[n.g], fp);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      dot(ctx, cp, cp.r + 1.2);
      if (fp) dot(ctx, fp, 4.5);
      ctx.fill();
    };
    const hg = hoverGroup ?? (hover?.kind === "group" ? hover.i : null);
    if (hg !== null) {
      ctx.strokeStyle = "rgba(141,180,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      nodes.forEach((n, i) => n.g === hg && visible(n) && line(ctx, L.contactPos[i], L.groupPos[hg]));
      ctx.stroke();
      ctx.fillStyle = C.sel;
      ctx.beginPath();
      nodes.forEach((n, i) => n.g === hg && visible(n) && dot(ctx, L.contactPos[i]));
      ctx.fill();
    }
    const selIdx = selected ? nodes.findIndex((n) => n.id === selected) : -1;
    // The strongest eight are lit; when someone is selected, only their path.
    if (selIdx < 0 && hg === null) for (const lb of L.labels) path(lb.ni, "rgba(61,123,255,0.55)", 1.2);
    const hovIdx = hover && (hover.kind === "contact" || hover.kind === "fit" || hover.kind === "label") ? hover.i : -1;
    if (hovIdx >= 0 && hovIdx !== selIdx) path(hovIdx, "rgba(141,180,255,0.7)", 1.2);
    if (selIdx >= 0) path(selIdx, C.sel, 2);
    // Labels for the strongest eight.
    for (const lb of L.labels) {
      const n = nodes[lb.ni];
      const fp = L.fitPos.get(lb.ni)!;
      const on = selIdx < 0 || selIdx === lb.ni;
      ctx.globalAlpha = on ? 1 : 0.45;
      ctx.strokeStyle = C.accentDim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fp.x + 5, fp.y);
      ctx.lineTo(lb.x - 12, lb.y);
      ctx.stroke();
      ctx.fillStyle = n.nf ? "#5a3a3a" : C.accent;
      ctx.beginPath();
      dot(ctx, { x: lb.x - 6, y: lb.y, r: 7 });
      ctx.fill();
      ctx.strokeStyle = n.k & (n.k - 1) ? C.white : selIdx === lb.ni ? C.sel : C.accentDim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      dot(ctx, { x: lb.x - 6, y: lb.y, r: 9.5 });
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.font = `600 13px ${FF}`;
      ctx.fillText(ellipsis(ctx, n.n, lb.w - 14), lb.x + 10, lb.y - 2);
      ctx.fillStyle = C.muted;
      ctx.font = `12px ${FF}`;
      ctx.fillText(ellipsis(ctx, n.c, lb.w - 14), lb.x + 10, lb.y + 13);
      ctx.globalAlpha = 1;
    }
    // A hovered fit outside the eight gets a label too.
    if (hovIdx >= 0 && L.fitPos.has(hovIdx) && !L.labels.some((l) => l.ni === hovIdx)) {
      const fp = L.fitPos.get(hovIdx)!;
      ctx.fillStyle = C.sel;
      ctx.beginPath();
      dot(ctx, fp, 5);
      ctx.fill();
    }
  }, [L, size, nodes, owners, bit, visible, hover, hoverGroup, selected]);

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size.W;
    const y = ((e.clientY - rect.top) / rect.height) * size.H;
    const h = find(x, y);
    setHover(h);
    if (!h) {
      setTip(null);
      return;
    }
    const tx = e.clientX - rect.left + 14;
    const ty = e.clientY - rect.top + 14;
    if (h.kind === "group") {
      const g = groups[h.i];
      const total = nodes.filter((n) => n.g === h.i && visible(n)).length;
      setTip({ x: tx, y: ty, html: <><b>{g.label}</b><br /><span className="muted">{total} people · {L.dmsPerGroup[h.i]} decision-makers who fit</span></> });
    } else if (h.kind === "owner") {
      setTip({ x: tx, y: ty, html: <><b>{owners[h.i].name}</b><br /><span className="muted">{nodes.filter((n) => n.k & (1 << h.i)).length} connections</span></> });
    } else {
      const n = nodes[h.i];
      setTip({
        x: tx,
        y: ty,
        html: (
          <>
            <b>{n.n}</b>
            <br />
            <span className="muted">{n.t || "No title"}{n.c ? ` · ${n.c}` : ""}</span>
            <br />
            <span className="xs faint">{groups[n.g].label}{n.f === 2 ? " · Strong fit" : n.f === 1 ? " · Possible fit" : ""}{n.k & (n.k - 1) ? " · known by two or more of you" : ""}</span>
          </>
        ),
      });
    }
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const h = find(((e.clientX - rect.left) / rect.width) * size.W, ((e.clientY - rect.top) / rect.height) * size.H);
    if (!h) return onHoverGroup(null);
    if (h.kind === "group") return onHoverGroup(hoverGroup === h.i ? null : h.i);
    if (h.kind === "contact" || h.kind === "fit" || h.kind === "label") onSelect(nodes[h.i].id);
  }

  return (
    <div ref={wrap} style={{ overflowX: "auto" }}>
      <div className="drawing" style={{ width: size.W, height: size.H }}>
        <canvas
          ref={canvas}
          style={{ width: size.W, height: size.H, cursor: hover && hover.kind !== "owner" ? "pointer" : "default" }}
          onMouseMove={onMove}
          onMouseLeave={() => {
            setHover(null);
            setTip(null);
          }}
          onClick={onClick}
          role="img"
          aria-label={`Network drawing: ${counts.contacts} people in ${counts.groups} industry groups, ${counts.fits} decision-makers who fit. The list next to it has the same people.`}
        />
        {tip ? (
          <div className="tip" style={{ left: Math.min(tip.x, size.W - 290), top: Math.min(tip.y, size.H - 80) }}>
            {tip.html}
          </div>
        ) : null}
      </div>
    </div>
  );
}
