import { useEffect, useState } from "react";
import type { Incident } from "@flowpilot/contracts";
import "./InvestigationProgress.css";

export type InvestigationProgressMode =
  "analysis" | "answer" | "conversation" | "queued" | "updating";

const activity = {
  analysis: {
    title: "Analyzing current evidence",
    detail:
      "Reviewing collected evidence and confirmed observations to build the investigation.",
  },
  answer: {
    title: "Reviewing your answer",
    detail:
      "Checking how your answer connects with the evidence and the investigation timeline.",
  },
  conversation: {
    title: "Reviewing your message",
    detail:
      "Checking your message against the current question and collected evidence.",
  },
  queued: {
    title: "Analysis queued",
    detail:
      "Your evidence is saved. Waiting for the investigation agent to pick it up.",
  },
  updating: {
    title: "Updating the investigation",
    detail:
      "Reviewing saved evidence to prepare the next question and update the timeline.",
  },
};

export function InvestigationProgress({
  incident,
  mode,
  compact = false,
}: {
  incident: Incident;
  mode: InvestigationProgressMode;
  compact?: boolean;
}) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt]);
  const evidenceCount = (incident.evidence ?? []).filter(
    (item) => item.status === "collected",
  ).length;
  const observationCount = (incident.observations ?? []).length;
  const current = activity[mode];
  return (
    <div
      className={`investigation-progress${compact ? " is-compact" : ""}`}
      data-mode={mode}
      aria-label="Investigation progress"
    >
      <div className="investigation-progress-orbit" aria-hidden="true">
        <span className="investigation-progress-core" />
        <span className="investigation-progress-ring" />
      </div>
      <div className="investigation-progress-content">
        <div className="investigation-progress-heading">
          <span className="investigation-progress-eyebrow">
            Investigation agent
          </span>
          <time
            role="timer"
            aria-live="off"
            aria-label={`${elapsed} seconds elapsed`}
          >
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </time>
        </div>
        <div role="status" aria-atomic="true">
          <strong>
            {current.title}
            <span className="investigation-progress-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </strong>
          <p>{current.detail}</p>
        </div>
        <div className="investigation-progress-scope">
          <span>
            {evidenceCount} evidence {evidenceCount === 1 ? "item" : "items"}
          </span>
          {!!observationCount && (
            <span>
              {observationCount} recorded{" "}
              {observationCount === 1 ? "observation" : "observations"}
            </span>
          )}
          {elapsed >= 15 && (
            <span>Still working · you can keep inspecting the evidence</span>
          )}
        </div>
      </div>
      {!compact && (
        <div className="investigation-progress-preview" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
