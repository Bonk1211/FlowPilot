import { useState } from "react";
import type { DiagnosticAssessment } from "@flowpilot/contracts";

export function CausalReasoning({
  hypothesis,
  onSelectEvidence,
}: {
  hypothesis: DiagnosticAssessment["hypotheses"][number];
  onSelectEvidence: (id: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const why = selected < 5 ? hypothesis.why_chain[selected] : undefined;
  const label =
    selected < 5
      ? `Why ${selected + 1}`
      : selected === 5
        ? "Mechanism"
        : "Verification";
  const question =
    selected < 5
      ? (why?.question ?? "Further cause not yet established")
      : selected === 5
        ? "How could this mechanism produce the defect?"
        : "How can we test whether this explanation is correct?";
  const explanation =
    selected < 5
      ? (why?.explanation ??
        "No causal step is recorded at this level. Gather evidence before extending the chain.")
      : selected === 5
        ? hypothesis.how_mechanism
        : hypothesis.how_to_test;
  const status =
    selected < 5
      ? (why?.status ?? "Not yet established")
      : selected === 5
        ? "Proposed mechanism"
        : "Verification approach";

  return (
    <section className="why-how-reasoning" aria-label="Causal reasoning">
      <p className="causal-prerequisite">
        {hypothesis.status === "supported"
          ? "Follow the supported physical mechanism with evidence for each deeper cause."
          : "The physical mechanism is not yet supported. Verify it before extending this provisional cause chain."}
      </p>
      <h3>
        5 Whys <span>Find the cause</span>
      </h3>
      <div className="why-how-levels" role="group" aria-label="Five Why levels">
        {Array.from({ length: 5 }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Why ${index + 1}`}
            aria-pressed={selected === index}
            className={hypothesis.why_chain[index] ? "" : "is-unrecorded"}
            title={
              hypothesis.why_chain[index]?.question ?? "Not yet established"
            }
            onClick={() => setSelected(index)}
          >
            <span>Why</span>
            <strong>{index + 1}</strong>
          </button>
        ))}
      </div>
      <p className="why-how-progress">
        {Math.min(hypothesis.why_chain.length, 5)} of 5 Why levels recorded. The
        chain can stop where evidence ends.
      </p>
      <h3>
        Mechanism & test <span>Supporting detail</span>
      </h3>
      <div
        className="why-how-methods"
        role="group"
        aria-label="Mechanism and verification"
      >
        {["Mechanism", "Verification"].map((title, index) => (
          <button
            key={title}
            type="button"
            aria-label={title}
            aria-pressed={selected === index + 5}
            onClick={() => setSelected(index + 5)}
          >
            <strong>{title}</strong>
          </button>
        ))}
      </div>
      <article
        className={`why-how-detail ${selected < 5 ? "is-why" : "is-how"}`}
        aria-live="polite"
      >
        <p className="why-how-status">
          {label} · {status}
        </p>
        <h4>{question}</h4>
        <p>{explanation || "Not yet recorded."}</p>
        {!!why?.evidence_ids.length && (
          <div className="incident-actions" aria-label="Reasoning evidence">
            {why.evidence_ids.map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => onSelectEvidence(id)}
              >
                Inspect {id}
              </button>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
