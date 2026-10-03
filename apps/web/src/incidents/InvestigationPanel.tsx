import { useState } from "react";
import type { DiagnosticAssessment, IncidentObservation } from "./api";
import "./InvestigationPanel.css";
import { StatusChip } from "./StatusChip";

export type ObservationInput = {
  check_id: string;
  result: string;
  notes: string;
  evidence_ids: string[];
  synthetic: boolean;
};

type Props = {
  assessment: DiagnosticAssessment | null;
  observations: IncidentObservation[];
  onObserve: (input: ObservationInput) => Promise<void>;
  onSelectHypothesis: (id: string) => void;
  selectedHypothesisId: string | null;
  onSelectEvidence?: (id: string) => void;
  busy: boolean;
  showForms?: boolean;
};

export function InvestigationPanel({
  assessment,
  observations,
  onObserve,
  onSelectHypothesis,
  selectedHypothesisId,
  onSelectEvidence,
  busy,
  showForms = true,
}: Props) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const disabled = busy || saving;

  async function record(input: ObservationInput) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onObserve(input);
      setNotice(
        "Observation saved. The assessment and handoff have been updated.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Your input is preserved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!assessment)
    return (
      <section
        className="incident-card investigation-panel"
        aria-labelledby="investigation-title"
      >
        <h2 id="investigation-title">Ready to investigate</h2>
        <p>
          Analyze the available evidence to compare possible causes. Missing
          sources can arrive later.
        </p>
      </section>
    );

  const selected =
    assessment.hypotheses.find((item) => item.id === selectedHypothesisId) ??
    assessment.hypotheses[0];
  const next = assessment.next_step;
  const nextCheck = assessment.checks.find((item) => item.id === next.id);
  const sources = assessment.sources.filter((source) =>
    query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((term) =>
        `${source.title} ${source.passage} ${source.document_id}`
          .toLowerCase()
          .includes(term),
      ),
  );

  return (
    <section
      className="incident-card investigation-panel"
      aria-labelledby="investigation-title"
    >
      <div className="investigation-heading">
        <div>
          <p className="investigation-eyebrow">
            Evidence → explanation → check
          </p>
          <h2 id="investigation-title">Investigate competing causes</h2>
        </div>
        <StatusChip kind="inferred" />
      </div>
      <p className="investigation-muted">{assessment.summary}</p>
      {assessment.explanation?.result && (
        <details>
          <summary>AI explanation · review against its sources</summary>
          <p>{assessment.explanation.result.text}</p>
          <p className="investigation-muted">
            Evidence:{" "}
            {assessment.explanation.result.evidence_ids.join(", ") ||
              "None available"}
          </p>
          <p className="investigation-muted">
            Sources: {assessment.explanation.result.source_refs.join(", ")}
          </p>
          <ul>
            {assessment.explanation.result.uncertainties.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}
      <div
        className="investigation-hypotheses"
        aria-label="Candidate mechanisms"
      >
        {assessment.hypotheses.map((hypothesis) => (
          <button
            type="button"
            key={hypothesis.id}
            className={`investigation-candidate ${selected?.id === hypothesis.id ? "is-selected" : ""}`}
            aria-pressed={selected?.id === hypothesis.id}
            onClick={() => onSelectHypothesis(hypothesis.id)}
          >
            <span className="investigation-rank">
              {hypothesis.rank.toString().padStart(2, "0")}
            </span>
            <strong>{hypothesis.title}</strong>
            <span className="investigation-candidate-status">
              {hypothesis.status.replaceAll("_", " ")}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="investigation-explanation">
          <h3>{selected.title}</h3>
          <p>{selected.mechanism}</p>
          <p className="investigation-muted">{selected.explanation}</p>
          <details>
            <summary>Inspect support, conflict and missing evidence</summary>
            {(["supporting_evidence", "conflicting_evidence"] as const).map(
              (kind) => (
                <div key={kind} className="investigation-evidence-list">
                  <h4>
                    {kind === "supporting_evidence"
                      ? "Supports"
                      : "Conflicts / limits"}
                  </h4>
                  {selected[kind].length ? (
                    <ul>
                      {selected[kind].map((reason, index) => (
                        <li key={`${reason.evidence_id}-${index}`}>
                          {onSelectEvidence ? (
                            <button
                              type="button"
                              className="investigation-ref"
                              onClick={() =>
                                onSelectEvidence(reason.evidence_id)
                              }
                            >
                              {reason.evidence_id}
                            </button>
                          ) : (
                            <code>{reason.evidence_id}</code>
                          )}
                          <span>{reason.explanation}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No distinguishing evidence recorded.</p>
                  )}
                </div>
              ),
            )}
            <h4>Still missing</h4>
            <ul>
              {selected.missing_evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Why / how explanation</h4>
            {selected.why_chain.map((step) => (
              <p key={step.question}>
                <strong>{step.question}</strong> {step.explanation}
                <span className="investigation-muted"> [{step.status}]</span>
              </p>
            ))}
            <p>
              <strong>How could it happen?</strong> {selected.how_mechanism}
            </p>
            <p>
              <strong>How can we distinguish it?</strong> {selected.how_to_test}
            </p>
            <p className="investigation-muted">
              Sources: {selected.source_refs.join(", ")}
            </p>
          </details>
        </div>
      )}

      {showForms && (
        <div className="investigation-next" aria-live="polite">
          <span className="investigation-eyebrow">
            Next useful step · {next.kind}
          </span>
          <h3>{next.title}</h3>
          <p>{next.reason}</p>
          {next.kind === "question" && (
            <p className="investigation-muted">
              Complete the highlighted discovery field below. Unknown is a valid
              answer.
            </p>
          )}
          {nextCheck && (
            <>
              <p className="investigation-badge">Synthetic replay result</p>
              <details>
                <summary>Method, prerequisites and expected outcomes</summary>
                <p>{nextCheck.method}</p>
                <p>
                  <strong>Response:</strong> {nextCheck.measured_response}
                </p>
                <p>
                  <strong>Responsible role:</strong>{" "}
                  {nextCheck.responsible_role}
                </p>
                <ul>
                  {nextCheck.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {nextCheck.expected_outcomes.map((outcome) => (
                  <p key={outcome.value}>
                    <strong>{outcome.label}:</strong> {outcome.interpretation}
                  </p>
                ))}
                <ul>
                  {nextCheck.stopping_conditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>Sources: {nextCheck.source_refs.join(", ")}</p>
              </details>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void record({
                    check_id: nextCheck.id,
                    result: String(form.get("result")),
                    notes: String(form.get("notes") ?? ""),
                    evidence_ids: [],
                    synthetic: true,
                  });
                }}
                key={nextCheck.id}
                className="investigation-result-form"
              >
                <label htmlFor={`result-${nextCheck.id}`}>
                  Recorded replay outcome
                </label>
                <select
                  id={`result-${nextCheck.id}`}
                  name="result"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select an outcome
                  </option>
                  {nextCheck.expected_outcomes.map((outcome) => (
                    <option value={outcome.value} key={outcome.value}>
                      {outcome.label}
                    </option>
                  ))}
                </select>
                <label htmlFor={`notes-${nextCheck.id}`}>
                  Conditions / notes
                </label>
                <textarea
                  id={`notes-${nextCheck.id}`}
                  name="notes"
                  rows={2}
                  maxLength={2000}
                  placeholder="Record comparability, missing conditions, or limitations."
                />
                <button
                  type="submit"
                  disabled={disabled || !nextCheck.eligible}
                >
                  {saving ? "Saving…" : "Record replay result"}
                </button>
              </form>
              <p className="investigation-limit">{nextCheck.blocked_reason}</p>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="investigation-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="investigation-notice">
          {notice}
        </p>
      )}

      <details
        open={showForms && next.kind === "question"}
        className="investigation-discovery"
      >
        <summary>
          {showForms
            ? "Problem discovery · confirm or correct known information"
            : "Known context · imported and confirmed facts"}
        </summary>
        {!showForms && (
          <dl>
            {assessment.discovery.map((field) => (
              <div key={field.id}>
                <dt>
                  {field.label} · {field.status}
                </dt>
                <dd>{field.value ?? "Unknown"}</dd>
              </div>
            ))}
          </dl>
        )}
        {showForms &&
          assessment.discovery.map((field) => (
            <form
              key={`${field.id}-${field.value}-${field.status}`}
              className={`investigation-field ${next.id === field.id ? "is-next" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const value = String(form.get("value") ?? "").trim();
                void record({
                  check_id: field.id,
                  result: value || "unknown",
                  notes: "Discovery confirmation / correction",
                  evidence_ids: [],
                  synthetic: true,
                });
              }}
            >
              <label htmlFor={field.id}>
                {field.label} <span>· {field.status}</span>
              </label>
              <p className="investigation-muted">{field.question}</p>
              <input
                id={field.id}
                name="value"
                defaultValue={field.value ?? ""}
                maxLength={1000}
                placeholder="Unknown / not measured"
              />
              <div className="investigation-field-actions">
                <button type="submit" disabled={disabled}>
                  Confirm / update
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    void record({
                      check_id: field.id,
                      result: "unknown",
                      notes: "Not known / not measured",
                      evidence_ids: [],
                      synthetic: true,
                    })
                  }
                >
                  Unknown
                </button>
              </div>
            </form>
          ))}
      </details>

      <details>
        <summary>
          Recorded answers and test results · {observations.length}
        </summary>
        {observations.length ? (
          <ol className="investigation-history">
            {observations.map((observation) => (
              <li key={observation.id} id={`observation-${observation.id}`}>
                <strong>
                  {observation.check_id.replaceAll("_", " ")}:{" "}
                  {observation.result}
                </strong>
                <p>
                  {observation.notes || "No additional conditions recorded."}
                </p>
                <small>
                  {observation.synthetic ? "Synthetic" : "Observed"} ·{" "}
                  {observation.recorded_at}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>No answers or test results recorded yet.</p>
        )}
      </details>

      <details>
        <summary>
          Source passages and applicability · {assessment.sources.length}
        </summary>
        <label htmlFor="incident-source-search">Search source passages</label>
        <input
          id="incident-source-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pressure, material, conditions…"
        />
        {sources.map((source) => (
          <article key={source.id} className="investigation-source">
            <h3>{source.title}</h3>
            <p className="investigation-muted">
              {source.document_id} · {source.revision} · §{source.section}
            </p>
            <span className="investigation-badge">
              {source.approval_status.replaceAll("_", " ")}
            </span>
            <span className="investigation-badge">
              {source.applicable
                ? "Configuration matches"
                : "Configuration not matched"}
            </span>
            <blockquote>{source.passage}</blockquote>
            <p>{source.limitation}</p>
            <p className="investigation-muted">
              Exact excerpt · {source.file_path} · ID: {source.id}
            </p>
          </article>
        ))}
        {!sources.length && <p>No source passages match this search.</p>}
      </details>
      <details>
        <summary>Model status and unresolved information</summary>
        <p>{assessment.provider_status}</p>
        {assessment.explanation && (
          <p>
            Explanation: {assessment.explanation.mode}
            {assessment.explanation.model
              ? ` · ${assessment.explanation.model}`
              : ""}
            .
            {assessment.explanation.fallback_reason
              ? ` ${assessment.explanation.fallback_reason}`
              : ""}
          </p>
        )}
        <p>
          Rules version: {assessment.version}. Priority order is not a
          probability.
        </p>
        <ul>
          {assessment.unresolved.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {(assessment.warnings ?? []).map((item) => (
          <p className="investigation-limit" key={item}>
            {item}
          </p>
        ))}
      </details>
    </section>
  );
}
