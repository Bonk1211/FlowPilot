import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CaretDown,
  ChatCircle,
  Check,
  Clock,
  FileText,
  Image,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Incident } from "./api";
import { incidentPageUrl } from "./navigation";
import { displayTime } from "./time";
import { timelineEvents, timelineExplanation } from "./timeline";
import "./LiveTimeline.css";

export function LiveTimeline({
  incident,
  syncing,
  onOpen,
  banner,
}: {
  incident: Incident;
  syncing: boolean;
  onOpen: (id?: string) => void;
  /** Something to act on, shown above the events. */
  banner?: ReactNode;
}) {
  const events = timelineEvents(incident).filter((item) => !item.superseded);
  const signature = JSON.stringify(
    events.map((item) => [item.id, item.label, item.event_time]),
  );
  const list = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());
  const initialized = useRef(false);
  const following = useRef(true);
  const status = useRef<HTMLParagraphElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const awaitingConfirmation =
    incident.conversation?.at(-1)?.status === "pending";

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = media.matches;
    const previous = positions.current;
    const firstRender = !initialized.current;
    initialized.current = true;
    const next = new Map<string, number>();
    const animations: Animation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const entries = [
      ...element.querySelectorAll<HTMLLIElement>("li[data-event-id]"),
    ];
    const added = entries.filter(
      (item) => !previous.has(item.dataset.eventId!),
    );
    for (const entry of entries) {
      const id = entry.dataset.eventId!;
      const top = entry.offsetTop;
      next.set(id, top);
      const before = previous.get(id);
      if (!firstRender && before === undefined) {
        entry.dataset.new = "true";
        timers.push(setTimeout(() => delete entry.dataset.new, 5000));
        if (!reduced)
          animations.push(
            entry.animate(
              [
                { opacity: 0, transform: "translateY(-12px) scale(.97)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: 480, easing: "cubic-bezier(.16, 1, .3, 1)" },
            ),
          );
      } else if (!reduced && before !== undefined && before !== top) {
        animations.push(
          entry.animate(
            [
              { transform: `translateY(${before - top}px)` },
              { transform: "none" },
            ],
            { duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)" },
          ),
        );
      }
    }
    positions.current = next;
    // Keep positions current when a reader expands a card or the rail resizes.
    const observer = new ResizeObserver(() => {
      positions.current = new Map(
        entries.map((entry) => [entry.dataset.eventId!, entry.offsetTop]),
      );
    });
    entries.forEach((entry) => observer.observe(entry));
    const stopMotion = () => {
      if (media.matches) animations.forEach((animation) => animation.cancel());
    };
    media.addEventListener("change", stopMotion);
    if (!firstRender && added.length) {
      const last = added.at(-1)!;
      if (status.current)
        status.current.textContent = `${added.length === 1 ? "New event" : `${added.length} new events`} added · ${last.querySelector("strong")?.textContent}`;
      if (
        following.current &&
        !element.contains(document.activeElement) &&
        !element.querySelector("details[open]")
      )
        element.scrollTo({
          top: last.offsetTop - element.offsetTop - 16,
          behavior: reduced ? "instant" : "smooth",
        });
    }
    return () => {
      observer.disconnect();
      media.removeEventListener("change", stopMotion);
      animations.forEach((animation) => animation.cancel());
      timers.forEach(clearTimeout);
      entries.forEach((entry) => delete entry.dataset.new);
    };
  }, [signature]);

  return (
    <aside
      className={`investigation-live-timeline${mobileOpen ? " is-mobile-open" : ""}`}
      aria-label="Live investigation timeline"
    >
      <header className="live-timeline-heading">
        <div>
          <p className="live-timeline-eyebrow">
            <span aria-hidden="true" /> Live evidence
          </p>
          <h3>
            <Clock aria-hidden="true" /> Timeline <span>{events.length}</span>
          </h3>
        </div>
        <a
          href={incidentPageUrl(incident.id, "evidence")}
          aria-label="Open full timeline"
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
        >
          Full timeline <ArrowUpRight aria-hidden="true" />
        </a>
        <button
          type="button"
          className="live-timeline-mobile-toggle"
          aria-label={
            mobileOpen ? "Collapse live timeline" : "Expand live timeline"
          }
          aria-expanded={mobileOpen}
          aria-controls="live-timeline-events"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <CaretDown aria-hidden="true" />
        </button>
      </header>
      {banner}
      <ol
        ref={list}
        id="live-timeline-events"
        className="live-timeline-events"
        aria-label="Live timeline events"
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            64;
        }}
      >
        {events.map((item) => (
          <li
            key={item.id}
            data-event-id={item.id}
            data-observation={!!item.observation}
          >
            <span className="live-timeline-marker" aria-hidden="true">
              {item.observation ? (
                <ChatCircle />
              ) : item.status !== "collected" ? (
                <WarningCircle />
              ) : item.kind === "image" ? (
                <Image />
              ) : (
                <FileText />
              )}
            </span>
            <time dateTime={item.event_time ?? undefined}>
              {item.observation ? "Recorded · " : ""}
              {displayTime(item.event_time)}
            </time>
            <details className="live-timeline-event">
              <summary>
                <span className="live-event-meta">
                  {item.answer
                    ? "Confirmed finding"
                    : item.observation
                      ? "Recorded observation"
                      : item.role === "last_good"
                        ? "Last known good"
                        : item.role === "first_bad"
                          ? "First known bad"
                          : item.kind === "maintenance"
                            ? "Maintenance"
                            : "Source evidence"}
                  <span className="live-event-new">New</span>
                </span>
                <strong>{item.label}</strong>
                <span className="live-event-state">
                  {item.status === "collected" ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <WarningCircle aria-hidden="true" />
                  )}
                  {item.synthetic ? "Simulated" : "Observed"}
                  {item.status !== "collected" ? ` · ${item.status}` : ""}
                  <CaretDown aria-hidden="true" />
                </span>
              </summary>
              <div className="live-event-explanation">
                {item.node && <p>{item.node.prompt}</p>}
                <p>{timelineExplanation(item)}</p>
                {item.time_uncertain && (
                  <p className="live-event-caveat">
                    Timing uncertain · order is provisional.
                  </p>
                )}
                <button type="button" onClick={() => onOpen(item.id)}>
                  Inspect in full timeline <ArrowUpRight aria-hidden="true" />
                </button>
              </div>
            </details>
          </li>
        ))}
        {!events.length && (
          <li className="live-timeline-empty">
            Your evidence and confirmed findings will appear here as the
            investigation develops.
          </li>
        )}
      </ol>
      <footer className="live-timeline-footer">
        <p
          role="status"
          aria-atomic="true"
          className={syncing ? "is-syncing" : ""}
        >
          <span aria-hidden="true" />
          {syncing
            ? "Synchronizing investigation…"
            : awaitingConfirmation
              ? "Awaiting answer confirmation"
              : "Synced with this investigation"}
        </p>
        <p ref={status} className="sr-only" role="status" aria-atomic="true" />
        <small>UTC · Answers use recorded time. Undated sources last.</small>
      </footer>
    </aside>
  );
}
