import type {
  InvestigationAnswer,
  InvestigationNode,
} from "@flowpilot/contracts";

const statements: Record<string, Record<string, string>> = {
  recipe_change: {
    changed: "A recipe or parameter change is recorded.",
    unchanged: "No recipe or parameter change is recorded.",
  },
  controller_events: {
    present: "Controller errors or sequence interruptions are recorded.",
    absent: "No controller errors or sequence interruptions are recorded.",
  },
  frequency: {
    progressive: "The defect develops progressively.",
    intermittent: "The defect occurs intermittently.",
    continuous: "The defect is continuous.",
    sudden: "The defect appeared suddenly.",
  },
  pressure_trend: {
    stable: "Recorded pressure is stable.",
    unstable: "Pressure records show variation.",
  },
  mass_trend: {
    falling: "Recorded mass is falling.",
    stable: "Recorded mass is stable.",
  },
  material: {
    flux: "The recorded material is flux.",
    other: "Another material is recorded.",
  },
  coverage: {
    insufficient: "Images show insufficient coverage.",
    uniform: "Images show uniform coverage.",
  },
  material_condition: {
    changed: "A material condition change is recorded.",
    unchanged: "No material condition change is recorded.",
  },
  timing: {
    aligned: "The sample times align.",
    not_aligned: "The sample times do not align.",
  },
  comparability: {
    comparable: "The records are comparable.",
    not_comparable: "The records are not comparable.",
  },
  idle_history: {
    idle: "An idle interval is recorded.",
    no_idle: "No idle interval is recorded.",
  },
  recent_changes: {
    material_changed: "A material change is recorded.",
    setup_changed: "A setup change is recorded.",
    maintenance_changed: "A maintenance change is recorded.",
    none: "No recent change is recorded.",
  },
  location: {
    dispense_area: "The defect is in the dispense area.",
    one_lane: "The defect affects one lane.",
    multiple_lanes: "The defect affects multiple lanes.",
  },
};

export const responseNodeId = (answerId: string) => `response-${answerId}`;

export function responseStatement(
  node: Pick<InvestigationNode, "target_fact" | "choices">,
  answer: Pick<InvestigationAnswer, "status" | "confirmed_value" | "choice">,
  clarified = false,
) {
  if (
    clarified &&
    (answer.status === "pending" || answer.status === "clarification")
  )
    return "The original response was clarified.";
  if (answer.status === "pending") return "The response awaits confirmation.";
  if (answer.status === "clarification")
    return "The response needs clarification.";
  const fact = node.target_fact.replaceAll("_", " ");
  const subject = `${fact[0]?.toUpperCase() ?? ""}${fact.slice(1)}`;
  const value = answer.confirmed_value ?? answer.choice;
  if (answer.status === "unknown" || !value || value === "unknown")
    return subject.length > 48
      ? "The requested information remains unknown."
      : `${subject} remains unknown.`;
  const known = statements[node.target_fact]?.[value];
  if (known) return known;
  const label =
    node.choices?.find((choice) => choice.value === value)?.label ??
    value.replaceAll("_", " ");
  const sentence = `${subject}: ${label.replace(/[.!?]+$/, "")}.`;
  // Keep unfamiliar/adaptive responses concise without truncating a qualification.
  return sentence.length <= 90
    ? sentence
    : "A response is recorded; see answer details.";
}
