import type { IncidentExperiment, SimulationRun } from "@flowpilot/contracts";
import { experimentShots, type Mechanism } from "../scene/experimentShots.ts";
import {
  partAnnotations,
  type GroupId,
  type ReadingTarget,
  type Shot,
} from "../scene/shots.ts";

type Result = NonNullable<IncidentExperiment["results"]>[number];
type Point = SimulationRun["points"][number];

/** One simulated sequence position, as the 3D view draws it. All illustrative. */
export type FluidPoint = {
  position: number;
  mass: number;
  coverage: number;
  supplyPressure: number;
  feedFlow: number;
  pathOpen: number;
  flowResistance: number;
  valveDuty: number;
  sprayWidth: number;
  /** False for runs saved before the illustrative channels existed. */
  channels: boolean;
};

export type PlaybackStep = {
  id: Shot["id"];
  recordAt?: ReadingTarget;
  title: string;
  /** What is on screen and what it means. Numbers come from the saved run. */
  narration: string;
  /** Optional reasoning kept out of the short step description. */
  details?: string[];
  /** Why the step is not evidence. */
  caution: string;
  shot: Shot;
  /** One point is held for the shot; several are swept across it. */
  fluid: FluidPoint[];
  /** The control condition at the same sequence position, for comparison. */
  control: FluidPoint;
  /** The start of the sequence, or the tested severity as it develops. */
  condition: "start" | "tested";
  mechanism: Mechanism;
  modelNode: string;
  highlightIds: string[];
  /** Illustrative levels for named meshes, from 0 to 1. */
  partStates: Record<string, number>;
  /** Normalized sequence position shown on the response curve, if any. */
  position: number | null;
};

export type PlaybackScript =
  | {
      ok: true;
      run: SimulationRun;
      baseline: SimulationRun;
      steps: PlaybackStep[];
    }
  | { ok: false; reason: string };

export type MechanismText = {
  title: string;
  mechanism: string;
  assumption: string;
};

const SIMULATED =
  "Illustrative simulation, not a measurement or confirmed cause.";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const fixed = (value: number) => value.toFixed(2);
const mechanisms: Mechanism[] = [
  "restriction",
  "unstable_delivery",
  "material_condition",
];

function resultsFor(experiment: IncidentExperiment, hypothesisId: string) {
  const own = (experiment.results ?? []).filter(
    (item) => item.condition.hypothesis_id === hypothesisId,
  );
  const baseline = own.find((item) => item.condition.baseline);
  const tested = own.filter((item) => !item.condition.baseline);
  // The highest tested severity shows the clearest simulated response.
  const strongest = [...tested].sort(
    (a, b) =>
      b.condition.parameters.severity - a.condition.parameters.severity ||
      b.condition.repetition - a.condition.repetition,
  )[0];
  return { baseline, strongest } as {
    baseline: Result | undefined;
    strongest: Result | undefined;
  };
}

/** Channels saved by model version 2; earlier runs fall back to mass and coverage. */
export function fluidPoint(point: Point): FluidPoint {
  return {
    position: point.position,
    mass: point.relative_mass,
    coverage: point.coverage_fraction,
    supplyPressure: point.supply_pressure ?? 1,
    feedFlow: point.feed_flow ?? point.relative_mass,
    pathOpen: point.path_open ?? 1,
    flowResistance: point.flow_resistance ?? 1,
    valveDuty: point.valve_duty ?? 1,
    sprayWidth: point.spray_width ?? point.coverage_fraction,
    channels: point.path_open != null,
  };
}

function levels(point: FluidPoint) {
  return {
    "visible-fluid-core": clamp(point.feedFlow),
    "spray-cone": clamp(point.sprayWidth),
    substrate_tray: clamp(point.coverage),
  };
}

/** What one mechanism's saved simulation shows, for a short card summary. */
export function trackSummary(
  experiment: IncidentExperiment,
  hypothesisId: string,
) {
  const { baseline, strongest } = resultsFor(experiment, hypothesisId);
  if (!baseline || !strongest) return null;
  const last = (run: SimulationRun) => run.points[run.points.length - 1];
  const end = last(strongest.run);
  const reference = last(baseline.run);
  const effect = experiment.analysis?.effects.find(
    (item) => item.hypothesis_id === hypothesisId,
  );
  return {
    severity: strongest.condition.parameters.severity,
    controlSeverity: baseline.condition.parameters.severity,
    mass: end.relative_mass,
    baselineMass: reference.relative_mass,
    coverage: end.coverage_fraction,
    baselineCoverage: reference.coverage_fraction,
    mainEffect: effect?.main_effect ?? null,
  };
}

