import { useEffect, useState } from "react";
import type {
  Case,
  CitationStatus,
  PastExperience as Experience,
} from "@flowpilot/contracts";
import { knowledgeStatus } from "../api";
import { humanize } from "../presentation";
import "../knowledge.css";

export function ExperienceList({
  matches,
  compact = false,
}: {
  matches: Experience[];
  compact?: boolean;
}) {
  return (
    <div className="experience-list">
      {matches.map((match) => (
        <article key={match.citation}>
          <div className="knowledge-heading">
            <h3>
              <a
                href={`/knowledge?entry=${match.knowledge_id}&version=${match.version}`}
              >
                {match.content.title}
              </a>
            </h3>
            <span className="status">Version {match.version}</span>
          </div>
          <p>
            {humanize(match.content.finding)} ·{" "}
            <strong>{humanize(match.content.outcome)}</strong>
          </p>
          {!compact && <p>{match.content.lesson}</p>}
          <details>
            <summary>Why this experience matches</summary>
            {compact && <p>{match.content.lesson}</p>}
            <ul>
              {match.matched_conditions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>Unknown applicability: {match.unknown_conditions.join("; ")}.</p>
            <p>
              Recorded action: {humanize(match.historical_action ?? "none")}
            </p>
            <a href={`/?case=${match.source_case_id}`}>
              Open source investigation
            </a>
            <p className="mono">
              {match.citation} · source revision {match.source_revision}
            </p>
            <p>
              {match.simulated
                ? "Simulated source; repeated equivalent experiences are grouped."
                : "Recorded case experience."}
            </p>
          </details>
        </article>
      ))}
    </div>
  );
}

export function PastExperiencePanel({
  value,
  onRefresh,
}: {
  value: Case;
  onRefresh: () => void;
}) {
  const [statuses, setStatuses] = useState<CitationStatus[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void knowledgeStatus(value.investigation.id)
        .then((result) => {
          if (active) {
            setStatuses(result);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Reference status could not be checked.");
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [value.investigation.id, value.revision, attempt]);
  const historical = value.past_experience;
  const citations = new Set(historical?.matches?.map((m) => m.citation));
  const stale = statuses.filter((s) => !s.current && citations.has(s.citation));
  const olderStale = statuses.some(
    (s) => !s.current && !citations.has(s.citation),
  );
  return (
    <section className="past-experience" aria-label="Past experience">
      <div className="knowledge-heading">
        <div>
          <p className="eyebrow">Learning database</p>
          <h2>Past experience</h2>
        </div>
        <button type="button" className="secondary" onClick={onRefresh}>
          Refresh past experience
        </button>
      </div>
      {!!stale.length && (
        <p role="status" className="knowledge-warning">
          Referenced knowledge has changed:{" "}
          {stale.map((s) => `${s.citation} (${humanize(s.status)})`).join(", ")}
          . Saved diagnoses retain their original references. Refresh to use
          current knowledge.
        </p>
      )}
      {olderStale && !stale.length && (
        <p className="muted">
          Earlier diagnostic snapshots retain references that have since
          changed. Open Diagnostic history to inspect their original knowledge
          versions.
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="secondary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry reference check
          </button>
        </p>
      )}
      {historical?.matches?.length ? (
        <>
          <p className="experience-advice">
            <strong>Historical check focus</strong> {historical.suggested_check}
          </p>
          <ExperienceList matches={historical.matches} compact />
        </>
      ) : (
        <p>
          {historical?.explanation ??
            "No past experience saved for this diagnosis."}{" "}
          <a href="/knowledge">Open Knowledge Library</a>
        </p>
      )}
    </section>
  );
}

export function KnowledgeCapture({ value }: { value: Case }) {
  const eligible =
    value.scenario_version === "2.0" &&
    value.investigation.evidence?.some(
      (e) => e.key === "inspection" && e.verification_state === "verified",
    );
  return eligible ? (
    <section className="knowledge-capture">
      <div>
        <p className="eyebrow">Retain what you learned</p>
        <h2>Review case experience</h2>
        <p>
          Your inspection, action and outcome are retained. Review the prepared
          experience before AI reuse.
        </p>
      </div>
      <a
        className="secondary"
        href={`/knowledge?source=${value.investigation.id}`}
      >
        Review case experience
      </a>
    </section>
  ) : null;
}
