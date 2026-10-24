"use client";
// The team's network on a canvas, drawn as a layered network flowing left to
// right: owners -> contacts (an organic cloud per industry group) ->
// industry groups -> the decision-makers who fit. Every contact is a node and
// every link is drawn, blended additively so dense flows glow and sparse ones
// fade. The layout is seeded, never physics: the same data always gives the
// same picture. A static layer renders once per filter and size to an
// offscreen canvas; a scene layer adds hover and selection; the first-load
// pulse and the particles are drawn per frame on top.
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
  ip: boolean; // at a company in the target profile
  rx: number; // reactions to the team's posts in the last 30 days
};
export type DGroup = { id: string; label: string; short: string; grey: boolean };
export type DOwner = { id: string; name: string };

type P = { x: number; y: number; r: number };
type Hit = { kind: "contact" | "fit" | "group" | "owner" | "label"; i: number };
type Counts = { contacts: number; groups: number; fits: number };

const C = {
  bg: "#0e1115",
  text: "#e8eaed",
  text2: "#c3c8cf",
  muted: "#8b929c",
  faintText: "#6f7782",
  accent: "#3d7bff",
  possible: "#2b59bd",
  sel: "#8db4ff",
  green: "#8fe0a6",
  notFit: "#7a4343",
};
const PULSE_MS = 1500;
// Canvas fonts cannot read CSS variables; resolved from the page once mounted.
let FF = "system-ui, sans-serif";

// ---------- layout ----------

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n points spread evenly but irregularly (best-candidate sampling) in a rounded blob w x h centred on 0,0. */
function scatter(n: number, w: number, h: number, rand: () => number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (!n) return out;
  const cell = Math.max(1.2, Math.sqrt((w * h * 0.8) / n));
  const cols = Math.ceil(w / cell) + 8;
  const grid = new Map<number, number[]>();
  const tries = n > 3000 ? 5 : 8;
  for (let i = 0; i < n; i++) {
    let bx = 0;
    let by = 0;
    let bd = -1;
    for (let k = 0; k < tries; k++) {
      let u = 0;
      let v = 0;
      do {
        u = rand() * 2 - 1;
        v = rand() * 2 - 1;
      } while (Math.abs(u) ** 2.4 + Math.abs(v) ** 2.4 > 1);
      const x = ((u + 1) * w) / 2;
      const y = ((v + 1) * h) / 2;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      let d = cell * 9;
      for (let gy = cy - 2; gy <= cy + 2; gy++)
        for (let gx = cx - 2; gx <= cx + 2; gx++) {
          const list = grid.get((gy + 4) * cols + gx + 4);
          if (list) for (const j of list) d = Math.min(d, (out[j].x - x) ** 2 + (out[j].y - y) ** 2);
        }
      if (d > bd) {
        bd = d;
        bx = x;
        by = y;
      }
    }
    const key = (Math.floor(by / cell) + 4) * cols + Math.floor(bx / cell) + 4;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(out.length);
    out.push({ x: bx, y: by });
  }
  return out.map((p) => ({ x: p.x - w / 2, y: p.y - h / 2 }));
}

const importance = (n: DNode) => (n.f === 2 ? 3 : n.f === 1 ? 2 : n.dm ? 1 : 0);

/** Below this width the drawing uses the phone layout. */
const COMPACT = 640;

export function heightFor(W: number) {
  return W < COMPACT ? Math.round(Math.max(470, Math.min(640, W * 1.45))) : Math.round(Math.max(600, Math.min(820, W * 0.68)));
}

