import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Question,
  Warning,
  TextIndent,
  CaretDown,
} from "@phosphor-icons/react";
import type { IngestionResult } from "@flowpilot/contracts";
import {
  displayTimestamp,
  eventFlags,
  eventSummary,
  humanize,
} from "../presentation";

export function EventViewer({
  result,
  selectedId,
  onSelect,
  onClose,
}: {
  result: IngestionResult;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const initialId = useRef(selectedId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const target = initialId.current
      ? document.getElementById(`event-${initialId.current}`)
      : heading.current;
    target?.focus();
  }, []);
  return (
    <section className="event-stage" aria-labelledby="events-title">
      <div className="stage-toolbar">
        <button className="stage-back" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
          Back to preview
        </button>
        <span>Simulated log · Source order preserved</span>
      </div>
      <div className="stage-heading">
        <div>
          <p className="eyebrow">Source inspection</p>
          <h2 id="events-title" ref={heading} tabIndex={-1}>
            Raw machine events
          </h2>
          <p className="mono">{result.sourceName}</p>
        </div>
        <p className="stage-count">
          <strong className="mono">{result.events.length}</strong> events
        </p>
      </div>
      <p className="stage-note">
        Local timestamps ·{" "}
        {result.timezone
          ? `Supplied offset ${result.timezone}`
          : "Timezone not supplied"}
        . Original order is retained, including timestamp regressions.
      </p>
      <div className="event-columns" aria-hidden="true">
        <span>Local timestamp</span>
        <span>Event / normalized summary</span>
        <span>Recognition / flags</span>
        <span>Source</span>
      </div>
      <div className="event-list">
        {result.events.length === 0 && (
          <p className="empty-note">No events were found in this log.</p>
        )}
        {result.events.map((event) => {
          const flags = eventFlags(event, result.warnings);
          const selected = selectedId === event.id;
          return (
            <article
              className={`event-record ${selected ? "event-selected" : ""}`}
              key={event.id}
            >
              <button
                className="event-selector"
                id={`event-${event.id}`}
                aria-expanded={selected}
                aria-controls={`payload-${event.id}`}
                onClick={() => onSelect(selected ? null : event.id)}
              >
                <time
                  className="event-time mono"
                  dateTime={event.localTimestamp ?? undefined}
                >
                  {displayTimestamp(event.localTimestamp)}
                </time>
                <span className="event-description">
                  <strong>{humanize(event.kind)}</strong>
                  <span>{eventSummary(event)}</span>
                </span>
                <span className="event-flags">
                  <span
                    className={
                      flags.unknown ? "event-caution" : "event-recognized"
                    }
                  >
                    {flags.unknown ? (
                      <Question aria-hidden="true" />
                    ) : (
                      <CheckCircle aria-hidden="true" />
                    )}
                    {flags.unknown ? "Unknown" : "Recognized"}
                  </span>
                  {flags.regression && (
                    <span className="event-caution">
                      <Warning aria-hidden="true" />
                      Out of order
                    </span>
                  )}
                  {flags.continuation && (
                    <span className="event-caution">
                      <TextIndent aria-hidden="true" />
                      Continuation
                    </span>
                  )}
                </span>
                <span className="event-line mono">
                  L{event.lineStart}
                  {event.lineStart !== event.lineEnd
                    ? `–L${event.lineEnd}`
                    : ""}
                  <CaretDown aria-hidden="true" />
                </span>
              </button>
              <div
                id={`payload-${event.id}`}
                hidden={!selected}
                className="event-detail"
              >
                <p className="eyebrow">
                  Original payload{" "}
                  <span className="mono">/ {event.sourceRef}</span>
                </p>
                <pre>{event.raw}</pre>
                <details>
                  <summary>Normalized fields</summary>
                  <pre>{JSON.stringify(event.fields, null, 2)}</pre>
                </details>
              </div>
            </article>
          );
        })}
      </div>
      <div className="stage-footer">
        <span>
          Raw records are reference material, not a verified diagnosis.
        </span>
        <button className="stage-back" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
          Back to preview
        </button>
      </div>
    </section>
  );
}
