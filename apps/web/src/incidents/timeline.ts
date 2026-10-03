import type {
  Incident,
  IncidentEvidence,
  IncidentObservation,
  InvestigationAnswer,
  InvestigationNode,
} from "@flowpilot/contracts";

export type TimelineEvent = Pick<
  IncidentEvidence,
  | "id"
  | "label"
  | "event_time"
  | "time_uncertain"
  | "synthetic"
  | "kind"
  | "role"
  | "status"
> & {
  evidence?: IncidentEvidence;
  observation?: IncidentObservation;
  answer?: InvestigationAnswer;
  node?: InvestigationNode;
  superseded: boolean;
};

/** Source times and observation recording times retain their distinct meanings. */
export function timelineEvents(
  incident: Pick<Incident, "evidence" | "observations" | "investigation">,
): TimelineEvent[] {
  const evidence = incident.evidence ?? [];
  const observations = incident.observations ?? [];
  const answers = incident.investigation?.answers ?? [];
  const replacedEvidence = new Set(evidence.map((item) => item.supersedes_id));
  const replacedAnswers = new Set(answers.map((item) => item.supersedes_id));
  const replacedObservations = new Set(
    observations.map((item) => item.supersedes_id),
  );
  const collected = new Set(
    evidence
      .filter(
        (item) => !replacedEvidence.has(item.id) && item.status === "collected",
      )
      .map((item) => item.id),
  );
  const events: TimelineEvent[] = evidence.map((item) => ({
    ...item,
    evidence: item,
    superseded: replacedEvidence.has(item.id),
  }));
  for (const observation of observations) {
    const answer = answers.find(
      (item) => item.observation_id === observation.id,
    );
    // An unknown or unconfirmed answer is not an established timeline finding.
    if (answer && answer.status !== "confirmed") continue;
    const node = incident.investigation?.nodes?.find(
      (item) => item.id === answer?.node_id,
    );
    const choice = node?.choices?.find(
      (item) => item.value === observation.result,
    );
    const fact = (node?.target_fact ?? observation.check_id)
      .replace(/^question_/, "")
      .replaceAll("_", " ");
    events.push({
      id: observation.id,
      label: `${fact[0]?.toUpperCase() ?? ""}${fact.slice(1)} · ${choice?.label ?? observation.result.replaceAll("_", " ")}`,
      event_time: observation.recorded_at,
      time_uncertain: false,
      synthetic: observation.synthetic,
      kind: "context",
      role: "context",
      status: "collected",
      observation,
      answer,
      node,
      superseded:
        replacedObservations.has(observation.id) ||
        !!(answer && replacedAnswers.has(answer.id)) ||
        node?.status === "superseded" ||
        (observation.evidence_ids ?? []).some((id) => !collected.has(id)),
    });
  }
  const sortTime = (item: TimelineEvent) => {
    const time = item.event_time;
    return time &&
      /(Z|[+-]\d{2}:\d{2})$/i.test(time) &&
      Number.isFinite(Date.parse(time))
      ? Date.parse(time)
      : Infinity;
  };
  return events.sort((a, b) => sortTime(a) - sortTime(b));
}

export function timelineExplanation(event: TimelineEvent) {
  return (
    event.node?.choices?.find(
      (choice) => choice.value === event.observation?.result,
    )?.interpretation ??
    event.node?.why ??
    event.observation?.notes ??
    event.evidence?.provenance ??
    "Recorded investigation observation."
  );
}
