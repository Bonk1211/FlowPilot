import type { ProcedureStep } from "@flowpilot/contracts";
import { modelNodes, activeModelNodes } from "./model";

export function ProcedureDiagram({ step }: { step: ProcedureStep }) {
  const current = modelNodes[step.model_node_id];
  return (
    <figure className="prototype-diagram">
      <figcaption>Illustrative model — not OEM-certified guidance</figcaption>
      <p>
        2D guide ·{" "}
        {current
          ? `Current part: ${current.label}`
          : "Diagram unavailable for this part; use the text instructions."}
      </p>
      <svg
        viewBox="0 0 535 445"
        role="img"
        aria-label={`Dispensing assembly. ${current ? `Highlighted part: ${current.label}` : "No highlighted part"}`}
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
            data-node-id={id}
            data-highlighted={
              id === step.model_node_id && step.highlight !== "none"
            }
          >
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx="6"
            />
            <text
              x={node.x + node.width / 2}
              y={node.y + node.height / 2 + 5}
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
