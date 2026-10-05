import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProcedureStep, SimulationRun } from "@flowpilot/contracts";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowsIn,
  ArrowsOut,
  Cube,
  Pause,
  Path,
  Play,
} from "@phosphor-icons/react";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import { modelNodes, type ModelNodeId } from "../prototype/model";
import type { SceneDirection } from "../scene/stage";
import {
  ModelReadingAnnotation,
  type ReadingAnnotationHandle,
} from "./ModelReadingAnnotation";
import { SceneBoundary } from "./SceneBoundary";
import { StatusChip } from "./StatusChip";
import { ResponsePlot } from "./SimulationPanel";
import type { PlaybackStep } from "./experimentPlayback";
import "../components/viewer.css";
import "./GuidedPlayback.css";

const AssemblyScene = lazy(() => import("../components/AssemblyScene"));
const legend = [
  ["liquid", "Liquid"],
  ["reservoir", "Reservoir air"],
  ["valve", "Valve-actuation air"],
  ["atomizing", "Atomizing air"],
] as const;

/** Each step is an inspectable view. Playing demonstrates only that step. */
export function GuidedPlayback({
  script,
  title,
  children,
  settings,
  viewTools,
  stepRecord,
}: {
  script: { steps: PlaybackStep[]; run?: SimulationRun };
  title: string;
  children?: ReactNode;
  settings?: ReactNode;
  viewTools?: ReactNode;
  stepRecord?: (index: number, go: (index: number) => void) => ReactNode;
}) {
  const { steps } = script;
  const last = steps.length - 1;
  const viewport = useRef<HTMLDivElement>(null);
  const readingAnnotation = useRef<ReadingAnnotationHandle>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [held, setHeld] = useState(false);
  const [twoD, setTwoD] = useState(false);
  const [failed, setFailed] = useState(false);
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState(1);
  const [fullScreen, setFullScreen] = useState(false);
  const [initialGuideOpen] = useState(
    () => !script.run || !matchMedia("(max-width: 700px)").matches,
  );
  const [fullScreenError, setFullScreenError] = useState("");
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const identity = `${title}:${script.run?.id ?? "reference"}`;
  const [playbackIdentity, setPlaybackIdentity] = useState(identity);
  const changed = playbackIdentity !== identity;
  // Reset the walkthrough without remounting the floating settings console.
  if (changed) {
    setPlaybackIdentity(identity);
    setIndex(0);
    setPlaying(false);
    setStarted(false);
    setHeld(false);
    setProgress(1);
  }
  const step = steps[changed ? 0 : index];

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () =>
      setFullScreen(document.fullscreenElement === viewport.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    return () => {
      document.removeEventListener("visibilitychange", stop);
      setPlaying(false);
    };
  }, []);

  const sceneStep = useMemo<ProcedureStep>(
    () => ({
      step_id: `playback-${step.id}`,
      title: step.title,
      instruction: step.narration,
      caution: step.caution,
      camera_preset: "assembly_overview",
      model_node_id: (Object.hasOwn(modelNodes, step.modelNode)
        ? step.modelNode
        : "substrate_tray") as ModelNodeId,
      highlight: step.highlightIds.length ? "active" : "none",
    }),
    [step],
  );
  const direction = useMemo<SceneDirection>(
    () => ({
      key: `${identity}:${step.id}`,
      shot: step.shot,
      fluid: step.fluid,
      control: step.control,
      condition: step.condition,
      mechanism: step.mechanism,
      recordAt: stepRecord ? step.recordAt : undefined,
    }),
    [step, identity, stepRecord],
  );
  const highlightIds = step.highlightIds.length ? step.highlightIds : undefined;
  const go = (next: number) => {
    const target = Math.min(last, Math.max(0, next));
    if (target === index) return;
    const animate = !reduced && !twoD && !failed;
    // Move from the current view into this step, then hold until another choice.
    setPlaying(animate);
    setStarted(animate);
    setHeld(false);
    setProgress(animate ? 0 : 1);
    setIndex(target);
  };
  const sweep = step.fluid.length > 1 && step.shot.deposit === "build";
  const marker =
    step.position === null
      ? null
      : sweep && !reduced
        ? step.position * progress
        : step.position;
  const playbackLabel = playing
    ? "Pause step"
    : !started
      ? "Play step"
      : progress >= 1 || held
        ? "Replay step"
        : "Resume step";

  return (
    <section
      className="guided-playback"
      aria-label="Guided simulation playback"
      data-reference={!script.run}
      data-content-switch={!!viewTools}
      data-recording={!!stepRecord}
    >
      <div
        ref={viewport}
        className="guided-viewport procedure-viewer"
        onKeyDown={(event) => {
          if (
            event.target instanceof HTMLElement &&
            (event.target.closest(".assembly-camera-tools") ||
              ["INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(
                event.target.tagName,
              ))
          )
            return;
          if (event.key === "ArrowRight") go(index + 1);
          else if (event.key === "ArrowLeft") go(index - 1);
          else return;
          event.preventDefault();
        }}
      >
        <div className="guided-topbar">
          <div className="guided-playback-head">
            <p className="eyebrow">ASYMTEK S932 · 3D simulation</p>
            <h3 className={viewTools ? "sr-only" : undefined}>{title}</h3>
            {viewTools && (
              <div className="guided-content-switch">{viewTools}</div>
            )}
          </div>
          <div className="guided-view-tools">
            <div className="incident-view-toggle">
              <button
                className="secondary"
                aria-pressed={!twoD && !failed}
                disabled={failed}
                onClick={() => {
                  setTwoD(false);
                  setPlaying(false);
                }}
              >
                <Cube aria-hidden="true" /> 3D assembly
              </button>
              <button
                className="secondary"
                aria-pressed={twoD || failed}
                onClick={() => {
                  setTwoD(true);
                  setPlaying(false);
                }}
              >
                <Path aria-hidden="true" /> 2D schematic
              </button>
            </div>
            <button
              className="secondary guided-fullscreen"
              aria-label={fullScreen ? "Exit full screen" : "Enter full screen"}
              title={fullScreen ? "Exit full screen" : "Enter full screen"}
              onClick={async () => {
                setFullScreenError("");
                try {
                  if (document.fullscreenElement === viewport.current)
                    await document.exitFullscreen();
                  else await viewport.current?.requestFullscreen();
                } catch {
                  setFullScreenError(
                    "Full screen is unavailable in this browser. The expanded viewer remains usable.",
                  );
                }
              }}
            >
              {fullScreen ? (
                <ArrowsIn aria-hidden="true" />
              ) : (
                <ArrowsOut aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <div className="guided-model-area incident-scene">
          {failed && (
            <p className="guided-fallback" role="status">
              3D unavailable. The schematic and the steps remain usable.
            </p>
          )}
          {twoD || failed ? (
            <ProcedureDiagram step={sceneStep} highlightIds={highlightIds} />
          ) : (
            <div className="guided-frame">
              <SceneBoundary
                fallback={
                  <ProcedureDiagram
                    step={sceneStep}
                    highlightIds={highlightIds}
                  />
                }
              >
                <Suspense
                  fallback={<p role="status">Loading illustrative assembly…</p>}
                >
                  <AssemblyScene
                    step={sceneStep}
                    reset={replay}
                    reduced={reduced}
                    paused={!playing}
                    highlightIds={highlightIds}
                    partStates={step.partStates}
                    directed
                    direction={direction}
                    onReadingAnchor={(anchor) =>
                      readingAnnotation.current?.place(anchor)
                    }
                    onShotProgress={(value) => {
                      setProgress(value);
                      if (value >= 1) setPlaying(false);
                    }}
                    onFailure={() => {
                      setFailed(true);
                      setPlaying(false);
                    }}
                    onInteract={() => {
                      setPlaying(false);
                      setHeld(true);
                    }}
                  />
                </Suspense>
              </SceneBoundary>
            </div>
          )}
          <p className="guided-shot">
            {step.shot.coreLabels?.length
              ? "Core detail"
              : step.shot.explode.length
                ? "Exploded view"
                : "Assembly view"}{" "}
            · {step.shot.name}
          </p>
          <ul className="guided-legend" aria-label="Colours in the 3D view">
            {legend.map(([kind, label]) => (
              <li key={kind} data-kind={kind}>
                {label}
              </li>
            ))}
          </ul>
        </div>
        {stepRecord && step.recordAt && (
          <ModelReadingAnnotation
            ref={readingAnnotation}
            target={step.recordAt}
            index={index}
            total={steps.length}
            schematic={twoD || failed}
            onGo={go}
            onFocus={() => {
              setPlaying(false);
              setHeld(true);
            }}
          >
            {stepRecord(index, go)}
          </ModelReadingAnnotation>
        )}
        <div className="guided-auxiliary">
          {children}
          {settings && (
            <details className="guided-panel guided-settings">
              <summary>Simulation settings</summary>
              {settings}
            </details>
          )}
        </div>
        <details
          className="guided-console"
          aria-label="Step-by-step guide"
          open={stepRecord ? false : initialGuideOpen}
        >
          <summary className="guided-console-heading">
            <span className="eyebrow">Step-by-step guide</span>
            <span className="guided-counter" role="status">
              Step {index + 1} of {steps.length}
            </span>
          </summary>
          <div className="guided-console-body">
            <div className="guided-step-progress" aria-hidden="true">
              {steps.map((item, position) => (
                <span key={item.id} data-active={position <= index} />
              ))}
            </div>
            <div
              className="guided-narration"
              aria-live="polite"
              aria-atomic="true"
            >
              <h4>{step.title}</h4>
              <p>{step.narration}</p>
            </div>
            <div className="guided-controls">
              <button
                className="secondary"
                aria-label="Previous step"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <ArrowLeft aria-hidden="true" /> Previous
              </button>
              <button
                className="primary"
                aria-label="Next step"
                disabled={index === last}
                onClick={() => go(index + 1)}
              >
                Next step <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <div className="guided-play-control">
              <button
                className="secondary"
                disabled={reduced || twoD || failed}
                aria-pressed={playing}
                onClick={() => {
                  if (playing) setPlaying(false);
                  else {
                    if (!started || progress >= 1 || held) {
                      setProgress(0);
                      setReplay((value) => value + 1);
                    }
                    setStarted(true);
                    setHeld(false);
                    setPlaying(true);
                  }
                }}
              >
                {playing ? (
                  <Pause aria-hidden="true" />
                ) : started && (progress >= 1 || held) ? (
                  <ArrowClockwise aria-hidden="true" />
                ) : (
                  <Play aria-hidden="true" />
                )}
                {playbackLabel}
              </button>
              <p>
                {reduced
                  ? "Reduced motion · inspect each step."
                  : "Plays once. Choose Next step to continue."}
              </p>
            </div>
            {!!step.details?.length && (
              <details key={step.id} className="guided-response">
                <summary>Step details</summary>
                {step.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </details>
            )}
            <details className="guided-step-list">
              <summary>All {steps.length} steps</summary>
              <ol className="guided-steps" aria-label="Playback steps">
                {steps.map((item, position) => (
                  <li key={item.id}>
                    <button
                      aria-current={position === index ? "step" : undefined}
                      onClick={(event) => {
                        go(position);
                        if (!script.run)
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                      }}
                    >
                      <span className="guided-step-number" aria-hidden="true">
                        {position + 1}
                      </span>
                      <span className="guided-step-text">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </details>
            {script.run && (
              <details className="guided-response">
                <summary>Simulated response</summary>
                <ResponsePlot
                  run={script.run}
                  marker={marker}
                  showTable={false}
                />
              </details>
            )}
            <div className="guided-source">
              {script.run && (
                <StatusChip kind="simulated" detail="not measured" />
              )}
              {script.run && (
                <p>Illustrative geometry · S932 / DJ-2200 references.</p>
              )}
              <details>
                <summary>
                  {script.run
                    ? "Model references"
                    : "Illustrative model · references"}
                </summary>
                <p>
                  Valve appearance follows the{" "}
                  <a
                    href="https://nc-p-001.sitecorecontenthub.cloud/api/public/content/347a9db638b24881971204d5e660d19f?v=51d7862b"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Nordson datasheet
                  </a>
                  . Internal component names follow the{" "}
                  <a
                    href="https://nc-p-001.sitecorecontenthub.cloud/api/public/content/31bd3f7e505044a0a6a86cb500602659"
                    target="_blank"
                    rel="noreferrer"
                  >
                    DJ-2200 parts list
                  </a>
                  . The S932 reference supplies the BFS, motion, conveyor and
                  service assemblies. Original S932 drawings and measured
                  dimensions were not available.
                </p>
              </details>
            </div>
          </div>
        </details>
        {fullScreenError && (
          <p className="guided-fallback" role="status">
            {fullScreenError}
          </p>
        )}
      </div>
    </section>
  );
}
