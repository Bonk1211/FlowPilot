import type { IngestionResult } from "@flowpilot/contracts";

export type MachineEvent = IngestionResult["events"][number];

export const humanize = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

// Preserve the logged local time and supplied offset, without browser-timezone conversion.
export function displayTimestamp(value: string | null | undefined) {
  return value ? value.replace("T", " · ") : "Not recorded";
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${humanize(key)}: ${displayValue(item)}`)
      .join(" · ");
  return String(value);
}

export function candidateValue(candidate: {
  value: unknown;
  unit?: string | Record<string, string> | null;
}): string {
  if (candidate.value === null) return "Not recorded";
  if (
    candidate.unit &&
    typeof candidate.unit === "object" &&
    typeof candidate.value === "object" &&
    !Array.isArray(candidate.value)
  ) {
    const units = candidate.unit;
    return Object.entries(candidate.value)
      .map(
        ([key, value]) =>
          `${humanize(key)}: ${displayValue(value)}${value !== null && units[key] ? ` ${units[key]}` : ""}`,
      )
      .join(" · ");
  }
  return `${displayValue(candidate.value)}${typeof candidate.unit === "string" ? ` ${candidate.unit}` : ""}`;
}

export function eventSummary(event: MachineEvent): string {
  const { fields } = event;
  if (!Object.keys(fields).length)
    return event.kind === "unknown" || event.kind === "unparsed_line"
      ? "No recognized fields; original record retained."
      : "Event marker; no measured values.";
  return Object.entries(fields)
    .map(([key, value]) => `${humanize(key)}: ${displayValue(value)}`)
    .join(" · ");
}

export function eventFlags(
  event: MachineEvent,
  warnings: IngestionResult["warnings"],
) {
  return {
    unknown: ["unknown", "unparsed_line"].includes(event.kind),
    regression: warnings.some(
      (w) => w.code === "timestamp_out_of_order" && w.line === event.lineStart,
    ),
    continuation: warnings.some(
      (w) =>
        w.code === "continuation_line" &&
        w.line >= event.lineStart &&
        w.line <= event.lineEnd,
    ),
  };
}

export const knowledgeState = (state: string) =>
  ({
    published: "Available to AI",
    draft: "Pending review",
    disputed: "Disputed",
    archived: "Archived",
    recorded: "Saved to database",
  })[state] ?? humanize(state);
