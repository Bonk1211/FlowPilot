import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  DownloadSimple,
  EnvelopeSimple,
  Flask,
  Plus,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import {
  actOnIncident,
  createIncident,
  downloadIncidentReport,
  incidentReportUrl,
  listIncidents,
  loadIncident,
  startReplay,
  type CreateIncident,
  type EvidenceInput,
  type Incident,
  type IncidentCommand,
} from "./api";
import { EvidenceExplorer, displayTime } from "./EvidenceExplorer";
import { MechanismView } from "./MechanismView";
import { InvestigationPanel } from "./InvestigationPanel";
import { IncidentReview } from "./IncidentReview";
import { PastIncidents } from "./PastIncidents";
import { AccessPanel, AccessStatus, useIncidentAccess } from "./AccessPanel";
import { RawArtifacts } from "./RawArtifacts";
import { JobStatus } from "./JobStatus";
import { CommunicationPanel } from "./CommunicationPanel";
import { KnowledgeRegistry } from "./KnowledgeRegistry";
import { SimulationPanel } from "./SimulationPanel";
import { ExperimentsPanel } from "./ExperimentsPanel";
import "./incidents.css";

function getIncidentId() {
  const match = window.location.pathname.match(/^\/incidents\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function HandoffDrawer({
  incident,
  open,
  onClose,
  busy,
  onAction,
}: {
  incident: Incident;
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onAction: (command: IncidentCommand) => Promise<void>;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const dialog = useRef<HTMLDialogElement>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState("Draft");
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  const text = edited ?? incident.handoff.body;
  return (
    <dialog
      className="incident-handoff"
      ref={dialog}
      aria-labelledby="handoff-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Ready before the cause is known</p>
          <h2 id="handoff-title">Engineer handoff</h2>
        </div>
        <button
          type="button"
          aria-label="Close engineer handoff"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
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
    </dialog>
  );
}

function PackageImport({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: CreateIncident) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="incident-import">
      <summary>
        <UploadSimple aria-hidden="true" /> Import an incident package
      </summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await onCreate(JSON.parse(content) as CreateIncident);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Package could not be imported.",
            );
          }
        }}
      >
        <p>
          Import a replay or synthetic JSON package containing a trigger ID,
          tool/configuration, symptom and evidence. Each source retains its
          provenance and original timestamp.
        </p>
        <label>
          Choose JSON package
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000) {
                setError("Choose a package smaller than 2 MB.");
                return;
              }
              setContent(await file.text());
              setError("");
            }}
          />
        </label>
        <label>
          Package JSON
          <textarea
            className="mono"
            rows={7}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              '{"trigger_id":"my-replay-001","tool_id":"S932-DEMO-01","mode":"synthetic","evidence":[]}'
            }
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy || !content.trim()} type="submit">
          Import package
        </button>
      </form>
    </details>
  );
}

function AddEvidence({
  busy,
  onAction,
  closed = false,
}: {
  busy: boolean;
  onAction: (command: IncidentCommand) => Promise<void>;
  closed?: boolean;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="incident-add-evidence">
      <summary>
        {closed ? "Add late evidence and reopen" : "Add source evidence"}
      </summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await onAction({
              action: "add_evidence",
              evidence: JSON.parse(content) as EvidenceInput,
            });
            setContent("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Evidence could not be added.",
            );
          }
        }}
      >
        <p>
          Append a source record without replacing existing evidence. The server
          checks the source format and incident association.
        </p>
        {closed && (
          <p>
            New evidence reopens the investigation and withdraws its previous
            learning from reuse. The earlier review remains in history.
          </p>
        )}
        <label>
          Evidence JSON
          <textarea
            className="mono"
            rows={5}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            placeholder={
              '{"id":"context-2","kind":"context","role":"context","label":"Material record","source_ref":"replay/material","synthetic":true,"values":{}}'
            }
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy || !content.trim()}>Save source evidence</button>
      </form>
    </details>
  );
}

