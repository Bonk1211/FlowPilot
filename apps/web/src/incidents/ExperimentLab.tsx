import { useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowBendUpLeft,
  CheckCircle,
  CircleNotch,
  Hourglass,
  MinusCircle,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Incident } from "./api";
import { GuidedPlayback } from "./GuidedPlayback";
import { assemblyGuide } from "./assemblyGuide";
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
import { findingOf, findingState } from "./experimentFindings";
import { handBack } from "./experimentRuns";
import {
  trackStages,
  useExperimentRuns,
  type Track,
} from "./useExperimentRuns";
import "./ExperimentLab.css";

const referenceGuide = assemblyGuide();

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

/** How one finished experiment compares with the records, and whether it goes back. */
function TrackFinding({
  plan,
  id,
  busy,
  onReturn,
  onOpen,
}: {
  plan: NonNullable<Track["plan"]>;
  id: MechanismId;
  busy: boolean;
  onReturn: () => void;
  onOpen: () => void;
}) {
  const finding = findingOf(plan, id);
  if (!finding) return null;
  const state = findingState(plan, id);
  const outdated = plan.source_current === false;
  return (
    <div className="lab-finding" data-outcome={finding.outcome}>
      <p className="lab-finding-label">
        {finding.outcome === "consistent" ? (
          <CheckCircle aria-hidden="true" weight="fill" />
        ) : finding.outcome === "conflicts" ? (
          <WarningCircle aria-hidden="true" />
        ) : (
          <MinusCircle aria-hidden="true" />
        )}
        {finding.label}
      </p>
      <details>
        <summary>How this was judged</summary>
        <p>{finding.summary}</p>
        <ul>
          {finding.criteria.map((criterion) => (
            <li key={criterion.id}>
              {criterion.met ? "Met" : "Not met"}: {criterion.label}.{" "}
              {criterion.detail}
            </li>
          ))}
        </ul>
      </details>
      {outdated && (
        <p className="lab-track-error">
          Outdated: the evidence changed after this simulation.
        </p>
      )}
      {state === "returned" ? (
        <p className="lab-finding-returned">
          Returned to the investigation.{" "}
          <button type="button" className="link-button" onClick={onOpen}>
            Open the investigation
          </button>
        </p>
      ) : finding.outcome === "consistent" && !outdated ? (
        <button className="primary" disabled={busy} onClick={onReturn}>
          <ArrowBendUpLeft aria-hidden="true" />
          Return to investigation with this finding
        </button>
      ) : (
        <p className="incident-caption">
          Return requires a match with the records.
        </p>
      )}
    </div>
  );
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
  onReturn,
  settings,
}: {
  settings?: ReactNode;
  incident: Incident;
  planIds: readonly string[];
  requested: readonly MechanismId[];
  onPlans: (planIds: string[]) => void;
  onRefresh: () => Promise<void>;
  experimentsHref: string;
  onOpenLink: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Go back to the investigation with a returned finding. */
  onReturn: (hypothesisId: MechanismId) => void;
}) {
  const [returning, setReturning] = useState<MechanismId | null>(null);
  const [returnError, setReturnError] = useState("");
  const { tracks, loadError, start, replace } = useExperimentRuns({
    incidentId: incident.id,
    requested,
    planIds,
    onPlans,
    onRefresh,
  });
  const [chosen, setChosen] = useState<MechanismId | null>(null);
  const [showTour, setShowTour] = useState(true);
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
  const brief = (id: MechanismId) =>
    incident.assessment?.checks.find(
      (check) => check.id === mechanismChecks[id],
    )?.brief;
  const script =
    selectedPlan && selected
      ? experimentPlaybackSteps(
          selectedPlan,
          selected,
          mechanismCopy[selected],
          incident.assessment?.hypotheses.find((item) => item.id === selected)
            ?.component_ids ?? [],
          brief(selected)?.prediction.if_holds,
          findingOf(selectedPlan, selected)?.summary,
        )
      : null;
  const showingResult = !showTour && script?.ok;
  async function returnFinding(id: MechanismId) {
    const plan = tracks[id].plan;
    if (!plan) return;
    setReturning(id);
    setReturnError("");
    try {
      replace(id, await handBack(incident.id, plan, id, "return"));
      onReturn(id);
    } catch (cause) {
      setReturnError(
        cause instanceof Error
          ? cause.message
          : "The finding could not be returned to the investigation.",
      );
    } finally {
      setReturning(null);
    }
  }

  const console = (
    <div className="lab-console-content">
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
          ? `${busy.length} running · ${finished.length} of ${mechanismIds.length} finished.`
          : finished.length
            ? `${finished.length} of ${mechanismIds.length} experiments finished.`
            : "Run together or individually."}
      </p>

      {returnError && (
        <div role="alert" className="incident-experiment-error lab-error">
          <p>{returnError}</p>
        </div>
      )}
      {loadError && (
        <div role="alert" className="incident-experiment-error lab-error">
          <p>{loadError}</p>
        </div>
      )}

      {!script?.ok && (
        <p className="incident-caption" role="status">
          {script && !script.ok
            ? script.reason
            : busy.length
              ? "Experiment playback becomes available when the first experiment finishes."
              : "Run an experiment to play its simulated result in 3D."}
        </p>
      )}
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
              data-selected={
                (showingResult && selected === track.id) || undefined
              }
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
                  Mass {summary.mass.toFixed(2)} vs{" "}
                  {summary.baselineMass.toFixed(2)} control · Coverage{" "}
                  {summary.coverage.toFixed(2)} vs{" "}
                  {summary.baselineCoverage.toFixed(2)} control.
                </p>
              )}
              {track.stage === "done" && track.plan && (
                <TrackFinding
                  plan={track.plan}
                  id={track.id}
                  busy={returning !== null}
                  onReturn={() => void returnFinding(track.id)}
                  onOpen={() => onReturn(track.id)}
                />
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
                  aria-pressed={!!showingResult && selected === track.id}
                  aria-label={`Open playback of ${title}`}
                  onClick={() => {
                    setChosen(track.id);
                    setShowTour(false);
                  }}
                >
                  {showingResult && selected === track.id
                    ? "Playing in 3D"
                    : "Open playback"}
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
      <p className="incident-caption lab-footnote">
        Simulated results cannot rank causes or become evidence. Engineer review
        required.{" "}
        <a href={experimentsHref} onClick={onOpenLink}>
          Full plans and matrices
        </a>
      </p>
    </div>
  );
  return (
    <section
      className="experiment-lab"
      aria-labelledby="experiment-lab-heading"
    >
      <div className="lab-stage">
        <GuidedPlayback
          script={showingResult ? script : referenceGuide}
          title={
            showingResult ? mechanismTitles[selected!] : "S932 assembly guide"
          }
          settings={settings}
          viewTools={
            <div
              className="incident-view-toggle"
              role="group"
              aria-label="Simulation content"
            >
              <button
                className="secondary"
                aria-pressed={!showingResult}
                onClick={() => setShowTour(true)}
              >
                Assembly tour
              </button>
              <button
                className="secondary"
                aria-pressed={!!showingResult}
                disabled={!script?.ok}
                onClick={() => setShowTour(false)}
              >
                Experiment playback
              </button>
            </div>
          }
        >
          <details className="guided-panel lab-console" open>
            <summary>
              Experiments · {finished.length} of {mechanismIds.length} finished
            </summary>
            {console}
          </details>
        </GuidedPlayback>
      </div>
    </section>
  );
}
