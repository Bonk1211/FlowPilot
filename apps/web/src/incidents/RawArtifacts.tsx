import { useEffect, useState } from "react";
import { DownloadSimple, Paperclip, UploadSimple } from "@phosphor-icons/react";
import type { Artifact } from "@flowpilot/contracts";
import {
  downloadIncidentFile,
  incidentFetch,
  type Incident,
  type IncidentCommand,
} from "./api";
import { useIncidentAccess } from "./AccessPanel";
import { displayTime } from "./EvidenceExplorer";
import "./artifacts.css";

const roles = {
  last_good: { label: "Last-known-good image", kind: "image" },
  first_bad: { label: "First-known-bad image", kind: "image" },
  machine_log: { label: "Machine log", kind: "log" },
  pm: { label: "Maintenance record", kind: "maintenance" },
  context: { label: "Other supporting record", kind: "context" },
} as const;

async function checkedJson<T>(response: Response): Promise<T> {
  const content: unknown = await response.json();
  if (!response.ok) {
    const detail =
      content && typeof content === "object" && "detail" in content
        ? content.detail
        : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "The original file could not be saved. Check the file and try again.",
    );
  }
  return content as T;
}

export function RawArtifacts({
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
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [savedArtifact, setSavedArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const base = `/api/incidents/${encodeURIComponent(incident.id)}/artifacts`;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    incidentFetch(base, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((response) => checkedJson<Artifact[]>(response))
      .then((items) => {
        if (active) setArtifacts(items);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Original files could not be loaded.",
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

  return (
    <section
      className="incident-card incident-artifacts"
      aria-labelledby="incident-originals-title"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Preserve the original</p>
          <h2 id="incident-originals-title">
            <Paperclip aria-hidden="true" />
            Source files
          </h2>
        </div>
        <button
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Refresh files
        </button>
      </div>
      <p className="incident-muted">
        Original images, logs and maintenance records stay linked to their
        evidence. The byte hash verifies stored content; it does not certify the
        source or its interpretation.
      </p>
      {error && (
        <p role="alert" className="incident-artifact-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading source files…</p>}
      {!loading && !artifacts.length && (
        <p className="incident-caption">
          No uploaded originals. Replay example images remain available through
          their evidence links.
        </p>
      )}
      <ul className="incident-artifact-list">
        {artifacts.map((item) => (
          <li key={item.id}>
            <div className="incident-artifact-title">
              <div>
                <strong>{item.filename}</strong>
                <p className="incident-caption">
                  {item.media_type} · {item.size_bytes.toLocaleString()} bytes ·{" "}
                  {item.status}
                </p>
              </div>
              <button
                disabled={item.status !== "available"}
                onClick={() => {
                  setError("");
                  void downloadIncidentFile(
                    `${base}/${item.id}`,
                    item.filename,
                  ).catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Original download failed.",
                    ),
                  );
                }}
              >
                <DownloadSimple aria-hidden="true" />
                Download original
              </button>
            </div>
            <details>
              <summary>Integrity, provenance and retention</summary>
              <dl>
                <dt>Raw file SHA-256</dt>
                <dd className="mono">{item.sha256}</dd>
                <dt>Uploaded by</dt>
                <dd>
                  {item.created_by} · {displayTime(item.created_at)}
                </dd>
                <dt>Retention expires</dt>
                <dd>{displayTime(item.expires_at)}</dd>
                <dt>Original ID</dt>
                <dd className="mono">{item.id}</dd>
              </dl>
              {item.deletion_reason && (
                <p>Removal reason: {item.deletion_reason}</p>
              )}
            </details>
            {access.permissions.includes("manage_data") &&
              item.status === "available" && (
                <details>
                  <summary>Remove original bytes</summary>
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      setSaving(true);
                      setError("");
                      try {
                        await checkedJson<Artifact>(
                          await incidentFetch(`${base}/${item.id}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              reason: String(data.get("reason")),
                            }),
                          }),
                        );
                        setNotice(
                          "Original bytes removed. Provenance and the deletion reason remain recorded.",
                        );
                        setAttempt((value) => value + 1);
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Original could not be removed.",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    <p>
                      Removing the original bytes is permanent. The evidence
                      record and audit history remain.
                    </p>
                    <label>
                      Reason for removing original
                      <input name="reason" required maxLength={1000} />
                    </label>
                    <button disabled={saving || busy}>
                      Permanently remove original
                    </button>
                  </form>
                </details>
              )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <details className="incident-artifact-upload">
          <summary>
            <UploadSimple aria-hidden="true" />
            Upload a source file
          </summary>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!file) return;
              const form = event.currentTarget;
              const data = new FormData(form);
              const role = String(data.get("role")) as keyof typeof roles;
              const origin = String(data.get("origin"));
              if (
                !(role in roles) ||
                !["observed", "simulated"].includes(origin)
              )
                return;
              setSaving(true);
              setError("");
              setNotice("");
              try {
                if (file.size > 20 * 1024 * 1024)
                  throw new Error(
                    "Use a file no larger than 20 MB for this upload form.",
                  );
                if (
                  roles[role].kind === "image" &&
                  !file.type.startsWith("image/")
                )
                  throw new Error(
                    "Choose a PNG, JPEG or WebP file for image evidence.",
                  );
                let artifact = savedArtifact;
                if (!artifact) {
                  const digest = await crypto.subtle.digest(
                    "SHA-256",
                    await file.arrayBuffer(),
                  );
                  const sha256 = Array.from(new Uint8Array(digest), (value) =>
                    value.toString(16).padStart(2, "0"),
                  ).join("");
                  artifact = await checkedJson<Artifact>(
                    await incidentFetch(
                      `${base}?filename=${encodeURIComponent(file.name)}`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type":
                            file.type ||
                            (/\.(log|txt)$/i.test(file.name)
                              ? "text/plain"
                              : "application/octet-stream"),
                          "X-Content-SHA256": sha256,
                        },
                        body: file,
                        signal: AbortSignal.timeout(60000),
                      },
                    ),
                  );
                  setSavedArtifact(artifact);
                }
                if (artifact.status !== "available")
                  throw new Error(
                    "This original was previously deleted or has expired. Use a new source record.",
                  );
                await onAction({
                  action: "add_evidence",
                  evidence: {
                    id: `upload-${crypto.randomUUID()}`,
                    kind: roles[role].kind,
                    role,
                    label: String(data.get("label")).trim(),
                    source_ref: `original:${artifact.id}:${artifact.filename}`,
                    artifact_id: artifact.id,
                    image_url:
                      roles[role].kind === "image"
                        ? `${base}/${artifact.id}`
                        : null,
                    event_time: String(data.get("event_time")).trim() || null,
                    event_timezone:
                      String(data.get("event_timezone")).trim() || null,
                    time_uncertain: true,
                    status: "collected",
                    synthetic: origin === "simulated",
                    tool_id: incident.tool_id,
                    configuration: incident.configuration,
                    provenance: `Original uploaded by ${artifact.created_by}; clock alignment not verified`,
                    values: { source_note: String(data.get("note")).trim() },
                  },
                });
                setNotice(
                  "Original preserved and linked to a new evidence record. Review the source before adding interpreted observations.",
                );
                form.reset();
                setFile(null);
                setSavedArtifact(null);
                setAttempt((value) => value + 1);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Upload could not be completed. Your source details are retained.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <fieldset
              disabled={busy || saving}
              className="incident-upload-fields"
            >
              <p>
                The original is preserved without automatically inferring
                measurements or a diagnosis.
              </p>
              <label>
                Original file
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.csv,.log,.txt,.json,.pdf"
                  required
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setSavedArtifact(null);
                  }}
                />
              </label>
              <div className="incident-artifact-fields">
                <label>
                  Evidence role
                  <select name="role" defaultValue="context">
                    <option value="context">Other supporting record</option>
                    {Object.entries(roles)
                      .filter(([id]) => id !== "context")
                      .map(([id, value]) => (
                        <option key={id} value={id}>
                          {value.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Evidence origin
                  <select name="origin" required defaultValue="">
                    <option value="" disabled>
                      Choose an origin
                    </option>
                    <option value="observed">
                      Observed / original production record
                    </option>
                    <option value="simulated">
                      Simulated / replay fixture
                    </option>
                  </select>
                </label>
              </div>
              <label>
                Evidence label
                <input
                  name="label"
                  required
                  maxLength={200}
                  placeholder="Describe the source and what it records"
                />
              </label>
              <div className="incident-artifact-fields">
                <label>
                  Original event time, if known
                  <input
                    name="event_time"
                    maxLength={100}
                    placeholder="2026-09-30T09:08:00+08:00"
                  />
                </label>
                <label>
                  Source timezone, if known
                  <input
                    name="event_timezone"
                    maxLength={100}
                    placeholder="Asia/Kuala_Lumpur"
                  />
                </label>
              </div>
              <p className="incident-caption">
                Leave missing times blank. Upload time is recorded separately;
                clock alignment remains unverified.
              </p>
              <label>
                Context note
                <textarea name="note" rows={2} maxLength={2000} />
              </label>
              {savedArtifact && (
                <p className="incident-notice">
                  Original {savedArtifact.filename} is saved. Retry to link the
                  evidence record without uploading the bytes again.
                </p>
              )}
              <button className="primary" disabled={busy || saving || !file}>
                {saving
                  ? "Preserving source…"
                  : savedArtifact
                    ? "Retry linking evidence"
                    : "Preserve and link source"}
              </button>
            </fieldset>
          </form>
        </details>
      )}
    </section>
  );
}
