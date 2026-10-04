import type { IncidentExperiment, SimulationRun } from "@flowpilot/contracts";

type Result = NonNullable<IncidentExperiment["results"]>[number];

export type PlaybackStep = {
  id: string;
  title: string;
  /** What happened at this step, in plain language. Numbers come from the saved run. */
  narration: string;
  /** Why the step is not evidence. */
  caution: string;
  camera: "assembly_overview" | "valve_closeup" | "nozzle_closeup";
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

const POSITION_STEPS = [0, 3, 6, 9, 12];
const SIMULATED =
  "Simulated response from an illustrative model. It is not a measurement and does not confirm a cause.";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const fixed = (value: number) => value.toFixed(2);

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

function levels(point: SimulationRun["points"][number]) {
  return {
    "visible-fluid-core": clamp(point.relative_mass),
    "spray-cone": clamp(point.coverage_fraction),
  };
}

function direction(value: number, baseline: number) {
  const change = value - baseline;
  if (Math.abs(change) < 0.005) return "level with the baseline";
  return `${fixed(Math.abs(change))} ${change < 0 ? "below" : "above"} the baseline`;
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
    mass: end.relative_mass,
    baselineMass: reference.relative_mass,
    coverage: end.coverage_fraction,
    baselineCoverage: reference.coverage_fraction,
    mainEffect: effect?.main_effect ?? null,
  };
}

/**
 * Turn one mechanism's saved simulated runs into a short guided sequence. Every
 * number is read from the runs; nothing here is measured or recorded as evidence.
 */
export function experimentPlaybackSteps(
  experiment: IncidentExperiment,
  hypothesisId: string,
  copy: MechanismText,
  componentIds: string[],
): PlaybackScript {
  if (experiment.status !== "completed")
    return { ok: false, reason: "The experiment has not finished running." };
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

  const camera = componentIds.includes("nozzle")
    ? "nozzle_closeup"
    : componentIds.includes("dj2200_valve")
      ? "valve_closeup"
      : "assembly_overview";
  const focus = componentIds.includes("nozzle")
    ? "nozzle"
    : componentIds.includes("dj2200_valve")
      ? "dj2200_valve"
      : (componentIds[0] ?? "substrate_tray");
  const first = componentIds[0] ?? "substrate_tray";
  const baseEnd = base.points[base.points.length - 1];
  const severity = strongest.condition.parameters.severity;

  const steps: PlaybackStep[] = [
    {
      id: "baseline",
      title: "Without the fault",
      narration: `The same plan with the fault not applied. Across the sequence the simulated mass stays near ${fixed(baseEnd.relative_mass)} and coverage near ${fixed(baseEnd.coverage_fraction)}. This is the reference the next steps are compared with.`,
      caution: SIMULATED,
      camera: "assembly_overview",
      modelNode: first,
      highlightIds: [],
      partStates: levels(baseEnd),
      position: null,
    },
    {
      id: "mechanism",
      title: `Where ${copy.title.toLowerCase()} acts`,
      narration: `${copy.mechanism} ${copy.assumption}`,
      caution: SIMULATED,
      camera,
      modelNode: focus,
      highlightIds: componentIds,
      partStates: levels(baseEnd),
      position: null,
    },
    ...POSITION_STEPS.map((index): PlaybackStep => {
      const point = run.points[Math.min(index, run.points.length - 1)];
      const reference = base.points[Math.min(index, base.points.length - 1)];
      return {
        id: `position-${index}`,
        title: `Sequence position ${fixed(point.position)}`,
        narration: `With the fault at severity ${fixed(severity)}, the simulated mass is ${fixed(point.relative_mass)} (${direction(point.relative_mass, reference.relative_mass)}) and coverage ${fixed(point.coverage_fraction)} (${direction(point.coverage_fraction, reference.coverage_fraction)}). Positions are normalized steps, not elapsed time.`,
        caution: SIMULATED,
        camera: "assembly_overview",
        modelNode: first,
        highlightIds: componentIds,
        partStates: levels(point),
        position: point.position,
      };
    }),
  ];

  const effect = experiment.analysis?.effects.find(
    (item) => item.hypothesis_id === hypothesisId,
  );
  const endPoint = run.points[run.points.length - 1];
  steps.push({
    id: "summary",
    title: "What this simulation shows",
    narration: [
      experiment.analysis?.summary ?? "",
      effect
        ? `For this mechanism, raising ${effect.factor.replaceAll("_", " ")} from ${effect.low_level} to ${effect.high_level} changed the mean simulated response by ${fixed(effect.main_effect)}.`
        : "",
      "Synthetic responses do not confirm a physical cause. No machine test or measurement was performed.",
    ]
      .filter(Boolean)
      .join(" "),
    caution: SIMULATED,
    camera: "assembly_overview",
    modelNode: first,
    highlightIds: componentIds,
    partStates: levels(endPoint),
    position: endPoint.position,
  });
  return { ok: true, run, baseline: base, steps };
}
