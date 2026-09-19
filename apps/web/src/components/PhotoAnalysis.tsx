import { useEffect, useId, useState } from "react";
import type { VisionAssessment, VisionExample } from "@flowpilot/contracts";
import { assessExample, assessPhoto, loadPhotoExamples } from "../api";
import "../photo.css";

export function PhotoResult({
  value,
  title,
}: {
  value: VisionAssessment;
  title: string;
}) {
  return (
    <figure className="photo-result">
      <figcaption>{title}</figcaption>
      <div className="photo-pair">
        <div>
          <img src={value.image_url} alt={`${title}: inspection photo`} />
          <span>Inspection photo</span>
        </div>
        <div>
          <img src={value.heatmap_url} alt={`${title}: anomaly heatmap`} />
          <span>Anomaly map</span>
        </div>
      </div>
      <p
        className={`photo-outcome ${value.passed ? "photo-normal" : "photo-anomaly"}`}
      >
        <span aria-hidden="true">{value.passed ? "✓" : "◉"}</span>
        <span>{value.passed ? "Within reference range" : "Area to review"}</span>
      </p>
      <p className="photo-caption">
        {value.passed
          ? "The inspected region looks similar to the normal reference."
          : "Warm areas differ from the normal reference. Confirm the symptom during discovery."}
      </p>
      <details className="photo-analysis-details">
        <summary>Analysis details</summary>
        <dl>
          <div>
            <dt>Anomaly score</dt>
            <dd>{value.raw_score.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Reference threshold</dt>
            <dd>{value.threshold.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{value.model_id}</dd>
          </div>
          <div>
            <dt>Inspection region</dt>
            <dd>Center 60% of the image</dd>
          </div>
        </dl>
        <p>
          Scores measure feature differences, not defect probability or root
          cause.
        </p>
      </details>
    </figure>
  );
}

export function PhotoInput({
  value,
  onChange,
  onBusy,
  title = "Inspection photo",
  initialExample = "incomplete",
}: {
  value: VisionAssessment | null;
  onChange: (value: VisionAssessment | null) => void;
  onBusy: (busy: boolean) => void;
  title?: string;
  initialExample?: string;
}) {
  const id = useId();
  const [examples, setExamples] = useState<VisionExample[]>([]);
  const [example, setExample] = useState(initialExample);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadPhotoExamples()
      .then((items) => {
        if (active) {
          setExamples(items);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load examples.");
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  const source = file
    ? preview
    : examples.find((item) => item.id === example)?.image_url;
  async function analyze() {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    onChange(null);
    setError("");
    try {
      onChange(file ? await assessPhoto(file) : await assessExample(example));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Photo analysis failed. Try again.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="photo-intake" aria-label={title}>
      <div className="photo-intake-controls">
        <p className="eyebrow">Visual inspection</p>
        <h2>{title}</h2>
        <p>
          Use a top-down close-up of the coated area. Keep the same framing for
          the before and after photos.
        </p>
        <label className="photo-upload" htmlFor={id}>
          <span>Upload a photo</span>
          <small>PNG or JPEG · up to 8 MB</small>
        </label>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (!next) return;
            onChange(null);
            setError("");
            setFile(null);
            setPreview("");
            setExample("");
            if (
              next.size > 8 * 1024 * 1024 ||
              !["image/png", "image/jpeg"].includes(next.type)
            ) {
              setError("Choose a PNG or JPEG up to 8 MB.");
              event.target.value = "";
              return;
            }
            setFile(next);
            setPreview(URL.createObjectURL(next));
          }}
        />
        {file && <p className="photo-filename">{file.name}</p>}
        <p className="photo-example-label">Or try an example</p>
        <div className="photo-examples">
          {examples.map((item) => (
            <button
              key={item.id}
              type="button"
              className="photo-example"
              disabled={busy}
              aria-pressed={!file && example === item.id}
              onClick={() => {
                setExample(item.id);
                setFile(null);
                setError("");
                onChange(null);
                const input = document.getElementById(
                  id,
                ) as HTMLInputElement | null;
                if (input) input.value = "";
              }}
            >
              <img src={item.image_url} alt="" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          disabled={busy || (!file && !source)}
          onClick={() => void analyze()}
        >
          {busy
            ? "Analyzing photo…"
            : value
              ? "Analyze again"
              : "Analyze photo"}
        </button>
        {busy && <p role="status">Comparing with the normal reference…</p>}
        {error && (
          <div className="photo-error" role="alert">
            <p>{error}</p>
            {!examples.length && (
              <button
                type="button"
                className="secondary"
                onClick={() => setRetry((n) => n + 1)}
              >
                Retry examples
              </button>
            )}
          </div>
        )}
      </div>
      {value ? (
        <PhotoResult value={value} title="Analysis result" />
      ) : (
        <figure className="photo-preview">
          {source ? (
            <img src={source} alt="Photo ready for analysis" />
          ) : (
            <div className="photo-placeholder">Choose a photo to begin</div>
          )}
          <figcaption>
            Analyze the photo to highlight areas that need a closer look.
          </figcaption>
        </figure>
      )}
    </section>
  );
}
