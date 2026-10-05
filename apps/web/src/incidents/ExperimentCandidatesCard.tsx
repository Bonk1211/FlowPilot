import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  Flask,
  Play,
  X,
} from "@phosphor-icons/react";
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
  onClose,
}: {
  item: Item;
  disabled: boolean;
  onRun: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    const modal = dialog.current;
    const trigger = document.activeElement;
    modal?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      modal?.close();
      if (trigger instanceof HTMLElement)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  const { hypothesis, check } = item;
  const brief = check.brief;
  return (
    <dialog
      ref={dialog}
      className="experiment-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (
          event.shiftKey
            ? document.activeElement === first ||
              document.activeElement === heading.current
            : document.activeElement === last
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <header className="experiment-dialog-heading">
        <div>
          <p className="eyebrow">
            <Flask aria-hidden="true" /> Experiment
          </p>
          <h2 id={id} ref={heading} tabIndex={-1}>
            {hypothesis.title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close experiment description"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="experiment-brief-body">
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
      </div>
      <footer className="experiment-dialog-actions">
        <StatusChip kind="simulated" detail="no machine test" />
        <button
          type="button"
          className="primary experiment-brief-run"
          disabled={disabled}
          aria-label={`Run this experiment: ${hypothesis.title}`}
          onClick={() => {
            onClose();
            onRun();
          }}
        >
          <Play aria-hidden="true" />
          Run this experiment
        </button>
      </footer>
    </dialog>
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
  focus = null,
}: {
  offer: InvestigationExperiments;
  disabled: boolean;
  onRun: (ids?: MechanismId[]) => void;
  focus?: { id: string; n: number } | null;
}) {
  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  if (focus && focus.n !== seen) {
    setSeen(focus.n);
    setSelected(focus.id);
  }
  const selectedItem = offer.items.find(
    (item) => item.hypothesis.id === selected,
  );
  const count = offer.items.length;
  return (
    <>
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
            {count} {count === 1 ? "experiment" : "experiments"} ready
          </span>
          {open ? (
            <CaretDown aria-hidden="true" />
          ) : (
            <CaretUp aria-hidden="true" />
          )}
        </button>
        <div id="experiment-offer-body" hidden={!open}>
          <p className="experiment-offer-lead">
            Compare{" "}
            {count === 1
              ? "this explanation"
              : `${count} possible explanations`}{" "}
            with the recorded pattern.
          </p>
          <ol className="experiment-offer-list">
            {offer.items.map(({ hypothesis, check }) => (
              <li key={hypothesis.id} className="experiment-brief">
                <button
                  type="button"
                  className="experiment-brief-toggle"
                  aria-haspopup="dialog"
                  onClick={() => setSelected(hypothesis.id)}
                >
                  <span className="experiment-brief-heading">
                    <strong>{hypothesis.title}</strong>
                    <span>
                      {check.brief
                        ? `Tests ${signatureWords[check.brief.prediction.signature]}`
                        : (check.mini_experiment?.factor ?? check.title)}
                    </span>
                  </span>
                  {check.brief && (
                    <SignatureSpark prediction={check.brief.prediction} />
                  )}
                  <ArrowSquareOut aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <StatusChip kind="simulated" detail="no machine test" />
          <button
            className="primary experiment-offer-run"
            disabled={disabled}
            onClick={() => onRun()}
          >
            <Play aria-hidden="true" weight="fill" />
            {count === 1
              ? "Run this experiment"
              : count === 2
                ? "Run both experiments"
                : `Run all ${count === 3 ? "three" : count} experiments`}
          </button>
          <p className="experiment-offer-note">
            Simulated results · demo engineer · not recorded evidence.
          </p>
        </div>
      </aside>
      {selectedItem && (
        <ExperimentBrief
          key={selectedItem.hypothesis.id}
          item={selectedItem}
          disabled={disabled}
          onClose={() => setSelected(null)}
          onRun={() => onRun([selectedItem.hypothesis.id as MechanismId])}
        />
      )}
    </>
  );
}
