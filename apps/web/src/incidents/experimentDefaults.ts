import type {
  ExperimentFactor,
  ExperimentProposal,
} from "@flowpilot/contracts";

export const mechanismTitles = {
  restriction: "Fluid-path restriction",
  unstable_delivery: "Unstable fluid delivery",
  material_condition: "Material-condition change",
} as const;
export type MechanismId = keyof typeof mechanismTitles;
export const mechanismIds = Object.keys(mechanismTitles) as MechanismId[];

export const factorSpecs = {
  severity: { label: "Fault severity", min: 0, max: 1 },
  delivery_ratio: { label: "Delivery ratio", min: 0.8, max: 1.2 },
  material_ratio: { label: "Material ratio", min: 0.8, max: 1.2 },
} as const;
export type FactorName = ExperimentFactor["name"];

export const defaultLevels: Record<FactorName, number[]> = {
  severity: [0.2, 0.8],
  delivery_ratio: [0.8, 1.2],
  material_ratio: [0.8, 1.2],
};
export const defaultControls = {
  severity: 0.7,
  delivery_ratio: 1,
  material_ratio: 1,
};
export const defaultExpectation =
  "Compare hypothetical response changes across all three candidate mechanisms.";

/** The fixed comparison offered by default: all three mechanisms, one factor, one repetition. */
export function defaultProposal(
  incidentRevision: number,
  checkId: ExperimentProposal["check_id"],
): ExperimentProposal {
  return {
    incident_revision: incidentRevision,
    check_id: checkId,
    hypothesis_ids: [...mechanismIds],
    factors: [{ name: "severity", levels: [...defaultLevels.severity] }],
    controls: { ...defaultControls },
    repetitions: 1,
    response: "relative_mass",
    expected_discrimination: defaultExpectation,
  };
}
