import { useEffect, useState } from "react";
import type { IncidentExperience } from "@flowpilot/contracts";
import { incidentFetch, type Incident } from "./api";
import "./review.css";

export function PastIncidents({ incident }: { incident: Incident }) {
  const [matches, setMatches] = useState<IncidentExperience[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    incidentFetch(
      `/api/incidents/${encodeURIComponent(incident.id)}/experience`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Reviewed experience could not be loaded.");
        return (await response.json()) as IncidentExperience[];
      })
      .then((data) => {
        if (active) {
          setMatches(data);
          setError("");
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Reviewed experience is unavailable. Retry to check the latest publication status.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [incident.id, incident.revision, attempt]);

  return (
    <section className="incident-card" aria-labelledby="past-incidents-title">
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Reviewed experience</p>
          <h2 id="past-incidents-title">Earlier investigations</h2>
        </div>
        <button
          className="secondary"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setAttempt(attempt + 1);
          }}
        >
          Refresh experience
        </button>
      </div>
      <p className="incident-muted">
        Same configuration and evidence mode. Only published findings from
        incidents closed before this investigation are eligible.
      </p>
      {loading && <p role="status">Checking published experience…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !matches.length && (
        <p>
          No compatible published experience. Continue using the current
          incident's evidence.
        </p>
      )}
      {!error && (
        <ul className="incident-experience-list">
          {matches.map((match) => (
            <li key={match.citation}>
              <a href={`/incidents/${encodeURIComponent(match.incident_id)}`}>
                {match.symptom}
              </a>
              <p>{match.summary}</p>
              <p className="incident-caption">
                {match.citation} · {match.outcome} · Reviewed by{" "}
                {match.reviewed_by}
              </p>
              <p className="incident-muted incident-caption">
                {match.limitation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
