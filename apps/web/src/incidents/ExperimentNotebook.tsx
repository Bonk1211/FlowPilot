import { useId, useRef, useState } from "react";
import type { Incident, IncidentObservation } from "@flowpilot/contracts";
import { incidentJson, type IncidentCommand } from "./api";
import type { PlaybackStep } from "./experimentPlayback";
import { mechanismTitles, type MechanismId } from "./experimentDefaults";
import "./ExperimentNotebook.css";

type Command = Extract<IncidentCommand, { action: "record_experiment" }>;
type Reading = Command["readings"]["steps"][number];
type DraftReading = {
  quantity: string;
  value: string;
  unit: string;
  condition: string;
  notes: string;
};
type Draft = {
  id: string;
  synthetic: boolean;
  demoFilled?: boolean;
  steps: Record<string, DraftReading>;
};
const empty: DraftReading = {
  quantity: "",
  value: "",
  unit: "",
  condition: "",
  notes: "",
};
const conditions = {
  good: "Good condition / intact",
  damaged: "Damaged / broken",
  abnormal: "Abnormal",
  uncertain: "Unable to determine",
  not_applicable: "Not applicable",
};
const stepTitles: Record<Reading["step_id"], string> = {
  establish: "Starting conditions",
  follow: "Liquid path",
  apart: "Parts and seals",
  mechanism: "At the mechanism",
  valve: "Valve response",
  nozzle: "Nozzle and spray",
  substrate: "Deposit measurements",
  readout: "Experiment summary",
};
const prompts: Record<string, string> = {
  establish:
    "Record the starting conditions, sample identity or baseline reading.",
  follow:
    "Record what you observed along the liquid path, such as leaks, bubbles or interrupted flow.",
  apart:
    "Record the condition of inspected parts and seals. For example: O-ring intact, worn or broken.",
  mechanism:
    "Record the physical value you measured or the condition you observed at this component.",
  valve: "Record the observed valve response, leakage or a measured reading.",
  nozzle:
    "Record the observed spray pattern, nozzle condition or measured spray width.",
  substrate:
    "Record measured mass or coverage, or describe the deposit you observed.",
  readout:
    "Summarize what changed, what stayed the same and any uncertainty in your experiment.",
};

/** Example equipment readings, loaded only when the technician chooses demo fill. */
function demoReadings(mechanism: MechanismId): Record<string, DraftReading> {
  const measured = (
    quantity: string,
    value: string,
    unit: string,
    notes: string,
  ): DraftReading => ({
    ...empty,
    quantity,
    value,
    unit,
    notes: `Demo: ${notes}`,
  });
  return {
    establish: measured(
      "Supply pressure",
      "2.4",
      "bar",
      "Baseline sample DEMO-01.",
    ),
    follow: measured(
      "Feed flow",
      "8.2",
      "mL/min",
      "Flow observed through the clear feed tube.",
    ),
    apart: {
      ...empty,
      condition: mechanism === "material_condition" ? "good" : "damaged",
      notes:
        mechanism === "material_condition"
          ? "Demo: lid O-ring intact; no visible cracks."
          : "Demo: seal split on one side; fluid visible around the seal.",
    },
    mechanism:
      mechanism === "material_condition"
        ? measured(
            "Material temperature",
            "27.5",
            "°C",
            "Temperature recorded at the flux bottle.",
          )
        : mechanism === "unstable_delivery"
          ? measured(
              "Supply pressure",
              "1.8",
              "bar",
              "Pressure fluctuated between 1.8 and 2.4 bar.",
            )
          : measured(
              "Pressure drop",
              "0.6",
              "bar",
              "Difference recorded across the fluid QD.",
            ),
    valve: measured(
      "Valve response time",
      "120",
      "ms",
      "Valve response observed during the check.",
    ),
    nozzle: measured("Spray width", "8.5", "mm", "Spray narrower on one side."),
    substrate: measured(
      "Deposit mass",
      "0.42",
      "g",
      "Mass recorded for sample DEMO-01.",
    ),
    readout: {
      ...measured(
        "Final deposit mass",
        "0.42",
        "g",
        "reduced flow and an uneven deposit were recorded. Compare the component observations and measurements in the investigation; cause remains open.",
      ),
      condition: "abnormal",
    },
  };
}

function readingError(reading: DraftReading) {
  const measured = reading.value.trim() !== "";
  if (measured && !Number.isFinite(Number(reading.value)))
    return "Enter a finite measured value.";
  if (measured && (!reading.quantity.trim() || !reading.unit.trim()))
    return "Add the measured quantity and unit for this value.";
  if (!measured && (reading.quantity.trim() || reading.unit.trim()))
    return "Enter the measured value, or clear the quantity and unit.";
  if (!measured && !reading.condition && !reading.notes.trim())
    return "Record a measurement, condition or observation for this step.";
  if (reading.condition === "not_applicable" && !reading.notes.trim())
    return "Explain why this step is not applicable.";
  return "";
}

