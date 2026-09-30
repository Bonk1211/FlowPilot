import { useEffect, useState } from "react";
import type { IncidentCommunication } from "@flowpilot/contracts";
import { incidentJson, type Incident } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import { displayTime } from "./EvidenceExplorer";
import "./operations.css";

const labels: Record<IncidentCommunication["status"], string> = {
  approved: "Approved snapshot · not sent",
  sending: "Submission in progress · delivery unverified",
  accepted: "Accepted by SMTP · delivery unverified",
  failed: "Submission failed",
  unknown: "Submission or delivery outcome unknown",
  delivered: "Delivery receipt recorded",
  acknowledged: "Engineer acknowledgement recorded",
};

export function CommunicationPanel({
  incident,
  draftDirty,
  busy,
  onDraftStatus,
}: {
  incident: Incident;
  draftDirty: boolean;
  busy: boolean;
  onDraftStatus: (status: string) => void;
}) {
  const access = useIncidentAccess();
  const canSend =
    access.mode === "configured" && access.permissions.includes("send_email");
  const canMock =
    (access.mode === "demo" || access.permissions.includes("edit")) &&
    (incident.evidence ?? []).every((item) => item.synthetic);
  const [messages, setMessages] = useState<IncidentCommunication[]>([]);
  const [recipients, setRecipients] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertainSend, setUncertainSend] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const base = `/api/incidents/${incident.id}/communications`;
  const reviewKey = `${incident.revision}:${incident.handoff.version}:${recipients}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    incidentJson<IncidentCommunication[]>(base, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((items) => {
        if (active) {
          setMessages(items);
          setUncertainSend(null);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Communication history could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [base, incident.revision, attempt]);

  useEffect(() => {
    if (loading) {
      onDraftStatus("Checking communication status");
      return;
    }
    const current = [...messages]
      .sort((a, b) => Date.parse(b.approved_at) - Date.parse(a.approved_at))
      .find((message) => message.draft_version === incident.handoff.version);
    onDraftStatus(
      error
        ? "Communication status unavailable"
        : current
          ? `${current.transport === "mock" ? "Simulated · " : ""}${labels[current.status]}`
          : "Draft · not sent",
    );
  }, [messages, incident.handoff.version, loading, error, onDraftStatus]);

  async function mutate(
    path: string,
    payload: unknown,
    success: string,
    sendingId?: string,
  ) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await incidentJson<IncidentCommunication>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
      setMessages((items) => [
        result,
        ...items.filter((item) => item.id !== result.id),
      ]);
      setNotice(success);
    } catch (cause) {
      if (sendingId) setUncertainSend(sendingId);
      setError(
        `${cause instanceof Error ? cause.message : "Communication action failed."}${sendingId ? " Refresh communication status before another submission." : ""}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="incident-communications"
      aria-labelledby="incident-mail-title"
    >
      <div className="incident-section-title">
        <h3 id="incident-mail-title">Engineer communication</h3>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          Refresh communications
        </button>
      </div>
      <p className="incident-muted">
        Approval saves an immutable message snapshot. Submission is a separate
        action. SMTP acceptance alone does not establish delivery.
      </p>
      {error && (
        <p role="alert" className="incident-mail-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading communication history…</p>}
      {!canSend && (
        <p className="incident-caption">
          {access.mode === "demo"
            ? "Use simulated communication events below. They never submit an email. Export remains available."
            : "Approving, sending and recording email receipts require the send email permission."}
        </p>
      )}
      {canMock && (
        <div className="incident-mock-communication">
          <p>
            <strong>Simulated engineer handoff</strong>
          </p>
          <p className="incident-caption">
            Follow approval, submission and receipt states using a fixed
            fictional recipient. No email leaves this workspace.
          </p>
          {draftDirty && (
            <p className="incident-notice">
              Save your handoff edits before creating its simulated snapshot.
            </p>
          )}
          <button
            type="button"
            disabled={
              busy ||
              saving ||
              loading ||
              draftDirty ||
              incident.handoff.source_revision !== incident.revision
            }
            onClick={() => {
              void mutate(
                `${base}/mock`,
                {
                  incident_revision: incident.revision,
                  draft_version: incident.handoff.version,
                },
                "Simulated handoff snapshot prepared. No email was submitted.",
              );
            }}
          >
            Simulate handoff
          </button>
        </div>
      )}
      {canSend && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reviewed !== reviewKey || draftDirty) return;
            void mutate(
              `${base}/approvals`,
              {
                incident_revision: incident.revision,
                draft_version: incident.handoff.version,
                recipients: recipients
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              },
              "Snapshot approved. Inspect the saved recipients and message before sending.",
            );
          }}
        >
          <label>
            Engineer recipients
            <input
              type="email"
              multiple
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="engineer@example.com"
              required
              disabled={saving}
            />
          </label>
          <p className="incident-caption">
            Use comma-separated addresses from the configured engineer
            allowlist. The server validates every recipient.
          </p>
          <label className="incident-approval-checkbox">
            <input
              type="checkbox"
              checked={reviewed === reviewKey}
              onChange={(event) =>
                setReviewed(event.target.checked ? reviewKey : "")
              }
              disabled={saving}
            />
            I reviewed draft version {incident.handoff.version} and these
            recipients.
          </label>
          {(draftDirty ||
            incident.handoff.source_revision !== incident.revision) && (
            <p className="incident-notice">
              Review and save the current handoff before approving it. Approval
              must match the latest evidence revision.
            </p>
          )}
          <button
            type="submit"
            disabled={
              busy ||
              saving ||
              loading ||
              draftDirty ||
              reviewed !== reviewKey ||
              !recipients.trim() ||
              incident.handoff.source_revision !== incident.revision
            }
          >
            Approve this snapshot
          </button>
        </form>
      )}
      {!loading && !error && !messages.length && (
        <p className="incident-caption">
          No approved or submitted messages for this incident.
        </p>
      )}
      {messages.map((message) => {
        const current =
          message.draft_version === incident.handoff.version &&
          message.incident_revision === incident.revision;
        const lastAttempt = message.attempts?.at(-1);
        const eligibleToSend =
          message.status === "approved" ||
          (message.status === "failed" && lastAttempt?.retryable);
        const submitted = [
          "sending",
          "accepted",
          "unknown",
          "delivered",
          "acknowledged",
        ].includes(message.status);
        return (
          <article className="incident-mail-record" key={message.id}>
            <p className="incident-mail-state">
              {message.transport === "mock" ? "Simulated · " : ""}
              {labels[message.status]}
            </p>
            <h4>{message.subject}</h4>
            <p>
              <strong>To:</strong> {message.recipients.join(", ")}
            </p>
            <p className="incident-caption">
              Approved by {message.approved_by} ·{" "}
              {displayTime(message.approved_at)} · draft {message.draft_version}{" "}
              / revision {message.incident_revision}
            </p>
            <details>
              <summary>Inspect approved message</summary>
              <pre>{message.body}</pre>
              <p className="incident-caption mono">
                Snapshot SHA-256: {message.snapshot_sha256}
              </p>
            </details>
            {eligibleToSend && !current && (
              <p className="incident-notice">
                This snapshot predates the current draft or evidence. Approve
                the current version before submission.
              </p>
            )}
            {canSend && message.transport !== "mock" && eligibleToSend && (
              <button
                type="button"
                className="primary"
                disabled={
                  busy ||
                  saving ||
                  loading ||
                  !current ||
                  uncertainSend === message.id
                }
                onClick={() => {
                  void mutate(
                    `${base}/${message.id}/send`,
                    { revision: message.revision },
                    "Submission status updated. Delivery requires separate evidence.",
                    message.id,
                  );
                }}
              >
                {message.status === "failed"
                  ? "Retry approved submission"
                  : "Send approved snapshot"}
              </button>
            )}
            {canMock && message.transport === "mock" && (
              <div className="incident-actions incident-mock-events">
                {(["approved", "failed"].includes(message.status)
                  ? ["accepted", "failed", "unknown"]
                  : ["accepted", "unknown"].includes(message.status)
                    ? ["delivered", "acknowledged"]
                    : message.status === "delivered"
                      ? ["acknowledged"]
                      : []
                ).map((state) => (
                  <button
                    type="button"
                    key={state}
                    disabled={
                      busy ||
                      saving ||
                      loading ||
                      (!current &&
                        ["accepted", "failed", "unknown"].includes(state))
                    }
                    onClick={() => {
                      void mutate(
                        `${base}/${message.id}/mock-event`,
                        { revision: message.revision, status: state },
                        "Simulated communication state recorded. No email was submitted.",
                      );
                    }}
                  >
                    {state === "accepted"
                      ? "Simulate SMTP acceptance"
                      : state === "failed"
                        ? "Simulate submission failure"
                        : state === "unknown"
                          ? "Simulate uncertain outcome"
                          : state === "delivered"
                            ? "Simulate delivery receipt"
                            : "Simulate acknowledgement"}
                  </button>
                ))}
              </div>
            )}
            {message.status === "unknown" && message.transport !== "mock" && (
              <p className="incident-notice">
                Verify the outcome with the mail service using the Message-ID
                before any further submission.
              </p>
            )}
            {(message.attempts ?? []).map((item) => (
              <details key={item.number}>
                <summary>
                  Submission attempt {item.number} · {item.status}
                </summary>
                <p>{item.detail}</p>
                <p className="mono">Message-ID: {item.message_id}</p>
                <p className="incident-caption">
                  {item.actor} · {displayTime(item.started_at)}
                </p>
              </details>
            ))}
            {(message.receipts ?? []).map((receipt) => (
              <details key={receipt.version}>
                <summary>
                  Receipt {receipt.version} · {receipt.status}
                </summary>
                <p>{receipt.reference}</p>
                <p>{receipt.notes}</p>
                <p className="incident-caption">
                  Recorded by {receipt.actor} ·{" "}
                  {displayTime(receipt.recorded_at)}
                </p>
              </details>
            ))}
            {canSend && message.transport !== "mock" && submitted && (
              <details>
                <summary>Record delivery or acknowledgement evidence</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void mutate(
                      `${base}/${message.id}/receipts`,
                      {
                        revision: message.revision,
                        status: String(data.get("status")),
                        reference: String(data.get("reference")).trim(),
                        notes: String(data.get("notes")).trim(),
                      },
                      "Receipt evidence recorded with its source reference.",
                    );
                  }}
                >
                  <p>
                    Record a delivery receipt or engineer acknowledgement only
                    when supported by the referenced source.
                  </p>
                  <label>
                    Receipt status
                    <select
                      name="status"
                      defaultValue={
                        message.status === "acknowledged"
                          ? "acknowledged"
                          : message.status === "delivered"
                            ? "delivered"
                            : "unknown"
                      }
                      disabled={saving}
                    >
                      {!["delivered", "acknowledged"].includes(
                        message.status,
                      ) && (
                        <option value="unknown">Outcome remains unknown</option>
                      )}
                      {message.status !== "acknowledged" && (
                        <option value="delivered">
                          Delivery confirmed by receipt
                        </option>
                      )}
                      <option value="acknowledged">
                        Engineer acknowledged
                      </option>
                    </select>
                  </label>
                  <label>
                    Receipt or acknowledgement reference
                    <input
                      name="reference"
                      required
                      maxLength={1000}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Receipt evidence notes
                    <textarea
                      name="notes"
                      required
                      maxLength={3000}
                      rows={2}
                      disabled={saving}
                    />
                  </label>
                  <button disabled={busy || saving}>
                    Record receipt evidence
                  </button>
                </form>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
