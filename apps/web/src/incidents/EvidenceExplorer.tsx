import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Clock,
  Play,
  Pause,
  Image,
  FileText,
} from "@phosphor-icons/react";
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
        setFailed(false);
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
  actions,
}: {
  actions?: ReactNode;
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
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [collapsedId, setCollapsedId] = useState<string | null>(null);
  const timeline = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    query.addEventListener("change", update);
    document.addEventListener("visibilitychange", pause);
    return () => {
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", pause);
      setPlaying(false);
    };
  }, []);
  const select = (id: string) => {
    setPlaying(false);
    setCollapsedId(null);
    onSelect(id);
  };
  useEffect(() => {
    const list = timeline.current;
    if (layout !== "horizontal" || !list) return;
    const center = (behavior: ScrollBehavior) => {
      const marker = list.querySelector<HTMLElement>(
        ".incident-event.selected",
      );
      if (!marker) return;
      const offset =
        marker.getBoundingClientRect().left - list.getBoundingClientRect().left;
      list.scrollTo({
        left:
          list.scrollLeft +
          offset -
          (list.clientWidth - marker.clientWidth) / 2,
        behavior,
      });
    };
    center(reduced ? "instant" : "smooth");
    let width = list.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === list.clientWidth) return;
      width = list.clientWidth;
      center("instant");
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedId, layout, evidence.length, reduced]);
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
  const selectedIndex = ordered.findIndex((item) => item.id === selectedId);
  const nextId = ordered[selectedIndex + 1]?.id;
  const atPenultimate = selectedIndex >= ordered.length - 2;
  useEffect(() => {
    if (!playing || reduced || !nextId) return;
    const timer = window.setTimeout(() => {
      onSelect(nextId);
      setCollapsedId(null);
      if (atPenultimate) setPlaying(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, nextId, onSelect, atPenultimate]);
  const flags: Record<IncidentEvidence["role"], string> = {
    last_good: "Last known good",
    first_bad: "First known bad",
    machine_log: "Machine log",
    pm: "Maintenance",
    context: "Context / change",
  };
  const detail = (
    <section
      key={selectedId}
      className="incident-event-detail"
      aria-label="Selected evidence"
    >
      {selected ? (
        <>
          <button
            className="incident-detail-toggle"
            aria-expanded={collapsedId !== selected.id}
            aria-controls="selected-evidence-content"
            onClick={() =>
              setCollapsedId(collapsedId === selected.id ? null : selected.id)
            }
          >
            <span>
              {layout === "horizontal" ? (
                <>
                  <span className="eyebrow">
                    Event {selectedIndex + 1} of {ordered.length} ·{" "}
                    {selected.synthetic ? "Simulated" : "Observed"}
                  </span>
                  <strong>{selected.label}</strong>
                  <span className="incident-caption">
                    {displayTime(selected.event_time)}
                  </span>
                </>
              ) : collapsedId === selected.id ? (
                "Show event content"
              ) : (
                "Hide event content"
              )}
            </span>
            {collapsedId === selected.id ? (
              <CaretRight aria-hidden="true" />
            ) : (
              <CaretDown aria-hidden="true" />
            )}
          </button>
          <div
            id="selected-evidence-content"
            hidden={collapsedId === selected.id}
          >
            {selected.kind === "image" && (
              <EvidenceImage
                key={`image-${selected.id}`}
                evidence={selected}
                title="Selected source image"
                onSelect={select}
              />
            )}
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
                  {selected.time_uncertain ? " · Time ordering uncertain" : ""}
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
          </div>
        </>
      ) : (
        <p className="incident-muted">
          {evidence.length
            ? "Select an image or event to inspect its original values, timing and provenance."
            : "No source events yet. Add source evidence to start the timeline."}
        </p>
      )}
    </section>
  );
  return (
    <section
      className="incident-card incident-evidence-explorer"
      aria-labelledby="incident-evidence-heading"
      onFocusCapture={() => setPlaying(false)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !(event.target instanceof Element))
          return;
        const drawer = event.target.closest<HTMLDetailsElement>(
          ".incident-source-tools[open]",
        );
        if (drawer) {
          drawer.open = false;
          drawer.querySelector("summary")?.focus();
        }
      }}
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Follow the evidence</p>
          <h2 id="incident-evidence-heading">Evidence & timeline</h2>
        </div>
        <div className="incident-timeline-actions">
          <span className="incident-tag">
            {active.filter((item) => item.status === "collected").length} /{" "}
            {active.length} collected
          </span>
          <details
            className="incident-source-tools"
            name="evidence-tools"
            onClick={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest(".incident-image-button")
              )
                event.currentTarget.open = false;
            }}
          >
            <summary>
              <Image aria-hidden="true" /> Compare images
            </summary>
            <div className="incident-source-drawer">
              <div className="incident-timeline-heading">
                <h3>Coverage comparison</h3>
              </div>
              <div className="incident-image-pair">
                <EvidenceImage
                  key={
                    active.find((item) => item.role === "last_good")?.id ??
                    "last_good"
                  }
                  evidence={active.find((item) => item.role === "last_good")}
                  title="Last known good"
                  onSelect={select}
                />
                <EvidenceImage
                  key={
                    active.find((item) => item.role === "first_bad")?.id ??
                    "first_bad"
                  }
                  evidence={active.find((item) => item.role === "first_bad")}
                  title="First known bad"
                  onSelect={select}
                />
              </div>
              <p className="incident-muted incident-caption">
                {active.some((item) => item.kind === "image" && item.synthetic)
                  ? "Replay uses AI-generated illustrative images. They do not measure production coverage or establish a real failure boundary."
                  : "Compare source identity, camera position and lighting before interpreting a visual change. Images alone do not establish the cause."}
              </p>
            </div>
          </details>
          {actions}
        </div>
      </div>
      <div className="incident-timeline-toolbar">
        <h3>
          <Clock aria-hidden="true" /> Source events
        </h3>
        <div
          className="incident-view-toggle"
          role="group"
          aria-label="Timeline layout"
        >
          <button
            aria-pressed={layout === "horizontal"}
            onClick={() => {
              setPlaying(false);
              setLayout("horizontal");
            }}
          >
            Horizontal
          </button>
          <button
            aria-pressed={layout === "vertical"}
            onClick={() => {
              setPlaying(false);
              setLayout("vertical");
            }}
          >
            Vertical
          </button>
        </div>
        {ordered.length > 0 && (
          <div className="incident-timeline-controls">
            <button
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              disabled={ordered.length < 2 || reduced}
              title={
                reduced
                  ? "Playback is disabled for reduced motion"
                  : "Advance one source event every 3 seconds"
              }
              onClick={() => {
                if (!playing && !nextId) onSelect(ordered[0].id);
                setPlaying((value) => !value);
              }}
            >
              {playing ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
            <button
              aria-label="Previous event"
              disabled={selectedIndex <= 0}
              onClick={() => select(ordered[selectedIndex - 1].id)}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <label className="incident-event-scrubber">
              Explore source events
              <input
                type="range"
                min={0}
                max={ordered.length - 1}
                step={1}
                value={Math.max(0, selectedIndex)}
                onFocus={() => {
                  if (selectedIndex < 0) select(ordered[0].id);
                }}
                onChange={(event) =>
                  select(ordered[Number(event.target.value)].id)
                }
                aria-valuetext={selected?.label ?? ordered[0].label}
              />
            </label>
            <button
              aria-label="Next event"
              disabled={selectedIndex === ordered.length - 1}
              onClick={() => select(ordered[selectedIndex + 1].id)}
            >
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <p className="incident-timeline-caption">
        UTC · Sequence spacing, not elapsed time · Undated records last.
        {evidence.some((item) => item.time_uncertain) &&
          " Timing uncertain: order is provisional."}
        {playing && " Playing · 3 seconds per event"}
      </p>
      <div className="incident-events" data-layout={layout}>
        <ol
          ref={timeline}
          aria-label="Evidence timeline"
          className="incident-timeline"
          onKeyDown={(event) => {
            if (
              !(event.target instanceof HTMLElement) ||
              !event.target.classList.contains("incident-event")
            )
              return;
            const index = ["ArrowRight", "ArrowDown"].includes(event.key)
              ? selectedIndex + 1
              : ["ArrowLeft", "ArrowUp"].includes(event.key)
                ? selectedIndex - 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? ordered.length - 1
                    : null;
            if (index === null) return;
            event.preventDefault();
            const target = Math.max(0, Math.min(ordered.length - 1, index));
            select(ordered[target].id);
            const buttons =
              timeline.current?.querySelectorAll<HTMLButtonElement>(
                ".incident-event",
              );
            buttons?.[target]?.focus({ preventScroll: true });
          }}
        >
          {ordered.map((item, index) => (
            <li key={item.id} data-past={index < selectedIndex}>
              <button
                aria-pressed={selectedId === item.id}
                tabIndex={
                  selectedId === item.id || (selectedIndex < 0 && index === 0)
                    ? 0
                    : -1
                }
                title={item.label}
                onClick={() => select(item.id)}
                className={
                  selectedId === item.id
                    ? "incident-event selected"
                    : "incident-event"
                }
              >
                <span className="incident-event-flag">{flags[item.role]}</span>
                <span className="incident-event-time">
                  {displayTime(item.event_time)}
                </span>
                <span className="incident-event-dot" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="incident-event-card">
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
                      {item.synthetic ? "Simulated" : "Observed"} ·{" "}
                      {item.status}
                      {superseded.has(item.id) ? " · Superseded" : ""}
                    </span>
                    {item.time_uncertain && <span>Timing uncertain</span>}
                  </span>
                  <CaretRight
                    className="incident-event-caret"
                    aria-hidden="true"
                  />
                </span>
              </button>
              {layout === "vertical" && selectedId === item.id && detail}
            </li>
          ))}
        </ol>
        {(layout === "horizontal" || !selected) && detail}
      </div>
    </section>
  );
}
