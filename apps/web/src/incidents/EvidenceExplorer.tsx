import { useEffect, useState } from "react";
import { ArrowSquareOut, Clock, Image, FileText } from "@phosphor-icons/react";
import {
  incidentFetch,
  type EvidenceInput,
  type IncidentEvidence,
} from "./api";

// eslint-disable-next-line react-refresh/only-export-components -- Shared timestamp formatting for this feature.
export function displayTime(value?: string | null) {
  if (!value) return "Event time unavailable";
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return `${value} (offset unknown)`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      });
}

function imageUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) &&
      url.origin === window.location.origin
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function RecordedValues({
  values = {},
}: {
  values: IncidentEvidence["values"];
}) {
  const samples = Array.isArray(values.samples)
    ? values.samples.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item) &&
          "mass_mg" in item &&
          "fluid_pressure_bar" in item,
      )
    : [];
  return (
    <>
      <dl className="incident-facts">
        {Object.entries(values)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll("_", " ")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
      </dl>
      {samples.length > 0 && (
        <div className="incident-sample-table">
          <table>
            <caption>Recorded samples — original units</caption>
            <thead>
              <tr>
                <th scope="col">Tray</th>
                <th scope="col">Mass (mg)</th>
                <th scope="col">Fluid pressure (bar)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample, index) => (
                <tr key={index}>
                  <th scope="row">{String(sample.tray ?? "Unspecified")}</th>
                  <td>{String(sample.mass_mg ?? "Unavailable")}</td>
                  <td>{String(sample.fluid_pressure_bar ?? "Unavailable")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary>Original source values</summary>
        <pre className="incident-record">{JSON.stringify(values, null, 2)}</pre>
      </details>
    </>
  );
}

function EvidenceImage({
  evidence,
  title,
  onSelect,
}: {
  evidence?: IncidentEvidence;
  title: string;
  onSelect: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(evidence?.image_url);
  const [loaded, setLoaded] = useState<{
    source: string;
    objectUrl: string;
  } | null>(null);
  useEffect(() => {
    if (!url || evidence?.status !== "collected") return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;
    incidentFetch(url, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Image unavailable");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ source: url, objectUrl });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, evidence?.status]);
  const displayUrl = loaded?.source === url ? loaded.objectUrl : null;
  return (
    <figure className="incident-image">
      <div className="incident-image-title">
        <span>{title}</span>
        <span className="incident-tag">
          {evidence
            ? evidence.synthetic
              ? "Simulated"
              : "Observed"
            : "Not supplied"}
        </span>
      </div>
      {displayUrl && evidence?.status === "collected" && !failed ? (
        <button
          className="incident-image-button"
          onClick={() => onSelect(evidence.id)}
          aria-label={`Inspect ${title.toLowerCase()} evidence`}
        >
          <img
            src={displayUrl}
            alt={`${title}: ${evidence.label}`}
            width="512"
            height="512"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <div className="incident-image-missing">
          <Image aria-hidden="true" />
          <p>
            {failed
              ? "Image could not load"
              : url && evidence?.status === "collected"
                ? "Loading image…"
                : `Image ${evidence?.status ?? "not supplied"}`}
          </p>
        </div>
      )}
      <figcaption>
        <strong>{evidence?.label ?? "Awaiting source image"}</strong>
        <span>{displayTime(evidence?.event_time)}</span>
        <span>
          {evidence
            ? [evidence.lot_id, evidence.tray_id, evidence.unit_id]
                .filter(Boolean)
                .join(" / ") || "Lot / tray / unit association unavailable"
            : "Association unavailable"}
        </span>
        {displayUrl && (
          <a href={displayUrl} target="_blank" rel="noreferrer">
            Open original <ArrowSquareOut aria-hidden="true" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function CorrectionForm({
  evidence,
  onCorrect,
  busy,
}: {
  evidence: IncidentEvidence;
  busy: boolean;
  onCorrect: (
    id: string,
    replacement: EvidenceInput,
    reason: string,
  ) => Promise<void>;
}) {
  const [label, setLabel] = useState(evidence.label);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState(
    JSON.stringify(evidence.values, null, 2),
  );
  const [error, setError] = useState("");
  return (
    <details className="incident-correction">
      <summary>Correct this evidence</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            const parsed: unknown = JSON.parse(values);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
              throw new Error("Values must be a JSON object.");
            const replacement: EvidenceInput = {
              id: `${evidence.id.slice(0, 50)}-${crypto.randomUUID()}`,
              kind: evidence.kind,
              role: evidence.role,
              label,
              source_ref: evidence.source_ref,
              event_time: evidence.event_time,
              event_timezone: evidence.event_timezone,
              time_uncertain: evidence.time_uncertain,
              clock_offset_seconds: evidence.clock_offset_seconds,
              tool_id: evidence.tool_id,
              configuration: evidence.configuration,
              lot_id: evidence.lot_id,
              tray_id: evidence.tray_id,
              unit_id: evidence.unit_id,
              synthetic: evidence.synthetic,
              provenance: evidence.provenance,
              status: evidence.status,
              image_url: evidence.image_url,
              artifact_id: evidence.artifact_id,
              values: parsed as EvidenceInput["values"],
            };
            await onCorrect(evidence.id, replacement, reason);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Correction could not be saved.",
            );
          }
        }}
      >
        <p>
          A correction creates a new evidence record and preserves this
          original.
        </p>
        <label>
          Evidence label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label>
          Recorded values (JSON)
          <textarea
            className="mono"
            rows={6}
            value={values}
            onChange={(event) => setValues(event.target.value)}
            required
          />
        </label>
        <label>
          Reason for correction
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={1000}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy || !reason.trim()} type="submit">
          Save correction
        </button>
      </form>
    </details>
  );
}

export function EvidenceExplorer({
  evidence,
  selectedId,
  onSelect,
  onCorrect,
  busy,
  closed,
}: {
  evidence: IncidentEvidence[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCorrect: (
    id: string,
    replacement: EvidenceInput,
    reason: string,
  ) => Promise<void>;
  busy: boolean;
  closed: boolean;
}) {
  const superseded = new Set(
    evidence.map((item) => item.supersedes_id).filter(Boolean),
  );
  const active = evidence.filter((item) => !superseded.has(item.id));
  const selected = evidence.find((item) => item.id === selectedId);
  const sortTime = (item: IncidentEvidence) =>
    item.event_time && /(Z|[+-]\d{2}:\d{2})$/i.test(item.event_time)
      ? Date.parse(item.event_time)
      : Infinity;
  const ordered = [...evidence].sort((a, b) => sortTime(a) - sortTime(b));
  return (
    <section
      className="incident-card"
      aria-labelledby="incident-evidence-heading"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Preserve the change</p>
          <h2 id="incident-evidence-heading">Evidence & timeline</h2>
        </div>
        <span className="incident-tag">
          {active.filter((item) => item.status === "collected").length} /{" "}
          {active.length} collected
        </span>
      </div>
      <div className="incident-image-pair">
        <EvidenceImage
          key={
            active.find((item) => item.role === "last_good")?.id ?? "last_good"
          }
          evidence={active.find((item) => item.role === "last_good")}
          title="Last known good"
          onSelect={onSelect}
        />
        <EvidenceImage
          key={
            active.find((item) => item.role === "first_bad")?.id ?? "first_bad"
          }
          evidence={active.find((item) => item.role === "first_bad")}
          title="First known bad"
          onSelect={onSelect}
        />
      </div>
      <p className="incident-muted incident-caption">
        {active.some((item) => item.kind === "image" && item.synthetic)
          ? "Replay uses AI-generated illustrative images. They do not measure production coverage or establish a real failure boundary."
          : "Compare source identity, camera position and lighting before interpreting a visual change. Images alone do not establish the cause."}
      </p>
      <div className="incident-timeline-heading">
        <h3>
          <Clock aria-hidden="true" /> Source events
        </h3>
        <span className="incident-muted">Known offsets shown in UTC</span>
      </div>
      {ordered.length > 0 && (
        <label className="incident-event-scrubber">
          Explore source events
          <input
            type="range"
            min={0}
            max={ordered.length - 1}
            step={1}
            value={Math.max(
              0,
              ordered.findIndex((item) => item.id === selectedId),
            )}
            onFocus={() => {
              if (!selectedId) onSelect(ordered[0].id);
            }}
            onChange={(event) =>
              onSelect(ordered[Number(event.target.value)].id)
            }
            aria-valuetext={selected?.label ?? ordered[0].label}
          />
          <span className="incident-caption">
            {selected
              ? `Selected: ${selected.label}`
              : "Use the slider or arrow keys to inspect a source record."}{" "}
            Record positions do not establish precise machine timing.
          </span>
        </label>
      )}
      {evidence.some((item) => item.time_uncertain) && (
        <p className="incident-notice">
          Clock mismatch or uncertain timing is recorded. Display order is
          provisional; original timestamps are retained below.
        </p>
      )}
      <div className="incident-events">
        <ol aria-label="Evidence timeline" className="incident-timeline">
          {ordered.map((item) => (
            <li key={item.id}>
              <button
                aria-pressed={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                className={
                  selectedId === item.id
                    ? "incident-event selected"
                    : "incident-event"
                }
              >
                <span className="incident-event-icon">
                  {item.kind === "image" ? (
                    <Image aria-hidden="true" />
                  ) : (
                    <FileText aria-hidden="true" />
                  )}
                </span>
                <span className="incident-event-text">
                  <strong>{item.label}</strong>
                  <span>
                    {displayTime(item.event_time)}
                    {item.time_uncertain ? " · Timing uncertain" : ""}
                  </span>
                  <span>
                    {item.synthetic ? "Simulated" : "Observed"} · {item.status}
                    {superseded.has(item.id) ? " · Superseded" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="incident-event-detail" aria-label="Selected evidence">
          {selected ? (
            <>
              <div className="incident-section-title">
                <h3>{selected.label}</h3>
                <span className="incident-tag">
                  {selected.synthetic ? "Simulated" : "Observed"}
                </span>
              </div>
              <dl className="incident-facts">
                <div>
                  <dt>Source</dt>
                  <dd>{selected.source_ref}</dd>
                </div>
                <div>
                  <dt>Source event time</dt>
                  <dd>
                    {selected.event_time ?? "Unavailable"} ·{" "}
                    {selected.event_timezone ?? "Timezone unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Clock correction</dt>
                  <dd>
                    {selected.clock_offset_seconds == null
                      ? "No verified correction supplied"
                      : `${selected.clock_offset_seconds} seconds recorded; original timestamp retained`}
                  </dd>
                </div>
                <div>
                  <dt>Ingested</dt>
                  <dd>{displayTime(selected.ingested_at)}</dd>
                </div>
                <div>
                  <dt>Tool / configuration</dt>
                  <dd>
                    {selected.tool_id} / {selected.configuration}
                  </dd>
                </div>
                <div>
                  <dt>Collection</dt>
                  <dd>
                    {selected.status}
                    {selected.time_uncertain
                      ? " · Time ordering uncertain"
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Provenance</dt>
                  <dd>{selected.provenance}</dd>
                </div>
              </dl>
              <RecordedValues values={selected.values} />
              {!closed && !superseded.has(selected.id) && (
                <CorrectionForm
                  key={selected.id}
                  evidence={selected}
                  busy={busy}
                  onCorrect={onCorrect}
                />
              )}
            </>
          ) : (
            <p className="incident-muted">
              Select an image or event to inspect its original values, timing
              and provenance.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