export function layout(nodes: DNode[], groups: DGroup[], owners: DOwner[], W: number, H: number) {
  const compact = W < COMPACT;
  const top = compact ? 50 : 86;
  // Compact: a strip at the bottom keeps the zoom buttons off the decision-makers.
  const bottom = compact ? 46 : 18;
  const span = H - top - bottom;
  const owner = compact ? 13 : Math.max(40, W * 0.048);
  const c0 = compact ? 28 : Math.max(128, W * 0.135);
  const label = compact ? W : W - (W >= 960 ? 178 : 150);
  const fit = compact ? W - 36 : label - 46;
  const group = compact ? W * 0.56 : c0 + (fit - c0) * 0.6;
  const c1 = compact ? W * 0.475 : group - Math.max(64, W * 0.08);
  const xs = { owner, c0, c1, group, fit, label };

  // Bands: target industries get most of the height, the rest is compressed below.
  const byGroup = groups.map(() => [] as number[]);
  nodes.forEach((n, i) => byGroup[n.g]?.push(i));
  const present = byGroup.map((l) => l.length > 0);
  const target = groups.map((g, gi) => present[gi] && !g.grey && byGroup[gi].some((i) => nodes[i].ip));
  const tIdx = groups.map((_, g) => g).filter((g) => target[g]);
  const gIdx = groups.map((_, g) => g).filter((g) => present[g] && !target[g]);
  const order = [...tIdx, ...gIdx];
  const gap = compact ? 5 : 9;
  const split = tIdx.length && gIdx.length ? (compact ? 12 : 22) : 0;
  const bandsH = span - gap * Math.max(0, order.length - 1) - split;
  const tH = !gIdx.length ? bandsH : !tIdx.length ? 0 : bandsH * 0.74;
  const heights = groups.map(() => 0);
  const share = (idx: number[], total: number, min: number) => {
    const w = idx.map((g) => byGroup[g].length ** 0.8);
    const sw = w.reduce((a, b) => a + b, 0) || 1;
    const m = Math.min(min, total / Math.max(1, idx.length));
    idx.forEach((g, j) => (heights[g] = m + ((total - m * idx.length) * w[j]) / sw));
  };
  share(tIdx, tH, compact ? 16 : 24);
  share(gIdx, bandsH - tH, compact ? 10 : 14);

  const contact: P[] = new Array(nodes.length);
  const band = groups.map(() => ({ y0: 0, y1: 0, x0: 0, x1: 0 }));
  const maxT = Math.max(1, ...tIdx.map((g) => byGroup[g].length));
  const maxG = Math.max(1, ...gIdx.map((g) => byGroup[g].length));
  const full = c1 - c0;
  let y = top;
  let splitY = 0;
  order.forEach((g, j) => {
    if (j && j === tIdx.length) {
      splitY = y - gap / 2 + split / 2;
      y += split;
    }
    const list = byGroup[g];
    const h = heights[g];
    const rand = mulberry32(0x5eed ^ (g * 7919) ^ (list.length * 104729));
    const isT = target[g];
    const w = full * (0.52 + 0.48 * Math.sqrt(list.length / (isT ? maxT : maxG)));
    const cx = c0 + full / 2 + (rand() - 0.5) * (full - w) * 0.9;
    const cy = y + h / 2;
    band[g] = { y0: y, y1: y + h, x0: cx - w / 2, x1: cx + w / 2 };
    const spacing = Math.sqrt((w * h * 0.8) / Math.max(1, list.length));
    // Fits lean to the right of their cloud, nearest their industry, with
    // enough noise that it never reads as a sorted list.
    const pts = scatter(list.length, w, h, rand).map((p) => ({ ...p, k: p.x + (rand() - 0.5) * w * 0.5 }));
    pts.sort((a, b) => b.k - a.k);
    const sorted = [...list].sort((a, b) => importance(nodes[b]) - importance(nodes[a]) || nodes[b].s - nodes[a].s || a - b);
    const scale = Math.max(0.55, Math.min(1, spacing / (isT ? 7.5 : 4.4))) * (compact ? 0.85 : 1);
    sorted.forEach((ni, k) => {
      const n = nodes[ni];
      const base = isT ? (n.f === 2 ? 3.3 : n.f === 1 ? 2.8 : n.dm ? 2.3 : 1.9) : n.dm ? 1.6 : 1.15;
      contact[ni] = { x: cx + pts[k].x, y: cy + pts[k].y, r: Math.max(0.75, base * scale) };
    });
    y += h + gap;
  });

  // Industry nodes at their band's centre, pushed apart so labels never overlap.
  const fitsIn = groups.map((_, g) => byGroup[g].filter((i) => nodes[i].f).length);
  const maxFits = Math.max(1, ...fitsIn);
  const gy = order.map((g) => (band[g].y0 + band[g].y1) / 2);
  const minGap = compact ? 22 : 31;
  for (let i = 1; i < gy.length; i++) gy[i] = Math.max(gy[i], gy[i - 1] + minGap);
  for (let i = gy.length - 1; i >= 0; i--) gy[i] = Math.min(gy[i], i === gy.length - 1 ? H - bottom - 8 : gy[i + 1] - minGap);
  for (let i = 0; i < gy.length; i++) gy[i] = Math.max(gy[i], i ? gy[i - 1] + minGap : top + 6);
  const groupPos: P[] = groups.map(() => ({ x: group, y: 0, r: 0 }));
  order.forEach((g, i) => (groupPos[g] = { x: group, y: gy[i], r: target[g] ? (compact ? 3.5 : 5) + Math.sqrt(fitsIn[g] / maxFits) * (compact ? 6 : 10) : compact ? 2.2 : 3 }));

  // Decision-makers who fit: the full height, in staggered sub-columns,
  // in band order so their links from the industries barely cross.
  const rank = new Map(order.map((g, i) => [g, i]));
  const fitIdx = nodes.map((_, i) => i).filter((i) => nodes[i].f);
  fitIdx.sort((a, b) => (rank.get(nodes[a].g) ?? 0) - (rank.get(nodes[b].g) ?? 0) || nodes[b].s - nodes[a].s || a - b);
  const minStep = compact ? 6.5 : 8.5;
  let cols = 2;
  while (cols < 4 && Math.ceil(fitIdx.length / cols) * minStep > span) cols++;
  const each = Math.min(compact ? 9 : 12, span / Math.max(1, fitIdx.length));
  const y0 = top + (span - each * fitIdx.length) / 2;
  const colGap = compact ? 9 : 17;
  const fr = Math.max(1.2, Math.min(compact ? 2.5 : 3, each * cols * 0.3));
  const fitPos = new Map<number, P>();
  fitIdx.forEach((ni, j) => {
    const col = j % cols;
    fitPos.set(ni, { x: fit + (col - (cols - 1) / 2) * colGap, y: y0 + (j + 0.5) * each, r: fr });
  });

  // Owners: sized by their number of connections.
  const ownerCount = owners.map((_, o) => nodes.reduce((a, n) => a + (n.k & (1 << o) ? 1 : 0), 0));
  const maxO = Math.max(1, ...ownerCount);
  const ownerPos: P[] = owners.map((_, i) => ({
    x: owner,
    y: top + span * (0.2 + (0.6 * (i + 0.5)) / owners.length),
    r: (compact ? 4.5 : 7) + (compact ? 3 : 6) * Math.sqrt(ownerCount[i] / maxO),
  }));

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  // Mid widths keep the desktop layout but use short industry names when the
  // longest full name ("Wood and building products", about 170 px) would
  // reach the decision-makers' column.
  const short = compact || fit - group < 205;
  return { W, H, compact, short, top, xs, contact, band, target, present, order, splitY, groupPos, fitsIn, fitPos, ownerPos, ownerCount, index };
}

type Layout = ReturnType<typeof layout>;
type Label = { ni: number; x: number; y: number; w: number };

/** The top people get a label in the lane right of the column, near their dot. */
function placeLabels(L: Layout, topIds: string[]): Label[] {
  const idx = topIds.map((id) => L.index.get(id)).filter((i): i is number => i !== undefined && L.fitPos.has(i));
  idx.sort((a, b) => L.fitPos.get(a)!.y - L.fitPos.get(b)!.y);
  const minGap = 38;
  const ys = idx.map((i) => L.fitPos.get(i)!.y);
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + minGap);
  for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? L.H - 22 : ys[i + 1] - minGap);
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + minGap : L.top + 10);
  const x = L.xs.label + 18;
  return idx.map((ni, j) => ({ ni, x, y: ys[j], w: L.W - x - 6 }));
}

