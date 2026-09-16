import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ProcedureStep } from "@flowpilot/contracts";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import { modelNodes, cameraPresets } from "../prototype/model";
import "./viewer.css";

const AssemblyScene = lazy(() => import("./AssemblyScene"));

class ViewerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ProcedureViewer({
  steps,
  index,
  onStep,
}: {
  steps: ProcedureStep[];
  index: number;
  onStep: (index: number) => void;
}) {
  const [twoD, setTwoD] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reset, setReset] = useState(0);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const step = steps[index];
  const mapped =
    step &&
    modelNodes[step.model_node_id] &&
    step.camera_preset in cameraPresets;
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(query.matches);
      setPlaying(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index < steps.length - 1) onStep(index + 1);
      if (index >= steps.length - 2) setPlaying(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [playing, index, steps.length, onStep]);
  if (!step)
    return (
      <p role="status">
        Procedure unavailable. Use the recorded case instructions.
      </p>
    );
  return (
    <section
      className="procedure-viewer"
      aria-label="Illustrative procedure viewer"
    >
      <p>Illustrative assembly · expert review pending</p>
      <div className="assembly-tools">
        <button
          className="secondary"
          onClick={() => {
            setTwoD(!twoD);
            setPlaying(false);
          }}
        >
          {twoD ? "Use 3D view" : "Use 2D view"}
        </button>
        <button
          className="secondary"
          disabled={reduced || index === steps.length - 1}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause guide" : "Play guide"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setReset(reset + 1);
            setPlaying(false);
          }}
        >
          Reset view
        </button>
      </div>
      {reduced && <p>Reduced motion: use the step buttons to advance.</p>}
      {failed || !mapped ? (
        <p role="status">
          3D unavailable. The 2D and text guides remain available.
        </p>
      ) : null}
      {twoD || failed || !mapped ? (
        <ProcedureDiagram step={step} />
      ) : (
        <ViewerBoundary
          fallback={
            <>
              <p role="status">
                3D could not load. Use the 2D and text guides.
              </p>
              <ProcedureDiagram step={step} />
            </>
          }
        >
          <Suspense fallback={<p role="status">Loading 3D assembly…</p>}>
            <AssemblyScene
              step={step}
              reset={reset}
              reduced={reduced}
              onFailure={() => {
                setFailed(true);
                setPlaying(false);
              }}
              onInteract={() => setPlaying(false)}
            />
          </Suspense>
        </ViewerBoundary>
      )}
      {!twoD && !failed && mapped && (
        <p aria-live="polite">
          Current part:{" "}
          <strong>
            {modelNodes[step.model_node_id]?.label ?? step.model_node_id}
          </strong>
        </p>
      )}
      <div className="assembly-tools">
        <button
          className="secondary"
          disabled={index === 0}
          onClick={() => {
            setPlaying(false);
            onStep(index - 1);
          }}
        >
          Previous step
        </button>
        <button
          className="secondary"
          disabled={index === steps.length - 1}
          onClick={() => {
            setPlaying(false);
            onStep(index + 1);
          }}
        >
          Next step
        </button>
      </div>
      <details open={failed || !mapped || undefined}>
        <summary>Text alternative</summary>
        <ol>
          {steps.map((item, i) => (
            <li key={item.step_id}>
              <button
                className="prototype-text-step"
                aria-current={index === i ? "step" : undefined}
                onClick={() => {
                  setPlaying(false);
                  onStep(i);
                }}
              >
                {item.title}
              </button>
              <p>{item.instruction}</p>
              <p>{item.caution}</p>
            </li>
          ))}
        </ol>
      </details>
      <p>
        Drag to orbit; right-drag to pan; scroll to zoom. Camera buttons also
        work with a keyboard. Playback highlights parts only and never records
        an observation.
      </p>
    </section>
  );
}
