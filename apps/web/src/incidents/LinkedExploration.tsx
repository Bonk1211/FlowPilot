import type { MouseEvent } from "react";
import type { DiagnosticAssessment, IncidentEvidence } from "./api";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { MechanismView } from "./MechanismView";
import { displayTime } from "./time";
import { useTimelinePlayback } from "./useTimelinePlayback";

type Link = {
  hypothesisId: string;
  title: string;
  relation: "Supports" | "Conflicts with";
  explanation: string;
};

function linksFor(
  assessment: DiagnosticAssessment | null,
  evidenceId: string | null,
): Link[] {
  if (!assessment || !evidenceId) return [];
  return assessment.hypotheses.flatMap((hypothesis) => [
    ...hypothesis.supporting_evidence
      .filter((reason) => reason.evidence_id === evidenceId)
      .map((reason) => ({
        hypothesisId: hypothesis.id,
        title: hypothesis.title,
        relation: "Supports" as const,
        explanation: reason.explanation,
      })),
    ...hypothesis.conflicting_evidence
      .filter((reason) => reason.evidence_id === evidenceId)
      .map((reason) => ({
        hypothesisId: hypothesis.id,
        title: hypothesis.title,
        relation: "Conflicts with" as const,
        explanation: reason.explanation,
      })),
  ]);
}

/**
 * Shows one selection across the evidence timeline, the hypotheses that cite
 * the selected event and the components of the selected hypothesis. It keeps
 * no diagnostic state of its own: the owner supplies and changes the selection.
 */
export function LinkedExploration({
  evidence,
  assessment,
  selectedEventId,
  onSelectEvent,
  hypothesisId,
  onSelectHypothesis,
  revision,
  evidenceHref,
  onOpenEvidence,
}: {
  evidence: IncidentEvidence[];
  assessment: DiagnosticAssessment | null;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  hypothesisId: string | null;
  onSelectHypothesis: (id: string) => void;
  revision: number;
  evidenceHref: string;
  onOpenEvidence: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { playing, setPlaying, reduced } = useTimelinePlayback();
  const selected = evidence.find((item) => item.id === selectedEventId);
  const links = linksFor(assessment, selectedEventId);
  const hypothesis = assessment?.hypotheses.find(
    (item) => item.id === hypothesisId,
  );
  const announcement = selected
    ? `Selected ${selected.label}. ${
        links.length
          ? links.map((link) => `${link.relation} ${link.title}`).join(". ")
          : "No hypothesis cites this event."
      }`
    : "";
  return (
    <section
      className="incident-card incident-linked"
      aria-labelledby="incident-linked-heading"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Follow one selection</p>
          <h2 id="incident-linked-heading">Evidence and mechanism</h2>
        </div>
      </div>
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div className="incident-linked-layout">
        <div className="incident-linked-evidence">
          <EvidenceTimeline
            evidence={evidence}
            selectedId={selectedEventId}
            onSelect={onSelectEvent}
            playing={playing}
            onPlayingChange={setPlaying}
            reduced={reduced}
            renderDetail={({ index, total }) => (
              <section
                key={selectedEventId}
                className="incident-event-detail incident-linked-detail"
                aria-label="Selected event"
              >
                {selected ? (
                  <>
                    <span className="eyebrow">
                      Event {index + 1} of {total} ·{" "}
                      {selected.synthetic ? "Simulated" : "Observed"}
                    </span>
                    <strong>{selected.label}</strong>
                    <span className="incident-caption">
                      {displayTime(selected.event_time)}
                      {selected.time_uncertain
                        ? " · Time ordering uncertain"
                        : ""}
                    </span>
                    {links.length > 0 ? (
                      <ul
                        className="incident-linked-links"
                        aria-label="Hypotheses that cite this event"
                      >
                        {links.map((link) => (
                          <li
                            key={`${link.hypothesisId}-${link.relation}`}
                            data-relation={
                              link.relation === "Supports"
                                ? "supports"
                                : "conflicts"
                            }
                          >
                            <button
                              aria-pressed={hypothesisId === link.hypothesisId}
                              onClick={() =>
                                onSelectHypothesis(link.hypothesisId)
                              }
                            >
                              {link.relation} {link.title}
                            </button>
                            <span className="incident-caption">
                              {link.explanation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="incident-muted">
                        {assessment
                          ? "No hypothesis cites this event."
                          : "Analyze the evidence to link events to explanations."}
                      </p>
                    )}
                    <a href={evidenceHref} onClick={onOpenEvidence}>
                      Open original values and provenance
                    </a>
                  </>
                ) : (
                  <p className="incident-muted">
                    {evidence.length
                      ? "Select an event to see which explanations cite it."
                      : "No source events yet."}
                  </p>
                )}
              </section>
            )}
          />
        </div>
        <MechanismView
          compact
          hypothesisId={hypothesisId}
          componentIds={hypothesis?.component_ids ?? []}
          revision={revision}
          eventLabel={selected?.label}
        />
      </div>
    </section>
  );
}
