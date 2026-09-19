import { useEffect, useRef } from "react";
import cytoscape, {
  type Core,
  type StylesheetStyle,
  type Css,
} from "cytoscape";
import type { KnowledgeGraph as Graph } from "@flowpilot/contracts";
import {
  ArrowsOut,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Crosshair,
  Graph as GraphIcon,
} from "@phosphor-icons/react";

const nodeTypes: {
  kind: string;
  token: string;
  shape: Css.NodeShape;
  glyph: string;
}[] = [
  { kind: "Case", token: "case", shape: "round-rectangle", glyph: "case" },
  { kind: "Symptom", token: "symptom", shape: "diamond", glyph: "diamond" },
  { kind: "Component", token: "component", shape: "hexagon", glyph: "hexagon" },
  {
    kind: "Possible cause",
    token: "hypothesis",
    shape: "triangle",
    glyph: "triangle",
  },
  { kind: "Finding", token: "finding", shape: "ellipse", glyph: "circle" },
  { kind: "Action", token: "action", shape: "rectangle", glyph: "square" },
  { kind: "Outcome", token: "outcome", shape: "pentagon", glyph: "pentagon" },
];

export function KnowledgeGraph({
  graph,
  selected,
  onSelect,
}: {
  graph: Graph;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Core | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const styles = getComputedStyle(container.current);
    const color = (name: string) => styles.getPropertyValue(name).trim();
    const categoryStyles: StylesheetStyle[] = nodeTypes.map((type) => ({
      selector: `node[kind = "${type.kind}"]`,
      style: {
        shape: type.shape,
        "background-color": color(`--graph-${type.token}`),
        width: type.kind === "Case" ? 46 : 30,
        height: type.kind === "Case" ? 35 : 30,
      },
    }));
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...graph.nodes.map((node) => ({
          data: {
            ...node,
            display:
              node.kind === "Case"
                ? node.id.slice(-4).toUpperCase()
                : node.label.length > 40
                  ? node.label.slice(0, 37) + "…"
                  : node.label,
          },
        })),
        ...graph.edges.map((edge) => ({ data: { ...edge } })),
      ],
      minZoom: 0.2,
      maxZoom: 2.5,
      layout: {
        name: "cose",
        animate: false,
        padding: 28,
        boundingBox: {
          x1: 0,
          y1: 0,
          w: Math.max(220, container.current.clientWidth - 140),
          h: Math.max(150, container.current.clientHeight - 100),
        },
        // Labels must stay legible on a projector, so keep nodes apart enough
        // that the fit zoom does not have to shrink the map to read it.
        nodeRepulsion: () => 5200,
        idealEdgeLength: () => 88,
        componentSpacing: 110,
        nodeOverlap: 24,
        nodeDimensionsIncludeLabels: true,
      },
      style: [
        {
          selector: "node",
          style: {
            "background-color": color("--slate-300"),
            label: "data(display)",
            color: color("--text-primary"),
            "font-family": "IBM Plex Sans",
            "font-size": 14,
            "font-weight": 500,
            "text-wrap": "wrap",
            "text-max-width": "110px",
            "text-valign": "bottom",
            "text-margin-y": 10,
            "text-background-color": color("--surface-document"),
            "text-background-opacity": 1,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            width: 21,
            height: 21,
            "border-width": 2,
            "border-color": color("--surface-document"),
          },
        },
        ...categoryStyles,
        {
          selector: 'node[kind = "Case"]',
          style: {
            "text-valign": "center",
            "text-margin-y": 0,
            "text-background-opacity": 0,
            "font-size": 12,
            "font-weight": 600,
            color: color("--white"),
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            opacity: 0.65,
            "line-color": color("--border-strong"),
            "target-arrow-color": color("--border-strong"),
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.6,
            "curve-style": "bezier",
          },
        },
        {
          selector: 'edge[status = "hypothesis"]',
          style: { "line-style": "dashed" },
        },
        { selector: "node.dim", style: { opacity: 0.35, "z-index": 1 } },
        { selector: "node.active", style: { "z-index": 10 } },
        { selector: "edge.dim", style: { opacity: 0.12 } },
        {
          selector: "node.chosen",
          style: {
            "z-index": 20,
            "border-width": 4,
            "border-color": color("--text-primary"),
            "border-style": "double",
          },
        },
        {
          selector: "edge.active",
          style: {
            width: 2.2,
            opacity: 0.9,
            "line-color": color("--slate-500"),
            "target-arrow-color": color("--slate-500"),
          },
        },
      ],
    });
    instance.current = cy;
    cy.on("tap", "node, edge", (event) => onSelect(event.target.id()));
    const resize = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 28);
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.current = null;
      cy.destroy();
    };
  }, [graph, onSelect]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.elements().removeClass("dim active chosen");
    const target = cy.getElementById(selected);
    if (target.length) {
      const related = target.data("kind")
        ? target.closedNeighborhood()
        : cy.collection(target).union(cy.collection(target).connectedNodes());
      cy.elements().difference(related).addClass("dim");
      related.addClass("active");
      target.addClass("chosen");
    }
  }, [selected, graph]);
  const zoom = (factor: number) => {
    const cy = instance.current;
    if (cy)
      cy.zoom({
        level: cy.zoom() * factor,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
  };
  return (
    <>
      <div className="graph-toolbar" aria-label="Graph controls">
        <div className="graph-heading">
          <GraphIcon aria-hidden="true" />
          <div>
            <h2>Knowledge map</h2>
            <p>
              {graph.nodes.length} nodes · {graph.edges.length} connections
            </p>
          </div>
        </div>
        <div>
          <button
            className="secondary"
            aria-label="Zoom in"
            onClick={() => zoom(1.3)}
          >
            <MagnifyingGlassPlus aria-hidden="true" />
          </button>
          <button
            className="secondary"
            aria-label="Zoom out"
            onClick={() => zoom(0.75)}
          >
            <MagnifyingGlassMinus aria-hidden="true" />
          </button>
          <button
            className="secondary"
            onClick={() => {
              const cy = instance.current;
              const target = cy?.getElementById(selected);
              if (target?.length) cy?.fit(target.closedNeighborhood(), 45);
            }}
            disabled={!selected}
          >
            <Crosshair aria-hidden="true" /> Focus
          </button>
          <button
            className="secondary"
            onClick={() => {
              onSelect("");
              instance.current?.fit(undefined, 42);
            }}
          >
            <ArrowsOut aria-hidden="true" /> Full graph
          </button>
        </div>
      </div>
      <div
        ref={container}
        className="learning-graph-stage"
        role="img"
        aria-label={`Knowledge graph with ${graph.nodes.length} nodes. Use the node and relationship lists below for keyboard access.`}
      />
      <div className="graph-legend" aria-label="Node type legend">
        {nodeTypes.map((type) => (
          <span key={type.kind} data-kind={type.kind}>
            <i
              className={`node-swatch shape-${type.glyph}`}
              style={{ backgroundColor: `var(--graph-${type.token})` }}
              aria-hidden="true"
            />
            {type.kind}
          </span>
        ))}
        <p>
          <i className="legend-dashed" aria-hidden="true" /> Dashed links are
          hypotheses. Colors identify types, not review status.
        </p>
      </div>
      <div className="graph-accessible-slot">
        <details className="graph-accessible">
          <summary>Browse nodes and relationships with keyboard</summary>
          <h3>Nodes</h3>
          <ul>
            {graph.nodes.map((node) => (
              <li key={node.id}>
                <button
                  className="graph-list-button"
                  aria-pressed={node.id === selected}
                  onClick={() => onSelect(node.id)}
                >
                  {node.kind}: {node.label}
                </button>
              </li>
            ))}
          </ul>
          <h3>Relationships</h3>
          <ul>
            {graph.edges.map((edge) => (
              <li key={edge.id}>
                <button
                  className="graph-list-button"
                  aria-pressed={edge.id === selected}
                  onClick={() => onSelect(edge.id)}
                >
                  {graph.nodes.find((n) => n.id === edge.source)?.label} →{" "}
                  {edge.relation} →{" "}
                  {graph.nodes.find((n) => n.id === edge.target)?.label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}
