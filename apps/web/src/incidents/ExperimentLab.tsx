import { useMemo, useState, type MouseEvent } from "react";
import {
  CheckCircle,
  CircleNotch,
  Hourglass,
  WarningCircle,
} from "@phosphor-icons/react";
import type { IncidentExperiment } from "@flowpilot/contracts";
import type { Incident } from "./api";
import { GuidedPlayback } from "./GuidedPlayback";
import { StatusChip } from "./StatusChip";
import { mechanismIds, mechanismTitles } from "./experimentDefaults";
import { experimentPlaybackSteps, trackSummary } from "./experimentPlayback";
import { mechanismCopy } from "./mechanismCopy";
import { suggestInvestigationExperiments } from "./investigationExperiment";
import { runStages, useExperimentRun, type RunStage } from "./useExperimentRun";
import "./ExperimentLab.css";

const progressOf: Record<RunStage, number> = {
  idle: 0,
  proposing: 0,
  approving: 1,
  running: 2,
  done: 3,
  failed: 0,
};

function agentState(stage: RunStage, plan: IncidentExperiment | null) {
  if (stage === "done") return "done" as const;
  if (stage === "running") return "running" as const;
  if (stage === "failed")
    return plan?.status === "completed" ? "done" : "failed";
  return "queued" as const;
}

const stateLabel = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Not run",
} as const;

function StateIcon({ state }: { state: keyof typeof stateLabel }) {
  if (state === "done") return <CheckCircle aria-hidden="true" weight="fill" />;
  if (state === "running")
    return <CircleNotch aria-hidden="true" className="lab-spin" />;
  if (state === "failed") return <WarningCircle aria-hidden="true" />;
  return <Hourglass aria-hidden="true" />;
}

/**
 * The three suggested experiments, run as one saved plan and shown as three
 * agent-style tracks beside a guided 3D playback of whichever one is open.
 * Everything shown is simulated; nothing becomes recorded evidence.
 */
