import type { ProcedureStep } from "@flowpilot/contracts";
import { modelNodes } from "./model";

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
          d="M165 58 H257 V365 M370 220 H330"
          fill="none"
          className="assembly-path"
          strokeWidth="3"
        />
        {Object.entries(modelNodes).map(([id, node]) => (
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
