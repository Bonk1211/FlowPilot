import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, {
  type Core,
  type Layouts,
  type CoseLayoutOptions,
  type AnimationOptions,
  type StylesheetStyle,
  type Css,
} from "cytoscape";
import type { KnowledgeGraph as Graph } from "@flowpilot/contracts";
import { attachElasticDrag } from "./elasticGraph";
import {
  knowledgeArrivalConnections,
  type graphConnectivity,
} from "../knowledgeGraph";
import {
  ArrowsOut,
  ArrowsClockwise,
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
  {
    kind: "Reference document",
    token: "reference",
    shape: "round-rectangle",
    glyph: "document",
  },
  {
    kind: "Reference section",
    token: "section",
    shape: "rectangle",
    glyph: "section",
  },
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
  { kind: "Knowledge", token: "finding", shape: "ellipse", glyph: "circle" },
  {
    kind: "Configuration",
    token: "component",
    shape: "hexagon",
    glyph: "hexagon",
  },
  { kind: "Evidence", token: "section", shape: "rectangle", glyph: "section" },
  {
    kind: "Recorded check",
    token: "action",
    shape: "rectangle",
    glyph: "square",
  },
  { kind: "Action", token: "action", shape: "rectangle", glyph: "square" },
  { kind: "Outcome", token: "outcome", shape: "pentagon", glyph: "pentagon" },
];

function forceLayout(
  width: number,
  height: number,
): Omit<CoseLayoutOptions, "animate"> & { animate: false | "end" } {
  return {
    name: "cose",
    animate: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? false
      : "end",
    animationDuration: 700,
    animationEasing: "ease-out-cubic",
    randomize: true,
    padding: 36,
    boundingBox: {
      x1: 0,
      y1: 0,
      w: Math.max(280, width - 140),
      h: Math.max(240, height - 100),
    },
    nodeRepulsion: () => 11000,
    idealEdgeLength: (edge) =>
      96 + Math.max(edge.source().data("size"), edge.target().data("size")),
    componentSpacing: 110,
    nodeOverlap: 24,
    nodeDimensionsIncludeLabels: true,
  };
}

function moveViewport(cy: Core, options: AnimationOptions) {
  cy.stop(true, false);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (options.fit) cy.fit(options.fit.eles, options.fit.padding);
    if (options.zoom) cy.zoom(options.zoom);
  } else {
    cy.animate(options, { duration: 400, easing: "ease-out-cubic" });
  }
}