const partNames: Record<string, string> = {
  bfs_lid: "the BFS lid",
  bfs_sensors: "the BFS level sensors",
  nozzle_nut: "the nozzle nut",
  bfs_bottle: "the BFS bottle",
  bfs_air: "the BFS reservoir-pressure air line",
  pickup_tube: "the pickup tube",
  feed_tube: "the clear feed tube",
  fluid_qd: "the fluid quick-disconnect (QD)",
  dj2200_valve: "the DJ-2200 valve",
  air_cap: "the air cap",
  nozzle: "the nozzle",
};

function listed(items: string[]) {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** What the close-up shows for each mechanism at the tested severity. */
function atTheMechanism(
  mechanism: Mechanism,
  severity: number,
  tested: FluidPoint[],
  end: FluidPoint,
) {
  const at = `At severity ${fixed(severity)}`;
  if (!end.channels)
    return `${at}, feed flow is ${fixed(end.feedFlow)}. Saved before the model's illustrative channels existed; only mass and coverage are available.`;
  if (mechanism === "restriction")
    return `${at}, the model narrows the open path to ${fixed(end.pathOpen)}; feed flow falls to ${fixed(end.feedFlow)}. The marked location is hypothetical.`;
  if (mechanism === "unstable_delivery") {
    const pressures = tested.map((point) => point.supplyPressure);
    return `${at}, supply pressure varies from ${fixed(Math.min(...pressures))} to ${fixed(Math.max(...pressures))}. Liquid arrives in pulses with gaps.`;
  }
  return `${at}, flow resistance reaches ${fixed(end.flowResistance)}× reference; feed flow falls to ${fixed(end.feedFlow)}. Darker liquid illustrates slower flow, not measured viscosity.`;
}

function depositShape(mechanism: Mechanism) {
  if (mechanism === "restriction")
    return "The stripes fade steadily from one end to the other.";
  if (mechanism === "unstable_delivery")
    return "Dense and sparse stripes alternate as the delivery rises and falls.";
  return "The stripes fade quickly at first and then more slowly.";
}

/**
 * Turn one mechanism's saved simulated runs into eight inspectable guide steps.
 * Every number is read from the runs; nothing here is measured or recorded as
 * evidence, and the narration says only what the frame shows.
 */
export function experimentPlaybackSteps(
  experiment: IncidentExperiment,
  hypothesisId: string,
  copy: MechanismText,
  componentIds: string[],
  prediction?: string,
  finding?: string,
): PlaybackScript {
  if (experiment.status !== "completed")
    return { ok: false, reason: "The experiment has not finished running." };
  if (!mechanisms.includes(hypothesisId as Mechanism))
    return { ok: false, reason: "This mechanism has no playback." };
  const mechanism = hypothesisId as Mechanism;
  const { baseline, strongest } = resultsFor(experiment, hypothesisId);
  if (!baseline || !strongest)
    return {
      ok: false,
      reason: "The saved results do not include this mechanism's runs.",
    };
  const base = baseline.run;
  const run = strongest.run;
  if (run.points.length < 2 || base.points.length < 2)
    return { ok: false, reason: "The saved runs are too short to play back." };

  const tested = run.points.map(fluidPoint);
  const control = base.points.map(fluidPoint);
  const end = tested[tested.length - 1];
  const controlEnd = control[control.length - 1];
  const severity = strongest.condition.parameters.severity;
  const controlSeverity = baseline.condition.parameters.severity;
  const shots = experimentShots(mechanism, componentIds);
  const shot = (id: string) => shots.find((item) => item.id === id)!;
  const first = componentIds[0] ?? "substrate_tray";
  const parts = listed(
    shot("apart").explode.map((id) => partNames[id] ?? id.replaceAll("_", " ")),
  );
  const effect = experiment.analysis?.effects.find(
    (item) => item.hypothesis_id === hypothesisId,
  );
  const step = (
    id: string,
    title: string,
    narration: string,
    fluid: FluidPoint[],
    condition: PlaybackStep["condition"],
    extra: Partial<PlaybackStep> = {},
  ): PlaybackStep => ({
    id,
    recordAt: readingTarget(id, mechanism),
    title,
    narration,
    caution: SIMULATED,
    shot: shot(id),
    fluid,
    control: condition === "start" ? control[0] : controlEnd,
    condition,
    mechanism,
    modelNode: first,
    highlightIds: componentIds,
    partStates: levels(fluid[fluid.length - 1]),
    position: null,
    ...extra,
  });

  const steps: PlaybackStep[] = [
    step(
      "establish",
      "The machine and the question",
      `${copy.mechanism} Compare severity ${fixed(severity)} with control ${fixed(controlSeverity)}.`,
      [tested[0]],
      "start",
      {
        highlightIds: [],
        details: [
          `Starting simulated mass: ${fixed(tested[0].mass)} of reference.`,
        ],
      },
    ),
    step(
      "follow",
      "Following the liquid",
      "Follow the teal liquid: BFS bottle → pickup tube → feed tube → fluid QD → DJ-2200 valve. Air supplies follow separate paths.",
      [tested[0]],
      "start",
      { highlightIds: [] },
    ),
    step(
      "apart",
      "Taking it apart",
      `Inspect ${parts}. Rotate the exploded view for a closer look.`,
      [tested[0]],
      "start",
      {
        details: [
          copy.assumption,
          "Illustrative separation, not a maintenance sequence.",
        ],
      },
    ),
    step(
      "mechanism",
      `Where ${copy.title.toLowerCase()} acts`,
      atTheMechanism(mechanism, severity, tested, end),
      [end],
      "tested",
    ),
    step(
      "valve",
      "Inside the valve",
      `Feed flow: ${fixed(end.feedFlow)} against ${fixed(controlEnd.feedFlow)} control. Amber air actuates the valve; blue air feeds the air cap.`,
      [end],
      "tested",
      {
        details: [
          "Valve actuation is shown at a constant rate; it is not modelled.",
        ],
      },
    ),
    step(
      "nozzle",
      "At the nozzle",
      `Spray width: ${fixed(end.sprayWidth)} against ${fixed(controlEnd.sprayWidth)} control. Droplet density follows feed flow (${fixed(end.feedFlow)}).`,
      [end],
      "tested",
    ),
    step(
      "substrate",
      "The deposit, position by position",
      `Coverage changes from ${fixed(tested[0].coverage)} to ${fixed(end.coverage)} (${fixed(controlEnd.coverage)} control). ${depositShape(mechanism)}`,
      tested,
      "tested",
      {
        position: end.position,
        details: [
          "The deposit builds one stripe per sequence position, left to right. Denser stripes mean more coverage. Positions are normalized steps, not elapsed time.",
        ],
      },
    ),
    step(
      "readout",
      "What this simulation shows",
      `Simulated mass ends at ${fixed(end.mass)} against ${fixed(controlEnd.mass)} control. These results do not confirm a physical cause.`,
      tested,
      "tested",
      {
        position: end.position,
        details: [
          prediction ? `Predicted before the run: ${prediction}` : "",
          effect
            ? `Raising ${effect.factor.replaceAll("_", " ")} from ${effect.low_level} to ${effect.high_level} changed the mean simulated response by ${fixed(effect.main_effect)}.`
            : "",
          finding ? `Against the records: ${finding}` : "",
          "No machine test or measurement was performed.",
        ].filter(Boolean),
      },
    ),
  ];
  return { ok: true, run, baseline: base, steps };
}

/** The physical location to inspect, independent of the simulated response. */
function readingTarget(step: string, mechanism: Mechanism): ReadingTarget {
  if (step === "apart")
    return mechanism === "restriction"
      ? {
          part: "fluid_qd",
          text: "Fluid QD · seal / O-ring",
          mesh: "qd-seal",
          point: [0.126, 0, 0],
        }
      : {
          part: "bfs_lid",
          text: "BFS lid · O-ring",
          mesh: "lid-o-ring",
          point: [0.61, 0, 0],
        };
  const mechanismPart: Record<Mechanism, GroupId> = {
    restriction: "fluid_qd",
    unstable_delivery: "bfs_air",
    material_condition: "bfs_bottle",
  };
  const parts: Record<string, GroupId> = {
    establish: "bfs_air",
    follow: "feed_tube",
    mechanism: mechanismPart[mechanism],
    valve: "dj2200_valve",
    nozzle: "nozzle",
    substrate: "substrate_tray",
    readout: "substrate_tray",
  };
  const part = parts[step] ?? "substrate_tray";
  return { part, ...partAnnotations[part] };
}
