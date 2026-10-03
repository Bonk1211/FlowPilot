import type { Incident } from "@flowpilot/contracts";

function currentResponses(incident: Incident) {
  const graph = incident.investigation;
  const replaced = new Set(
    graph?.answers?.map((answer) => answer.supersedes_id),
  );
  return (graph?.answers ?? []).flatMap((answer) => {
    const node = graph?.nodes?.find(
      (node) => node.id === answer.node_id && node.status !== "superseded",
    );
    return node && !replaced.has(answer.id) ? [{ answer, node }] : [];
  });
}

export function resolveInvestigationExperiment(
  incident: Incident,
  checkId: string | null,
  answerId: string | null,
) {
  const source = currentResponses(incident).find(
    ({ answer }) => answer.id === answerId && answer.status === "confirmed",
  );
  const check = incident.assessment?.checks.find(
    (check) => check.id === checkId && check.eligible,
  );
  if (!source || !check) return null;
  return { ...source, check };
}

export type InvestigationExperiment = NonNullable<
  ReturnType<typeof resolveInvestigationExperiment>
>;

export function suggestInvestigationExperiment(
  incident: Incident,
): InvestigationExperiment | null {
  const assessment = incident.assessment;
  if (
    !assessment ||
    incident.status === "closed" ||
    incident.escalated ||
    ["review", "escalate"].includes(assessment.next_step.kind)
  )
    return null;
  const responses = currentResponses(incident);
  const confirmed = responses.filter(
    ({ answer, node }) =>
      answer.status === "confirmed" && node.kind === "question",
  );
  const latest = responses.at(-1);
  if (confirmed.length < 2 || latest?.answer.status !== "confirmed")
    return null;
  const candidates = assessment.hypotheses.filter((hypothesis) =>
    ["possible", "inconclusive"].includes(hypothesis.status),
  );
  if (candidates.length < 2) return null;
  const active = incident.investigation?.nodes?.find(
    (node) => node.id === incident.investigation?.active_node_id,
  );
  const check = [...assessment.checks]
    .filter(
      (check) =>
        check.eligible &&
        candidates.some((hypothesis) => hypothesis.id === check.hypothesis_id),
    )
    .sort((a, b) => {
      const priority = (id: string, hypothesis: string) =>
        id === active?.target_fact
          ? -1
          : (candidates.find((item) => item.id === hypothesis)?.rank ?? 99);
      return priority(a.id, a.hypothesis_id) - priority(b.id, b.hypothesis_id);
    })[0];
  return check ? { ...latest, check } : null;
}
