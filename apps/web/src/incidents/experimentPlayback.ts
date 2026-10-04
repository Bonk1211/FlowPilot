import type { IncidentExperiment, SimulationRun } from "@flowpilot/contracts";
import { experimentShots, type Mechanism } from "../scene/experimentShots.ts";
import type { Shot } from "../scene/shots";

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
  title: string;
  /** What is on screen and what it means. Numbers come from the saved run. */
  narration: string;
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
  "Simulated response from an illustrative model. It is not a measurement and does not confirm a cause.";

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

function direction(value: number, baseline: number) {
  const change = value - baseline;
  if (Math.abs(change) < 0.005) return "level with the control condition";
  return `${fixed(Math.abs(change))} ${change < 0 ? "below" : "above"} the control condition`;
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
  bfs_bottle: "the bottle",
  bfs_air: "the reservoir air line",
  pickup_tube: "the pickup tube",
  feed_tube: "the feed tube",
  fluid_qd: "the quick disconnect",
  dj2200_valve: "the valve",
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
    return `${at} feed flow falls to ${fixed(end.feedFlow)}. This run was saved before the model's illustrative channels existed, so the view shows mass and coverage only.`;
  if (mechanism === "restriction")
    return `${at} the model narrows the open path to ${fixed(end.pathOpen)} of its reference by the end of the sequence. Downstream of the marked example location the liquid thins and feed flow falls to ${fixed(end.feedFlow)}. The location is hypothetical: the model does not place a restriction.`;
  if (mechanism === "unstable_delivery") {
    const pressures = tested.map((point) => point.supplyPressure);
    return `${at} the model's supply pressure swings between ${fixed(Math.min(...pressures))} and ${fixed(Math.max(...pressures))} of its reference. The reservoir air pulses and the liquid in the pickup and feed tube arrives in surges with gaps between them.`;
  }
  return `${at} the model raises flow resistance to ${fixed(end.flowResistance)} times its reference by the end of the sequence. The liquid is drawn darker and moves more slowly, and feed flow falls to ${fixed(end.feedFlow)}. No viscosity is measured; the darker colour is illustrative.`;
}

function depositShape(mechanism: Mechanism) {
  if (mechanism === "restriction")
    return "The stripes fade steadily from one end to the other.";
  if (mechanism === "unstable_delivery")
    return "Dense and sparse stripes alternate as the delivery rises and falls.";
  return "The stripes fade quickly at first and then more slowly.";
}

/**
 * Turn one mechanism's saved simulated runs into an eight-shot guided film.
 * Every number is read from the runs; nothing here is measured or recorded as
 * evidence, and the narration says only what the frame shows.
 */
export function experimentPlaybackSteps(
  experiment: IncidentExperiment,
  hypothesisId: string,
  copy: MechanismText,
  componentIds: string[],
  prediction?: string,
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
      `${copy.mechanism} This film shows what the illustrative model gives for that explanation. It opens at the start of the sequence, where the simulated mass is ${fixed(tested[0].mass)} of its reference. The tested condition (severity ${fixed(severity)}) is later compared with the plan's control condition (severity ${fixed(controlSeverity)}).`,
      [tested[0]],
      "start",
      { highlightIds: [] },
    ),
    step(
      "follow",
      "Following the liquid",
      "The liquid leaves the pressurized bottle through the pickup tube, crosses the clear feed tube and the quick disconnect, and enters the valve. Teal is the liquid. The reservoir air (purple), valve-actuation air (amber) and atomizing air (blue) are separate lines that carry no liquid. This is the start of the sequence.",
      [tested[0]],
      "start",
      { highlightIds: [] },
    ),
    step(
      "apart",
      "Taking it apart",
      `The parts this explanation involves separate: ${parts}. The rest of the machine is faded. ${copy.assumption}`,
      [tested[0]],
      "start",
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
      `The valve meters the liquid down its centre: feed flow here is ${fixed(end.feedFlow)} against ${fixed(controlEnd.feedFlow)} in the control condition. Valve-actuation air (amber) switches the valve and atomizing air (blue) runs to the air cap. Valve actuation is not modelled; it is shown at a constant rate.`,
      [end],
      "tested",
    ),
    step(
      "nozzle",
      "At the nozzle",
      `The spray width follows the simulated coverage: ${fixed(end.sprayWidth)} against ${fixed(controlEnd.sprayWidth)} in the control condition. Droplet density follows feed flow, ${fixed(end.feedFlow)}.`,
      [end],
      "tested",
    ),
    step(
      "substrate",
      "The deposit, position by position",
      `The deposit builds one stripe per sequence position, left to right; a denser stripe means more simulated coverage. At severity ${fixed(severity)} coverage goes from ${fixed(tested[0].coverage)} to ${fixed(end.coverage)}, against ${fixed(controlEnd.coverage)} at the end of the control condition (${direction(end.coverage, controlEnd.coverage)}). ${depositShape(mechanism)} Positions are normalized steps, not elapsed time.`,
      tested,
      "tested",
      { position: end.position },
    ),
    step(
      "readout",
      "What this simulation shows",
      [
        prediction ? `Predicted before the run: ${prediction}` : "",
        `Simulated: the mass ends at ${fixed(end.mass)} against ${fixed(controlEnd.mass)} in the control condition.`,
        effect
          ? `Raising ${effect.factor.replaceAll("_", " ")} from ${effect.low_level} to ${effect.high_level} changed the mean simulated response by ${fixed(effect.main_effect)}.`
          : "",
        "Synthetic responses do not confirm a physical cause. No machine test or measurement was performed.",
      ]
        .filter(Boolean)
        .join(" "),
      tested,
      "tested",
      { position: end.position },
    ),
  ];
  return { ok: true, run, baseline: base, steps };
}