// ---------- drawing helpers ----------

function curve(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2;
  ctx.moveTo(ax, ay);
  ctx.bezierCurveTo(mx, ay, mx, by, bx, by);
}

function onCurve(ax: number, ay: number, bx: number, by: number, t: number) {
  const mx = (ax + bx) / 2;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * ax + (b + c) * mx + d * bx, y: (a + b) * ay + (c + d) * by };
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** One stroke per link, so overlapping links add up under "lighter". */
function strokeEach(ctx: CanvasRenderingContext2D, segs: number[], color: string, width: number) {
  if (!segs.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (let i = 0; i < segs.length; i += 4) {
    ctx.beginPath();
    curve(ctx, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]);
    ctx.stroke();
  }
}

/** Faint links in batches: cheap, and they hardly add up. */
function strokeBatched(ctx: CanvasRenderingContext2D, segs: number[], color: string, width: number, per = 40) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (let i = 0; i < segs.length; i += 4 * per) {
    ctx.beginPath();
    for (let j = i; j < Math.min(segs.length, i + 4 * per); j += 4) curve(ctx, segs[j], segs[j + 1], segs[j + 2], segs[j + 3]);
    ctx.stroke();
  }
}

const glows = new Map<string, HTMLCanvasElement>();
/** A soft round glow in one colour, drawn with "lighter". */
function glow(rgb: string): HTMLCanvasElement {
  let g = glows.get(rgb);
  if (g) return g;
  g = document.createElement("canvas");
  g.width = g.height = 64;
  const x = g.getContext("2d")!;
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.16)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  glows.set(rgb, g);
  return g;
}
const halo = (ctx: CanvasRenderingContext2D, rgb: string, x: number, y: number, R: number, a = 1) => {
  ctx.globalAlpha = a;
  ctx.drawImage(glow(rgb), x - R, y - R, 2 * R, 2 * R);
  ctx.globalAlpha = 1;
};

