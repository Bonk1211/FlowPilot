import { useEffect, useRef, useState } from "react";
import type { IncidentJob } from "@flowpilot/contracts";
import { incidentJson, type Incident } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import "./operations.css";

export function JobStatus({
  incident,
  onRefresh,
}: {
  incident: Incident;
  onRefresh: () => Promise<void>;
}) {
  const access = useIncidentAccess();
  const [jobs, setJobs] = useState<IncidentJob[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const finished = useRef(new Set<string>());
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const options = {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        };
        const [status, current] = await Promise.all([
          incidentJson<{ enabled: boolean }>(
            "/api/incident-jobs/status",
            options,
          ),
          incidentJson<IncidentJob[]>(
            `/api/incidents/${incident.id}/jobs`,
            options,
          ),
        ]);
        if (!active) return;
        setEnabled(status.enabled);
        setJobs(current);
        setError("");
        const newlyCompleted = current.filter(
          (job) =>
            job.state === "succeeded" &&
            !finished.current.has(`${job.id}:${job.updated_at}`),
        );
        for (const job of newlyCompleted)
          finished.current.add(`${job.id}:${job.updated_at}`);
        if (newlyCompleted.length) await refresh.current();
        if (
          active &&
          status.enabled &&
          current.some((job) => ["pending", "running"].includes(job.state))
        )
          timer = setTimeout(() => {
            void poll();
          }, 2000);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Background status unavailable. Manual investigation remains available.",
          );
      }
    }
    void poll();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [incident.id, incident.revision, attempt]);

  async function schedule(retry_failed: boolean) {
    setBusy(true);
    setError("");
    try {
      setJobs(
        await incidentJson<IncidentJob[]>(
          `/api/incidents/${incident.id}/jobs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ retry_failed }),
          },
        ),
      );
      setAttempt((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Background work could not be queued.",
      );
    } finally {
      setBusy(false);
    }
  }
  const editable =
    access.mode === "demo" || access.permissions.includes("edit");
  const latest = [...jobs]
    .reverse()
    .filter(
      (job, index, values) =>
        values.findIndex((item) => item.kind === job.kind) === index,
    );
  return (
    <details className="incident-jobs">
      <summary>
        Background investigation & handoff{" "}
        <span>
          {enabled === null
            ? "Checking status"
            : enabled
              ? "Worker enabled"
              : "Manual mode"}
        </span>
      </summary>
      {error && <p role="alert">{error}</p>}
      {enabled === false && (
        <p>
          Background processing is off. Analyze evidence and refresh the handoff
          using the workspace controls.
        </p>
      )}
      <ul>
        {latest.map((job) => (
          <li key={job.id}>
            <strong>
              {job.kind === "analysis"
                ? "Evidence analysis"
                : "Handoff preparation"}
            </strong>
            <span>
              {job.state} · evidence revision {job.source_revision} · attempt{" "}
              {job.attempts}/{job.max_attempts}
            </span>
            {job.error && <p>{job.error}</p>}
          </li>
        ))}
      </ul>
      {enabled && !jobs.length && (
        <p>No background work queued for this incident yet.</p>
      )}
      <div className="incident-actions">
        <button
          disabled={busy}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Refresh job status
        </button>
        {enabled && editable && incident.status !== "closed" && (
          <>
            <button
              disabled={busy}
              onClick={() => {
                void schedule(false);
              }}
            >
              Queue analysis and handoff
            </button>
            {latest.some((job) => job.state === "failed") && (
              <button
                disabled={busy}
                onClick={() => {
                  void schedule(true);
                }}
              >
                Retry failed jobs
              </button>
            )}
          </>
        )}
      </div>
      {jobs.length > 2 && (
        <details>
          <summary>Job history ({jobs.length})</summary>
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                {job.kind} · {job.state} · revision {job.source_revision}
                {job.error ? ` · ${job.error}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  );
}