function IncidentWorkspaceContent() {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [incident, setIncident] = useState<Incident | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const [replayTrigger] = useState(() => `workspace-${crypto.randomUUID()}`);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedHypothesis, setSelectedHypothesis] = useState<string | null>(
    null,
  );
  const [historicalRevision, setHistoricalRevision] = useState<number | null>(
    null,
  );
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [manualTool, setManualTool] = useState("S932-DEMO-01");
  const [manualSymptom, setManualSymptom] = useState(
    "Progressively insufficient flux coverage",
  );
  useEffect(() => {
    let active = true;
    const id = getIncidentId();
    (id
      ? loadIncident(id).then((value) => {
          if (active) setIncident(value);
        })
      : listIncidents().then((value) => {
          if (active) setRecent(value);
        })
    )
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load incidents.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function showIncident(value: Incident) {
    setIncident(value);
    setHistoricalRevision(null);
    window.history.replaceState(
      null,
      "",
      `/incidents/${encodeURIComponent(value.id)}`,
    );
  }
  async function start(create: () => Promise<Incident>) {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    try {
      const value = await create();
      showIncident(value);
      setStatus("Incident saved. A partial engineer handoff is ready.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Incident could not be saved.",
      );
      throw cause;
    } finally {
      setBusy(false);
    }
  }
  async function onAction(
    command: IncidentCommand,
    role?: "technician" | "engineer",
  ) {
    if (!incident) return;
    setBusy(true);
    setError("");
    try {
      const updated = await actOnIncident(
        incident.id,
        { ...command, revision: incident.revision },
        role,
      );
      setIncident((current) =>
        current &&
        current.id === updated.id &&
        current.revision > updated.revision
          ? current
          : updated,
      );
      setHistoricalRevision(null);
      setStatus(
        `Saved revision ${updated.revision}. ${command.action.replaceAll("_", " ")} complete.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Change could not be saved.",
      );
      throw cause;
    } finally {
      setBusy(false);
    }
  }
  const perform = (command: IncidentCommand) => {
    void onAction(command).catch(() => undefined);
  };
  const snapshot = incident?.assessment_history?.find(
    (item) => item.incident_revision === historicalRevision,
  );
  const assessment = snapshot?.assessment ?? incident?.assessment ?? null;
  const hypothesisId = assessment
    ? assessment.hypotheses.some((item) => item.id === selectedHypothesis)
      ? selectedHypothesis
      : (assessment.hypotheses[0]?.id ?? null)
    : selectedHypothesis;
  const closed = incident?.status === "closed";
  const incidentId = incident?.id;
  const refreshSaved = useCallback(async () => {
    if (!incidentId) return;
    const update = await loadIncident(incidentId);
    setIncident((current) =>
      current && current.id === update.id && update.revision >= current.revision
        ? update
        : current,
    );
  }, [incidentId]);
  const selectedObservation = incident?.observations?.find(
    (item) => item.id === selectedEvent,
  );
  const visibleObservations = (incident?.observations ?? []).filter(
    (item) =>
      !snapshot ||
      Date.parse(item.recorded_at) <= Date.parse(snapshot.created_at),
  );

  return (
    <div className="incident-app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="command-bar incident-command-bar">
        <a
          className="wordmark"
          href="/incidents"
          aria-label="FlowPilot incidents"
        >
          <Flask aria-hidden="true" />
          FlowPilot
        </a>
        <span className="incident-nav-context">S932 · Incident workspace</span>
        <nav aria-label="Workspace navigation">
          <a href="/incidents">Incidents</a>
          <a href="/knowledge">Learning database</a>
          <a href="/legacy">
            Legacy demo <ArrowSquareOut aria-hidden="true" />
          </a>
        </nav>
        <span className="demo-badge">Prototype / Simulated data</span>
      </header>
      <main id="main" tabIndex={-1} className="incident-main">
        <div className="incident-access-banner">
          <AccessStatus />
        </div>
        {!canEdit && (
          <p className="incident-permission-note">
            View access. Evidence edits and new investigations require the edit
            permission.
          </p>
        )}
        <div aria-live="polite" className="sr-only">
          {status}
        </div>
        {error && (
          <div className="incident-error" role="alert">
            <p>{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              Reload saved state
            </button>
          </div>
        )}
        {loading ? (
          <div className="incident-loading" role="status">
            Loading saved incidents…
          </div>
        ) : !incident ? (
          <>
            <div className="incident-home-heading">
              <p className="eyebrow">Evidence first. A clear next step.</p>
              <h1>Investigate the change.</h1>
              <p>
                Connect images, machine events and maintenance context to
                understand declining flux coverage on the S932.
              </p>
            </div>
            <div className="incident-start-grid">
              <section className="incident-start-card">
                <span className="incident-sequence mono">
                  01 / INCIDENT REPLAY
                </span>
                <h2>
                  From first bad image
                  <br />
                  to a useful next check.
                </h2>
                <p>
                  Open a saved, partial evidence package. Compare three possible
                  mechanisms and see how a check changes the investigation.
                </p>
                <button
                  className="primary"
                  disabled={busy || !canEdit}
                  onClick={() => {
                    void start(() => startReplay(replayTrigger)).catch(
                      () => undefined,
                    );
                  }}
                >
                  {busy ? "Opening incident…" : "Start S932 replay"}
                  <ArrowRight aria-hidden="true" />
                </button>
                <p className="incident-caption">
                  Synthetic records and AI-generated images. No connection to
                  machine controls.
                </p>
              </section>
              <section className="incident-card incident-manual">
                <span className="incident-sequence mono">
                  02 / MANUAL TRIGGER
                </span>
                <h2>Preserve a new incident</h2>
                <form
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void start(() =>
                      createIncident({
                        trigger_id: replayTrigger,
                        trigger_origin: "manual",
                        tool_id: manualTool,
                        symptom: manualSymptom,
                        configuration: "S932 / DJ-2200 / BFS",
                        mode: "synthetic",
                      }),
                    ).catch(() => undefined);
                  }}
                >
                  <label>
                    Tool ID
                    <input
                      value={manualTool}
                      onChange={(event) => setManualTool(event.target.value)}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Observed symptom
                    <textarea
                      rows={2}
                      value={manualSymptom}
                      onChange={(event) => setManualSymptom(event.target.value)}
                      required
                      maxLength={2000}
                    />
                  </label>
                  <button
                    disabled={
                      busy ||
                      !canEdit ||
                      !manualTool.trim() ||
                      !manualSymptom.trim()
                    }
                  >
                    <Plus aria-hidden="true" />
                    Open incident
                  </button>
                </form>
                <PackageImport
                  busy={busy || !canEdit}
                  onCreate={(body) => start(() => createIncident(body))}
                />
              </section>
            </div>
            <section className="incident-recent" aria-labelledby="recent-title">
              <div className="incident-section-title">
                <h2 id="recent-title">Recent incidents</h2>
                <span className="incident-muted">Saved on this workspace</span>
              </div>
              {recent.length ? (
                <div className="incident-recent-list">
                  {recent.map((item) => (
                    <a
                      href={`/incidents/${encodeURIComponent(item.id)}`}
                      key={item.id}
                    >
                      <div>
                        <strong>{item.symptom}</strong>
                        <span>
                          {item.tool_id} · {item.id}
                        </span>
                      </div>
                      <span className="incident-tag">
                        {item.status.replaceAll("_", " ")}
                      </span>
                      <time>{displayTime(item.updated_at)}</time>
                      <ArrowRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="incident-empty">
                  No incidents yet. Start the replay or preserve a new incident
                  above.
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            <a href="/incidents" className="incident-back">
              <ArrowLeft aria-hidden="true" />
              All incidents
            </a>
            <div className="incident-masthead">
              <div>
                <p className="eyebrow">
                  {incident.tool_id}{" "}
                  <span className="mono">/ {incident.id}</span>
                </p>
                <h1>{incident.symptom}</h1>
                <p>{incident.configuration}</p>
              </div>
              <div className="incident-masthead-actions">
                <span className="incident-tag">
                  {incident.status.replaceAll("_", " ")}
                </span>
                <button onClick={() => setHandoffOpen(true)}>
                  <EnvelopeSimple aria-hidden="true" />
                  Engineer handoff
                </button>
                <a
                  className="incident-button-link"
                  href={incidentReportUrl(incident.id)}
                  download
                  onClick={(event) => {
                    event.preventDefault();
                    setError("");
                    void downloadIncidentReport(incident.id).catch(
                      (cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Report download failed.",
                        ),
                    );
                  }}
                >
                  <DownloadSimple aria-hidden="true" />
                  Export report
                </a>
              </div>
            </div>
            <div className="incident-state-strip">
              <span>
                <strong>Evidence revision {incident.revision}</strong> ·{" "}
                {incident.mode}
              </span>
              <span>Equipment disposition: not assessed</span>
              <span>Owner: {incident.owner ?? "Unassigned"}</span>
              {incident.waiting_for && (
                <span>
                  Waiting for:{" "}
                  {
                    {
                      observation: "technician observation",
                      test_authorization: "test authorization",
                      engineer: "engineer review",
                      missing_data: "missing evidence",
                    }[incident.waiting_for]
                  }
                </span>
              )}
              <span>
                {incident.escalated
                  ? "Engineer escalation recorded · email not sent"
                  : "Engineer handoff: saved draft · see communication status"}
              </span>
            </div>
            <div className="incident-action-bar">
              <div className="incident-actions">
                {!closed &&
                  incident.mode === "replay" &&
                  incident.replay_stage < 1 && (
                    <button
                      disabled={busy || !canEdit}
                      onClick={() => perform({ action: "advance_replay" })}
                    >
                      {busy ? "Collecting…" : "Collect next evidence"}
                    </button>
                  )}
                {!closed && (
                  <button
                    className="primary"
                    disabled={busy || !canEdit}
                    onClick={() => perform({ action: "analyze" })}
                  >
                    {busy
                      ? "Working…"
                      : incident.assessment
                        ? "Reassess evidence"
                        : "Analyze available evidence"}
                  </button>
                )}
                {!closed && !incident.escalated && (
                  <button
                    disabled={busy || !canEdit}
                    onClick={() =>
                      perform({
                        action: "escalate",
                        notes:
                          "Technician requested engineer review from the incident workspace.",
                      })
                    }
                  >
                    Request engineer review
                  </button>
                )}
              </div>
              <label className="incident-history-select">
                Assessment view
                <select
                  value={historicalRevision ?? "current"}
                  onChange={(event) =>
                    setHistoricalRevision(
                      event.target.value === "current"
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="current">Current evidence</option>
                  {(incident.assessment_history ?? []).map((item) => (
                    <option
                      key={item.incident_revision}
                      value={item.incident_revision}
                    >
                      Saved assessment · revision {item.incident_revision}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {historicalRevision !== null && (
              <p className="incident-notice">
                Historical assessment at revision {historicalRevision}; the
                evidence timeline shows current records, including later
                arrivals. The mechanism view follows this saved assessment, not
                a historical sensor state. Return to Current evidence to record
                a new result.
              </p>
            )}
            <JobStatus
              key={`jobs-${incident.id}`}
              incident={incident}
              onRefresh={refreshSaved}
            />
            <div className="incident-work-grid">
              <div className="incident-evidence-column">
                <EvidenceExplorer
                  evidence={incident.evidence ?? []}
                  selectedId={selectedEvent}
                  onSelect={setSelectedEvent}
                  busy={busy || !canEdit}
                  closed={closed ?? false}
                  onCorrect={(id, replacement, reason) =>
                    onAction({
                      action: "correct_evidence",
                      evidence_id: id,
                      replacement,
                      reason,
                    })
                  }
                />
                {selectedObservation && (
                  <article
                    className="incident-card incident-selected-observation"
                    aria-label="Selected recorded result"
                  >
                    <span className="incident-tag">
                      {selectedObservation.synthetic ? "Simulated" : "Observed"}
                    </span>
                    <h3>{selectedObservation.check_id.replaceAll("_", " ")}</h3>
                    <p>
                      {selectedObservation.result} ·{" "}
                      {displayTime(selectedObservation.recorded_at)}
                    </p>
                    <p>{selectedObservation.notes}</p>
                    <span className="mono">{selectedObservation.id}</span>
                  </article>
                )}
                <AddEvidence
                  busy={busy || !canEdit}
                  onAction={onAction}
                  closed={!!closed}
                />
              </div>
              <InvestigationPanel
                assessment={assessment}
                observations={visibleObservations}
                onObserve={(input) =>
                  onAction({ action: "record_result", ...input })
                }
                onSelectEvidence={setSelectedEvent}
                onSelectHypothesis={setSelectedHypothesis}
                selectedHypothesisId={hypothesisId}
                busy={
                  busy || !canEdit || historicalRevision !== null || !!closed
                }
              />
            </div>
            <MechanismView
              hypothesisId={hypothesisId}
              revision={snapshot?.incident_revision ?? incident.revision}
              eventLabel={
                incident.evidence?.find((item) => item.id === selectedEvent)
                  ?.label ?? selectedObservation?.check_id
              }
            />
            <SimulationPanel
              key={`simulation-${incident.id}`}
              incident={incident}
              selectedHypothesis={hypothesisId}
              onSelectHypothesis={setSelectedHypothesis}
              selectedEvidenceId={selectedEvent}
              onRefresh={refreshSaved}
              busy={busy || historicalRevision !== null}
            />
            <ExperimentsPanel
              key={`experiments-${incident.id}`}
              incident={incident}
              busy={busy || historicalRevision !== null}
            />
            <PastIncidents
              key={`experience-${incident.id}`}
              incident={incident}
            />
            <RawArtifacts
              key={`originals-${incident.id}`}
              incident={incident}
              busy={busy}
              onAction={onAction}
            />
            <KnowledgeRegistry configuration={incident.configuration} />
            <IncidentReview
              key={`review-${incident.id}`}
              incident={incident}
              busy={busy}
              onAction={onAction}
            />
            <details className="incident-audit">
              <summary>
                Application activity ({(incident.history ?? []).length})
              </summary>
              <p className="incident-muted">
                These are application actions, separate from machine and source
                event times.
              </p>
              <ol>
                {(incident.history ?? []).map((item, index) => (
                  <li key={`${item.revision}-${index}`}>
                    <span className="mono">r{item.revision}</span> ·{" "}
                    {displayTime(item.timestamp)} ·{" "}
                    {item.action.replaceAll("_", " ")}
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ol>
            </details>
            <HandoffDrawer
              key={`handoff-${incident.id}`}
              incident={incident}
              busy={busy}
              open={handoffOpen}
              onClose={() => setHandoffOpen(false)}
              onAction={onAction}
            />
          </>
        )}
      </main>
      <footer className="incident-footer">
        <span>FlowPilot · Evidence-driven S932 investigations</span>
        <span>Prototype · Human review required for conclusions</span>
      </footer>
    </div>
  );
}

export function IncidentWorkspace() {
  return (
    <AccessPanel>
      <IncidentWorkspaceContent />
    </AccessPanel>
  );
}
