import { useState } from "react";
import type { CaseAction, Evidence } from "@flowpilot/contracts";

type Correction = Omit<
  Extract<CaseAction, { action: "correct_evidence" }>,
  "revision"
>;
const answers: Record<string, string[]> = {
  frequency: ["continuous", "intermittent"],
  continuous: ["yes", "unknown"],
  intermittent: ["yes", "unknown"],
  change: ["yes", "no"],
  temperature: ["unknown", "available"],
  service: ["unknown", "available"],
};

export function EvidenceCorrection({
  evidence,
  onCorrect,
}: {
  evidence: Evidence;
  onCorrect: (action: Correction) => Promise<void>;
}) {
  const [operation, setOperation] = useState<"edit" | "reject">("reject");
  const [value, setValue] = useState(String(evidence.value));
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const editable =
    evidence.source_type === "technician_input" &&
    (evidence.key === "operator_report" || evidence.key in answers);
  return (
    <details className="evidence-correction">
      <summary>Correct this evidence</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onCorrect({
            action: "correct_evidence",
            evidence_id: evidence.id,
            operation,
            value: operation === "edit" ? value : null,
            reason,
            confirmed: true,
          });
          setConfirmed(false);
        }}
      >
        <label>
          Correction type
          <select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value as "edit" | "reject");
              setConfirmed(false);
            }}
          >
            <option value="reject">Reject evidence</option>
            {editable && <option value="edit">Edit technician value</option>}
          </select>
        </label>
        {operation === "edit" && (
          <label>
            Replacement value
            {answers[evidence.key] ? (
              <select
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setConfirmed(false);
                }}
              >
                {answers[evidence.key].map((answer) => (
                  <option key={answer}>{answer}</option>
                ))}
              </select>
            ) : (
              <textarea
                required
                maxLength={2000}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setConfirmed(false);
                }}
              />
            )}
          </label>
        )}
        <label>
          Correction reason
          <textarea
            required
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <p>
          The original value remains in history. Changing a discovery answer
          retires dependent answers. Rejecting image evidence also rejects its
          derived measurements.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I confirm this evidence correction.
        </label>
        <button
          className="secondary"
          disabled={
            !confirmed ||
            !reason.trim() ||
            (operation === "edit" && !value.trim())
          }
        >
          Save correction
        </button>
      </form>
    </details>
  );
}
