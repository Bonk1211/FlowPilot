import type { Measurement, RecoveryChecks } from "@flowpilot/contracts";

export const sampleNames: Record<Measurement["sample_id"], string> = {
  normal: "Accepted spray",
  incomplete: "Incomplete coverage",
  coarse: "Coarse deposits / blobs",
  shifted: "Shifted pattern",
  overspray: "Overspray",
};

export const emptyRecovery: RecoveryChecks = {
  profile: "synthetic_demo",
  prompted_setup: "unknown",
  calibration: "unknown",
  weight_within_limits: "unknown",
  pressure_within_limits: "unknown",
  limits_reference: "",
  expected_lanes: ["A", "B"],
  first_carriers: [
    { lane: "A", all_units_accepted: "unknown" },
    { lane: "B", all_units_accepted: "unknown" },
  ],
  subsequent_required: "unknown",
  subsequent_trays_accepted: 0,
  confirmed: false,
};
