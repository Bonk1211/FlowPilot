import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleNotch,
  FileText,
  Images,
  Pause,
  Play,
  Scan,
  Stack,
  TreeStructure,
} from "@phosphor-icons/react";
import type { DemoScenario, IngestionResult } from "@flowpilot/contracts";
import {
  incidentFetch,
  incidentJson,
  type Incident,
  type IncidentEvidence,
} from "./api";
import "./ReplayPipeline.css";

const steps = [
  { title: "Analysing images", detail: "Compare the change", icon: Images },
  {
    title: "Reading machine log",
    detail: "Find the relevant signals",
    icon: FileText,
  },
  {
    title: "Assembling evidence",
    detail: "Build the response flow",
    icon: Stack,
  },
];
const keywords =
  /(TIME_BETWEEN_BOARDS(?:_LANE1)?|Fiducial Find|Fid Found|Fid Score|Height Sense(?: Results)?|Run Started|Run Finished|Board #\d+|PASS|Duration|Frame Location)/gi;
const transcriptId = "photo-machine-log";

function ScanImage({
  evidence,
  scanning,
}: {
  evidence: IncidentEvidence;
  scanning: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!evidence.image_url) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    incidentFetch(evidence.image_url, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Image unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidence.image_url]);
  return (
    <figure className="replay-image">
      <div className="replay-image-frame">
        {url ? (
          <img src={url} alt={evidence.label} />
        ) : (
          <span>
            {failed || !evidence.image_url
              ? "Image unavailable"
              : "Loading image…"}
          </span>
        )}
        {url && scanning && (
          <div className="replay-scan-line" aria-hidden="true" />
        )}
        <span className="replay-image-tag">
          {evidence.role === "last_good" ? "REFERENCE" : "OBSERVED"}
        </span>
      </div>
      <figcaption>
        <strong>
          {evidence.role === "last_good"
            ? "Last known good"
            : "First known bad"}
        </strong>
        <span>{String(evidence.values?.coverage ?? evidence.label)}</span>
      </figcaption>
    </figure>
  );
}

