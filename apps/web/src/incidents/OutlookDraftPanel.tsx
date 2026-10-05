import { useCallback, useEffect, useState } from "react";
import type { OutlookDraft, OutlookStatus } from "@flowpilot/contracts";
import { incidentJson, type Incident } from "./api";
import { useIncidentAccess } from "./AccessPanel";

const base = "/api/incident-outlook";

export function OutlookDraftPanel({
  incident,
  draftDirty,
  busy,
}: {
  incident: Incident;
  draftDirty: boolean;
  busy: boolean;
}) {
  const access = useIncidentAccess();
  const canEdit = access.permissions.includes("edit");
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [recipients, setRecipients] = useState("");
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<{
    key: string;
    draft: OutlookDraft;
  } | null>(null);
  const key = `${incident.id}:${incident.revision}:${incident.handoff.version}:${recipients}`;
  const needsReview =
    draftDirty || incident.handoff.source_revision !== incident.revision;
  const current = !needsReview && saved?.key === key ? saved.draft : null;

  const checkConnection = useCallback(async (signal?: AbortSignal) => {
    setChecking(true);
    try {
      const timeout = AbortSignal.timeout(15000);
      const result = await incidentJson<OutlookStatus>(base, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!signal?.aborted) setStatus(result);
    } catch (cause) {
      if (!signal?.aborted) {
        setStatus(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Outlook status could not be checked.",
        );
      }
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void checkConnection(controller.signal);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [checkConnection]);

  async function connect() {
    const popup = window.open("", "_blank", "popup,width=600,height=720");
    if (!popup) {
      setError(
        "Allow pop-up windows for FlowPilot, then connect Outlook again.",
      );
      return;
    }
    popup.opener = null;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await incidentJson<{ authorization_url: string }>(
        `${base}/connect`,
        {
          method: "POST",
        },
      );
      setSaved(null);
      setStatus((value) =>
        value ? { ...value, connected: false, email: null } : value,
      );
      popup.location.href = result.authorization_url;
      setNotice(
        "Sign in to Microsoft, then close the sign-in window and return here.",
      );
    } catch (cause) {
      popup.close();
      setError(
        cause instanceof Error
          ? cause.message
          : "Outlook sign-in could not be started.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    setWorking(true);
    setError("");
    try {
      setStatus(
        await incidentJson<OutlookStatus>(`${base}/disconnect`, {
          method: "POST",
        }),
      );
      setSaved(null);
      setNotice("Outlook disconnected. Existing Outlook drafts are retained.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Outlook could not be disconnected.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveDraft() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const draft = await incidentJson<OutlookDraft>(
        `${base}/drafts/${encodeURIComponent(incident.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_revision: incident.revision,
            draft_version: incident.handoff.version,
            recipients: recipients
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        },
      );
      setSaved({ key, draft });
      setNotice(
        "Saved in Outlook Drafts. Open it in Outlook to review and send.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Check Outlook Drafts before saving again.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className="outlook-draft-panel"
      aria-labelledby="outlook-draft-title"
    >
      <h4 id="outlook-draft-title">Outlook draft</h4>
      <p className="incident-caption">
        Save this email to your Outlook Drafts folder, then review and send it
        in Outlook.
      </p>
      {error && (
        <p className="incident-notice" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {checking && (
        <p className="incident-caption" role="status">
          Checking Outlook connection…
        </p>
      )}
      {status?.configured === false && (
        <p className="incident-caption">
          Ask your workspace administrator to configure the Outlook connector.
        </p>
      )}
      {!canEdit && (
        <p className="incident-caption">
          Saving Outlook drafts requires edit permission.
        </p>
      )}
      {status?.connected && (
        <p className="incident-caption">Connected as {status.email}</p>
      )}
      <div className="incident-actions">
        {canEdit && status?.configured && !status.connected && (
          <button
            type="button"
            disabled={working || checking}
            onClick={() => void connect()}
          >
            Connect Outlook
          </button>
        )}
        <button
          type="button"
          disabled={working || checking}
          onClick={() => {
            setError("");
            void checkConnection();
          }}
        >
          Check connection
        </button>
        {canEdit && status?.connected && (
          <button
            type="button"
            disabled={working}
            onClick={() => void disconnect()}
          >
            Disconnect Outlook
          </button>
        )}
      </div>
      {canEdit && status?.connected && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <label>
            Outlook recipients (optional)
            <input
              type="email"
              multiple
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              disabled={working}
              aria-describedby="outlook-recipients-help"
            />
          </label>
          <p id="outlook-recipients-help" className="incident-caption">
            Separate addresses with commas, or add recipients later in Outlook.
          </p>
          {needsReview && (
            <p className="incident-notice">
              Review and save the current handoff before saving it to Outlook.
            </p>
          )}
          <div className="incident-actions">
            <button
              type="submit"
              className="primary"
              disabled={working || checking || busy || needsReview || !!current}
            >
              {working
                ? "Working…"
                : current
                  ? "Saved to Outlook"
                  : "Save to Outlook"}
            </button>
            {current && (
              <a
                href={current.web_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open draft in Outlook
              </a>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
