import { useState, type MouseEvent } from "react";
import {
  CheckCircle,
  CircleNotch,
  Hourglass,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Incident } from "./api";
import { GuidedPlayback } from "./GuidedPlayback";
import { SignatureSpark } from "./SignatureSpark";
import { StatusChip } from "./StatusChip";
import {
  mechanismChecks,
  mechanismIds,
  mechanismTitles,
  type MechanismId,
} from "./experimentDefaults";
import { experimentPlaybackSteps, trackSummary } from "./experimentPlayback";
import { mechanismCopy } from "./mechanismCopy";
import {
  trackStages,
  useExperimentRuns,
  type Track,
} from "./useExperimentRuns";
import "./ExperimentLab.css";

const stateLabel = {
  idle: "Not run",
  saving: "Saving plan",
  approving: "Approving",
  simulating: "Simulating",
  done: "Done",
  failed: "Stopped",
} as const;

function StateIcon({ stage }: { stage: Track["stage"] }) {
  if (stage === "done") return <CheckCircle aria-hidden="true" weight="fill" />;
  if (stage === "failed") return <WarningCircle aria-hidden="true" />;
  if (stage === "idle") return <Hourglass aria-hidden="true" />;
  return <CircleNotch aria-hidden="true" className="lab-spin" />;
}

/** How far one experiment has got: plan saved, approved, then each condition. */
function progressOf(track: Track) {
  const conditions = track.plan?.matrix.length ?? 3;
  const saved = track.plan?.results?.length ?? 0;
  const steps = {
    idle: 0,
    saving: 0,
    approving: 1,
    simulating: 2 + saved,
    done: 2 + conditions,
    failed: track.plan ? 2 + saved : 0,
  }[track.stage];
  const text = {
    idle: "Not run yet",
    saving: "Saving the plan",
    approving: "Plan saved; approving as demo engineer",
    simulating: `Simulating: ${saved} of ${conditions} conditions saved`,
    done: `Finished: ${saved} of ${conditions} conditions simulated`,
    failed: `Stopped after ${saved} of ${conditions} conditions`,
  }[track.stage];
  return { steps, total: 2 + conditions, text, saved, conditions };
}

/**
 * The suggested experiments as tracks that run together or one at a time,
 * beside a guided 3D playback of whichever finished one is open. Everything
 * shown is simulated; nothing becomes recorded evidence.
 */
