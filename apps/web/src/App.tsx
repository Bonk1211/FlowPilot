import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowClockwise } from "@phosphor-icons/react";
import type { DemoScenario, IngestionResult } from "@flowpilot/contracts";
import { loadScenario, previewLog } from "./api";
import { ApplicationFrame } from "./components/ApplicationFrame";
import { ReportContext, SourceOverview } from "./components/ReportOverview";
import { EvidencePreview } from "./components/EvidencePreview";
import { EventViewer } from "./components/EventViewer";
import { ErrorNotice } from "./components/Status";

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export function App() {
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [scenarioError, setScenarioError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<IngestionResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const returnTarget = useRef("open-events");
  const restoreFocus = useRef(false);

  useEffect(() => {
    let current = true;
    loadScenario()
      .then((data) => {
        if (current) setScenario(data);
      })
      .catch((error) => {
        if (current) setScenarioError(errorMessage(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!viewerOpen && restoreFocus.current) {
      const target = document.getElementById(returnTarget.current);
      const disclosure = target?.closest("details");
      if (disclosure) disclosure.open = true;
      target?.focus();
      restoreFocus.current = false;
    }
  }, [viewerOpen]);

  async function runPreview() {
    if (!scenario || previewing) return;
    setPreviewing(true);
    setPreviewError("");
    try {
      setPreview(await previewLog(scenario.sample_log));
    } catch (error) {
      setPreviewError(errorMessage(error));
    } finally {
      setPreviewing(false);
    }
  }

  function openViewer(target: string, sourceRef?: string) {
    if (!preview) return;
    const event = sourceRef
      ? preview.events.find((event) => event.sourceRef === sourceRef)
      : preview.events[0];
    setSelectedEvent(event?.id ?? null);
    returnTarget.current = target;
    setViewerOpen(true);
  }

  function closeViewer() {
    restoreFocus.current = true;
    setViewerOpen(false);
  }

  return (
    <ApplicationFrame investigation={scenario?.investigation}>
      <main id="main" tabIndex={-1}>
        <section
          className={`masthead ${preview ? "masthead-compact" : ""}`}
          aria-labelledby="phase-title"
        >
          <div>
            <p className="eyebrow">
              Report <span aria-hidden="true">/</span>{" "}
              <span className="mono">
                {scenario?.investigation.id ?? "Sample investigation"}
              </span>
            </p>
            <h1 id="phase-title">
              {preview
                ? "Review the log evidence"
                : "Review the reported defect"}
            </h1>
            <p className="phase-summary">
              {viewerOpen
                ? "Inspect the original records behind each observation."
                : preview
                  ? "Direct machine facts, with their sources and uncertainties intact."
                  : "Begin with the operator’s observation. Check the machine context next."}
            </p>
          </div>
          {scenario && !viewerOpen && (
            <div className="masthead-action">
              <button
                className={preview ? "secondary" : "primary"}
                disabled={previewing}
                onClick={() => void runPreview()}
              >
                {preview ? (
                  <ArrowClockwise aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {previewing
                  ? "Previewing log…"
                  : preview
                    ? "Refresh log preview"
                    : "Preview sample log"}
              </button>
              <span className="action-caption">
                Preview only · nothing is saved
              </span>
            </div>
          )}
        </section>
        {loading && (
          <p className="loading-note" role="status">
            Loading sample investigation…
          </p>
        )}
        {scenarioError && (
          <ErrorNotice
            message={scenarioError}
            action="Retry loading scenario"
            onRetry={() => {
              setLoading(true);
              setScenarioError("");
              setAttempt(attempt + 1);
            }}
          />
        )}
        {scenario && (
          <>
            {previewing && (
              <p className="loading-note" role="status">
                Reading sample events…
              </p>
            )}
            {previewError && (
              <ErrorNotice
                message={`${preview ? "Refresh failed. The last successful preview is still shown. " : ""}${previewError}`}
                action="Retry log preview"
                onRetry={() => void runPreview()}
              />
            )}
            {viewerOpen && preview ? (
              <EventViewer
                result={preview}
                selectedId={selectedEvent}
                onSelect={setSelectedEvent}
                onClose={closeViewer}
              />
            ) : (
              <div
                className={`report-layout ${preview ? "report-layout-active" : ""}`}
              >
                <ReportContext scenario={scenario} compact={!!preview} />
                <div className="work-region">
                  {preview ? (
                    <EvidencePreview
                      result={preview}
                      metadata={scenario.log_metadata}
                      onOpenViewer={openViewer}
                    />
                  ) : (
                    <SourceOverview scenario={scenario} />
                  )}
                </div>
              </div>
            )}
            <footer className="workspace-footer">
              <span>FlowPilot / Evidence-led investigation</span>
              <span>
                Report & log preview available. Later phases are not
                implemented.
              </span>
            </footer>
          </>
        )}
      </main>
    </ApplicationFrame>
  );
}