export function ExperimentLab({
  incident,
  planId,
  runRequested,
  onPlan,
  onRefresh,
  experimentsHref,
  onOpenLink,
}: {
  incident: Incident;
  planId: string | null;
  runRequested: boolean;
  onPlan: (planId: string) => void;
  onRefresh: () => Promise<void>;
  experimentsHref: string;
  onOpenLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const offer = suggestInvestigationExperiments(incident);
  const checkId =
    offer?.lead.id ??
    incident.assessment?.checks.find((check) => check.eligible)?.id ??
    null;
  const { stage, plan, error, retry } = useExperimentRun({
    incidentId: incident.id,
    planId,
    runRequested,
    checkId: checkId as IncidentExperiment["proposal"]["check_id"] | null,
    onPlan,
    onRefresh,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const ids = (plan?.proposal.hypothesis_ids ?? mechanismIds) as string[];
  const selected = chosen ?? (stage === "done" ? ids[0] : null);
  const script = useMemo(() => {
    if (!plan || !selected) return null;
    const hypothesis = incident.assessment?.hypotheses.find(
      (item) => item.id === selected,
    );
    return experimentPlaybackSteps(
      plan,
      selected,
      mechanismCopy[selected],
      hypothesis?.component_ids ?? [],
    );
  }, [plan, selected, incident.assessment]);
  const progress = progressOf[stage];
  const running =
    stage === "proposing" || stage === "approving" || stage === "running";
  const planned = plan?.matrix.length ?? 0;
  const simulated = plan?.results?.length ?? 0;

  return (
    <section
      className="incident-card experiment-lab"
      aria-labelledby="experiment-lab-heading"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Compare the explanations</p>
          <h2 id="experiment-lab-heading">Experiments</h2>
        </div>
        <StatusChip kind="simulated" detail="no machine test" />
      </div>

      {stage !== "idle" && (
        <div className="lab-progress">
          <div
            role="progressbar"
            aria-label="Experiment run progress"
            aria-valuemin={0}
            aria-valuemax={runStages.length}
            aria-valuenow={progress}
            aria-valuetext={
              stage === "done"
                ? `Finished: ${simulated} of ${planned} conditions simulated`
                : stage === "failed"
                  ? "The run stopped"
                  : `Stage ${progress + 1} of ${runStages.length}: ${runStages[progress].label}`
            }
            className="lab-progress-bar"
            data-stage={stage}
          >
            {runStages.map((item, position) => (
              <span
                key={item.id}
                data-state={
                  position < progress
                    ? "done"
                    : position === progress && running
                      ? "active"
                      : "pending"
                }
              />
            ))}
          </div>
          <ol className="lab-stage-list" aria-label="Run stages">
            {runStages.map((item, position) => (
              <li
                key={item.id}
                aria-current={
                  position === progress && running ? "step" : undefined
                }
                data-state={
                  position < progress
                    ? "done"
                    : position === progress && running
                      ? "active"
                      : "pending"
                }
              >
                {position < progress ? (
                  <CheckCircle aria-hidden="true" weight="fill" />
                ) : position === progress && running ? (
                  <CircleNotch aria-hidden="true" className="lab-spin" />
                ) : (
                  <Hourglass aria-hidden="true" />
                )}
                {item.label}
              </li>
            ))}
          </ol>
          <p className="incident-caption" role="status">
            {stage === "done"
              ? `${simulated} of ${planned} planned conditions simulated.${plan?.approved_by ? ` Approved by ${plan.approved_by} for simulation only.` : ""}`
              : running
                ? `Stage ${progress + 1} of ${runStages.length}.`
                : ""}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="incident-experiment-error lab-error">
          <p>{error}</p>
          {runRequested && !planId && (
            <button onClick={retry}>Try again</button>
          )}
        </div>
      )}

      <div className="lab-layout">
        <div className="lab-stage">
          {script?.ok ? (
            <GuidedPlayback
              key={`${plan?.id}:${selected}`}
              script={script}
              title={mechanismTitles[selected as keyof typeof mechanismTitles]}
            />
          ) : (
            <div className="lab-placeholder">
              <p>
                {script && !script.ok
                  ? script.reason
                  : running
                    ? "The 3D playback opens here when the simulations finish."
                    : "Open an experiment to play its simulated result in 3D."}
              </p>
            </div>
          )}
        </div>
        <ol className="lab-agents" aria-label="Experiment tracks">
          {ids.map((id, position) => {
            const state = agentState(stage, plan);
            const summary = plan ? trackSummary(plan, id) : null;
            const hypothesis = incident.assessment?.hypotheses.find(
              (item) => item.id === id,
            );
            const title = mechanismTitles[id as keyof typeof mechanismTitles];
            const conditions = plan?.matrix.filter(
              (item) => item.hypothesis_id === id,
            ).length;
            return (
              <li
                key={id}
                className="lab-agent"
                data-state={state}
                data-selected={selected === id || undefined}
                style={{ animationDelay: `${position * 140}ms` }}
              >
                <div className="lab-agent-head">
                  <strong>{title}</strong>
                  <span className="incident-tag lab-state" data-state={state}>
                    <StateIcon state={state} />
                    {stateLabel[state]}
                  </span>
                </div>
                <p className="incident-caption">
                  {conditions
                    ? `${conditions} planned conditions, including a control condition at the plan's default settings.`
                    : "Compares this mechanism's simulated response with its own baseline."}
                </p>
                {state === "done" && summary && (
                  <p>
                    At severity {summary.severity.toFixed(2)} the simulated mass
                    ends at {summary.mass.toFixed(2)} against{" "}
                    {summary.baselineMass.toFixed(2)} in the control condition
                    (severity {summary.controlSeverity.toFixed(2)}), and
                    coverage at {summary.coverage.toFixed(2)} against{" "}
                    {summary.baselineCoverage.toFixed(2)}.
                  </p>
                )}
                {hypothesis && (
                  <p className="incident-caption">
                    {hypothesis.supporting_evidence.length +
                      hypothesis.conflicting_evidence.length ===
                    0
                      ? "No recorded evidence cites this explanation yet."
                      : `Recorded evidence: ${hypothesis.supporting_evidence.length} supporting and ${hypothesis.conflicting_evidence.length} conflicting.`}
                  </p>
                )}
                {state === "done" && (
                  <button
                    aria-pressed={selected === id}
                    aria-label={`Open playback of ${title}`}
                    onClick={() => setChosen(id)}
                  >
                    {selected === id ? "Playing in 3D" : "Open playback"}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="incident-caption lab-footnote">
        Simulated responses cannot say which cause is most likely and do not
        become recorded evidence. The assessment and an engineer decide.{" "}
        <a href={experimentsHref} onClick={onOpenLink}>
          Open the full plan and matrix
        </a>
      </p>
    </section>
  );
}