export function ExperimentReadingList({
  observation,
}: {
  observation: IncidentObservation;
}) {
  return (
    <ol className="experiment-reading-list">
      {observation.experiment?.steps.map((step) => (
        <li key={step.step_id}>
          <strong>{stepTitles[step.step_id]}</strong>
          {step.value != null && (
            <p>
              {step.quantity}: {step.value} {step.unit}
            </p>
          )}
          {step.condition && <p>{conditions[step.condition]}</p>}
          {step.notes && (
            <p className="experiment-reading-notes">{step.notes}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Drafts are local to this incident, plan and mechanism; completion saves one atomic record. */
export function ExperimentNotebook({
  incident,
  planId,
  hypothesisId,
  steps,
  index,
  onGo,
  onComplete,
}: {
  incident: Incident;
  planId: string;
  hypothesisId: MechanismId;
  steps: PlaybackStep[];
  index: number;
  onGo: (index: number) => void;
  onComplete: (observationId: string) => Promise<void>;
}) {
  const storageKey = `flowpilot.experiment-readings:${incident.id}:${planId}:${hypothesisId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (stored?.id && stored.steps && typeof stored.synthetic === "boolean")
        return stored;
    } catch {
      /* A fresh draft remains usable when browser storage is unavailable. */
    }
    return { id: `OBS-${crypto.randomUUID()}`, synthetic: false, steps: {} };
  });
  const [storageError, setStorageError] = useState("");
  const [beforeDemo, setBeforeDemo] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const prefix = useId();
  const step = steps[index];
  const reading = draft.steps[step.id] ?? empty;
  const recorded = [...(incident.observations ?? [])]
    .reverse()
    .find(
      (item) =>
        item.experiment?.plan_id === planId &&
        item.experiment.hypothesis_id === hypothesisId,
    );
  const count = steps.filter(
    (item) => !readingError(draft.steps[item.id] ?? empty),
  ).length;
  const currentError = attempted ? readingError(reading) : "";
  function update(next: Draft) {
    setDraft(next);
    setError("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your draft. Keep this page open until you finish.",
      );
    }
  }
  function field(name: keyof DraftReading, value: string) {
    update({
      ...draft,
      steps: { ...draft.steps, [step.id]: { ...reading, [name]: value } },
    });
  }
  async function complete() {
    if (savingRef.current) return;
    setAttempted(true);
    const missing = steps.findIndex((item) =>
      readingError(draft.steps[item.id] ?? empty),
    );
    if (missing !== -1) {
      onGo(missing);
      setError(
        `Step ${missing + 1}: ${readingError(draft.steps[steps[missing].id] ?? empty)}`,
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      // Refresh the revision without overwriting the technician's local draft.
      const latest = await incidentJson<Incident>(
        `/api/incidents/${encodeURIComponent(incident.id)}`,
      );
      const command: Command = {
        action: "record_experiment",
        observation_id: draft.id,
        synthetic: draft.synthetic || !!draft.demoFilled,
        readings: {
          plan_id: planId,
          hypothesis_id: hypothesisId,
          steps: steps.map((item) => {
            const entry = draft.steps[item.id];
            return {
              step_id: item.id as Reading["step_id"],
              quantity: entry.quantity.trim(),
              value: entry.value.trim() === "" ? null : Number(entry.value),
              unit: entry.unit.trim(),
              condition: (entry.condition || null) as Reading["condition"],
              notes: entry.notes.trim(),
            };
          }),
        },
      };
      await incidentJson<Incident>(
        `/api/incidents/${encodeURIComponent(incident.id)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...command, revision: latest.revision }),
        },
      );
      await onComplete(draft.id);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* The durable record is saved. */
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Readings could not be saved. Your draft is retained; try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  if (recorded)
    return (
      <section
        className="experiment-notebook"
        aria-label="Technician experiment record"
      >
        <h5>Experiment recorded</h5>
        <p>All {steps.length} steps are saved in the investigation.</p>
        <details>
          <summary>Review recorded readings</summary>
          <ExperimentReadingList observation={recorded} />
        </details>
        <button type="button" onClick={() => void onComplete(recorded.id)}>
          Open experiment record in investigation
        </button>
      </section>
    );
  return (
    <section
      className="experiment-notebook"
      aria-label="Technician experiment record"
    >
      <div className="experiment-notebook-heading">
        <h5>Record this step</h5>
        <span role="status">
          {count} of {steps.length} recorded
        </span>
      </div>
      <div className="experiment-demo-actions">
        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={() => {
            setBeforeDemo(draft);
            update({
              ...draft,
              synthetic: true,
              demoFilled: true,
              steps: demoReadings(hypothesisId),
            });
          }}
        >
          Fill demo values
        </button>
        {beforeDemo && (
          <button
            type="button"
            className="link-button"
            disabled={saving}
            onClick={() => {
              update(beforeDemo);
              setBeforeDemo(null);
            }}
          >
            Undo demo fill
          </button>
        )}
      </div>
      {draft.demoFilled && (
        <p className="experiment-demo-status" role="status">
          Demo presets loaded for all {steps.length} steps · synthetic entries.
        </p>
      )}
      <p id={`${prefix}-hint`}>{prompts[step.id]}</p>
      <fieldset disabled={saving} aria-describedby={`${prefix}-hint`}>
        <legend className="sr-only">Step {index + 1} readings</legend>
        <label htmlFor={`${prefix}-quantity`}>
          Measured quantity <small>(optional)</small>
        </label>
        <input
          id={`${prefix}-quantity`}
          value={reading.quantity}
          maxLength={100}
          placeholder="e.g. Supply pressure"
          onChange={(event) => field("quantity", event.target.value)}
        />
        <div className="experiment-measurement-fields">
          <label>
            Measured value
            <input
              type="number"
              step="any"
              value={reading.value}
              onChange={(event) => field("value", event.target.value)}
            />
          </label>
          <label>
            Unit
            <input
              value={reading.unit}
              maxLength={40}
              placeholder="e.g. bar, g, mm"
              onChange={(event) => field("unit", event.target.value)}
            />
          </label>
        </div>
        <label htmlFor={`${prefix}-condition`}>
          {step.id === "apart"
            ? "Part / O-ring condition"
            : "Observed condition"}
        </label>
        <select
          id={`${prefix}-condition`}
          value={reading.condition}
          onChange={(event) => field("condition", event.target.value)}
        >
          <option value="">Choose if applicable</option>
          {Object.entries(conditions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor={`${prefix}-notes`}>Observations / notes</label>
        <textarea
          id={`${prefix}-notes`}
          rows={3}
          maxLength={2000}
          value={reading.notes}
          placeholder={
            step.id === "apart"
              ? "e.g. O-ring split on one side; fluid visible around the seal."
              : "What did you see? Include conditions or uncertainty."
          }
          onChange={(event) => field("notes", event.target.value)}
          aria-invalid={!!currentError}
          aria-describedby={currentError ? `${prefix}-error` : undefined}
        />
        {currentError && (
          <p id={`${prefix}-error`} className="experiment-record-error">
            {currentError}
          </p>
        )}
      </fieldset>
      <p className="experiment-draft-status">
        {storageError
          ? "Draft kept in this page."
          : "Draft saved on this device."}{" "}
        Complete every step with a reading, condition or note.
      </p>
      {index === steps.length - 1 && (
        <>
          <details>
            <summary>Review all {steps.length} steps</summary>
            <ol className="experiment-draft-review">
              {steps.map((item, position) => {
                const entry = draft.steps[item.id] ?? empty;
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => onGo(position)}>
                      {position + 1}. {item.title}
                    </button>
                    <p>
                      {readingError(entry)
                        ? "Needs a record"
                        : [
                            entry.value !== ""
                              ? `${entry.quantity}: ${entry.value} ${entry.unit}`
                              : "",
                            conditions[
                              entry.condition as keyof typeof conditions
                            ],
                            entry.notes,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </li>
                );
              })}
            </ol>
          </details>
          <label>
            Record source
            <select
              value={draft.synthetic ? "practice" : "observed"}
              disabled={saving || draft.demoFilled}
              onChange={(event) =>
                update({
                  ...draft,
                  synthetic: event.target.value === "practice",
                })
              }
            >
              <option value="observed">Observed / measured on equipment</option>
              <option value="practice">Practice / synthetic entries</option>
            </select>
          </label>
          <p>
            All readings will be added to the{" "}
            {mechanismTitles[hypothesisId].toLowerCase()} investigation for
            review.
          </p>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={() => void complete()}
          >
            {saving ? "Saving experiment…" : "Finish experiment & return"}
          </button>
        </>
      )}
      {storageError && (
        <p role="alert" className="experiment-record-error">
          {storageError}
        </p>
      )}
      {error && (
        <p role="alert" className="experiment-record-error">
          {error}
        </p>
      )}
    </section>
  );
}
