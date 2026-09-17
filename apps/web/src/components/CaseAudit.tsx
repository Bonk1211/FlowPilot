import type { Case } from "@flowpilot/contracts";
import { candidateValue, humanize } from "../presentation";

type Evidence = NonNullable<Case["investigation"]["evidence"]>[number];

function EvidenceList({ items }: { items: Evidence[] }) {
  return items.length ? (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{humanize(item.key)}</strong>: {candidateValue(item)}
          <p>
            {humanize(item.verification_state)} · <time>{item.timestamp}</time>
          </p>
          <p>
            {item.id} · {humanize(item.source_type)} · {item.source_ref}
          </p>
        </li>
      ))}
    </ul>
  ) : (
    <p>None recorded.</p>
  );
}

export function SummaryEvidence({ value }: { value: Case }) {
  const ids = new Set(value.summary?.evidence_ids ?? []);
  const items = (value.investigation.evidence ?? []).filter((item) =>
    ids.has(item.id),
  );
  const recoveryKeys = new Set(["recovery_checks", "verification_passed"]);
  const latest = new Map<string, string>();
  for (const item of items) {
    if (recoveryKeys.has(item.key) && item.verification_state !== "rejected")
      latest.set(item.key, item.id);
  }
  const rejected = items.filter(
    (item) => item.verification_state === "rejected",
  );
  const earlier = items.filter(
    (item) =>
      item.verification_state !== "rejected" &&
      recoveryKeys.has(item.key) &&
      latest.get(item.key) !== item.id,
  );
  const current = items.filter(
    (item) =>
      item.verification_state !== "rejected" &&
      (!recoveryKeys.has(item.key) || latest.get(item.key) === item.id),
  );
  return (
    <>
      <h3>Evidence used</h3>
      <p>
        Current observations retain their verification status. Provisional
        evidence does not confirm a cause; machine PASS does not establish
        product quality.
      </p>
      <details>
        <summary>Current evidence · {current.length} observations</summary>
        <EvidenceList items={current} />
      </details>
      <details>
        <summary>
          Earlier recovery attempts · {earlier.length} observations
        </summary>
        <p>Historical results, superseded by the final recovery attempt.</p>
        <EvidenceList items={earlier} />
      </details>
      <details>
        <summary>
          Rejected or superseded evidence · {rejected.length} observations
        </summary>
        <p>Retained for audit; excluded from the current diagnostic scores.</p>
        <EvidenceList items={rejected} />
      </details>
    </>
  );
}

export function DiagnosticHistory({ value }: { value: Case }) {
  return (
    <section className="case-section case-audit" aria-label="Diagnostic history">
      <h2>Diagnostic history</h2>
      <p>
        Saved results at each diagnostic revision. Earlier results keep the
        evidence and reasoning available at that time.
      </p>
      {!value.diagnostic_history?.length && (
        <p>
          No diagnostic history was captured for this saved case. Earlier
          results cannot be reconstructed.
        </p>
      )}
      {value.diagnostic_history?.map((snapshot) => (
        <details
          key={snapshot.revision}
          id={`diagnosis-revision-${snapshot.revision}`}
          tabIndex={-1}
        >
          <summary>
            Revision {snapshot.revision} · {humanize(snapshot.trigger)} ·{" "}
            {snapshot.findings_mode === "live" ? "Live" : "Cached"}
          </summary>
          <p>
            <time>{snapshot.timestamp}</time> · {humanize(snapshot.state)}
          </p>
          {snapshot.trigger === "retained_baseline" && (
            <p>
              Latest previously saved result, retained when this case was next
              changed. Earlier diagnostic history is unavailable.
            </p>
          )}
          {snapshot.reasoning && (
            <p>
              {snapshot.reasoning.model} · {snapshot.reasoning.prompt_version} ·{" "}
              {snapshot.reasoning.fallback_reason ??
                "Critic-reviewed live findings"}
            </p>
          )}
          {!snapshot.ranking.length && (
            <p>
              Diagnosis invalidated by evidence correction. Complete discovery
              before diagnosing again.
            </p>
          )}
          <ol>
            {snapshot.ranking.map((cause) => (
              <li key={cause.hypothesis_id}>
                <strong>
                  {cause.label}: {cause.score} points
                </strong>
                <ul>
                  {cause.contributions.map((contribution, i) => (
                    <li key={i}>
                      {contribution.evidence_id}: {contribution.weight} ·{" "}
                      {contribution.explanation}
                    </li>
                  ))}
                </ul>
                <p>
                  Missing: {cause.missing_evidence.join(", ") || "None listed"}
                </p>
              </li>
            ))}
          </ol>
          {snapshot.findings.map((finding, i) => (
            <details key={i}>
              <summary>
                {humanize(finding.agent)} · {humanize(finding.hypothesis_id)}
              </summary>
              <p>{finding.summary}</p>
              <p>
                Supporting evidence:{" "}
                {finding.supporting_evidence_ids.join(", ") || "None listed"}
              </p>
              <p>
                Conflicting evidence:{" "}
                {finding.conflicting_evidence_ids.join(", ") || "None listed"}
              </p>
              <p>
                Missing: {finding.missing_evidence.join(", ") || "None listed"}
              </p>
            </details>
          ))}
          <details>
            <summary>Evidence at this revision</summary>
            <EvidenceList items={snapshot.evidence} />
          </details>
        </details>
      ))}
    </section>
  );
}
