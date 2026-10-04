import { useEffect, useState } from "react";
import {
  DownloadSimple,
  EnvelopeSimple,
  FileText,
} from "@phosphor-icons/react";
import { downloadIncidentFile, incidentReportUrl, type Incident } from "./api";
import { loadHandoffReport, saveHandoffReport } from "./reportExports";
import "./HandoffReport.css";

export function HandoffReport({
  incident,
  busy,
  draftDirty,
}: {
  incident: Incident;
  busy: boolean;
  draftDirty: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof loadHandoffReport>
  > | null>(null);
  useEffect(() => {
    let active = true;
    loadHandoffReport(incident.id)
      .then((report) => {
        if (active) {
          setPreview(report);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Report preview could not be loaded. Please retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [incident.id, incident.revision, incident.handoff.version]);
  async function prepare(format: "preview" | "html" | "eml" | "md") {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (format === "md") {
        await downloadIncidentFile(
          incidentReportUrl(incident.id),
          `${incident.id}-report.md`,
        );
      } else {
        const report = await loadHandoffReport(incident.id);
        if (format === "preview") setPreview(report);
        else saveHandoffReport(report, format);
      }
      setNotice(
        format === "eml"
          ? "Email draft downloaded with the full HTML report attached. Choose a recipient in your mail app; no message has been sent."
          : format === "preview"
            ? "Saved report preview ready."
            : "Report downloaded.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Report could not be prepared. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="handoff-report" aria-labelledby="handoff-report-title">
      <p className="eyebrow">Technical assessment</p>
      <h3 id="handoff-report-title">Report preview</h3>
      <p>
        Assessment diagrams, evidence links, experiment timelines and result
        charts, with recommended next steps.
      </p>
      <div className="incident-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || loading}
          onClick={() => void prepare("html")}
        >
          <DownloadSimple aria-hidden="true" />
          Download HTML report
        </button>
        <button
          type="button"
          disabled={busy || loading || draftDirty}
          onClick={() => void prepare("eml")}
        >
          <EnvelopeSimple aria-hidden="true" />
          Download email draft (.eml)
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void prepare("preview")}
        >
          <FileText aria-hidden="true" />
          Preview saved report
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void prepare("md")}
        >
          Download Markdown
        </button>
      </div>
      <p className="incident-caption">
        Print or save as PDF in A4 portrait (210 × 297 mm). The email keeps your
        saved message and adds a recorded-work summary, with the complete report
        attached.
      </p>
      {loading && (
        <p role="status">Preparing the saved report and experiment history…</p>
      )}
      {error && (
        <p role="alert" className="incident-notice">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <>
          <p className="incident-caption">
            Preview of revision {preview.incident.revision}. Refresh the preview
            after saving edits or recording new experiments.
          </p>
          <iframe
            title="Technical assessment report preview"
            srcDoc={preview.html}
            sandbox="allow-scripts allow-modals"
          />
        </>
      )}
    </section>
  );
}
