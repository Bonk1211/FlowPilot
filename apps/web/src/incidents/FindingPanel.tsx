import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CheckCircle, Flask, MinusCircle, X } from "@phosphor-icons/react";
import type { Incident } from "@flowpilot/contracts";
import type { ReturnedFinding } from "./experimentFindings";
import { handBack } from "./experimentRuns";
import { mechanismTitles, type MechanismId } from "./experimentDefaults";
import { StatusChip } from "./StatusChip";
import "./FindingPanel.css";

/**
 * A simulated finding the engineer brought back to the investigation: what
 * was simulated, how it was judged against the records and the manual check
 * it suggests. It is not evidence and records nothing by itself.
 */
export function FindingPanel({
  incident,
  item,
  simulationHref,
  onOpenLink,
  onClose,
  onChanged,
}: {
  incident: Incident;
  item: ReturnedFinding;
  simulationHref: string;
  onOpenLink: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { finding, plan, outdated } = item;
  const check = incident.assessment?.checks.find(
    (entry) => entry.id === finding.suggested_check_id,
  );
  const title = mechanismTitles[finding.hypothesis_id as MechanismId];

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

  return (
    <dialog
      ref={dialog}
      className="finding-panel"
      aria-labelledby="finding-panel-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="finding-panel-heading">
        <div>
          <p className="eyebrow">
            <Flask aria-hidden="true" /> Simulated finding
          </p>
          <h2 id="finding-panel-title" ref={heading} tabIndex={-1}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close simulated finding"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="finding-panel-body">
        <div className="finding-panel-chips">
          <StatusChip kind="simulated" detail="not evidence" />
          <span className="finding-outcome" data-outcome={finding.outcome}>
            {finding.label}
          </span>
        </div>
        {outdated && (
          <p className="finding-outdated" role="note">
            Outdated: the evidence changed after this simulation. Run the
            experiment again before relying on it.
          </p>
        )}
        <p>{finding.summary}</p>
        <section aria-labelledby="finding-criteria">
          <h3 id="finding-criteria">How it was judged</h3>
          <ul className="finding-criteria">
            {finding.criteria.map((criterion) => (
              <li key={criterion.id} data-met={criterion.met}>
                {criterion.met ? (
                  <CheckCircle aria-hidden="true" weight="fill" />
                ) : (
                  <MinusCircle aria-hidden="true" />
                )}
                <span>
                  <strong>
                    {criterion.met ? "Met" : "Not met"}: {criterion.label}
                  </strong>
                  <small>{criterion.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="finding-next"
          aria-labelledby="finding-next-heading"
        >
          <h3 id="finding-next-heading">Suggested next manual check</h3>
          {check ? (
            <>
              <p>
                <strong>{check.title}</strong>
              </p>
              <p>{check.purpose}</p>
              <p className="incident-caption">
                Method: {check.method} Sources: {check.source_refs.join(", ")}.{" "}
                {check.blocked_reason}
              </p>
            </>
          ) : (
            <p>The suggested check is not in the current assessment.</p>
          )}
          <p className="incident-caption">
            You decide whether to do it. Record what the check finds from the
            records, not from this simulation, in the check form of the ordered
            text view.
          </p>
        </section>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer className="finding-panel-actions">
        <a href={simulationHref} onClick={onOpenLink}>
          Open the simulation
        </a>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await handBack(
                incident.id,
                plan,
                finding.hypothesis_id,
                "set_aside",
              );
              onChanged();
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "The finding could not be set aside.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          Set this finding aside
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}
