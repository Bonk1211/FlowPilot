import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { WorkspaceLoading } from "../components/WorkspaceLoading";
import type { Incident } from "./api";
import { MonitoringDashboard } from "./MonitoringDashboard";
import { ReplayPipeline } from "./ReplayPipeline";

export function ReplayDemo({
  request,
  onOpen,
  onBack,
  onRetry,
}: {
  request: Promise<Incident>;
  onOpen: (incident: Incident) => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const collectEvidence = useCallback(() => setCollecting(true), []);

  useEffect(() => {
    if (collecting) return;
    let active = true;
    void request.then(
      (value) => {
        if (active) {
          setIncident(value);
          setError("");
        }
      },
      (cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Replay could not open.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [request, collecting]);

  useEffect(() => {
    if (incident) heading.current?.focus();
  }, [incident]);

  if (collecting)
    return (
      <ReplayPipeline
        request={request}
        onOpen={onOpen}
        onBack={onBack}
        onRetry={onRetry}
      />
    );

  return (
    <section className="replay-demo" aria-labelledby="replay-monitor-title">
      <header className="replay-heading">
        <div>
          <p className="eyebrow">S932 / MONITORING REPLAY</p>
          <h1 id="replay-monitor-title" tabIndex={-1} ref={heading}>
            Watch the change unfold.
          </h1>
          <p>
            Trigger a demo incident, watch the parameters cross their limits,
            then follow the evidence collection.
          </p>
        </div>
        <button onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Back to incidents
        </button>
      </header>
      {error ? (
        <div className="incident-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setError("");
              onRetry();
            }}
          >
            Retry replay
          </button>
        </div>
      ) : incident ? (
        <MonitoringDashboard
          incident={incident}
          disabled={false}
          onAnalyze={collectEvidence}
          onCollectEvidence={collectEvidence}
        />
      ) : (
        <WorkspaceLoading detail="Preparing the S932 monitoring demo…" />
      )}
    </section>
  );
}
