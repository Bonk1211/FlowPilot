import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ArrowRight, Flask, X } from "@phosphor-icons/react";
import type { Incident } from "@flowpilot/contracts";
import { incidentJson } from "./api";
import { InvestigationProgress } from "./InvestigationProgress";
import { responseStatement } from "./investigationResponses";
import {
  resolveInvestigationExperiment,
  type InvestigationExperiment,
} from "./investigationExperiment";
import "./ExperimentPreview.css";

export function ExperimentPreview({
  incident,
  experiment,
  onCancel,
  onReady,
}: {
  incident: Incident;
  experiment: InvestigationExperiment;
  onCancel: () => void;
  onReady: (incident: Incident, experiment: InvestigationExperiment) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [designing, setDesigning] = useState(false);
  const [error, setError] = useState("");
  const { check, answer, node } = experiment;
  const plan = check.mini_experiment;
  const complete = useEffectEvent(onReady);

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

  useEffect(() => {
    if (!designing) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    // Give the preparation transition time to read even on a fast connection.
    const transition = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 1800);
    });
    void Promise.all([
      incidentJson<Incident>(
        `/api/incidents/${encodeURIComponent(incident.id)}`,
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      ),
      transition,
    ])
      .then(([current]) => {
        if (controller.signal.aborted) return;
        const prepared = resolveInvestigationExperiment(
          current,
          check.id,
          answer.id,
        );
        if (!prepared || current.status === "closed" || current.escalated) {
          throw new Error(
            "This experiment is no longer current. Return to the investigation and choose an updated experiment.",
          );
        }
        complete(current, prepared);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The experiment could not be prepared. Please try again.",
        );
        setDesigning(false);
      });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [designing, incident.id, check.id, answer.id]);

  const hypotheses =
    incident.assessment?.hypotheses.filter((item) =>
      check.distinguishes.includes(item.id),
    ) ?? [];
  return (
    <dialog
      ref={dialog}
      className="experiment-preview"
      aria-labelledby="experiment-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
    >
      <header className="experiment-preview-heading">
        <div>
          <p className="eyebrow">
            <Flask aria-hidden="true" /> Investigation · mini DOE
          </p>
          <h2 id="experiment-preview-title" ref={heading} tabIndex={-1}>
            {designing ? "Experiment design" : "Experiment preview"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close experiment preview"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="experiment-preview-body">
        {designing ? (
          <>
            <InvestigationProgress incident={incident} mode="experiment" />
            <div className="experiment-preview-preparing">
              <strong>{check.title}</strong>
              <p>
                Preparing this comparison from your confirmed response and
                current investigation. Simulation will open when it is ready.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="experiment-preview-purpose">
              <h3>{check.title}</h3>
              <p>{check.purpose}</p>
              {!!hypotheses.length && (
                <div
                  className="experiment-preview-hypotheses"
                  aria-label="Possibilities to distinguish"
                >
                  {hypotheses.map((item) => (
                    <span key={item.id}>{item.title}</span>
                  ))}
                </div>
              )}
            </div>
            <details className="experiment-preview-source">
              <summary>
                From your response: {responseStatement(node, answer)}
              </summary>
              <p>{node.prompt}</p>
            </details>
            {plan ? (
              <>
                <div className="experiment-preview-factor">
                  <strong>Compare one factor</strong>
                  <p>{plan.factor}</p>
                </div>
                <div className="experiment-preview-comparison">
                  <article>
                    <span>A · Baseline</span>
                    <p>{plan.baseline}</p>
                  </article>
                  <article>
                    <span>B · Comparison</span>
                    <p>{plan.comparison}</p>
                  </article>
                </div>
                <dl className="experiment-preview-measures">
                  <div>
                    <dt>Hold constant</dt>
                    <dd>{plan.held_constant.join(" · ")}</dd>
                  </div>
                  <div>
                    <dt>Measure</dt>
                    <dd>{check.measured_response}</dd>
                  </div>
                  <div>
                    <dt>Repeat / verify</dt>
                    <dd>{plan.repeat_plan}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <dl className="experiment-preview-measures">
                <div>
                  <dt>Suggested test</dt>
                  <dd>{check.method}</dd>
                </div>
                <div>
                  <dt>Measure</dt>
                  <dd>{check.measured_response}</dd>
                </div>
              </dl>
            )}
            <p className="experiment-preview-next">
              Confirm to prepare the experiment, then explore the response in
              Simulation.
            </p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer className="experiment-preview-actions">
        <button type="button" onClick={onCancel}>
          {designing ? "Cancel preparation" : "Back to investigation"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={designing}
          onClick={() => {
            setError("");
            setDesigning(true);
          }}
        >
          {designing ? "Designing experiment…" : "Confirm & design experiment"}
          {!designing && <ArrowRight aria-hidden="true" />}
        </button>
      </footer>
    </dialog>
  );
}