export function ReplayPipeline({
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
  const [source, setSource] = useState<DemoScenario | null>(null);
  const [preview, setPreview] = useState<IngestionResult | null>(null);
  const [ready, setReady] = useState<Incident | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const options = {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
    };
    async function prepare() {
      // Creation starts in the click handler, so StrictMode cannot create two incidents.
      let saved = await request;
      if (controller.signal.aborted) return;
      setIncident(saved);
      const scenario = await incidentJson<DemoScenario>(
        "/api/demo/scenario",
        options,
      );
      if (controller.signal.aborted) return;
      setSource(scenario);
      const parsed = await incidentJson<IngestionResult>("/api/logs/preview", {
        ...options,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario.sample_log),
      });
      if (controller.signal.aborted) return;
      setPreview(parsed);
      // Refresh before writing: background analysis may have advanced the revision.
      saved = await incidentJson<Incident>(
        `/api/incidents/${saved.id}`,
        options,
      );
      if (!saved.evidence?.some((item) => item.id === transcriptId)) {
        saved = await incidentJson<Incident>(
          `/api/incidents/${saved.id}/actions`,
          {
            ...options,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_evidence",
              revision: saved.revision,
              evidence: {
                id: transcriptId,
                kind: "log",
                role: "context",
                label: "Machine log transcribed from supplied photos",
                source_ref: parsed.sourceName,
                event_time: parsed.timeRange.start,
                event_timezone: parsed.timezone,
                time_uncertain: true,
                synthetic: true,
                provenance: `${scenario.log_metadata.source}. ${scenario.log_metadata.limitations.join(". ")}`,
                values: {
                  raw_text: scenario.sample_log.text,
                  source_digest: parsed.sourceDigest,
                  event_count: parsed.stats.eventCount,
                  context:
                    "Historical photo transcript; not time-correlated with the illustrative replay images. Keyword matches are source context, not evidence of a cause.",
                },
              },
            }),
          },
        );
      }
      if (controller.signal.aborted) return;
      setIncident(saved);
      const analyzed = await incidentJson<Incident>(
        `/api/incidents/${saved.id}/actions`,
        {
          ...options,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze", revision: saved.revision }),
        },
      );
      if (controller.signal.aborted) return;
      if (!analyzed.assessment || !analyzed.investigation?.nodes?.length)
        throw new Error(
          "The evidence is saved, but the response flow is not ready. Retry to finish analysis.",
        );
      setIncident(analyzed);
      setReady(analyzed);
    }
    void prepare().catch((cause: unknown) => {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The evidence pipeline could not finish. Please retry.",
        );
    });
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    if (paused || error || reducedMotion) return;
    const timer = window.setInterval(
      () => setElapsed((value) => value + 100),
      100,
    );
    return () => window.clearInterval(timer);
  }, [paused, error, reducedMotion]);

  const stage =
    !incident || (!reducedMotion && elapsed < 2400)
      ? 0
      : !preview || (!reducedMotion && elapsed < 6800)
        ? 1
        : 2;
  useEffect(() => {
    if (ready && !paused && !error && (reducedMotion || elapsed >= 9600))
      onOpen(ready);
  }, [ready, paused, error, reducedMotion, elapsed, onOpen]);

  const images =
    incident?.evidence?.filter(
      (item) => item.kind === "image" && item.status === "collected",
    ) ?? [];
  const lines = source?.sample_log.text.trimEnd().split(/\r?\n/) ?? [];
  const visibleCount =
    reducedMotion || stage === 2
      ? lines.length
      : Math.min(
          lines.length,
          Math.max(1, Math.floor((elapsed - 2400) / 220) + 1),
        );
  const visibleLines = lines.slice(0, visibleCount);
  const matches = [...new Set(visibleLines.join("\n").match(keywords) ?? [])];
  const collected =
    incident?.evidence?.filter((item) => item.status === "collected") ?? [];
  const StageIcon = steps[stage].icon;

  return (
    <section
      className="replay-pipeline"
      data-stage={stage}
      data-paused={paused || !!error}
      aria-labelledby="replay-title"
    >
      <header className="replay-heading">
        <div>
          <p className="eyebrow">S932 / EVIDENCE PIPELINE</p>
          <h1 id="replay-title" tabIndex={-1} ref={heading}>
            From signals to a next step.
          </h1>
          <p>Pulling the source records together for your investigation.</p>
        </div>
        <button onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Back to incidents
        </button>
      </header>

      <ol className="replay-steps" aria-label="Evidence pipeline stages">
        {steps.map((step, index) => (
          <li
            key={step.title}
            data-state={
              index < stage
                ? "complete"
                : index === stage
                  ? "active"
                  : "waiting"
            }
            aria-current={index === stage ? "step" : undefined}
          >
            <span className="replay-step-number">
              {index < stage ? <Check aria-hidden="true" /> : `0${index + 1}`}
            </span>
            <div>
              <strong>{step.title}</strong>
              <span>{index < stage ? "Reviewed" : step.detail}</span>
            </div>
            {index < 2 && (
              <ArrowRight className="replay-step-arrow" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      <div className="replay-console">
        <div className="replay-console-bar">
          <span>
            <span className="replay-live-dot" />{" "}
            {error
              ? "Pipeline paused"
              : ready && stage === 2
                ? "Evidence assembled"
                : "Processing evidence"}
          </span>
          <span className="mono">S932 / DJ-2200 / BFS</span>
        </div>
        <div className="replay-console-body">
          <div className="replay-visual" key={stage}>
            {stage === 0 ? (
              <>
                <div className="replay-visual-label">
                  <Scan aria-hidden="true" /> IMAGE COMPARISON{" "}
                  <span>AI-generated replay images</span>
                </div>
                <div className="replay-image-pair">
                  {images.length ? (
                    images.map((item) => (
                      <ScanImage
                        key={item.id}
                        evidence={item}
                        scanning={!error}
                      />
                    ))
                  ) : (
                    <div className="replay-empty">
                      <Images aria-hidden="true" />
                      <span>Retrieving the saved image pair…</span>
                    </div>
                  )}
                </div>
                <p className="replay-visual-note">
                  Comparing saved coverage observations across the last-good and
                  first-bad images.
                </p>
              </>
            ) : stage === 1 ? (
              <>
                <div className="replay-visual-label">
                  <FileText aria-hidden="true" /> SOURCE SCAN{" "}
                  <span>{source?.sample_log.sourceName ?? "Loading log…"}</span>
                </div>
                <div className="replay-log" aria-label="Machine log transcript">
                  <div
                    className="replay-log-track"
                    style={{
                      transform: `translateY(-${Math.max(0, visibleCount - 9) * 32}px)`,
                    }}
                  >
                    {visibleLines.map((line, index) => (
                      <div
                        className="replay-log-line"
                        key={index}
                        data-current={index === visibleCount - 1}
                      >
                        <span>{String(index + 1).padStart(3, "0")}</span>
                        <code>
                          {line
                            .split(keywords)
                            .map((part, i) =>
                              i % 2 ? <mark key={i}>{part}</mark> : part,
                            )}
                        </code>
                      </div>
                    ))}
                  </div>
                  {!lines.length && (
                    <p className="replay-empty">
                      Retrieving the saved log transcript…
                    </p>
                  )}
                </div>
                <p className="replay-visual-note">
                  Transcribed from your supplied photos · original machine file
                  unavailable.
                </p>
              </>
            ) : (
              <>
                <div className="replay-visual-label">
                  <TreeStructure aria-hidden="true" /> EVIDENCE ASSEMBLY{" "}
                  <span>Sources stay attached</span>
                </div>
                <div className="replay-assembly">
                  <div className="replay-source-stack">
                    {collected.map((item, i) => (
                      <div
                        key={item.id}
                        style={{ "--replay-order": i } as CSSProperties}
                      >
                        {item.kind === "image" ? (
                          <Images aria-hidden="true" />
                        ) : (
                          <FileText aria-hidden="true" />
                        )}
                        <span>
                          {item.id === transcriptId
                            ? "Machine log transcript"
                            : item.role === "last_good"
                              ? "Last-good image"
                              : item.role === "first_bad"
                                ? "First-bad image"
                                : item.label}
                        </span>
                        <Check aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                  <div className="replay-connector" aria-hidden="true">
                    <span />
                  </div>
                  <div className="replay-package">
                    <Stack aria-hidden="true" />
                    <strong>Evidence package</strong>
                    <span>{collected.length} collected sources</span>
                  </div>
                  <div className="replay-connector" aria-hidden="true">
                    <span />
                  </div>
                  <div className="replay-flow">
                    <TreeStructure aria-hidden="true" />
                    <strong>Response flow</strong>
                    <span>
                      {ready ? "Ready to explore" : "Building your next step…"}
                    </span>
                  </div>
                </div>
                <p className="replay-visual-note">
                  The historical log and replay images have different
                  timestamps. Their relationship remains unconfirmed.
                </p>
              </>
            )}
          </div>

          <aside className="replay-context">
            <span className="replay-stage-icon">
              <StageIcon aria-hidden="true" />
            </span>
            <p className="replay-kicker">STAGE 0{stage + 1} / 03</p>
            <h2>{steps[stage].title}</h2>
            <p>
              {stage === 0
                ? "Bring the reference and observed images into view. Look for the change in coverage."
                : stage === 1
                  ? "Follow the saved log line by line. Pick out board events, alignment checks and timing signals."
                  : "Keep images, source lines and open questions together, then prepare the investigation path."}
            </p>
            {stage === 1 ? (
              <div
                className="replay-keywords"
                aria-label="Keywords found in the log"
              >
                <span className="replay-kicker">
                  KEYWORDS FOUND · {matches.length}
                </span>
                <div>
                  {matches.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </div>
              </div>
            ) : stage === 2 ? (
              <div className="replay-evidence-summary">
                <span>
                  <Check aria-hidden="true" /> {collected.length} sources
                  preserved
                </span>
                <span>
                  <Check aria-hidden="true" /> {preview?.stats.eventCount ?? 0}{" "}
                  log events read
                </span>
                <span>
                  {incident?.evidence?.filter(
                    (item) => item.status !== "collected",
                  ).length ?? 0}{" "}
                  sources still pending or unavailable
                </span>
              </div>
            ) : (
              <div className="replay-context-caption">
                Saved observations · illustrative coverage comparison
              </div>
            )}
          </aside>
        </div>
        <footer className="replay-footer">
          <div role="status" aria-atomic="true">
            {error ? (
              <span>Review the error below to continue.</span>
            ) : (
              <>
                <CircleNotch
                  className={ready ? "" : "replay-spinner"}
                  aria-hidden="true"
                />
                <span>
                  {ready && stage === 2
                    ? paused
                      ? "Response flow ready to open."
                      : "Response flow ready. Opening your investigation…"
                    : `${steps[stage].title}…`}
                </span>
              </>
            )}
          </div>
          <div className="replay-controls">
            {!reducedMotion && (
              <button
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? (
                  <Play aria-hidden="true" />
                ) : (
                  <Pause aria-hidden="true" />
                )}
                {paused ? "Resume animation" : "Pause animation"}
              </button>
            )}
            <button disabled={!ready} onClick={() => ready && onOpen(ready)}>
              Open response flow <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
      {error && (
        <div className="incident-error replay-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setError("");
              setReady(null);
              setElapsed(0);
              onRetry();
            }}
          >
            Retry pipeline
          </button>
          {incident && (
            <button onClick={() => onOpen(incident)}>
              Open saved incident
            </button>
          )}
        </div>
      )}
      <p className="replay-provenance">
        Replay presentation · log keywords come from the saved transcript.
        Matches are context, not a confirmed cause.
      </p>
    </section>
  );
}