export function ExperimentLab({
  incident,
  planIds,
  requested,
  onPlans,
  onRefresh,
  experimentsHref,
  onOpenLink,
}: {
  incident: Incident;
  planIds: readonly string[];
  requested: readonly MechanismId[];
  onPlans: (planIds: string[]) => void;
  onRefresh: () => Promise<void>;
  experimentsHref: string;
  onOpenLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { tracks, loadError, start } = useExperimentRuns({
    incidentId: incident.id,
    requested,
    planIds,
    onPlans,
    onRefresh,
  });
  const [chosen, setChosen] = useState<MechanismId | null>(null);
  const list = mechanismIds.map((id) => tracks[id]);
  const finished = list.filter((track) => track.stage === "done");
  const busy = list.filter((track) =>
    ["saving", "approving", "simulating"].includes(track.stage),
  );
  // Not run yet, or stopped before a plan was saved: these can start.
  const waiting = list.filter(
    (track) =>
      track.stage === "idle" || (track.stage === "failed" && !track.plan),
  );
  const selected =
    chosen && tracks[chosen].stage === "done"
      ? chosen
      : (finished[0]?.id ?? null);
  const selectedPlan = selected ? tracks[selected].plan : null;
  const script =
    selectedPlan && selected
      ? experimentPlaybackSteps(
          selectedPlan,
          selected,
          mechanismCopy[selected],
          incident.assessment?.hypotheses.find((item) => item.id === selected)
            ?.component_ids ?? [],
        )
      : null;
  const brief = (id: MechanismId) =>
    incident.assessment?.checks.find(
      (check) => check.id === mechanismChecks[id],
    )?.brief;

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
        <div className="lab-heading-actions">
          {waiting.length > 0 && (
            <button
              className="primary"
              onClick={() => waiting.forEach((track) => start(track.id))}
            >
              <Play aria-hidden="true" weight="fill" />
              {waiting.length === mechanismIds.length
                ? "Run all three experiments"
                : waiting.length === 1
                  ? `Run ${mechanismTitles[waiting[0].id].toLowerCase()}`
                  : `Run the other ${waiting.length === 2 ? "two" : waiting.length}`}
            </button>
          )}
          <StatusChip kind="simulated" detail="no machine test" />
        </div>
      </div>
      <p className="incident-caption" role="status">
        {busy.length
          ? `${busy.length} running, ${finished.length} of ${mechanismIds.length} finished. Each condition takes milliseconds; stages are held briefly so you can follow them.`
          : finished.length
            ? `${finished.length} of ${mechanismIds.length} experiments finished.`
            : "Each experiment is its own saved plan. Run them together or one at a time."}
      </p>

      {loadError && (
        <div role="alert" className="incident-experiment-error lab-error">
          <p>{loadError}</p>
        </div>
      )}

      <div className="lab-layout">
        <div className="lab-stage">
          {script?.ok ? (
            <GuidedPlayback
              key={`${selectedPlan?.id}:${selected}`}
              script={script}
              title={mechanismTitles[selected!]}
            />
          ) : (
            <div className="lab-placeholder">
              <p>
                {script && !script.ok
                  ? script.reason
                  : busy.length
                    ? "The 3D playback opens here when the first experiment finishes."
                    : "Run an experiment to play its simulated result in 3D."}
              </p>
            </div>
          )}
        </div>
        <ol className="lab-agents" aria-label="Experiment tracks">
          {list.map((track, position) => {
            const title = mechanismTitles[track.id];
            const progress = progressOf(track);
            const summary =
              track.stage === "done" && track.plan
                ? trackSummary(track.plan, track.id)
                : null;
            const hypothesis = incident.assessment?.hypotheses.find(
              (item) => item.id === track.id,
            );
            const prediction = brief(track.id)?.prediction;
            const running = ["saving", "approving", "simulating"].includes(
              track.stage,
            );
            return (
              <li
                key={track.id}
                className="lab-agent"
                data-state={track.stage}
                data-selected={selected === track.id || undefined}
                style={{ animationDelay: `${position * 140}ms` }}
              >
                <div className="lab-agent-head">
                  {prediction && <SignatureSpark prediction={prediction} />}
                  <strong>{title}</strong>
                  <span
                    className="incident-tag lab-state"
                    data-state={track.stage}
                  >
                    <StateIcon stage={track.stage} />
                    {stateLabel[track.stage]}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.steps}
                  aria-valuetext={progress.text}
                  className="lab-track-bar"
                  data-stage={track.stage}
                >
                  <span
                    style={{
                      transform: `scaleX(${progress.steps / progress.total})`,
                    }}
                  />
                </div>
                <ol className="lab-track-stages" aria-label={`${title} stages`}>
                  {trackStages.map((item, index) => {
                    const reached =
                      progress.steps > index ||
                      (index === 2 && track.stage === "done");
                    const active =
                      running &&
                      ((index === 0 && track.stage === "saving") ||
                        (index === 1 && track.stage === "approving") ||
                        (index === 2 && track.stage === "simulating"));
                    return (
                      <li
                        key={item.id}
                        data-state={
                          active ? "active" : reached ? "done" : "pending"
                        }
                      >
                        {item.id === "approving" && track.plan?.approved_by
                          ? `Approved by ${track.plan.approved_by}`
                          : item.id === "simulating" && running
                            ? `${progress.saved} of ${progress.conditions} conditions`
                            : item.label}
                      </li>
                    );
                  })}
                </ol>
                {summary && (
                  <p>
                    At severity {summary.severity.toFixed(2)} the simulated mass
                    ends at {summary.mass.toFixed(2)} against{" "}
                    {summary.baselineMass.toFixed(2)} in the control condition
                    (severity {summary.controlSeverity.toFixed(2)}), and
                    coverage at {summary.coverage.toFixed(2)} against{" "}
                    {summary.baselineCoverage.toFixed(2)}.
                  </p>
                )}
                {track.error && (
                  <p className="lab-track-error" role="alert">
                    {track.error}
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
                {track.stage === "done" ? (
                  <button
                    aria-pressed={selected === track.id}
                    aria-label={`Open playback of ${title}`}
                    onClick={() => setChosen(track.id)}
                  >
                    {selected === track.id ? "Playing in 3D" : "Open playback"}
                  </button>
                ) : track.stage === "idle" || track.stage === "failed" ? (
                  <button
                    aria-label={`${track.stage === "failed" ? "Try again" : "Run"}: ${title}`}
                    onClick={() => start(track.id)}
                  >
                    <Play aria-hidden="true" />
                    {track.stage === "failed"
                      ? "Try again"
                      : "Run this experiment"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="incident-caption lab-footnote">
        Runs as the demo engineer. Simulated responses cannot say which cause is
        most likely and do not become recorded evidence; the assessment and an
        engineer decide.{" "}
        <a href={experimentsHref} onClick={onOpenLink}>
          Open the full plans and matrices
        </a>
      </p>
    </section>
  );
}
