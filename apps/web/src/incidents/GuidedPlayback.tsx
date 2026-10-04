import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ProcedureStep } from "@flowpilot/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Cube,
  Pause,
  Path,
  Play,
} from "@phosphor-icons/react";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import { modelNodes, type ModelNodeId } from "../prototype/model";
import { SceneBoundary } from "./SceneBoundary";
import { StatusChip } from "./StatusChip";
import { ResponsePlot } from "./SimulationPanel";
import type { PlaybackScript } from "./experimentPlayback";
import "../components/viewer.css";
import "./GuidedPlayback.css";

const AssemblyScene = lazy(() => import("../components/AssemblyScene"));
const STEP_MS = 5000;

/**
 * Plays one mechanism's simulated experiment step by step: the camera moves,
 * its parts are highlighted, illustrative levels follow the simulated values
 * and the narration says what the numbers show. Nothing here is a measurement.
 */
export function GuidedPlayback({
  script,
  title,
}: {
  script: Extract<PlaybackScript, { ok: true }>;
  title: string;
}) {
  const { steps } = script;
  const last = steps.length - 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [twoD, setTwoD] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reset, setReset] = useState(0);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const step = steps[index];
  const autoplaying = playing && !reduced && index < last;

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  // A hidden page tears its scene down, so playback must not carry on unseen.
  useEffect(() => () => setPlaying(false), []);
  useEffect(() => {
    if (!autoplaying) return;
    const timer = window.setTimeout(
      () => setIndex((value) => value + 1),
      STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [autoplaying, index]);

  const sceneStep = useMemo<ProcedureStep>(
    () => ({
      step_id: `playback-${step.id}`,
      title: step.title,
      instruction: step.narration,
      caution: step.caution,
      camera_preset: step.camera,
      model_node_id: (Object.hasOwn(modelNodes, step.modelNode)
        ? step.modelNode
        : "substrate_tray") as ModelNodeId,
      highlight: step.highlightIds.length ? "active" : "none",
    }),
    [step],
  );
  const highlightIds = step.highlightIds.length ? step.highlightIds : undefined;
  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.min(last, Math.max(0, next)));
  };

  return (
    <section
      className="guided-playback"
      aria-label="Guided simulation playback"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)
        )
          return;
        if (event.key === "ArrowRight") go(index + 1);
        else if (event.key === "ArrowLeft") go(index - 1);
        else return;
        event.preventDefault();
      }}
    >
      <div className="guided-playback-head">
        <div>
          <p className="eyebrow">Guided playback</p>
          <h3>{title}</h3>
        </div>
        <StatusChip kind="simulated" detail="not measured" />
      </div>
      <div className="incident-scene procedure-viewer">
        <div className="incident-view-toggle">
          <button
            className="secondary"
            aria-pressed={!twoD && !failed}
            disabled={failed}
            onClick={() => setTwoD(false)}
          >
            <Cube aria-hidden="true" />
            3D assembly
          </button>
          <button
            className="secondary"
            aria-pressed={twoD || failed}
            onClick={() => setTwoD(true)}
          >
            <Path aria-hidden="true" />
            2D schematic
          </button>
        </div>
        {failed && (
          <p role="status">
            3D unavailable. The schematic and the steps below remain usable.
          </p>
        )}
        {twoD || failed ? (
          <ProcedureDiagram step={sceneStep} highlightIds={highlightIds} />
        ) : (
          <SceneBoundary
            fallback={
              <ProcedureDiagram step={sceneStep} highlightIds={highlightIds} />
            }
          >
            <Suspense
              fallback={<p role="status">Loading illustrative assembly…</p>}
            >
              <AssemblyScene
                step={sceneStep}
                reset={reset}
                reduced={reduced}
                highlightIds={highlightIds}
                partStates={step.partStates}
                onFailure={() => setFailed(true)}
                onInteract={() => setPlaying(false)}
              />
            </Suspense>
          </SceneBoundary>
        )}
        <div className="assembly-tools">
          <button className="secondary" onClick={() => setReset((n) => n + 1)}>
            Reset view
          </button>
          <span className="incident-caption">
            Glow and spray levels follow the simulated values. They are
            illustrative, not measured.
          </span>
        </div>
      </div>
      <div className="guided-controls">
        <button
          aria-label="Previous step"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ArrowLeft aria-hidden="true" /> Previous
        </button>
        <button
          aria-pressed={autoplaying}
          disabled={reduced}
          title={
            reduced
              ? "Reduced motion: use the step buttons to advance."
              : undefined
          }
          onClick={() => {
            if (autoplaying) setPlaying(false);
            else {
              if (index === last) setIndex(0);
              setPlaying(true);
            }
          }}
        >
          {autoplaying ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {autoplaying ? "Pause guide" : "Play guide"}
        </button>
        <button
          aria-label="Next step"
          disabled={index === last}
          onClick={() => go(index + 1)}
        >
          Next <ArrowRight aria-hidden="true" />
        </button>
        <span className="guided-counter" role="status">
          Step {index + 1} of {steps.length}
        </span>
      </div>
      <div className="guided-narration" aria-live="polite" aria-atomic="true">
        <h4>{step.title}</h4>
        <p>{step.narration}</p>
        <p className="incident-caption">{step.caution}</p>
      </div>
      <ol className="guided-steps" aria-label="Playback steps">
        {steps.map((item, position) => (
          <li key={item.id}>
            <button
              aria-current={position === index ? "step" : undefined}
              onClick={() => go(position)}
            >
              <span className="guided-step-number" aria-hidden="true">
                {position + 1}
              </span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <ResponsePlot run={script.run} marker={step.position} showTable={false} />
    </section>
  );
}
