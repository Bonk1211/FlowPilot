import { Pulse } from "@phosphor-icons/react";
import type { Incident } from "./api";
import { displayTime } from "./time";

type Activity = NonNullable<Incident["history"]>[number];

const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

/**
 * What the application and its users did to this incident. These records are
 * not source evidence: they stay out of the timeline and its event counts.
 */
export function ApplicationActivity({ activity }: { activity: Activity[] }) {
  return (
    <details className="incident-source-tools" name="evidence-tools">
      <summary title="Application activity">
        <Pulse aria-hidden="true" />{" "}
        <span className="incident-narrow-label">Application activity</span>
      </summary>
      <div className="incident-source-drawer">
        <div className="incident-timeline-heading">
          <h3>Application activity · {activity.length}</h3>
        </div>
        <p className="incident-muted incident-caption">
          Actions taken in this workspace. They are not machine or production
          evidence and do not appear on the evidence timeline.
        </p>
        {activity.length ? (
          <ol className="incident-activity" aria-label="Application activity">
            {activity.map((item) => (
              <li key={`${item.revision}-${item.action}`}>
                <strong>{humanize(item.action)}</strong>
                <span className="incident-caption">
                  Revision {item.revision} · {displayTime(item.timestamp)} ·{" "}
                  {item.actor ?? "System"}
                </span>
                <span>{item.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="incident-muted">No application activity recorded.</p>
        )}
      </div>
    </details>
  );
}
