import type { IncidentExperiment } from "@flowpilot/contracts";

type Analysis = NonNullable<IncidentExperiment["analysis"]>;
export type ExperimentFinding = NonNullable<Analysis["findings"]>[number];
export type FindingState = "open" | "returned" | "set_aside";

/** The latest decision the engineer took on one mechanism's finding in a plan. */
export function findingState(
  plan: IncidentExperiment,
  hypothesisId: string,
): FindingState {
  const latest = [...(plan.handbacks ?? [])]
    .reverse()
    .find((item) => item.hypothesis_id === hypothesisId);
  return latest?.decision === "return"
    ? "returned"
    : latest?.decision === "set_aside"
      ? "set_aside"
      : "open";
}

export function findingOf(plan: IncidentExperiment, hypothesisId: string) {
  return (
    plan.analysis?.findings?.find(
      (item) => item.hypothesis_id === hypothesisId,
    ) ?? null
  );
}

export type ReturnedFinding = {
  plan: IncidentExperiment;
  finding: ExperimentFinding;
  /** Evidence changed after the simulation; the finding may no longer apply. */
  outdated: boolean;
  returnedAt: string;
};

/**
 * Findings the engineer handed back to the investigation and has not set
 * aside, newest plan per mechanism first. They are simulated suggestions,
 * never evidence.
 */
export function returnedFindings(plans: readonly IncidentExperiment[]) {
  const latest = new Map<string, ReturnedFinding>();
  for (const plan of plans) {
    if (plan.status !== "completed") continue;
    for (const finding of plan.analysis?.findings ?? []) {
      if (findingState(plan, finding.hypothesis_id) !== "returned") continue;
      const returnedAt = [...(plan.handbacks ?? [])]
        .reverse()
        .find(
          (item) => item.hypothesis_id === finding.hypothesis_id,
        )!.timestamp;
      const current = latest.get(finding.hypothesis_id);
      if (!current || current.returnedAt < returnedAt)
        latest.set(finding.hypothesis_id, {
          plan,
          finding,
          outdated: plan.source_current === false,
          returnedAt,
        });
    }
  }
  return [...latest.values()].sort((a, b) =>
    a.returnedAt.localeCompare(b.returnedAt),
  );
}
