import { lazy, Suspense, useEffect, useId, useMemo, useState } from "react";
import type { ProcedureStep } from "@flowpilot/contracts";
import { Columns, Cube, Path } from "@phosphor-icons/react";
import { StatusChip } from "./StatusChip";
import { SceneBoundary } from "./SceneBoundary";
import { MechanismCompare } from "./MechanismCompare";
import type { DiagnosticAssessment } from "./api";
import { ProcedureDiagram } from "../prototype/ProcedureDiagram";
import {
  modelNodeDetails,
  modelNodes,
  type ModelNodeId,
} from "../prototype/model";
import "../components/viewer.css";
import { mechanismCopy } from "./mechanismCopy";
import { GuidedPlayback } from "./GuidedPlayback";
import { assemblyGuide } from "./assemblyGuide";

const AssemblyScene = lazy(() => import("../components/AssemblyScene"));

export function MechanismView({
  hypothesisId,
  componentIds,
  revision,
  eventLabel,
  compact = false,
  immersive = false,
  hypotheses = [],
}: {
  hypothesisId: string | null;
  /** Components of the selected hypothesis, as supplied by the assessment. */
  componentIds: string[];
  revision: number;
  eventLabel?: string;
  /** Hides the flow sketch so the explorer fits beside a timeline. */
  compact?: boolean;
  /** Uses the full simulation viewer and a reference-only assembly guide. */
  immersive?: boolean;
  /** All candidate mechanisms; two or more enable the comparison view. */
  hypotheses?: DiagnosticAssessment["hypotheses"];
}) {
  const [comparing, setComparing] = useState(false);
  const headingId = useId();
  const mechanism = mechanismCopy[hypothesisId ?? ""];
  const componentKey = componentIds.join(",");
  const { nodes, unmapped } = useMemo(() => {
    const ids = componentKey ? componentKey.split(",") : [];
    return {
      nodes: ids.filter((id): id is ModelNodeId =>
        Object.hasOwn(modelNodes, id),
      ),
      unmapped: ids.filter((id) => !Object.hasOwn(modelNodes, id)),
    };
  }, [componentKey]);
  const guide = useMemo(
    () => (immersive ? assemblyGuide(nodes) : null),
    [immersive, nodes],
  );
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
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  const highlightIds = nodes.length ? nodes : undefined;
  const node =
    part && nodes.includes(part) ? part : (nodes[0] ?? "substrate_tray");
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
      data-compact={compact || undefined}
      aria-labelledby={headingId}
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">
            {immersive ? "Explore the equipment" : "Understand the explanation"}
          </p>
          <h2 id={headingId}>Mechanism explorer</h2>
        </div>
        <div className="incident-mechanism-actions">
          {hypotheses.length > 1 && (
            <button
              className="secondary"
              aria-pressed={comparing}
              onClick={() => setComparing(!comparing)}
            >
              <Columns aria-hidden="true" />
              Compare mechanisms
            </button>
          )}
          <StatusChip kind="simulated" detail="schematic v1" />
        </div>
      </div>
      <p className="incident-caption">
        {immersive ? (
          "Reference guide to the S932 fluid path and its separate air supplies. Each step stays in view until you choose Next step."
        ) : (
          <>
            Assessment revision {revision}
            {eventLabel ? ` · Inspecting evidence: ${eventLabel}` : ""}.
            Component highlights show a possible mechanism, not a sensor
            reading.
          </>
        )}
      </p>
      {comparing && hypotheses.length > 1 ? (
        <MechanismCompare hypotheses={hypotheses} initialId={hypothesisId} />
      ) : guide ? (
        <GuidedPlayback
          key={componentKey}
          script={guide}
          title="S932 assembly guide"
        />
      ) : (
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
              <ProcedureDiagram step={step} highlightIds={highlightIds} />
            ) : (
              <SceneBoundary
                fallback={
                  <ProcedureDiagram step={step} highlightIds={highlightIds} />
                }
              >
                <Suspense
                  fallback={<p role="status">Loading illustrative assembly…</p>}
                >
                  <AssemblyScene
                    step={step}
                    reset={reset}
                    reduced={reduced}
                    highlightIds={highlightIds}
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
            <StatusChip kind="inferred" detail="explanation" />
            <h3>{mechanism?.title ?? "Select a hypothesis to explore"}</h3>
            <p>{step.instruction}</p>
            {mechanism && (
              <>
                {!compact && (
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
                        {playing && !reduced
                          ? "Pause schematic"
                          : "Play schematic"}
                      </button>
                      <span className="incident-caption">
                        Simulated pattern · no physical timescale
                      </span>
                    </div>
                  </>
                )}
                <div
                  className="incident-component-list"
                  aria-label="Components in this mechanism"
                  onKeyDown={(event) => {
                    const step =
                      event.key === "ArrowRight" || event.key === "ArrowDown"
                        ? 1
                        : event.key === "ArrowLeft" || event.key === "ArrowUp"
                          ? -1
                          : 0;
                    if (!step) return;
                    event.preventDefault();
                    const next =
                      nodes[
                        (nodes.indexOf(node) + step + nodes.length) %
                          nodes.length
                      ];
                    setPart(next);
                    event.currentTarget
                      .querySelector<HTMLElement>(`[data-component="${next}"]`)
                      ?.focus();
                  }}
                >
                  {nodes.map((id) => (
                    <button
                      key={id}
                      data-component={id}
                      aria-pressed={node === id}
                      tabIndex={node === id ? 0 : -1}
                      onClick={() => setPart(id)}
                    >
                      {modelNodes[id].label}
                    </button>
                  ))}
                </div>
                {modelNodeDetails[node] && (
                  <div
                    className="incident-component-role"
                    role="group"
                    aria-label={`Role of ${modelNodes[node].label}`}
                  >
                    <strong>{modelNodes[node].label}</strong>
                    <p>{modelNodeDetails[node].function}</p>
                    <p className="incident-caption">
                      {modelNodeDetails[node].connection}
                    </p>
                  </div>
                )}
                {unmapped.length > 0 && (
                  <p className="incident-caption">
                    Not in the schematic: {unmapped.join(", ")}.
                  </p>
                )}
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
      )}
    </section>
  );
}
