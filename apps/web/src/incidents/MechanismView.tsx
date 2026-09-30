import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProcedureStep } from "@flowpilot/contracts";
import { Cube, Path } from "@phosphor-icons/react";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import { modelNodes, type ModelNodeId } from "../prototype/model";
import "../components/viewer.css";

const AssemblyScene = lazy(() => import("../components/AssemblyScene"));

const mechanisms: Record<
  string,
  {
    title: string;
    nodes: ModelNodeId[];
    mechanism: string;
    assumption: string;
    path: string;
  }
> = {
  restriction: {
    title: "Fluid-path restriction",
    nodes: ["feed_tube", "fluid_qd", "dj2200_valve", "nozzle"],
    mechanism:
      "A restriction in the fluid path could reduce the quantity reaching the substrate while dispensing continues.",
    assumption:
      "The location and degree of restriction are hypothetical. This view does not establish an obstruction from an image or pressure trend.",
    path: "BFS bottle → pickup tube → feed tube → fluid QD → valve → nozzle",
  },
  unstable_delivery: {
    title: "Unstable fluid delivery",
    nodes: ["bfs_air", "bfs_bottle", "pickup_tube", "feed_tube"],
    mechanism:
      "Changing reservoir delivery conditions could interrupt or vary fluid reaching the valve, producing inconsistent coverage.",
    assumption:
      "Reservoir pressure, valve-actuation air and coaxial atomization air are separate paths. No instantaneous airflow is measured by this view.",
    path: "BFS air → bottle headspace → pickup tube → feed tube → valve",
  },
  material_condition: {
    title: "Material-condition change",
    nodes: ["bfs_bottle", "feed_tube", "dj2200_valve", "substrate_tray"],
    mechanism:
      "A change in material condition could alter delivery and deposited coverage even when the mechanical path has not changed.",
    assumption:
      "Material properties, age and environmental effects require supporting records or checks. No viscosity or material state is inferred as a measurement.",
    path: "Material in bottle → delivery path → deposited coverage",
  },
};

class SceneBoundary extends Component<
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

export function MechanismView({
  hypothesisId,
  revision,
  eventLabel,
}: {
  hypothesisId: string | null;
  revision: number;
  eventLabel?: string;
}) {
  const mechanism = mechanisms[hypothesisId ?? ""];
  const [part, setPart] = useState<ModelNodeId | null>(null);
  const [twoD, setTwoD] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reset, setReset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const node =
    part && mechanism?.nodes.includes(part)
      ? part
      : (mechanism?.nodes[0] ?? "substrate_tray");
  const step = useMemo<ProcedureStep>(
    () => ({
      step_id: `mechanism-${hypothesisId}-${node}`,
      title: mechanism?.title ?? "Select a hypothesis",
      instruction:
        mechanism?.mechanism ??
        "Compare a hypothesis to inspect its relevant components.",
      caution:
        "Simulated schematic explanation only; no calibrated prediction or machine command.",
      model_node_id: node,
      camera_preset:
        node === "nozzle"
          ? "nozzle_closeup"
          : node === "dj2200_valve"
            ? "valve_closeup"
            : "assembly_overview",
      highlight: mechanism ? "active" : "none",
    }),
    [hypothesisId, mechanism, node],
  );
  return (
    <section
      className="incident-card incident-mechanism"
      aria-labelledby="incident-mechanism-heading"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Understand the explanation</p>
          <h2 id="incident-mechanism-heading">Mechanism explorer</h2>
        </div>
        <span className="incident-tag">Simulated · schematic v1</span>
      </div>
      <p className="incident-caption">
        Assessment revision {revision}
        {eventLabel ? ` · Inspecting evidence: ${eventLabel}` : ""}. Component
        highlights show a possible mechanism, not a sensor reading.
      </p>
      <div className="incident-mechanism-layout">
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
              3D unavailable. The schematic and investigation remain usable.
            </p>
          )}
          {twoD || failed ? (
            <ProcedureDiagram step={step} />
          ) : (
            <SceneBoundary fallback={<ProcedureDiagram step={step} />}>
              <Suspense
                fallback={<p role="status">Loading illustrative assembly…</p>}
              >
                <AssemblyScene
                  step={step}
                  reset={reset}
                  reduced={reduced}
                  onFailure={() => setFailed(true)}
                  onInteract={() => undefined}
                />
              </Suspense>
            </SceneBoundary>
          )}
          <div className="assembly-tools">
            <button
              className="secondary"
              onClick={() => {
                setPart(null);
                setReset((value) => value + 1);
              }}
            >
              Reset view
            </button>
            <span className="incident-caption">
              {reduced
                ? "Reduced motion enabled"
                : "Keyboard camera controls available"}
            </span>
          </div>
        </div>
        <div className="incident-mechanism-text">
          <span className="incident-tag">Inferred explanation</span>
          <h3>{mechanism?.title ?? "Select a hypothesis to explore"}</h3>
          <p>{step.instruction}</p>
          {mechanism && (
            <>
              <p className="mono incident-flow-path">{mechanism.path}</p>
              <div
                className="incident-flow-sketch"
                data-mechanism={hypothesisId}
                data-playing={playing && !reduced}
                role="img"
                aria-label={`Simulated qualitative illustration of ${mechanism.title.toLowerCase()}. No measured flow or timescale.`}
              >
                <span>Supply</span>
                <div className="incident-flow-track">
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <span>Deposit</span>
              </div>
              <div className="incident-actions">
                <button
                  disabled={reduced}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing && !reduced ? "Pause schematic" : "Play schematic"}
                </button>
                <span className="incident-caption">
                  Simulated pattern · no physical timescale
                </span>
              </div>
              <div
                className="incident-component-list"
                aria-label="Components in this mechanism"
              >
                {mechanism.nodes.map((id) => (
                  <button
                    key={id}
                    aria-pressed={node === id}
                    onClick={() => setPart(id)}
                  >
                    {modelNodes[id].label}
                  </button>
                ))}
              </div>
              <p>
                <strong>Assumptions & limits</strong>
              </p>
              <p>{mechanism.assumption}</p>
            </>
          )}
          <details>
            <summary>Model scope and pneumatic paths</summary>
            <p>
              Generic geometry, qualitative relationships and illustrative
              component highlights. Model: s932-schematic-v1. No calibrated
              flow, pressure, spray or coverage prediction.
            </p>
            <ul>
              <li>BFS air supplies reservoir pressure.</li>
              <li>Valve air actuates the valve.</li>
              <li>Coaxial air supports atomization at the air cap.</li>
            </ul>
            <p>
              Source: secondary S932 consolidated reference, equipment
              architecture. Controlled originals and installed-configuration
              validation are pending.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
