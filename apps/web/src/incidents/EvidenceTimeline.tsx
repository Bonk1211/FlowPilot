import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  Clock,
  FileText,
  Image,
  Pause,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
import type { IncidentEvidence } from "./api";
import { displayTime } from "./time";

export type TimelineDetailContext = {
  layout: "horizontal" | "vertical";
  /** Zero-based position of the selected event, or -1 when none is selected. */
  index: number;
  total: number;
};

const flags: Record<IncidentEvidence["role"], string> = {
  last_good: "Last known good",
  first_bad: "First known bad",
  machine_log: "Machine log",
  pm: "Maintenance",
  context: "Context / change",
};

export function EvidenceTimeline({
  evidence,
  selectedId,
  onSelect,
  playing,
  onPlayingChange,
  reduced,
  renderDetail,
}: {
  evidence: IncidentEvidence[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  reduced: boolean;
  renderDetail: (context: TimelineDetailContext) => ReactNode;
}) {
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const timeline = useRef<HTMLOListElement>(null);
  const setPlaying = onPlayingChange;
  const select = (id: string) => {
    setPlaying(false);
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
  const selected = evidence.find((item) => item.id === selectedId);
  const sortTime = (item: IncidentEvidence) =>
    item.event_time && /(Z|[+-]\d{2}:\d{2})$/i.test(item.event_time)
      ? Date.parse(item.event_time)
      : Infinity;
  const ordered = [...evidence].sort((a, b) => sortTime(a) - sortTime(b));
  const selectedIndex = ordered.findIndex((item) => item.id === selectedId);
  const nextId = ordered[selectedIndex + 1]?.id;
  const atPenultimate = selectedIndex >= ordered.length - 2;
  const advance = useRef(onSelect);
  useEffect(() => {
    advance.current = onSelect;
  });
  useEffect(() => {
    if (!playing || reduced || !nextId) return;
    const timer = window.setTimeout(() => {
      advance.current(nextId);
      if (atPenultimate) onPlayingChange(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, nextId, atPenultimate, onPlayingChange]);
  const detail = renderDetail({
    layout,
    index: selectedIndex,
    total: ordered.length,
  });
  return (
    <>
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
                setPlaying(!playing);
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
            <li
              key={item.id}
              data-past={index < selectedIndex}
              data-missing={item.status !== "collected" || undefined}
            >
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
                    {item.status !== "collected" ? (
                      <WarningCircle aria-hidden="true" />
                    ) : item.kind === "image" ? (
                      <Image aria-hidden="true" />
                    ) : (
                      <FileText aria-hidden="true" />
                    )}
                  </span>
                  <span className="incident-event-text">
                    <strong>{item.label}</strong>
                    <span>
                      {item.status !== "collected"
                        ? `${item.status[0].toUpperCase()}${item.status.slice(1)} · not assumed normal`
                        : `${item.synthetic ? "Simulated" : "Observed"} · ${item.status}`}
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
    </>
  );
}
