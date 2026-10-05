import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import type { IncidentObservation } from "@flowpilot/contracts";
import { ExperimentReadingList } from "./ExperimentNotebook";
import { mechanismTitles } from "./experimentDefaults";
import "./FindingPanel.css";

export function ExperimentRecordPanel({
  observation,
  onClose,
}: {
  observation: IncidentObservation;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    const trigger = document.activeElement;
    modal?.showModal();
    heading.current?.focus();
    return () => {
      modal?.close();
      if (trigger instanceof HTMLElement)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  if (!observation.experiment) return null;
  return (
    <dialog
      ref={dialog}
      className="finding-panel experiment-record-panel"
      aria-labelledby="experiment-record-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="finding-panel-heading">
        <div>
          <p className="eyebrow">Technician experiment record</p>
          <h2 id="experiment-record-title" ref={heading} tabIndex={-1}>
            {mechanismTitles[observation.experiment.hypothesis_id]}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close experiment record"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="finding-panel-body">
        <p>
          {observation.synthetic
            ? "Practice / synthetic entries"
            : "Observed / measured on equipment"}{" "}
          · {observation.author ?? "Technician"} ·{" "}
          {new Date(observation.recorded_at).toLocaleString()}
        </p>
        <p>
          All {observation.experiment.steps.length} step records are saved as
          investigation observations and included in the next assessment.
        </p>
        <ExperimentReadingList observation={observation} />
      </div>
      <footer className="finding-panel-actions">
        <button type="button" className="primary" onClick={onClose}>
          Continue investigation
        </button>
      </footer>
    </dialog>
  );
}