export function KnowledgeGraph({
  graph,
  connectivity,
  selected,
  onSelect,
  arrival,
  preserveLayout = false,
}: {
  graph: Graph;
  connectivity: ReturnType<typeof graphConnectivity>;
  selected: string;
  onSelect: (id: string) => void;
  arrival?: { id: string; sequence: number } | null;
  preserveLayout?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const arrivalHalo = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState("");
  const arrivalPaths = useRef<SVGSVGElement>(null);
  const connections = useMemo(
    () => knowledgeArrivalConnections(graph, arrival?.id ?? ""),
    [graph, arrival?.id],
  );
  const arrivalKey = arrival ? `${arrival.id}:${arrival.sequence}` : "";
  const [progress, setProgress] = useState({ key: "", phase: 0 });
  const phase = progress.key === arrivalKey ? progress.phase : 0;
  const directCount = connections.filter(
    (link) => link.wave === "direct",
  ).length;
  const libraryCount = connections.length - directCount;
  const instance = useRef<Core | null>(null);
  const runningLayout = useRef<Layouts | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const viewport = useRef<{
    zoom: number;
    pan: { x: number; y: number };
  } | null>(null);
  const lastArrival = useRef("");
  useEffect(() => {
    if (!container.current) return;
    const previous = positions.current;
    const added = graph.nodes.filter((node) => !previous.has(node.id));
    const reuseLayout =
      preserveLayout &&
      previous.size > 0 &&
      added.length <= 1 &&
      added.every((node) => node.kind === "Knowledge");
    function positionFor(id: string) {
      if (!reuseLayout) return undefined;
      if (previous.has(id)) return previous.get(id);
      const neighbors = graph.edges
        .filter((edge) => edge.target === id || edge.source === id)
        .map((edge) =>
          previous.get(edge.source === id ? edge.target : edge.source),
        )
        .filter((point) => point !== undefined);
      const origin = neighbors.length
        ? {
            x:
              neighbors.reduce((sum, point) => sum + point.x, 0) /
              neighbors.length,
            y:
              neighbors.reduce((sum, point) => sum + point.y, 0) /
              neighbors.length,
          }
        : { x: 300, y: 250 };
      // Keep the existing library still; place a new finding in nearby free space.
      return Array.from({ length: 12 }, (_, index) => ({
        x: origin.x + Math.cos((index * Math.PI) / 6) * 180,
        y: origin.y + Math.sin((index * Math.PI) / 6) * 180,
      })).sort((a, b) => {
        const clearance = (point: { x: number; y: number }) =>
          Math.min(
            ...[...previous.values()].map((other) =>
              Math.hypot(point.x - other.x, point.y - other.y),
            ),
          );
        return clearance(b) - clearance(a);
      })[0];
    }
    const styles = getComputedStyle(container.current);
    const color = (name: string) => styles.getPropertyValue(name).trim();
    const categoryStyles: StylesheetStyle[] = nodeTypes.map((type) => ({
      selector: `node[kind = "${type.kind}"]`,
      style: {
        shape: type.shape,
        "background-color": color(`--graph-${type.token}`),
      },
    }));
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...graph.nodes.map((node, index) => ({
          position: positionFor(node.id) ?? {
            x: (index % Math.ceil(Math.sqrt(graph.nodes.length))) * 160,
            y:
              Math.floor(index / Math.ceil(Math.sqrt(graph.nodes.length))) *
              140,
          },
          data: {
            ...node,
            size: connectivity.get(node.id)?.size ?? 34,
            height:
              (connectivity.get(node.id)?.size ?? 34) *
              (node.kind === "Case" ? 0.78 : 1),
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
      layout: { name: "preset", fit: !reuseLayout, padding: 36 },
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
            width: "data(size)",
            height: "data(height)",
            "border-width": 2,
            "border-color": color("--surface-document"),
            "transition-property":
              "opacity, border-width, border-color, overlay-opacity",
            "transition-duration": window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches
              ? 0
              : 180,
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
        {
          selector: 'edge[source_type = "reference"]',
          style: {
            "line-color": color("--graph-reference"),
            "target-arrow-color": color("--graph-reference"),
            opacity: 0.5,
          },
        },
        {
          selector: 'edge[status = "topic_match"]',
          style: { "line-style": "dotted" },
        },
        { selector: "node.dim", style: { opacity: 0.35, "z-index": 1 } },
        { selector: "node.active", style: { "z-index": 10 } },
        {
          selector: "node.hovered",
          style: {
            "border-width": 4,
            "border-color": color("--text-primary"),
            "overlay-color": color("--graph-reference"),
            "overlay-opacity": 0.15,
            "overlay-padding": 10,
            "z-index": 25,
          },
        },
        {
          selector: "node.elastic-root",
          style: {
            "overlay-color": color("--graph-reference"),
            "overlay-opacity": 0.2,
            "overlay-padding": 16,
            "z-index": 30,
          },
        },
        {
          selector: "edge.elastic-link",
          style: {
            width: 3,
            opacity: 1,
            "line-color": color("--graph-reference"),
            "target-arrow-color": color("--graph-reference"),
          },
        },
        { selector: "edge.dim", style: { opacity: 0.12 } },
        {
          selector: "node.chosen",
          style: {
            "z-index": 20,
            "border-width": 4,
            "border-color": color("--text-primary"),
            "border-style": "double",
            "overlay-color": color("--graph-reference"),
            "overlay-opacity": 0.12,
            "overlay-padding": 12,
          },
        },
        {
          selector: "edge.active",
          style: {
            width: 2.2,
            opacity: 0.9,
            "line-color": color("--graph-reference"),
            "target-arrow-color": color("--graph-reference"),
          },
        },
        {
          selector: "edge.knowledge-link",
          style: {
            width: 3,
            opacity: 1,
            "line-color": color("--graph-finding"),
            "target-arrow-color": color("--graph-finding"),
          },
        },
        {
          selector: "edge.knowledge-context",
          style: {
            width: 2.4,
            opacity: 0.9,
            "line-color": color("--graph-reference"),
            "target-arrow-color": color("--graph-reference"),
          },
        },
        {
          selector: "node.knowledge-reached",
          style: {
            "border-width": 4,
            "border-color": color("--graph-finding"),
          },
        },
        {
          selector: "node.knowledge-incoming",
          style: {
            "border-width": 4,
            "border-color": color("--graph-finding"),
            "font-size": 18,
            "font-weight": 600,
            "text-max-width": "180px",
            "z-index": 30,
          },
        },
      ],
    });
    if (reuseLayout && viewport.current) cy.viewport(viewport.current);
    instance.current = cy;
    if (!reuseLayout) {
      runningLayout.current = cy.layout(forceLayout(cy.width(), cy.height()));
      runningLayout.current.run();
    }
    cy.on("tap", "node, edge", (event) => onSelect(event.target.id()));
    cy.on("tap", (event) => {
      if (event.target === cy) {
        setHovered("");
        onSelect("");
      }
    });
    cy.on("mouseover", "node, edge", (event) => setHovered(event.target.id()));
    cy.on("mouseout", "node, edge", () => setHovered(""));
    cy.on("grab dragpan zoom", () => setHovered(""));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const detachElasticDrag = attachElasticDrag(cy, motion, () => {
      runningLayout.current?.stop();
      cy.stop(true, false);
      cy.elements().stop(true, false);
    });
    const updateMotion = () => {
      cy.nodes().style("transition-duration", motion.matches ? 0 : 180);
      if (motion.matches) {
        runningLayout.current?.stop();
        cy.stop(true, true);
        cy.elements().stop(true, true);
      }
    };
    motion.addEventListener("change", updateMotion);
    let resizeFrame = 0;
    const resize = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        cy.resize();
        if (!reuseLayout) cy.fit(undefined, 28);
      });
    });
    resize.observe(container.current);
    return () => {
      motion.removeEventListener("change", updateMotion);
      detachElasticDrag();
      runningLayout.current?.stop();
      runningLayout.current = null;
      resize.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      positions.current = new Map(
        cy
          .nodes()
          .map((node) => [
            node.id(),
            node.scratch("arrivalPosition") ?? { ...node.position() },
          ]),
      );
      viewport.current = { zoom: cy.zoom(), pan: { ...cy.pan() } };
      instance.current = null;
      cy.destroy();
    };
  }, [graph, connectivity, onSelect, preserveLayout]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.elements().removeClass(
      "dim active chosen hovered knowledge-link knowledge-context",
    );
    const target = cy.getElementById(hovered || selected);
    if (target.length) {
      let related = target.data("kind")
        ? target.closedNeighborhood()
        : cy.collection(target).union(cy.collection(target).connectedNodes());
      if (target.data("kind") === "Knowledge") {
        for (const link of knowledgeArrivalConnections(graph, target.id())) {
          const edge = cy.getElementById(link.edge.id);
          related = related.union(edge).union(cy.getElementById(link.to));
          edge.addClass(
            link.wave === "direct" ? "knowledge-link" : "knowledge-context",
          );
        }
      }
      cy.elements().difference(related).addClass("dim");
      related.addClass("active");
      if (target.id() === selected) target.addClass("chosen");
      if (hovered) target.addClass("hovered");
    }
  }, [selected, hovered, graph]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy || !arrival) return;
    const target = cy.getElementById(arrival.id);
    const halo = arrivalHalo.current;
    const overlay = arrivalPaths.current;
    if (!target.length || !halo || !overlay) return;
    const alreadyPlayed = lastArrival.current === arrivalKey;
    lastArrival.current = arrivalKey;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    halo.dataset.motion = overlay.dataset.motion = reduced
      ? "reduced"
      : "animated";
    const size = target.data("size") as number;
    const links = connections.map((link, index) => {
      const group = overlay.children[index] as SVGGElement;
      return {
        ...link,
        element: cy.getElementById(link.edge.id),
        destination: cy.getElementById(link.to),
        group,
        path: group.querySelector<SVGPathElement>(".knowledge-link-draw")!,
        track: group.querySelector<SVGPathElement>(".knowledge-link-track")!,
        particle: group.querySelector<SVGCircleElement>(
          ".knowledge-link-particle",
        )!,
        pulse: group.querySelector<SVGCircleElement>(".knowledge-link-pulse")!,
        reached: false,
      };
    });
    const locate = () => {
      const point = target.renderedPosition();
      halo.style.left = `${point.x}px`;
      halo.style.top = `${point.y}px`;
      const pan = cy.pan();
      const zoom = cy.zoom();
      const rendered = (point: { x: number; y: number }) =>
        `${point.x * zoom + pan.x},${point.y * zoom + pan.y}`;
      for (const link of links) {
        const edge = link.element;
        const reverse = link.from !== edge.source().id();
        const start = reverse ? edge.targetEndpoint() : edge.sourceEndpoint();
        const end = reverse ? edge.sourceEndpoint() : edge.targetEndpoint();
        const control = edge.controlPoints()?.[0];
        if (
          !start ||
          !end ||
          !Number.isFinite(start.x + start.y + end.x + end.y)
        )
          continue;
        const d = `M ${rendered(start)} ${control ? `Q ${rendered(control)}` : "L"} ${rendered(end)}`;
        link.path.setAttribute("d", d);
        link.track.setAttribute("d", d);
        const destination = link.destination.renderedPosition();
        link.pulse.setAttribute("cx", `${destination.x}`);
        link.pulse.setAttribute("cy", `${destination.y}`);
      }
    };
    cy.on("render pan zoom position", locate);
    locate();
    let frame = 0;
    const restore = () => {
      target.stop(true, false).removeClass("knowledge-incoming").removeStyle();
      for (const link of links) {
        link.element.removeStyle();
        link.destination.removeClass("knowledge-reached");
      }
    };
    if (reduced || alreadyPlayed) {
      cy.fit(undefined, 45);
      frame = window.requestAnimationFrame(() =>
        setProgress({ key: arrivalKey, phase: 3 }),
      );
    } else {
      target
        .addClass("knowledge-incoming")
        .style({ width: 4, height: 4, opacity: 0 });
      for (const link of links) link.element.style("opacity", 0);
      cy.animate(
        { fit: { eles: cy.elements(), padding: 55 } },
        { duration: 650, easing: "ease-out-cubic" },
      );
      target.animate(
        { style: { width: size * 1.45, height: size * 1.45, opacity: 1 } },
        {
          duration: 550,
          easing: "ease-out-cubic",
          complete: () =>
            target.animate(
              { style: { width: size, height: size } },
              { duration: 300 },
            ),
        },
      );
      const spreadStart =
        links.find((link) => link.wave === "library")?.delay ?? Infinity;
      const finish =
        Math.max(1000, ...links.map((link) => link.delay + link.duration)) +
        550;
      const started = performance.now();
      let lastPhase = -1;
      const draw = (now: number) => {
        const elapsed = now - started;
        const nextPhase =
          elapsed >= finish
            ? 3
            : elapsed >= spreadStart
              ? 2
              : elapsed >= 700
                ? 1
                : 0;
        if (nextPhase !== lastPhase) {
          lastPhase = nextPhase;
          setProgress({ key: arrivalKey, phase: nextPhase });
        }
        for (const link of links) {
          const progress = Math.max(
            0,
            Math.min(1, (elapsed - link.delay) / link.duration),
          );
          link.group.style.opacity = progress > 0 ? "1" : "0";
          link.path.style.strokeDashoffset = `${1 - progress}`;
          link.group.dataset.state =
            progress === 1 ? "connected" : progress > 0 ? "drawing" : "waiting";
          if (progress > 0 && progress < 1 && link.path.hasAttribute("d")) {
            const point = link.path.getPointAtLength(
              link.path.getTotalLength() * progress,
            );
            link.particle.setAttribute("cx", `${point.x}`);
            link.particle.setAttribute("cy", `${point.y}`);
            link.particle.style.opacity = "1";
          } else link.particle.style.opacity = "0";
          if (progress === 1) {
            if (!link.reached) {
              link.reached = true;
              link.element.removeStyle();
              link.destination.addClass("knowledge-reached");
            }
            const pulse = Math.min(
              1,
              (elapsed - link.delay - link.duration) / 650,
            );
            link.pulse.setAttribute(
              "r",
              `${link.destination.renderedWidth() / 2 + 6 + pulse * 30}`,
            );
            link.pulse.style.opacity = `${1 - pulse}`;
          }
        }
        if (elapsed < finish) frame = window.requestAnimationFrame(draw);
        else restore();
      };
      frame = window.requestAnimationFrame(draw);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      cy.off("render pan zoom position", locate);
      restore();
      cy.stop();
    };
  }, [arrival, arrivalKey, graph, connections]);
  const zoom = (factor: number) => {
    const cy = instance.current;
    if (cy)
      moveViewport(cy, {
        zoom: {
          level: Math.max(
            cy.minZoom(),
            Math.min(cy.maxZoom(), cy.zoom() * factor),
          ),
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
        },
      });
  };
  const previewNode = graph.nodes.find(
    (node) => node.id === (hovered || selected),
  );
  const previewEdge = graph.edges.find(
    (edge) => edge.id === (hovered || selected),
  );
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
              if (cy && target?.length)
                moveViewport(cy, {
                  fit: { eles: target.closedNeighborhood(), padding: 65 },
                });
            }}
            disabled={!selected}
          >
            <Crosshair aria-hidden="true" /> Focus
          </button>
          <button
            className="secondary"
            onClick={() => {
              setHovered("");
              onSelect("");
              const cy = instance.current;
              if (cy)
                moveViewport(cy, { fit: { eles: cy.elements(), padding: 42 } });
            }}
          >
            <ArrowsOut aria-hidden="true" /> Full graph
          </button>
          <button
            className="secondary"
            aria-label="Rearrange graph"
            title="Rearrange graph"
            disabled={!graph.nodes.length || (!!arrival && phase < 3)}
            onClick={() => {
              const cy = instance.current;
              if (!cy) return;
              setHovered("");
              runningLayout.current?.stop();
              cy.stop(true, false);
              cy.elements().stop(true, false);
              runningLayout.current = cy.layout(
                forceLayout(cy.width(), cy.height()),
              );
              runningLayout.current.run();
            }}
          >
            <ArrowsClockwise aria-hidden="true" />
          </button>
        </div>
      </div>
      {preserveLayout && (
        <div
          className="knowledge-connection-story"
          data-phase={arrival ? phase : "idle"}
          aria-live="polite"
          aria-label="Connection animation"
        >
          <ol>
            {[
              "Finding saved",
              "Link existing knowledge",
              "Connect the wider graph",
            ].map((label, index) => (
              <li
                key={label}
                data-state={
                  !arrival || phase < index
                    ? "waiting"
                    : phase === index
                      ? "active"
                      : "complete"
                }
              >
                <span>{arrival && phase > index ? "✓" : `0${index + 1}`}</span>
                {label}
              </li>
            ))}
          </ol>
          <p>
            {!arrival
              ? "Save a finding to watch its connections form across the library."
              : phase === 0
                ? "A new finding enters the shared graph."
                : phase === 1
                  ? `Drawing ${directCount} connections to its source and matching knowledge…`
                  : phase === 2
                    ? `Following existing links to ${libraryCount} reference sections and past cases…`
                    : `${directCount} direct connections${libraryCount ? ` · ${libraryCount} existing library nodes reached` : ""}. Select a line to inspect the relationship.`}
          </p>
        </div>
      )}
      <div
        className="knowledge-graph-viewport"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setHovered("");
            onSelect("");
          }
        }}
      >
        <div
          ref={container}
          className="learning-graph-stage"
          data-hovering={!!hovered}
          role="img"
          aria-label={`Knowledge graph with ${graph.nodes.length} nodes. Use the node and relationship lists below for keyboard access.`}
        />
        {(previewNode || previewEdge) && (
          <div className="knowledge-graph-preview" aria-label="Graph preview">
            <strong>{previewNode?.label ?? previewEdge?.relation}</strong>
            <span>
              {previewNode
                ? `${previewNode.kind} · ${connectivity.get(previewNode.id)?.connections ?? 0} connections`
                : `${graph.nodes.find((node) => node.id === previewEdge?.source)?.label} → ${graph.nodes.find((node) => node.id === previewEdge?.target)?.label}`}
            </span>
          </div>
        )}
        {arrival && (
          <svg
            ref={arrivalPaths}
            key={`paths:${arrivalKey}`}
            className="knowledge-connection-overlay"
            data-phase={phase}
            aria-hidden="true"
          >
            {connections.map((link) => (
              <g
                key={link.edge.id}
                data-edge-id={link.edge.id}
                data-from={link.from}
                data-to={link.to}
                data-wave={link.wave}
                data-state="waiting"
              >
                <path className="knowledge-link-track" />
                <path className="knowledge-link-draw" pathLength="1" />
                <circle className="knowledge-link-particle" r="4" />
                <circle className="knowledge-link-pulse" r="0" />
              </g>
            ))}
          </svg>
        )}
        {arrival && (
          <div
            ref={arrivalHalo}
            key={`${arrival.id}:${arrival.sequence}`}
            className="knowledge-node-arrival"
            data-knowledge-id={arrival.id}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <span>NEW KNOWLEDGE</span>
          </div>
        )}
      </div>
      <div className="graph-legend" aria-label="Node type legend">
        {nodeTypes
          .filter((type) => graph.nodes.some((node) => node.kind === type.kind))
          .map((type) => (
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
          Size shows unique connections in this map; larger nodes connect more
          knowledge.
        </p>
        <p>
          <i className="legend-dashed" aria-hidden="true" /> Dashed: hypotheses
          · dotted: reference topic matches. Source status is shown in the
          inspector.
        </p>
      </div>
      <div
        className="graph-accessible-slot"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setHovered("");
            onSelect("");
          }
        }}
      >
        <details className="graph-accessible">
          <summary>Browse nodes and relationships with keyboard</summary>
          <h3>Nodes</h3>
          <ul>
            {graph.nodes.map((node) => (
              <li key={node.id}>
                <button
                  className="graph-list-button"
                  aria-pressed={node.id === selected}
                  title={`${connectivity.get(node.id)?.connections ?? 0} unique connections`}
                  data-connections={connectivity.get(node.id)?.connections ?? 0}
                  data-node-size={connectivity.get(node.id)?.size ?? 34}
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
                  data-edge-id={edge.id}
                  data-source={edge.source}
                  data-target={edge.target}
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
