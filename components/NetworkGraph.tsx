"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import cytoscape from "cytoscape";
import type { GEdge, GNode } from "@/lib/graph.ts";

const INK = "#0a0a0a";
const MUTED = "#8a9099";
const RULE = "#cfd4da";
const HUE = "#1d5fbf";

export function NetworkGraph({ nodes, edges }: { nodes: GNode[]; edges: GEdge[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...nodes.map((n) => ({ data: { ...n, display: n.kind === "person" && n.score !== undefined ? `${n.label}\n${n.score}` : n.kind === "post" ? "" : n.label, full: n.label }, position: { x: n.x ?? 0, y: n.y ?? 0 } })),
        ...edges.map((e) => ({ data: e })),
      ],
      minZoom: 0.4,
      maxZoom: 2.2,
      wheelSensitivity: 0.2,
      style: [
        { selector: "node", style: { label: "data(display)", "font-family": "Geist, Inter, system-ui, sans-serif", "font-size": 15, color: INK, "text-wrap": "wrap", "text-max-width": "160px", "text-valign": "bottom", "text-margin-y": 6, "background-color": "#fff", "border-width": 1.5, "border-color": MUTED, width: 20, height: 20 } },
        { selector: 'node[kind = "founder"]', style: { "background-color": INK, "border-color": INK, width: 40, height: 40, "font-weight": 600, "font-size": 17 } },
        { selector: 'node[kind = "post"]', style: { shape: "round-rectangle", width: 14, height: 14, "background-color": "#eceff3", "border-color": "#b8bec6", color: MUTED, "font-size": 10 } },
        { selector: 'node[kind = "company"]', style: { shape: "round-rectangle", width: 24, height: 24, "background-color": "#f2f4f7", "border-color": "#9aa1ab", color: "#3d434b", "font-size": 13 } },
        { selector: 'node[kind = "company"][status = "customer"]', style: { "background-color": "#dcfae5", "border-color": "#2e7d32" } },
        { selector: 'node[kind = "company"][status = "signal"]', style: { "border-color": INK, "border-width": 2 } },
        { selector: 'node[kind = "person"][status = "recommend"]', style: { "background-color": HUE, "border-color": HUE, width: "mapData(score, 30, 90, 22, 40)", height: "mapData(score, 30, 90, 22, 40)", "font-weight": 600 } },
        { selector: 'node[kind = "person"][status = "hold"]', style: { "border-color": "#c4242a", "border-style": "dashed" } },
        { selector: 'node[kind = "person"][status = "customer"]', style: { "background-color": "#2e7d32", "border-color": "#2e7d32" } },
        { selector: "edge", style: { width: 1, "line-color": RULE, "curve-style": "bezier" } },
        { selector: 'edge[kind = "connected"]', style: { "line-color": "#b8bec6" } },
        { selector: 'edge[kind = "authored"]', style: { "line-color": "#dde1e6" } },
        { selector: 'edge[kind = "engaged"]', style: { "line-style": "dashed", "line-color": "#9aa1ab" } },
        { selector: 'edge[kind = "commented"]', style: { width: 2, "line-color": INK } },
        { selector: 'edge[kind = "intro"]', style: { width: 2.5, "line-color": HUE, "target-arrow-shape": "triangle", "target-arrow-color": HUE } },
        { selector: 'edge[kind = "works_at"]', style: { "line-color": "#c9ced6" } },
        { selector: "node:selected", style: { "overlay-color": HUE, "overlay-opacity": 0.12, "overlay-padding": 6 } },
      ],
      layout: { name: "preset", padding: 40 },
    });
    cy.on("tap", "node", (evt) => {
      const href = evt.target.data("href");
      if (href) router.push(href);
    });
    cy.on("mouseover", "node", (evt) => {
      if (evt.target.data("href") && ref.current) ref.current.style.cursor = "pointer";
      if (evt.target.data("kind") === "post") evt.target.style("label", evt.target.data("full"));
    });
    cy.on("mouseout", "node", (evt) => {
      if (ref.current) ref.current.style.cursor = "default";
      if (evt.target.data("kind") === "post") evt.target.style("label", "");
    });
    return () => cy.destroy();
  }, [nodes, edges, router]);

  return <div ref={ref} style={{ width: "100%", height: 680 }} aria-label="Relationship graph" />;
}
