import type { ProcedureStep } from "@flowpilot/contracts";
import { modelNodes, activeModelNodes } from "./model";

function ComponentSymbol({ id }: { id: string }) {
  switch (id) {
    case "bfs_bottle":
      return (
        <>
          <path
            className="node-shape"
            d="M18 18h94v40c0 13-10 23-23 23H41C28 81 18 71 18 58Z"
          />
          <path
            className="node-detail"
            d="M48 18V8h34v10M100 15l12-10m-3 3 11 11"
          />
          <circle className="node-detail" cx="118" cy="8" r="9" />
        </>
      );
    case "feed_tube":
      return (
        <path
          className="node-shape tube-symbol"
          d="M4 28C27 1 55 49 78 19s37-7 43 6"
        />
      );
    case "fluid_qd":
      return (
        <>
          <path
            className="node-shape"
            d="M20 10h34l10 8v24l-10 8H20l-10-9V19Z"
          />
          <path className="node-detail" d="M64 20h43v20H64M30 10v40" />
        </>
      );
    case "pickup_tube":
      return (
        <path
          className="node-shape tube-symbol"
          d="M28 2v26c0 15 12 27 27 27h55"
        />
      );
    case "bfs_air":
    case "coaxial_air":
    case "valve_air":
      return (
        <>
          <path className="node-shape tube-symbol" d="M4 20h96" />
          <path className="node-detail" d="m89 11 12 9-12 9" />
        </>
      );
    case "dj2200_valve":
      return (
        <>
          <path className="node-shape" d="M16 8h90v45H16zM43 53h38v15H43z" />
          <path
            className="node-detail"
            d="M27 18h68M28 43h68M6 22h10m90 8h14"
          />
          <circle className="node-detail" cx="34" cy="30" r="5" />
          <circle className="node-detail" cx="88" cy="30" r="5" />
        </>
      );
    case "air_cap":
      return (
        <>
          <ellipse className="node-shape" cx="50" cy="20" rx="42" ry="15" />
          <circle className="node-detail" cx="50" cy="20" r="7" />
        </>
      );
    case "nozzle":
      return <path className="node-shape" d="M20 3h45l-9 13-8 29H37l-8-29Z" />;
    case "vision_camera":
      return (
        <>
          <path className="node-shape" d="M14 8h86v48H14z" />
          <circle className="node-detail" cx="40" cy="32" r="17" />
          <circle className="node-detail" cx="40" cy="32" r="8" />
          <path className="node-detail" d="M100 22h17v20h-17M86 8V1" />
        </>
      );
    case "substrate_tray":
      return (
        <>
          <path className="node-shape" d="M8 8h299l-18 30H26Z" />
          <path className="node-detail" d="M35 16h245M70 8v30m175-30v30" />
        </>
      );
    default:
      return <circle className="node-shape" cx="20" cy="20" r="16" />;
  }
}

export function ProcedureDiagram({
  step,
  highlightIds,
}: {
  step: ProcedureStep;
  /** Parts to highlight; defaults to the step's own part. */
  highlightIds?: readonly string[];
}) {
  const current = modelNodes[step.model_node_id];
  const highlighted = highlightIds ?? [step.model_node_id];
  const highlightedLabels = highlighted
    .map((id) => modelNodes[id as keyof typeof modelNodes]?.label)
    .filter(Boolean)
    .join(", ");
  return (
    <figure className="prototype-diagram">
      <figcaption>
        Generic illustrative fluid-dispenser model — not the exact installed
        machine and not OEM-certified guidance
      </figcaption>
      <p>
        2D guide ·{" "}
        {highlightIds && highlightIds.length > 1
          ? `Highlighted parts: ${highlightedLabels}`
          : current
            ? `Current part: ${current.label}`
            : "Diagram unavailable for this part; use the text instructions."}
      </p>
      <svg
        viewBox="0 0 535 445"
        role="img"
        aria-label={`Dispensing assembly. ${highlightedLabels ? `Highlighted ${highlighted.length > 1 ? "parts" : "part"}: ${highlightedLabels}` : "No highlighted part"}`}
      >
        <path
          d="M100 90 V148 H175 V58 H195 M257 78 V290"
          fill="none"
          className="assembly-path"
          strokeWidth="3"
        />
        <path
          d="M435 118 H515 V305 H440 M340 305 H300"
          fill="none"
          stroke="#175b70"
          strokeWidth="3"
          strokeDasharray="8 4"
        />
        <path
          d="M365 150 H345 V210 H320"
          fill="none"
          stroke="#8b5a19"
          strokeWidth="3"
          strokeDasharray="2 4"
        />
        <path
          d="M35 200 H15 V58 H35"
          fill="none"
          stroke="#78549c"
          strokeWidth="3"
        />
        <path
          d="M245 328 L220 365 M270 328 L295 365 M257 328 V365"
          fill="none"
          stroke="#94b8c4"
          strokeWidth="2"
          strokeDasharray="3 4"
        />
        {Object.entries(activeModelNodes).map(([id, node]) => (
          <g
            key={id}
            transform={`translate(${node.x} ${node.y})`}
            data-node-id={id}
            data-highlighted={
              highlighted.includes(id) && step.highlight !== "none"
            }
          >
            <ComponentSymbol id={id} />
            <text
              x={node.width / 2}
              y={node.height / 2 + 5}
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