/** Text with a dark halo, so it reads on top of the links without a box. */
function haloText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string) {
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(14,17,21,0.9)";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

function ellipsis(ctx: CanvasRenderingContext2D, s: string, w: number) {
  if (ctx.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t + "…";
}

const fmt = (n: number) => n.toLocaleString("en-US");

// ---------- the static layer ----------

function drawStatic(ctx: CanvasRenderingContext2D, L: Layout, nodes: DNode[], groups: DGroup[], owners: DOwner[], bit: number, counts: Counts) {
  const { W, H, xs, compact } = L;
  const vis = (n: DNode) => !bit || (n.k & bit) !== 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const bgGlow = ctx.createRadialGradient(xs.group, H * 0.42, 0, xs.group, H * 0.42, W * 0.55);
  bgGlow.addColorStop(0, "rgba(61,123,255,0.07)");
  bgGlow.addColorStop(1, "rgba(61,123,255,0)");
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  // Links, added up: where many run together they glow. With many more
  // people each link is fainter, so big networks glow without burning out.
  const shown = bit ? nodes.reduce((a, n) => a + (vis(n) ? 1 : 0), 0) : nodes.length;
  const dens = Math.max(0.28, Math.min(1, Math.sqrt(2600 / Math.max(1, shown))));
  const a = (rgb: string, alpha: number) => `rgba(${rgb},${(alpha * dens).toFixed(4)})`;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const tIn: number[] = [];
  const tInFit: number[] = [];
  const tOwn: number[] = [];
  const tOwnFit: number[] = [];
  const gIn: number[] = [];
  const gOwn: number[] = [];
  nodes.forEach((n, i) => {
    if (!vis(n)) return;
    const p = L.contact[i];
    const gp = L.groupPos[n.g];
    const tg = L.target[n.g];
    for (let o = 0; o < owners.length; o++) {
      if (!(n.k & (1 << o)) || (bit && bit !== 1 << o)) continue;
      const op = L.ownerPos[o];
      (tg ? (n.f ? tOwnFit : tOwn) : gOwn).push(op.x, op.y, p.x, p.y);
    }
    (tg ? (n.f ? tInFit : tIn) : gIn).push(p.x, p.y, gp.x, gp.y);
  });
  strokeBatched(ctx, gOwn, a("150,160,180", 0.016), 0.6);
  strokeBatched(ctx, gIn, a("150,160,180", 0.02), 0.6);
  strokeEach(ctx, tOwn, a("80,125,255", 0.05), 0.7);
  strokeEach(ctx, tOwnFit, a("90,140,255", 0.11), 0.8);
  strokeEach(ctx, tIn, a("80,125,255", 0.075), 0.7);
  strokeEach(ctx, tInFit, a("100,150,255", 0.2), 0.8);
  const fOut: number[] = [];
  const fOutStrong: number[] = [];
  L.fitPos.forEach((p, i) => {
    const n = nodes[i];
    if (!vis(n) || n.nf) return;
    const gp = L.groupPos[n.g];
    (n.f === 2 ? fOutStrong : fOut).push(gp.x, gp.y, p.x, p.y);
  });
  strokeEach(ctx, fOut, a("61,123,255", 0.2), 0.8);
  strokeEach(ctx, fOutStrong, a("90,145,255", 0.34), 0.9);

  // Glow under the people who fit, the industries and the owners.
  nodes.forEach((n, i) => {
    if (!n.f || n.nf || !vis(n)) return;
    const p = L.contact[i];
    halo(ctx, "61,123,255", p.x, p.y, p.r * (n.f === 2 ? 4.2 : 3.2), (n.f === 2 ? 0.9 : 0.5) * dens);
  });
  L.fitPos.forEach((p, i) => vis(nodes[i]) && !nodes[i].nf && halo(ctx, "61,123,255", p.x, p.y, p.r * (nodes[i].f === 2 ? 4 : 3), (nodes[i].f === 2 ? 0.75 : 0.3) * dens));
  groups.forEach((_, g) => L.present[g] && L.target[g] && halo(ctx, "120,160,255", L.groupPos[g].x, L.groupPos[g].y, L.groupPos[g].r * 3.6, 0.7));
  L.ownerPos.forEach((p, o) => halo(ctx, "160,190,255", p.x, p.y, p.r * 4.5, bit && bit !== 1 << o ? 0.2 : 0.8));
  ctx.globalCompositeOperation = "source-over";

  // Contacts.
  const paint = (color: string, pick: (n: DNode, i: number) => boolean, scale = 1) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    nodes.forEach((n, i) => pick(n, i) && dot(ctx, L.contact[i].x, L.contact[i].y, L.contact[i].r * scale));
    ctx.fill();
  };
  const tg = (n: DNode) => L.target[n.g];
  paint("rgba(70,78,90,0.32)", (n) => !vis(n), 0.85);
  paint("rgba(115,125,142,0.42)", (n) => vis(n) && !tg(n) && !n.dm);
  paint("rgba(150,160,178,0.62)", (n) => vis(n) && !tg(n) && n.dm);
  paint("#394252", (n) => vis(n) && tg(n) && !n.f && !n.dm);
  paint("#576276", (n) => vis(n) && tg(n) && !n.f && n.dm);
  paint(C.notFit, (n) => vis(n) && !!n.f && n.nf);
  paint(C.possible, (n) => vis(n) && n.f === 1 && !n.nf);
  paint(C.accent, (n) => vis(n) && n.f === 2 && !n.nf);
  // Known by two or more of you: a white ring.
  for (const [color, pick] of [
    ["rgba(232,234,237,0.78)", (n: DNode) => tg(n)],
    ["rgba(232,234,237,0.3)", (n: DNode) => !tg(n)],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = compact ? 0.6 : 0.8;
    ctx.beginPath();
    nodes.forEach((n, i) => vis(n) && n.k & (n.k - 1) && pick(n) && dot(ctx, L.contact[i].x, L.contact[i].y, L.contact[i].r + (compact ? 0.8 : 1.1)));
    ctx.stroke();
  }

  // Decision-makers who fit.
  L.fitPos.forEach((p, i) => {
    const n = nodes[i];
    ctx.globalAlpha = vis(n) ? 1 : 0.25;
    ctx.fillStyle = n.nf ? C.notFit : n.f === 2 ? C.accent : C.possible;
    ctx.beginPath();
    dot(ctx, p.x, p.y, p.r);
    ctx.fill();
    if (n.k & (n.k - 1)) {
      ctx.strokeStyle = "rgba(232,234,237,0.78)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      dot(ctx, p.x, p.y, p.r + 1.1);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;

  // Owners.
  owners.forEach((o, i) => {
    const p = L.ownerPos[i];
    const on = !bit || bit === 1 << i;
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.fillStyle = C.text;
    ctx.beginPath();
    dot(ctx, p.x, p.y, p.r);
    ctx.fill();
    const name = compact ? o.name.split(" ")[0] : o.name;
    ctx.font = `500 ${compact ? 10 : 13}px ${FF}`;
    const tw = ctx.measureText(name).width;
    const lx = Math.max(3, p.x - tw / 2);
    const ly = p.y + p.r + (compact ? 12 : 17);
    haloText(ctx, name, lx, ly, C.text2);
    ctx.font = `${compact ? 9.5 : 12}px ${FF}`;
    haloText(ctx, fmt(L.ownerCount[i]), lx, ly + (compact ? 11 : 15), C.faintText);
  });
  ctx.globalAlpha = 1;

  // Industry groups. Their counts add up to the number of people.
  groups.forEach((g, i) => {
    if (!L.present[i]) return;
    const p = L.groupPos[i];
    const total = nodes.reduce((a, n) => a + (n.g === i && vis(n) ? 1 : 0), 0);
    const fits = nodes.reduce((a, n) => a + (n.g === i && n.f && vis(n) ? 1 : 0), 0);
    const tgt = L.target[i];
    ctx.fillStyle = tgt ? (fits ? "#dde5f5" : C.muted) : "#3d444f";
    ctx.beginPath();
    dot(ctx, p.x, p.y, p.r);
    ctx.fill();
    const name = L.short ? g.short : g.label;
    const sub = L.short ? `${fmt(total)}${fits ? ` · ${fits} fit` : ""}` : `${fmt(total)} people${fits ? ` · ${fits} fit` : ""}`;
    const fs1 = compact ? 10 : tgt ? 13 : 12;
    const fs2 = compact ? 9 : 11.5;
    ctx.font = `${tgt ? 500 : 400} ${fs1}px ${FF}`;
    const w1 = ctx.measureText(name).width;
    ctx.font = `${fs2}px ${FF}`;
    const w2 = ctx.measureText(sub).width;
    const lx = p.x + p.r + (compact ? 4 : 7);
    ctx.fillStyle = "rgba(14,17,21,0.45)";
    ctx.fillRect(lx - 3, p.y - fs1 - 1, Math.max(w1, w2) + 6, fs1 + fs2 + 6);
    ctx.font = `${tgt ? 500 : 400} ${fs1}px ${FF}`;
    haloText(ctx, name, lx, p.y - 1, tgt ? C.text2 : C.muted);
    ctx.font = `${fs2}px ${FF}`;
    haloText(ctx, sub, lx, p.y + fs2 + 1, C.faintText);
  });
  if (L.splitY && !compact) {
    ctx.font = `11px ${FF}`;
    ctx.fillStyle = "#4d5560";
    const t = "Outside your industries";
    ctx.fillText(t, xs.c1 - ctx.measureText(t).width, L.splitY + 4);
  }

  // Column headers.
  ctx.textBaseline = "alphabetic";
  const head = (x: number, a: string, b: string, c: string) => {
    ctx.fillStyle = C.text;
    ctx.font = `600 ${compact ? 14 : 19}px ${FF}`;
    ctx.fillText(a, x, compact ? 18 : 30);
    ctx.fillStyle = C.text2;
    ctx.font = `${compact ? 10 : 13}px ${FF}`;
    ctx.fillText(b, x, compact ? 31 : 47);
    if (!compact) {
      ctx.fillStyle = C.faintText;
      ctx.font = `12px ${FF}`;
      ctx.fillText(c, x, 62);
    }
  };
  if (!compact) head(14, String(owners.length), owners.length === 1 ? "network" : "networks", "LinkedIn exports");
  head(xs.c0, fmt(counts.contacts), "people", "merged by profile URL");
  head(xs.group - (compact ? 4 : 8), String(counts.groups), compact ? "groups" : "industry groups", "PRH line of business");
  head(compact ? W - 50 : xs.fit - 22, fmt(counts.fits), compact ? "who fit" : "decision-makers who fit", "title matches your roles");
}

// ---------- the scene: static + highlights ----------

type SceneOpts = { hg: number | null; hov: number; sel: number; reacted: boolean; labels: Label[]; bit: number };

function pathSegs(L: Layout, nodes: DNode[], i: number, owners: number, bit: number): number[][] {
  const n = nodes[i];
  const p = L.contact[i];
  const gp = L.groupPos[n.g];
  const fp = L.fitPos.get(i);
  const routes: number[][] = [];
  for (let o = 0; o < owners; o++) {
    if (!(n.k & (1 << o)) || (bit && bit !== 1 << o && n.k & bit)) continue;
    const op = L.ownerPos[o];
    const r = [op.x, op.y, p.x, p.y, p.x, p.y, gp.x, gp.y];
    if (fp) r.push(gp.x, gp.y, fp.x, fp.y);
    routes.push(r);
  }
  return routes;
}

function drawScene(ctx: CanvasRenderingContext2D, L: Layout, nodes: DNode[], owners: DOwner[], o: SceneOpts) {
  const vis = (n: DNode) => !o.bit || (n.k & o.bit) !== 0;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  if (o.hg !== null) {
    const own: number[] = [];
    const inn: number[] = [];
    const out: number[] = [];
    nodes.forEach((n, i) => {
      if (n.g !== o.hg || !vis(n)) return;
      const p = L.contact[i];
      const gp = L.groupPos[n.g];
      inn.push(p.x, p.y, gp.x, gp.y);
      for (let k = 0; k < owners.length; k++) if (n.k & (1 << k) && (!o.bit || o.bit === 1 << k)) own.push(L.ownerPos[k].x, L.ownerPos[k].y, p.x, p.y);
      const fp = L.fitPos.get(i);
      if (fp) out.push(gp.x, gp.y, fp.x, fp.y);
    });
    const many = inn.length / 4 > 1500;
    (many ? strokeBatched : strokeEach)(ctx, own, "rgba(141,180,255,0.07)", 0.7);
    (many ? strokeBatched : strokeEach)(ctx, inn, "rgba(141,180,255,0.2)", 0.8);
    strokeEach(ctx, out, "rgba(141,180,255,0.55)", 1);
    halo(ctx, "141,180,255", L.groupPos[o.hg].x, L.groupPos[o.hg].y, L.groupPos[o.hg].r * 5, 1);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = C.sel;
    ctx.beginPath();
    nodes.forEach((n, i) => n.g === o.hg && vis(n) && dot(ctx, L.contact[i].x, L.contact[i].y, Math.max(1.3, L.contact[i].r)));
    L.fitPos.forEach((p, i) => nodes[i].g === o.hg && vis(nodes[i]) && dot(ctx, p.x, p.y, p.r + 0.6));
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
  }
  if (o.reacted) {
    const own: number[] = [];
    nodes.forEach((n, i) => {
      if (!n.rx || !vis(n)) return;
      for (let k = 0; k < owners.length; k++) if (n.k & (1 << k) && (!o.bit || o.bit === 1 << k)) own.push(L.ownerPos[k].x, L.ownerPos[k].y, L.contact[i].x, L.contact[i].y);
      halo(ctx, "143,224,166", L.contact[i].x, L.contact[i].y, 14, 0.9);
    });
    strokeEach(ctx, own, "rgba(143,224,166,0.28)", 0.9);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = C.green;
    ctx.fillStyle = C.green;
    ctx.lineWidth = 1.2;
    nodes.forEach((n, i) => {
      if (!n.rx || !vis(n)) return;
      const p = L.contact[i];
      ctx.beginPath();
      dot(ctx, p.x, p.y, Math.max(2.2, p.r));
      ctx.fill();
      ctx.beginPath();
      dot(ctx, p.x, p.y, Math.max(2.2, p.r) + 2.2);
      ctx.stroke();
    });
    ctx.globalCompositeOperation = "lighter";
  }
  const lit = (i: number, color: string, width: number, glowA: number) => {
    const n = nodes[i];
    const segs = pathSegs(L, nodes, i, owners.length, o.bit).flat();
    strokeEach(ctx, segs, color, width);
    const p = L.contact[i];
    halo(ctx, "141,180,255", p.x, p.y, 16, glowA);
    const fp = L.fitPos.get(i);
    if (fp) halo(ctx, "141,180,255", fp.x, fp.y, 16, glowA);
    halo(ctx, "141,180,255", L.groupPos[n.g].x, L.groupPos[n.g].y, L.groupPos[n.g].r * 4, glowA * 0.7);
  };
  // At rest the strongest are lit; otherwise only what is hovered or chosen.
  if (o.sel < 0 && o.hg === null && o.hov < 0 && !o.reacted) for (const lb of o.labels) lit(lb.ni, "rgba(61,123,255,0.42)", 1.1, 0.5);
  if (o.hov >= 0 && o.hov !== o.sel) lit(o.hov, "rgba(141,180,255,0.75)", 1.2, 0.8);
  if (o.sel >= 0) lit(o.sel, "rgba(141,180,255,0.95)", 1.8, 1);
  ctx.globalCompositeOperation = "source-over";
  for (const i of [o.hov, o.sel]) {
    if (i < 0) continue;
    const p = L.contact[i];
    ctx.fillStyle = C.sel;
    ctx.beginPath();
    dot(ctx, p.x, p.y, Math.max(3, p.r + 1.2));
    const fp = L.fitPos.get(i);
    if (fp) dot(ctx, fp.x, fp.y, fp.r + 1.5);
    ctx.fill();
  }

  // Labels for the strongest.
  for (const lb of o.labels) {
    const n = nodes[lb.ni];
    const fp = L.fitPos.get(lb.ni)!;
    const on = o.sel < 0 || o.sel === lb.ni;
    ctx.globalAlpha = on ? 1 : 0.4;
    ctx.strokeStyle = "rgba(61,123,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fp.x + fp.r + 2, fp.y);
    ctx.bezierCurveTo(fp.x + 14, fp.y, lb.x - 22, lb.y, lb.x - 10, lb.y);
    ctx.stroke();
    ctx.fillStyle = n.nf ? C.notFit : C.accent;
    ctx.beginPath();
    dot(ctx, lb.x - 4, lb.y, 5.5);
    ctx.fill();
    ctx.strokeStyle = n.k & (n.k - 1) ? C.text : o.sel === lb.ni ? C.sel : "rgba(61,123,255,0.5)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    dot(ctx, lb.x - 4, lb.y, 8);
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = `600 13px ${FF}`;
    ctx.fillText(ellipsis(ctx, n.n, lb.w - 12), lb.x + 10, lb.y - 2);
    ctx.fillStyle = C.muted;
    ctx.font = `12px ${FF}`;
    ctx.fillText(ellipsis(ctx, n.c, lb.w - 12), lb.x + 10, lb.y + 13);
    ctx.globalAlpha = 1;
  }
}

// ---------- zoom ----------

type View = { z: number; x: number; y: number };
const HOME: View = { z: 1, x: 0, y: 0 };

/** Keeps the zoom between 1x and 6x and the drawing filling the frame. */
function clampView(v: View, W: number, H: number): View {
  const z = Math.max(1, Math.min(6, v.z));
  return { z, x: Math.min(0, Math.max(W * (1 - z), v.x)), y: Math.min(0, Math.max(H * (1 - z), v.y)) };
}

function zoomAt(v: View, cx: number, cy: number, f: number, W: number, H: number): View {
  const z = Math.max(1, Math.min(6, v.z * f));
  const k = z / v.z;
  return clampView({ z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, W, H);
}

// ---------- the component ----------

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
  counts: Counts;
  showReacted?: boolean;
  /** A person hovered in the list next to the drawing: lit like a hover. */
  focusId?: string | null;
}) {
  const { nodes, groups, owners, owner, topIds, selected, onSelect, hoverGroup, onHoverGroup, counts, showReacted = false, focusId = null } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<HTMLCanvasElement | null>(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState<Hit | null>(null);
  const [staticVersion, setStaticVersion] = useState(0);
  const anim = useRef({ raf: 0, pulse0: -1, pulsed: false, painted: false });
  const live = useRef<{ L: Layout | null; dpr: number; routes: number[][]; reduce: boolean; view: View; rview: View }>({ L: null, dpr: 1, routes: [], reduce: false, view: HOME, rview: HOME });
  const H = W ? heightFor(W) : 0;
  // `view` follows the wheel and the drag at once (a scaled copy of the layers);
  // `rview` is what the layers were last rendered at, crisp, once the gesture rests.
  const [view, setView] = useState<View>(HOME);
  const [rview, setRview] = useState<View>(HOME);
  const drag = useRef<{ x: number; y: number; v: View; moved: boolean } | null>(null);
  live.current.view = view;
  live.current.rview = rview;
  useEffect(() => {
    if (view === rview) return;
    const t = setTimeout(() => setRview(view), 140);
    return () => clearTimeout(t);
  }, [view, rview]);
  useEffect(() => {
    setView(HOME);
    setRview(HOME);
  }, [W]);
  const bit = owner >= 0 ? 1 << owner : 0;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    live.current.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = useMemo(() => {
    if (!W) return null;
    const t0 = performance.now();
    const l = layout(nodes, groups, owners, W, H);
    performance.measure("vn:layout", { start: t0 });
    return l;
  }, [nodes, groups, owners, W, H]);
  useEffect(() => {
    // Where the industry nodes are, for the screenshot scripts.
    if (L) (window as unknown as { __vnDrawing?: unknown }).__vnDrawing = { W: L.W, H: L.H, groups: groups.map((g, i) => ({ id: g.id, x: L.groupPos[i].x, y: L.groupPos[i].y, present: L.present[i] })), fits: [...L.fitPos.entries()].map(([i, p]) => ({ id: nodes[i].id, x: p.x, y: p.y })) };
  }, [L, groups, nodes]);
  const labels = useMemo(() => (L && !L.compact ? placeLabels(L, topIds) : []), [L, topIds]);
  live.current.L = L;

  // Grid hash for hit testing.
  const grid = useMemo(() => {
    const cell = 12;
    const m = new Map<number, Hit[]>();
    if (!L) return { cell, m };
    const add = (p: P, h: Hit, r: number) => {
      for (let gx = Math.floor((p.x - r) / cell); gx <= Math.floor((p.x + r) / cell); gx++)
        for (let gy = Math.floor((p.y - r) / cell); gy <= Math.floor((p.y + r) / cell); gy++) {
          const k = gy * 4096 + gx;
          (m.get(k) ?? m.set(k, []).get(k)!).push(h);
        }
    };
    L.contact.forEach((p, i) => p && add(p, { kind: "contact", i }, Math.max(4, p.r + 2)));
    L.fitPos.forEach((p, i) => add(p, { kind: "fit", i }, 6));
    L.groupPos.forEach((p, i) => L.present[i] && add(p, { kind: "group", i }, Math.max(10, p.r + 5)));
    L.ownerPos.forEach((p, i) => add(p, { kind: "owner", i }, p.r + 8));
    return { cell, m };
  }, [L]);

  const posOf = useCallback(
    (h: Hit): P | null => (!L ? null : h.kind === "contact" ? L.contact[h.i] : h.kind === "fit" ? L.fitPos.get(h.i) ?? null : h.kind === "group" ? L.groupPos[h.i] : h.kind === "owner" ? L.ownerPos[h.i] : null),
    [L],
  );

  function find(x: number, y: number): Hit | null {
    for (const lb of labels) if (x >= lb.x - 14 && x <= lb.x + lb.w && Math.abs(y - lb.y) <= 16) return { kind: "label", i: lb.ni };
    const list = grid.m.get(Math.floor(y / grid.cell) * 4096 + Math.floor(x / grid.cell)) ?? [];
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

  // One frame: the scene (or the first-load pulse), then particles on the chosen path.
  const frame = useCallback((now: number) => {
    const a = anim.current;
    a.raf = 0;
    const cv = canvas.current;
    const scene = sceneRef.current;
    const st = staticRef.current;
    const { L, dpr, routes, reduce } = live.current;
    if (!cv || !scene || !st || !L) return;
    if (cv.width !== scene.width || cv.height !== scene.height) {
      cv.width = scene.width;
      cv.height = scene.height;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    let more = false;
    const t = a.pulse0 >= 0 ? (now - a.pulse0) / PULSE_MS : 1;
    if (t < 1) {
      // The pulse: owners -> contacts -> industries -> decision-makers.
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const X = Math.round((L.xs.owner - 30 + (L.W + 30 - L.xs.owner) * e) * dpr);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(scene, 0, 0);
      ctx.globalAlpha = 1;
      if (X > 0) ctx.drawImage(scene, 0, 0, Math.min(X, scene.width), scene.height, 0, 0, Math.min(X, scene.width), scene.height);
      ctx.globalCompositeOperation = "lighter";
      const band = 90 * dpr;
      for (let s = 0; s < 6; s++) {
        const x0 = Math.max(0, X - ((s + 1) * band) / 6);
        const x1 = Math.min(st.width, X - (s * band) / 6);
        if (x1 <= x0) continue;
        ctx.globalAlpha = 0.9 * (1 - s / 6) * Math.min(1, (1 - t) * 4);
        ctx.drawImage(st, x0, 0, x1 - x0, st.height, x0, 0, x1 - x0, st.height);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      more = true;
    } else {
      if (a.pulse0 >= 0) a.pulse0 = -1;
      const { view: v, rview: r } = live.current;
      const k = v.z / r.z;
      if (k !== 1 || v.x !== r.x || v.y !== r.y) {
        // Mid-gesture: the last crisp layers, scaled, until they are redrawn.
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.setTransform(k, 0, 0, k, dpr * (v.x - k * r.x), dpr * (v.y - k * r.y));
      }
      ctx.drawImage(scene, 0, 0);
    }
    if (routes.length && !reduce) {
      // Small particles flowing along the chosen person's path.
      const v = live.current.view;
      ctx.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.x, dpr * v.y);
      ctx.globalCompositeOperation = "lighter";
      const g = glow("170,200,255");
      for (const r of routes) {
        const nSeg = r.length / 4;
        for (let k = 0; k < 4; k++) {
          const s = ((now / 900 + (k * nSeg) / 4) % nSeg + nSeg) % nSeg;
          const j = Math.floor(s) * 4;
          const p = onCurve(r[j], r[j + 1], r[j + 2], r[j + 3], s - Math.floor(s));
          ctx.drawImage(g, p.x - 9, p.y - 9, 18, 18);
          ctx.fillStyle = "rgba(235,242,255,0.95)";
          ctx.beginPath();
          dot(ctx, p.x, p.y, 1.5);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      more = true;
    }
    if (!a.painted) {
      a.painted = true;
      performance.mark("vn:first-frame");
    }
    if (more) a.raf = requestAnimationFrame(frameRef.current);
  }, []);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Draws now when nothing is animating, so a resize never shows a stretched frame.
  const kick = useCallback(() => {
    if (!anim.current.raf) frameRef.current(performance.now());
  }, []);
  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  // Static layer: every link and node for this filter and size.
  useEffect(() => {
    if (!L) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    live.current.dpr = dpr;
    FF = getComputedStyle(document.body).fontFamily || FF;
    const off = staticRef.current ?? document.createElement("canvas");
    staticRef.current = off;
    off.width = Math.round(L.W * dpr);
    off.height = Math.round(L.H * dpr);
    const ctx = off.getContext("2d")!;
    ctx.setTransform(dpr * rview.z, 0, 0, dpr * rview.z, dpr * rview.x, dpr * rview.y);
    const t0 = performance.now();
    drawStatic(ctx, L, nodes, groups, owners, bit, counts);
    performance.measure("vn:static", { start: t0 });
    if (!anim.current.pulsed) {
      anim.current.pulsed = true;
      if (!live.current.reduce) anim.current.pulse0 = performance.now();
    }
    setStaticVersion((v) => v + 1);
  }, [L, nodes, groups, owners, bit, counts, rview]);

  const hovIdx = hover && (hover.kind === "contact" || hover.kind === "fit" || hover.kind === "label") ? hover.i : focusId && L ? L.index.get(focusId) ?? -1 : -1;
  const selIdx = selected && L ? L.index.get(selected) ?? -1 : -1;
  const hg = hoverGroup ?? (hover?.kind === "group" ? hover.i : null);

  // Scene layer: the static layer plus what is hovered, chosen or toggled.
  useEffect(() => {
    const st = staticRef.current;
    if (!L || !st) return;
    const scene = sceneRef.current ?? document.createElement("canvas");
    sceneRef.current = scene;
    if (scene.width !== st.width || scene.height !== st.height) {
      scene.width = st.width;
      scene.height = st.height;
    }
    const ctx = scene.getContext("2d")!;
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(st, 0, 0);
    const dpr = live.current.dpr;
    const r = live.current.rview;
    ctx.setTransform(dpr * r.z, 0, 0, dpr * r.z, dpr * r.x, dpr * r.y);
    drawScene(ctx, L, nodes, owners, { hg, hov: hovIdx, sel: selIdx, reacted: showReacted, labels, bit });
    live.current.routes = selIdx >= 0 ? pathSegs(L, nodes, selIdx, owners.length, bit) : [];
    kick();
    performance.measure("vn:scene", { start: t0 });
  }, [staticVersion, L, nodes, owners, hg, hovIdx, selIdx, showReacted, labels, bit, kick]);
  useEffect(() => kick(), [view, kick]);

  // Ctrl or Cmd + wheel (and trackpad pinch) zooms around the pointer; plain wheel scrolls the page.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !L) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      setView((v) => zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01), L.W, L.H));
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [L]);

  function tipFor(h: Hit): React.ReactNode {
    if (h.kind === "group") {
      const g = groups[h.i];
      const vis = nodes.filter((n) => n.g === h.i && (!bit || n.k & bit));
      return (
        <>
          <b>{g.label}</b>
          <br />
          <span className="muted">
            {fmt(vis.length)} people · {vis.filter((n) => n.f).length} decision-makers who fit
          </span>
        </>
      );
    }
    if (h.kind === "owner") {
      return (
        <>
          <b>{owners[h.i].name}</b>
          <br />
          <span className="muted">{fmt(L?.ownerCount[h.i] ?? 0)} connections</span>
        </>
      );
    }
    const n = nodes[h.i];
    return (
      <>
        <b>{n.n}</b>
        <br />
        <span className="muted">
          {n.t || "No title"}
          {n.c ? ` · ${n.c}` : ""}
        </span>
        <br />
        <span className="xs faint">
          {groups[n.g].label}
          {n.f === 2 ? " · Strong fit" : n.f === 1 ? " · Possible fit" : ""}
          {n.k & (n.k - 1) ? " · known by two or more of you" : ""}
          {n.rx ? " · reacted recently" : ""}
        </span>
      </>
    );
  }

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * (L?.W ?? 1);
    const sy = ((e.clientY - rect.top) / rect.height) * (L?.H ?? 1);
    return { x: (sx - view.x) / view.z, y: (sy - view.y) / view.z, lx: e.clientX - rect.left, ly: e.clientY - rect.top };
  };
  const moveTip = (lx: number, ly: number) => {
    const el = tipEl.current;
    if (!el || !L) return;
    const w = el.offsetWidth || 240;
    el.style.left = `${Math.max(4, Math.min(lx + 14, L.W - w - 6))}px`;
    el.style.top = `${Math.min(ly + 14, L.H - (el.offsetHeight || 60) - 6)}px`;
  };
  const same = (a: Hit | null, b: Hit | null) => (a && b ? a.kind === b.kind && a.i === b.i : a === b);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType !== "mouse" || view.z <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, v: view, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") return;
    const d = drag.current;
    if (d && L) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) {
        if (hover) setHover(null);
        setView(clampView({ z: d.v.z, x: d.v.x + dx, y: d.v.y + dy }, L.W, L.H));
        return;
      }
    }
    const p = point(e);
    const h = find(p.x, p.y);
    if (!same(h, hover)) setHover(h);
    moveTip(p.lx, p.ly);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) return;
    const p = point(e);
    const h = find(p.x, p.y);
    if (!h) {
      setHover(null);
      return onHoverGroup(null);
    }
    if (h.kind === "group") return onHoverGroup(hoverGroup === h.i ? null : h.i);
    if (h.kind === "owner") {
      setHover(h);
      return moveTip(p.lx, p.ly);
    }
    // Touch: the first tap shows who it is, the second opens them.
    if (e.pointerType === "touch" && !same(h, hover) && !(hover && hover.kind !== "group" && hover.kind !== "owner" && hover.i === h.i)) {
      setHover(h);
      return moveTip(p.lx, p.ly);
    }
    setHover(null);
    onSelect(nodes[h.i].id);
  }

  return (
    <div ref={wrap} className="drawing-wrap">
      <div className="drawing" style={{ height: H || 600 }}>
        {L ? (
          <canvas
            ref={canvas}
            style={{ width: L.W, height: L.H, cursor: hover && hover.kind !== "owner" ? "pointer" : view.z > 1 ? "grab" : "default" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
            role="img"
            aria-label={`Network drawing: ${counts.contacts} people in ${counts.groups} industry groups, ${counts.fits} decision-makers who fit. The list next to it has the same people.`}
          />
        ) : null}
        <div ref={tipEl} className="tip" style={{ display: hover ? "block" : "none" }}>
          {hover ? tipFor(hover) : null}
          {hover && hover.kind !== "group" && hover.kind !== "owner" ? <div className="xs faint tap-hint">Tap again to open</div> : null}
        </div>
        {L ? (
          <div className="zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom in" title="Zoom in (or Ctrl + scroll)" onClick={() => setView((v) => zoomAt(v, L.W / 2, L.H / 2, 1.6, L.W, L.H))}>
              +
            </button>
            <button type="button" aria-label="Zoom out" disabled={view.z <= 1} onClick={() => setView((v) => zoomAt(v, L.W / 2, L.H / 2, 1 / 1.6, L.W, L.H))}>
              −
            </button>
            {view.z > 1 ? (
              <button type="button" className="reset" onClick={() => setView(HOME)}>
                Reset
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
