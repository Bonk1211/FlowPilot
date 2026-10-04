import { useState } from "react";
import { CaretDown, CaretUp, Flask, Play } from "@phosphor-icons/react";
import type { InvestigationExperiments } from "./investigationExperiment";
import { StatusChip } from "./StatusChip";
import "./ExperimentCandidatesCard.css";

/**
 * Offered once the answers leave several explanations open: one simulated
 * experiment per explanation, run together with a single press.
 */
export function ExperimentCandidatesCard({
  offer,
  disabled,
  onRun,
}: {
  offer: InvestigationExperiments;
  disabled: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <aside
      className="experiment-offer"
      aria-label="Suggested experiments"
      data-open={open}
    >
      <button
        className="experiment-offer-toggle"
        aria-expanded={open}
        aria-controls="experiment-offer-body"
        onClick={() => setOpen(!open)}
      >
        <span>
          <Flask aria-hidden="true" />
          {offer.items.length} experiments ready
        </span>
        {open ? (
          <CaretDown aria-hidden="true" />
        ) : (
          <CaretUp aria-hidden="true" />
        )}
      </button>
      <div id="experiment-offer-body" hidden={!open}>
        <p className="experiment-offer-lead">
          Your answers leave these explanations open. Compare them with one
          simulated experiment each.
        </p>
        <ol className="experiment-offer-list">
          {offer.items.map(({ hypothesis, check }) => (
            <li key={hypothesis.id}>
              <strong>{hypothesis.title}</strong>
              <span>{check.mini_experiment?.factor ?? check.title}</span>
            </li>
          ))}
        </ol>
        <StatusChip kind="simulated" detail="no machine test" />
        <button
          className="primary experiment-offer-run"
          disabled={disabled}
          onClick={onRun}
        >
          <Play aria-hidden="true" weight="fill" />
          Run all three experiments
        </button>
        <p className="experiment-offer-note">
          Runs as the demo engineer. Results are simulated and are not recorded
          as evidence.
        </p>
      </div>
    </aside>
  );
}
