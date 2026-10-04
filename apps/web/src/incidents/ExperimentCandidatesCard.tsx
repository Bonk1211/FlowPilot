import { useId, useState } from "react";
import { CaretDown, CaretUp, Flask, Play } from "@phosphor-icons/react";
import type { MechanismId } from "./experimentDefaults";
import type { InvestigationExperiments } from "./investigationExperiment";
import { signatureWords } from "./mechanismCopy";
import { SignatureSpark } from "./SignatureSpark";
import { StatusChip } from "./StatusChip";
import "./ExperimentCandidatesCard.css";

type Item = InvestigationExperiments["items"][number];

function ExperimentBrief({
  item,
  disabled,
  onRun,
}: {
  item: Item;
  disabled: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { hypothesis, check } = item;
  const brief = check.brief;
  const prediction = brief?.prediction;
  return (
    <li className="experiment-brief" data-open={open}>
      <button
        type="button"
        className="experiment-brief-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="experiment-brief-heading">
          <strong>{hypothesis.title}</strong>
          <span>
            {prediction
              ? `Tests whether it would give ${signatureWords[prediction.signature]}`
              : (check.mini_experiment?.factor ?? check.title)}
          </span>
        </span>
        {prediction && <SignatureSpark prediction={prediction} />}
        {open ? (
          <CaretUp aria-hidden="true" />
        ) : (
          <CaretDown aria-hidden="true" />
        )}
      </button>
      <div id={id} className="experiment-brief-body" hidden={!open}>
        {brief ? (
          <dl>
            <div>
              <dt>Why run it</dt>
              <dd>
                <ul>
                  {brief.why.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <p className="experiment-brief-facts-title">
                  What the records say about the shape
                </p>
                {brief.shape_facts.length ? (
                  <ul className="experiment-brief-facts">
                    {brief.shape_facts.map((fact) => (
                      <li key={`${fact.evidence_id}-${fact.description}`}>
                        {fact.description}
                        {fact.shape === "not_modelled" &&
                          " The model does not represent this kind of change."}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No record or confirmed answer describes the shape yet.</p>
                )}
              </dd>
            </div>
            <div>
              <dt>What it tests</dt>
              <dd>{brief.verifies}</dd>
            </div>
            <div>
              <dt>What we predict</dt>
              <dd>
                <SignatureSpark prediction={brief.prediction} size="large" />
                <p className="experiment-brief-legend">
                  <span data-series="tested">
                    Severity {brief.prediction.tested_severity.toFixed(2)}
                  </span>
                  <span data-series="control">
                    Control {brief.prediction.control_severity.toFixed(2)}
                  </span>
                  <span>Mass along the sequence</span>
                </p>
                <p>
                  <strong>If it holds:</strong> {brief.prediction.if_holds}
                </p>
                <p>
                  <strong>If it does not:</strong> {brief.prediction.if_not}
                </p>
                <p className="experiment-brief-basis">
                  {brief.prediction.basis}
                </p>
              </dd>
            </div>
            <div>
              <dt>How to read the result</dt>
              <dd>
                <ul>
                  {brief.reading.map((rule) => (
                    <li key={rule.outcome}>
                      <strong>{rule.label}:</strong> {rule.criterion}
                    </li>
                  ))}
                </ul>
                <p className="experiment-brief-basis">{brief.limits[0]}</p>
              </dd>
            </div>
          </dl>
        ) : (
          <p>{check.purpose}</p>
        )}
        <button
          type="button"
          className="experiment-brief-run"
          disabled={disabled}
          aria-label={`Run this experiment: ${hypothesis.title}`}
          onClick={onRun}
        >
          <Play aria-hidden="true" />
          Run this experiment
        </button>
      </div>
    </li>
  );
}

/**
 * Offered once the answers leave several explanations open: one simulated
 * experiment per explanation, each saying why it is worth running, what it
 * tests, what the model predicts and how to read the result.
 */
export function ExperimentCandidatesCard({
  offer,
  disabled,
  onRun,
}: {
  offer: InvestigationExperiments;
  disabled: boolean;
  onRun: (ids?: MechanismId[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const count = offer.items.length;
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
          {count} experiments ready
        </span>
        {open ? (
          <CaretDown aria-hidden="true" />
        ) : (
          <CaretUp aria-hidden="true" />
        )}
      </button>
      <div id="experiment-offer-body" hidden={!open}>
        <p className="experiment-offer-lead">
          Your answers leave {count} explanations open. Each experiment
          simulates one of them, so you can compare the shape it predicts with
          what was recorded. Open one to see why.
        </p>
        <ol className="experiment-offer-list">
          {offer.items.map((item) => (
            <ExperimentBrief
              key={item.hypothesis.id}
              item={item}
              disabled={disabled}
              onRun={() => onRun([item.hypothesis.id as MechanismId])}
            />
          ))}
        </ol>
        <StatusChip kind="simulated" detail="no machine test" />
        <button
          className="primary experiment-offer-run"
          disabled={disabled}
          onClick={() => onRun()}
        >
          <Play aria-hidden="true" weight="fill" />
          {count === 2
            ? "Run both experiments"
            : `Run all ${count === 3 ? "three" : count} experiments`}
        </button>
        <p className="experiment-offer-note">
          Runs as the demo engineer. Results are simulated and are not recorded
          as evidence.
        </p>
      </div>
    </aside>
  );
}
