import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Cpu,
  Crosshair,
  Eye,
  FileImage,
  Scan,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { VisionAssessment } from "@flowpilot/contracts";
import { assessPhoto } from "../api";
import "../photo.css";

function ModelBadge() {
  return (
    <span className="vision-model-badge">
      <Cpu aria-hidden="true" />
      PatchCore<span>Vision AI</span>
    </span>
  );
}

function ResultSummary({ value }: { value: VisionAssessment }) {
  const scale = Math.max(value.threshold * 2, value.raw_score * 1.12);
  const thresholdPosition = (100 * value.threshold) / scale;
  const scorePosition = (100 * value.raw_score) / scale;
  return (
    <div className="vision-summary">
      <p className="vision-kicker">MODEL FINDING</p>
      <div
        className={`vision-verdict ${value.passed ? "vision-verdict-normal" : "vision-verdict-anomaly"}`}
      >
        {value.passed ? (
          <CheckCircle weight="fill" aria-hidden="true" />
        ) : (
          <WarningCircle weight="fill" aria-hidden="true" />
        )}
        <h3>
          {value.passed ? "Within reference range" : "Visual anomaly detected"}
        </h3>
      </div>
      <p className="vision-summary-copy">
        {value.passed
          ? "The inspected pattern is similar to the normal reference. Confirm recovery with the equipment checks."
          : "The model found a pattern that differs from the normal reference. Review the highlighted area before investigating the cause."}
      </p>
      <div className="vision-score-block">
        <div className="vision-score-heading">
          <span>Anomaly score</span>
          <span className="mono">
            {(value.raw_score / value.threshold).toFixed(2)}× threshold
          </span>
        </div>
        <div className="vision-score-value mono">
          {value.raw_score.toFixed(2)}
          <span> / {value.threshold.toFixed(2)} reference</span>
        </div>
        <div
          className="vision-score-chart"
          role="img"
          aria-label={`Anomaly score ${value.raw_score.toFixed(3)}. Reference threshold ${value.threshold.toFixed(3)}. ${value.passed ? "Within" : "Above"} the reference range.`}
        >
          <div
            className="vision-score-range"
            style={{ width: `${thresholdPosition}%` }}
          />
          <span
            className={`vision-score-point ${value.passed ? "is-normal" : "is-anomaly"}`}
            style={{ left: `${scorePosition}%` }}
          />
          <span
            className="vision-score-cutoff"
            style={{ left: `${thresholdPosition}%` }}
          />
        </div>
        <div className="vision-score-labels">
          <span>Normal reference</span>
          <span>Higher deviation</span>
        </div>
        <p className="vision-score-note">
          A feature-distance score, not a confidence percentage.
        </p>
      </div>
      <div className="vision-next">
        <Crosshair aria-hidden="true" />
        <p>
          {value.passed
            ? "Visual check complete. Equipment checks establish whether recovery is complete."
            : "Next: combine this visual evidence with your observations and the guided inspection."}
        </p>
      </div>
      <details className="vision-details">
        <summary>How the model assessed this photo</summary>
        <p>
          PatchCore-style analysis compares local image features with stored
          normal patches. The heatmap shows where they differ; it does not
          identify a mechanical cause.
        </p>
        <dl>
          <div>
            <dt>Model</dt>
            <dd>{value.model_id}</dd>
          </div>
          <div>
            <dt>Preprocessing</dt>
            <dd>{value.preprocessing_id}</dd>
          </div>
          <div>
            <dt>Inspection region</dt>
            <dd>Center 60% of the photo</dd>
          </div>
          <div>
            <dt>Assessment</dt>
            <dd>{value.assessment_id}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function AnalysisCanvas({
  source,
  title,
  result,
  busy = false,
}: {
  source: string;
  title: string;
  result?: VisionAssessment;
  busy?: boolean;
}) {
  const [view, setView] = useState<"heatmap" | "original">("heatmap");
  const heatmap = !!result && view === "heatmap";
  return (
    <div className="vision-viewer">
      <div className="vision-viewer-toolbar">
        <span>
          <Crosshair aria-hidden="true" />
          {busy
            ? "Model analysis"
            : result
              ? "Inspection viewer"
              : "Image ready"}
        </span>
        {result && (
          <div
            className="vision-view-switch"
            role="group"
            aria-label={`${title} image view`}
          >
            <button
              type="button"
              aria-pressed={view === "original"}
              onClick={() => setView("original")}
            >
              <Eye aria-hidden="true" />
              Original
            </button>
            <button
              type="button"
              aria-pressed={view === "heatmap"}
              onClick={() => setView("heatmap")}
            >
              <Scan aria-hidden="true" />
              AI heatmap
            </button>
          </div>
        )}
      </div>
      <div className={`vision-canvas ${busy ? "is-analyzing" : ""}`}>
        <div className="vision-image-plane">
          <img
            src={heatmap ? result!.heatmap_url : source}
            alt={`${title}: ${heatmap ? "anomaly heatmap" : "inspection photo"}`}
          />
          {!heatmap && (
            <div className="vision-roi" aria-hidden="true">
              {busy && <span className="vision-scan-line" />}
            </div>
          )}
        </div>
        {busy && (
          <div className="vision-scanning-label">
            <CircleNotch className="vision-spinner" aria-hidden="true" />
            Comparing visual features
          </div>
        )}
      </div>
      <div className="vision-viewer-legend">
        {heatmap ? (
          <>
            <span>Deviation intensity</span>
            <span className="vision-heat-legend" aria-hidden="true" />
            <span>Low → High</span>
          </>
        ) : (
          <>
            <span className="vision-roi-key" aria-hidden="true" />
            <span>Inspection region · center 60%</span>
          </>
        )}
      </div>
    </div>
  );
}

export function PhotoResult({
  value,
  title,
}: {
  value: VisionAssessment;
  title: string;
}) {
  return (
    <figure className="photo-result vision-workbench">
      <figcaption className="vision-header">
        <div>
          <p className="vision-kicker">AI VISUAL INSPECTION</p>
          <h2>{title}</h2>
        </div>
        <ModelBadge />
      </figcaption>
      <div className="vision-body">
        <AnalysisCanvas
          key={value.assessment_id}
          source={value.image_url}
          title={title}
          result={value}
        />
        <ResultSummary value={value} />
      </div>
    </figure>
  );
}

export function PhotoInput({
  value,
  onChange,
  onBusy,
  title = "Inspection photo",
}: {
  value: VisionAssessment | null;
  onChange: (value: VisionAssessment | null) => void;
  onBusy: (busy: boolean) => void;
  title?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => () => operation.current?.abort(), []);
  function chooseFile(next: File) {
    if (busy) return;
    onChange(null);
    setError("");
    setFile(null);
    setPreview("");
    setDragging(false);
    if (
      next.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg"].includes(next.type)
    ) {
      setError("Choose a PNG or JPEG photo up to 8 MB.");
      if (input.current) input.current.value = "";
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }
  function cancel() {
    operation.current?.abort();
    operation.current = null;
    setBusy(false);
    onBusy(false);
  }
  async function analyze() {
    if (!file || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    onBusy(true);
    onChange(null);
    setError("");
    try {
      const result = await assessPhoto(file, controller.signal);
      if (!controller.signal.aborted) onChange(result);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Photo analysis failed. Try again.",
        );
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(false);
        onBusy(false);
      }
    }
  }
  const status = busy
    ? "Analyzing image"
    : value
      ? "Analysis complete"
      : file
        ? "Ready to analyze"
        : "Awaiting photo";
  return (
    <section className="photo-intake vision-workbench" aria-label={title}>
      <header className="vision-header">
        <div>
          <p className="vision-kicker">AI VISUAL INSPECTION</p>
          <h2>{title}</h2>
        </div>
        <ol className="vision-steps" aria-label="Photo analysis steps">
          {["Upload photo", "AI analysis", "Review findings"].map(
            (step, index) => {
              const complete =
                index === 0 ? !!file || !!value : index === 1 && !!value;
              const active =
                !file && !value
                  ? index === 0
                  : value
                    ? index === 2
                    : index === 1;
              return (
                <li
                  key={step}
                  className={complete ? "is-complete" : ""}
                  aria-current={active ? "step" : undefined}
                >
                  <span>
                    {complete ? (
                      <CheckCircle weight="fill" aria-hidden="true" />
                    ) : (
                      `0${index + 1}`
                    )}
                  </span>
                  {step}
                  {index < 2 && (
                    <ArrowRight
                      className="vision-step-arrow"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            },
          )}
        </ol>
        <ModelBadge />
      </header>
      <span id={`${id}-hint`} className="sr-only">
        PNG or JPEG photo, up to 8 MB.
      </span>
      <input
        ref={input}
        id={id}
        className="vision-file-input"
        type="file"
        tabIndex={-1}
        aria-label="Upload a photo"
        accept="image/png,image/jpeg"
        disabled={busy}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-invalid={!!error}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) chooseFile(next);
        }}
      />
      {file && (
        <div className="vision-file-bar">
          <FileImage aria-hidden="true" />
          <span>{file.name}</span>
          <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <UploadSimple aria-hidden="true" />
            Replace photo
          </button>
        </div>
      )}
      <div className="vision-body" aria-busy={busy}>
        {file || value ? (
          <AnalysisCanvas
            key={value?.assessment_id ?? "preview"}
            source={value?.image_url ?? preview}
            title={value ? "Analysis result" : title}
            result={value ?? undefined}
            busy={busy}
          />
        ) : (
          <div
            className={`vision-dropzone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const next = event.dataTransfer.files[0];
              if (next) chooseFile(next);
            }}
          >
            <div className="vision-upload-glyph">
              <Scan aria-hidden="true" />
              <UploadSimple aria-hidden="true" />
            </div>
            <h3>Bring the defect into focus</h3>
            <p>Drop your inspection photo here</p>
            <button
              type="button"
              className="primary"
              onClick={() => input.current?.click()}
            >
              <UploadSimple aria-hidden="true" />
              Choose photo
            </button>
            <small>PNG or JPEG · up to 8 MB</small>
          </div>
        )}
        {value ? (
          <ResultSummary value={value} />
        ) : (
          <aside className="vision-explainer">
            <div
              className={`vision-live-status ${busy ? "is-busy" : ""}`}
              role="status"
            >
              {busy ? (
                <CircleNotch className="vision-spinner" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" />
              )}
              {status}
            </div>
            <h3>
              {busy
                ? "Finding visual differences"
                : file
                  ? "Ready for a closer look"
                  : "A second set of eyes for every inspection."}
            </h3>
            <p>
              {busy
                ? "Your photo is being compared with normal-reference features. The result will show the areas that need attention."
                : "PatchCore compares the spray pattern with a normal reference and highlights unusual regions."}
            </p>
            {file && (
              <div className="vision-inline-action">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void analyze()}
                >
                  {busy ? (
                    <CircleNotch
                      className="vision-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Scan aria-hidden="true" />
                  )}
                  {busy ? "Analyzing…" : "Analyze photo"}
                </button>
                {busy && (
                  <button type="button" className="secondary" onClick={cancel}>
                    <X aria-hidden="true" />
                    Cancel
                  </button>
                )}
              </div>
            )}
            <ul className="vision-capabilities" hidden={!!file}>
              <li>
                <Crosshair aria-hidden="true" />
                <span>
                  <strong>Compare the pattern</strong>Inspect the central
                  coating region.
                </span>
              </li>
              <li>
                <Scan aria-hidden="true" />
                <span>
                  <strong>See the difference</strong>Locate deviations on an AI
                  heatmap.
                </span>
              </li>
              <li>
                <CheckCircle aria-hidden="true" />
                <span>
                  <strong>Continue with evidence</strong>Use the findings to
                  guide your inspection.
                </span>
              </li>
            </ul>
            <p className="vision-framing-note">
              Use a top-down close-up. Keep the framing consistent before and
              after repair.
            </p>
          </aside>
        )}
      </div>
      {error && (
        <div id={`${id}-error`} className="photo-error" role="alert">
          <WarningCircle aria-hidden="true" />
          <div>
            <strong>Analysis not completed</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      {file && value && (
        <footer className="vision-action-bar">
          <p>Analysis complete. Review the findings before continuing.</p>
          <div>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void analyze()}
            >
              <Scan aria-hidden="true" />
              Analyze again
            </button>
          </div>
        </footer>
      )}
      <p className="sr-only" role="status" aria-atomic="true">
        {value
          ? value.passed
            ? "Analysis complete. Within reference range."
            : "Analysis complete. Visual anomaly detected."
          : ""}
      </p>
    </section>
  );
}
