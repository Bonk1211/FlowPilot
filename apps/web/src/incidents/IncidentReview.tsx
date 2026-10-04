import { useId, useState } from "react";
import type { Incident, IncidentCommand } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import "./review.css";

export function IncidentReview({
  incident,
  busy,
  onAction,
  onDemo,
  demoDisabled = false,
  demoRunning = false,
}: {
  incident: Incident;
  busy: boolean;
  onAction: (
    action: IncidentCommand,
    role?: "technician" | "engineer",
  ) => Promise<void>;
  onDemo?: (
    review: Extract<IncidentCommand, { action: "close" }>,
  ) => Promise<void>;
  demoDisabled?: boolean;
  demoRunning?: boolean;
}) {
  const access = useIncidentAccess();
  const titleId = useId();
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<"supported" | "inconclusive">(
    "inconclusive",
  );
  const [conclusion, setConclusion] = useState("");
  const [engineer, setEngineer] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const closed = incident.status === "closed";
  const reviewerName =
    access.mode === "configured" ? (access.subject ?? "") : reviewer;
  const authorized =
    access.mode === "demo"
      ? engineer
      : access.permissions.includes(closed ? "publish_knowledge" : "close");
  const ready =
    authorized &&
    reviewerName.trim() &&
    notes.trim() &&
    !busy &&
    (closed || outcome === "inconclusive" || conclusion.trim());

  async function submit(action: IncidentCommand) {
    setError("");
    setNotice("");
    try {
      await onAction(action, "engineer");
      setNotice(
        action.action === "close"
          ? "Review saved. Equipment disposition is unchanged."
          : action.action === "review_learning" && action.decision === "approve"
            ? "Experience published for compatible replay investigations."
            : "Experience withdrawn from reuse.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Review could not be saved. Your notes are retained.",
      );
    }
  }

  async function runDemo() {
    if (!onDemo || busy || demoDisabled) return;
    const draft = {
      action: "close" as const,
      reviewer: incident.closure?.reviewer ?? "Demo reviewer",
      outcome: incident.closure?.outcome ?? ("inconclusive" as const),
      notes:
        incident.closure?.notes ??
        "Demo conclusion: the available replay evidence is inconclusive. Compare coverage observations with material and fluid-path history before attributing a cause.",
      conclusion: incident.closure?.conclusion ?? null,
    };
    setReviewer(draft.reviewer);
    setOutcome(draft.outcome);
    setNotes(draft.notes);
    setConclusion(draft.conclusion ?? "");
    setEngineer(true);
    setError("");
    setNotice("");
    try {
      await onDemo(draft);
      setNotice(
        "Demo knowledge recorded. Playing its connections in the graph.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Demo could not finish. Your filled fields are retained; try again.",
      );
    }
  }

  return (
    <section
      id="knowledge-review"
      className="incident-card incident-review"
      aria-labelledby={titleId}
    >
      <div className="incident-section-title">
        <div>
          <h2 id={titleId}>Conclusion & learning</h2>
        </div>
        <span className="incident-tag">
          {closed ? "Closed" : "Review required"}
        </span>
      </div>
      {onDemo && (
        <button
          type="button"
          className="secondary incident-demo-knowledge"
          disabled={busy || demoDisabled}
          onClick={() => void runDemo()}
        >
          {demoRunning
            ? "Recording demo knowledge…"
            : "Demo conclusion & record knowledge"}
        </button>
      )}
      {error && (
        <p role="alert" className="incident-review-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!closed && (
        <p className="incident-muted">Review the outcome to unlock saving.</p>
      )}
      {incident.closure && (
        <div className="incident-review-record">
          <strong>
            {incident.closure.outcome === "inconclusive"
              ? "Inconclusive — questions remain"
              : "Supported explanation"}
          </strong>
          <p>{incident.closure.conclusion ?? "No confirmed cause recorded."}</p>
          <p>{incident.closure.notes}</p>
          <small>
            Reviewed by {incident.closure.reviewer} ·{" "}
            {new Date(incident.closure.closed_at).toLocaleString()}
          </small>
        </div>
      )}
      {incident.learning && (
        <p className="incident-muted">Experience: {incident.learning.status}</p>
      )}
      <details open={!closed}>
        <summary>
          {closed
            ? "Review experience for reuse"
            : "Record an investigation review"}
        </summary>
        {incident.learning && (
          <div className="incident-review-record">
            <p>{incident.learning.summary}</p>
            <small>
              Source revision {incident.learning.source_revision} ·{" "}
              {incident.learning.evidence_ids.length} evidence references
            </small>
            <p className="incident-muted">
              Reviewed replay experience provides historical context. It is not
              an approved machine procedure.
            </p>
            {(incident.learning.reviews ?? []).length > 0 && (
              <details>
                <summary>
                  Publication history (
                  {(incident.learning.reviews ?? []).length})
                </summary>
                <ol>
                  {(incident.learning.reviews ?? []).map((review) => (
                    <li key={review.version}>
                      <strong>
                        {review.decision === "approve"
                          ? "Published"
                          : "Withdrawn"}
                      </strong>{" "}
                      by {review.reviewer}: {review.notes}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            void submit(
              closed
                ? {
                    action: "review_learning",
                    decision: "approve",
                    reviewer: reviewerName.trim(),
                    notes: notes.trim(),
                  }
                : {
                    action: "close",
                    outcome,
                    reviewer: reviewerName.trim(),
                    notes: notes.trim(),
                    conclusion:
                      outcome === "supported" ? conclusion.trim() : null,
                  },
            );
          }}
        >
          {access.mode === "demo" && (
            <>
              <label className="incident-role-control">
                <input
                  type="checkbox"
                  checked={engineer}
                  onChange={(event) => setEngineer(event.target.checked)}
                />
                Use the engineer role for this local demonstration
              </label>
            </>
          )}
          {access.mode === "configured" && !authorized && (
            <p className="incident-permission-note">
              {closed
                ? "Publishing or withdrawing experience requires the publish knowledge permission."
                : "Closing this investigation requires the close permission."}
            </p>
          )}
          <label>
            Reviewer name
            <input
              value={reviewerName}
              onChange={(event) => setReviewer(event.target.value)}
              readOnly={access.mode === "configured"}
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>
          {!closed && (
            <label>
              Investigation outcome
              <select
                value={outcome}
                onChange={(event) =>
                  setOutcome(event.target.value as typeof outcome)
                }
              >
                <option value="inconclusive">
                  Inconclusive — preserve unresolved hypotheses
                </option>
                <option value="supported">
                  Supported explanation — evidence required
                </option>
              </select>
            </label>
          )}
          {!closed && outcome === "supported" && (
            <label>
              Evidence-based conclusion
              <textarea
                value={conclusion}
                onChange={(event) => setConclusion(event.target.value)}
                required
                rows={2}
                maxLength={2000}
              />
            </label>
          )}
          <label>
            {closed ? "Review reason" : "Findings and unresolved questions"}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              required
              maxLength={2000}
            />
          </label>
          <div className="incident-review-actions">
            {!closed ? (
              <button className="primary" disabled={!ready}>
                Save review and close
              </button>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={!ready || incident.learning?.status === "published"}
                >
                  Publish reviewed experience
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={
                    !ready ||
                    !incident.learning ||
                    incident.learning.status === "withdrawn"
                  }
                  onClick={() =>
                    void submit({
                      action: "review_learning",
                      decision: "withdraw",
                      reviewer: reviewerName.trim(),
                      notes: notes.trim(),
                    })
                  }
                >
                  Withdraw experience
                </button>
              </>
            )}
          </div>
        </form>
      </details>
    </section>
  );
}
