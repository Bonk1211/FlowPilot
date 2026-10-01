import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import {
  downloadIncidentReport,
  incidentReportUrl,
  type Incident,
  type IncidentCommand,
} from "./api";
import { useIncidentAccess } from "./AccessPanel";
import { CommunicationPanel } from "./CommunicationPanel";

export function HandoffPage({
  incident,
  busy,
  onAction,
}: {
  incident: Incident;
  busy: boolean;
  onAction: (command: IncidentCommand) => Promise<void>;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState("Draft");
  const text = edited ?? incident.handoff.body;

  return (
    <section className="incident-handoff-page" aria-labelledby="handoff-title">
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Ready before the cause is known</p>
          <h2 id="handoff-title">Engineer handoff</h2>
        </div>
      </div>
      <div className="incident-inline">
        <span className="incident-tag">{draftStatus}</span>
        <span className="incident-caption">
          Version {incident.handoff.version} · based on revision{" "}
          {incident.handoff.source_revision}
        </span>
      </div>
      <h3>{incident.handoff.subject}</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await onAction({ action: "edit_handoff", body: text });
            setEdited(null);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Draft could not be saved. Your edits are retained.",
            );
          }
        }}
      >
        <label>
          Handoff message
          <textarea
            rows={19}
            value={text}
            onChange={(event) => setEdited(event.target.value)}
            required
            maxLength={20000}
            disabled={busy || !canEdit}
          />
        </label>
        {edited !== null && (
          <p className="incident-notice">
            Unsaved edits are retained here. Save before exporting the report.
          </p>
        )}
        {error && (
          <p className="incident-notice" role="alert">
            {error}
          </p>
        )}
        {incident.handoff.human_edited && (
          <p className="incident-caption">
            This draft contains human edits. Refresh saves a generated
            suggestion in draft history and preserves your active edits.
          </p>
        )}
        {incident.handoff.source_revision !== incident.revision && (
          <p className="incident-notice">
            New evidence arrived after this draft. Review its contents and save
            the reviewed handoff before approving a communication.
          </p>
        )}
        <div className="incident-actions">
          <button
            className="primary"
            disabled={
              busy ||
              !canEdit ||
              (edited === null &&
                incident.handoff.source_revision === incident.revision) ||
              !text.trim()
            }
          >
            {edited === null &&
            incident.handoff.source_revision !== incident.revision
              ? "Save reviewed handoff"
              : "Save handoff edits"}
          </button>
          <button
            type="button"
            disabled={busy || !canEdit || edited !== null}
            onClick={() => {
              setError("");
              void onAction({ action: "refresh_handoff" }).catch(
                (cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Draft could not be refreshed.",
                  ),
              );
            }}
          >
            Refresh from evidence
          </button>
        </div>
      </form>
      <a
        className="incident-button-link"
        href={incidentReportUrl(incident.id)}
        download
        onClick={(event) => {
          event.preventDefault();
          setError("");
          void downloadIncidentReport(incident.id).catch((cause: unknown) =>
            setError(
              cause instanceof Error
                ? cause.message
                : "Report download failed.",
            ),
          );
        }}
      >
        <DownloadSimple aria-hidden="true" />
        Export saved report
      </a>
      <p className="incident-muted">
        Export creates a saved file. Any email submission is a separate approved
        action below.
      </p>
      <details>
        <summary>
          Draft versions ({(incident.handoff_history ?? []).length})
        </summary>
        {(incident.handoff_history ?? []).map((draft) => (
          <details key={draft.version}>
            <summary>
              Version {draft.version} · revision {draft.source_revision}
              {draft.human_edited ? " · human edited" : ""}
            </summary>
            <pre>{draft.body}</pre>
          </details>
        ))}
      </details>
      <CommunicationPanel
        incident={incident}
        draftDirty={edited !== null}
        busy={busy}
        onDraftStatus={setDraftStatus}
      />
    </section>
  );
}
