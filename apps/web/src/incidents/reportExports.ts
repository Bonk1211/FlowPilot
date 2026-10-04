import type { IncidentExperiment } from "@flowpilot/contracts";
import { incidentJson, loadIncident } from "./api";
import { handoffEmailFile } from "./handoffDocument";
import {
  buildTroubleshootingMap,
  troubleshootingHandoff,
} from "./troubleshootingPlan";

export function downloadReportContent(
  content: string,
  type: string,
  filename: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadHandoffReport(id: string) {
  const base = `/api/incidents/${encodeURIComponent(id)}`;
  const [incident, experiments] = await Promise.all([
    loadIncident(id),
    incidentJson<IncidentExperiment[]>(`${base}/experiments`),
  ]);
  if ((await loadIncident(id)).revision !== incident.revision)
    throw new Error(
      "The incident changed while preparing the report. Refresh and try again.",
    );
  const map = buildTroubleshootingMap(incident, experiments);
  const html = troubleshootingHandoff(incident, map, experiments);
  return { incident, experiments, map, html };
}

export function saveHandoffReport(
  report: Awaited<ReturnType<typeof loadHandoffReport>>,
  format: "html" | "eml",
) {
  downloadReportContent(
    format === "html"
      ? report.html
      : handoffEmailFile(report.incident, report.experiments, report.html),
    format === "html" ? "text/html;charset=utf-8" : "message/rfc822",
    `${report.incident.id}-r${report.incident.revision}-handoff.${format}`,
  );
}

export async function downloadIncidentReport(id: string) {
  saveHandoffReport(await loadHandoffReport(id), "html");
}
