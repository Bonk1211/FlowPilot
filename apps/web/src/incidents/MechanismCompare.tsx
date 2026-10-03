import { useId, useState } from "react";
import type { ProcedureStep } from "@flowpilot/contracts";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import { modelNodes, type ModelNodeId } from "../prototype/model";
import type { DiagnosticAssessment } from "./api";
import { StatusChip } from "./StatusChip";

type Hypothesis = DiagnosticAssessment["hypotheses"][number];

const label = (id: string) =>
  Object.hasOwn(modelNodes, id) ? modelNodes[id as ModelNodeId].label : id;

function stepFor(hypothesis: Hypothesis): ProcedureStep {
  const node = hypothesis.component_ids.find((id) =>
    Object.hasOwn(modelNodes, id),
  ) as ModelNodeId | undefined;
  return {
    step_id: `compare-${hypothesis.id}`,
    title: hypothesis.title,
    instruction: hypothesis.mechanism,
    caution:
      "Simulated schematic explanation only; no calibrated prediction or machine command.",
    model_node_id: node ?? "substrate_tray",
    camera_preset: "assembly_overview",
    highlight: node ? "active" : "none",
  };
}

function ComponentList({ ids }: { ids: string[] }) {
  return ids.length ? (
    <ul>
      {ids.map((id) => (
        <li key={id}>{label(id)}</li>
      ))}
    </ul>
  ) : (
    <p className="incident-muted">None</p>
  );
}

/**
 * Two hypotheses side by side as 2D schematics, with the components they share
 * and the evidence each still lacks. All content is read from the assessment.
 */
export function MechanismCompare({
  hypotheses,
  initialId,
}: {
  hypotheses: Hypothesis[];
  initialId: string | null;
}) {
  const left = useId();
  const right = useId();
  const [leftId, setLeftId] = useState(
    hypotheses.find((item) => item.id === initialId)?.id ?? hypotheses[0].id,
  );
  const [rightId, setRightId] = useState(
    (hypotheses.find((item) => item.id !== leftId) ?? hypotheses[1]).id,
  );
  const a = hypotheses.find((item) => item.id === leftId) ?? hypotheses[0];
  const b = hypotheses.find((item) => item.id === rightId) ?? hypotheses[1];
  const shared = a.component_ids.filter((id) => b.component_ids.includes(id));
  const onlyA = a.component_ids.filter((id) => !b.component_ids.includes(id));
  const onlyB = b.component_ids.filter((id) => !a.component_ids.includes(id));
  const columns = [
    { id: left, value: leftId, set: setLeftId, other: rightId, item: a },
    { id: right, value: rightId, set: setRightId, other: leftId, item: b },
  ];
  return (
    <div className="incident-compare">
      <div className="incident-compare-grid">
        {columns.map((column, index) => (
          <section
            key={column.id}
            className="incident-compare-column"
            aria-label={`Schematic ${index === 0 ? "A" : "B"}`}
          >
            <label htmlFor={column.id}>
              Mechanism {index === 0 ? "A" : "B"}
            </label>
            <select
              id={column.id}
              value={column.value}
              onChange={(event) => column.set(event.target.value)}
            >
              {hypotheses.map((hypothesis) => (
                <option
                  key={hypothesis.id}
                  value={hypothesis.id}
                  disabled={hypothesis.id === column.other}
                >
                  {hypothesis.title}
                </option>
              ))}
            </select>
            <StatusChip kind="inferred" detail="explanation" />
            <p>{column.item.mechanism}</p>
            <ProcedureDiagram
              step={stepFor(column.item)}
              highlightIds={column.item.component_ids}
            />
          </section>
        ))}
      </div>
      <table className="incident-compare-table">
        <caption>Components in each mechanism</caption>
        <thead>
          <tr>
            <th scope="col">Only in A</th>
            <th scope="col">Shared</th>
            <th scope="col">Only in B</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <ComponentList ids={onlyA} />
            </td>
            <td>
              <ComponentList ids={shared} />
            </td>
            <td>
              <ComponentList ids={onlyB} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="incident-compare-grid">
        {[a, b].map((item, index) => (
          <section
            key={item.id}
            aria-label={`What would help separate ${item.title}`}
          >
            <h4>
              {index === 0 ? "A" : "B"} · Still needed for {item.title}
            </h4>
            {item.missing_evidence.length ? (
              <ul>
                {item.missing_evidence.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            ) : (
              <p className="incident-muted">No missing evidence recorded.</p>
            )}
          </section>
        ))}
      </div>
      <p className="incident-caption">
        Simulated schematic comparison. It shows which parts each explanation
        involves, not which one is correct.
      </p>
    </div>
  );
}
