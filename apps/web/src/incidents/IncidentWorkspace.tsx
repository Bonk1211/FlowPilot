import {
  Activity,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  ArrowLeft,
  Books,
  CheckSquare,
  ClockCounterClockwise,
  Cube,
  Info,
  MagnifyingGlass,
  PaperPlaneTilt,
  SidebarSimple,
  X,
  ArrowRight,
  ArrowSquareOut,
  DownloadSimple,
  Flask,
  Plus,
  UploadSimple,
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
import { HandoffPage } from "./HandoffPage";
import { KnowledgeRegistry } from "./KnowledgeRegistry";
import { SimulationPanel } from "./SimulationPanel";
import { ExperimentsPanel } from "./ExperimentsPanel";
import {
  incidentPages,
  incidentPageUrl,
  pageNames,
  useIncidentRoute,
  type IncidentRoute,
} from "./navigation";
import "./incidents.css";

const featureIcons = {
  investigation: MagnifyingGlass,
  evidence: ClockCounterClockwise,
  simulation: Cube,
  experiments: Flask,
  handoff: PaperPlaneTilt,
  knowledge: Books,
  review: CheckSquare,
};

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

function IncidentWorkspaceContent({
  route,
  navigate,
  followLink,
}: {
  route: IncidentRoute;
  navigate: (path: string) => void;
  followLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [incident, setIncident] = useState<Incident | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(!route.invalid || !!route.incidentId);
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
  const featureHeading = useRef<HTMLHeadingElement>(null);
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const timelinePage = route.page === "evidence" && !!incident;

  const [manualTool, setManualTool] = useState("S932-DEMO-01");
  const [manualSymptom, setManualSymptom] = useState(
    "Progressively insufficient flux coverage",
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalidListRoute = route.invalid && !route.incidentId;
  useEffect(() => {
    let active = true;
    const id = route.incidentId;
    if (invalidListRoute) return;
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
  }, [retry, route.incidentId, invalidListRoute]);

  async function start(create: () => Promise<Incident>) {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    try {
      const value = await create();
      if (!mounted.current) return;
      navigate(incidentPageUrl(value.id));
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
  const eventId = selectedEvent ?? incident?.evidence?.[0]?.id ?? null;
  const selectedObservation = incident?.observations?.find(
    (item) => item.id === eventId,
  );
  const visibleObservations = (incident?.observations ?? []).filter(
    (item) =>
      !snapshot ||
      Date.parse(item.recorded_at) <= Date.parse(snapshot.created_at),
  );

  useEffect(() => {
    const label = route.invalid
      ? "Page not found"
      : route.page
        ? incidentPages[route.page].label
        : "Incidents";
    document.title = `${label}${route.incidentId ? ` · ${route.incidentId}` : ""} · FlowPilot`;
    if (!loading) {
      featureHeading.current?.focus({ preventScroll: true });
      featureHeading.current?.scrollIntoView({ block: "start" });
    }
  }, [route.page, route.incidentId, route.invalid, loading]);

  return (
    <div
      className={`incident-app${incident ? " incident-workspace" : ""}${timelinePage ? " incident-timeline-page" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="command-bar incident-command-bar">
        <a
          className="wordmark"
          href="/incidents"
          aria-label="FlowPilot incidents"
          onClick={followLink}
        >
          <Flask aria-hidden="true" />
          FlowPilot
        </a>
        <span className="incident-nav-context">
          {timelinePage
            ? `${incident.tool_id} · Evidence timeline`
            : "S932 · Incident workspace"}
        </span>
        {timelinePage && (
          <button
            className="incident-overview-toggle"
            aria-expanded={overviewOpen}
            aria-controls="incident-overview"
            onClick={() => setOverviewOpen((open) => !open)}
          >
            <Info aria-hidden="true" /> Incident details
          </button>
        )}
        <nav aria-label="Workspace navigation">
          <a href="/incidents" onClick={followLink}>
            Incidents
          </a>
          <a href="/knowledge">Learning database</a>
          <a href="/legacy">
            Legacy demo <ArrowSquareOut aria-hidden="true" />
          </a>
        </nav>
        <span className="demo-badge">Prototype / Simulated data</span>
      </header>
      <main id="main" tabIndex={-1} className="incident-main">
        {!timelinePage && (
          <div className="incident-access-banner">
            <AccessStatus />
          </div>
        )}
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
        ) : route.invalid && !route.incidentId ? (
          <section className="incident-card incident-page-error">
            <h1>Page not found</h1>
            <p>This address does not identify an incident page.</p>
            <a href="/incidents" onClick={followLink}>
              Return to incidents
            </a>
          </section>
        ) : !incident && route.incidentId ? (
          <section className="incident-card incident-page-error">
            <h1>Incident unavailable</h1>
            <p>
              The saved incident could not be loaded. Retry above or return to
              the incident list.
            </p>
            <a href="/incidents" onClick={followLink}>
              Return to incidents
            </a>
          </section>
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
                      onClick={followLink}
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
            <section
              id="incident-overview"
              className="incident-overview"
              aria-label="Incident details"
              hidden={timelinePage && !overviewOpen}
              onKeyDown={(event) => {
                if (timelinePage && event.key === "Escape") {
                  setOverviewOpen(false);
                  document
                    .querySelector<HTMLButtonElement>(
                      ".incident-overview-toggle",
                    )
                    ?.focus();
                }
              }}
            >
              {timelinePage && (
                <div className="incident-access-banner">
                  <AccessStatus />
                  <button
                    aria-label="Close incident details"
                    onClick={() => setOverviewOpen(false)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              )}
              <a
                href="/incidents"
                className="incident-back"
                onClick={followLink}
              >
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
              <JobStatus
                key={`jobs-${incident.id}`}
                incident={incident}
                onRefresh={refreshSaved}
              />
            </section>
            <div className="incident-feature-layout">
              <aside
                className="incident-feature-sidebar"
                data-expanded={navigationExpanded}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setNavigationExpanded(false);
                    event.currentTarget
                      .querySelector<HTMLButtonElement>("button")
                      ?.focus();
                  }
                }}
              >
                <button
                  className="incident-sidebar-toggle"
                  aria-label={
                    navigationExpanded
                      ? "Collapse navigation"
                      : "Expand navigation"
                  }
                  aria-expanded={navigationExpanded}
                  aria-controls="incident-feature-nav"
                  onClick={() => setNavigationExpanded((expanded) => !expanded)}
                >
                  <SidebarSimple aria-hidden="true" />
                  <span>Workspace</span>
                </button>
                <nav id="incident-feature-nav" aria-label="Incident features">
                  {pageNames.map((page) => {
                    const Icon = featureIcons[page];
                    return (
                      <a
                        key={page}
                        href={incidentPageUrl(incident.id, page)}
                        onClick={(event) => {
                          setNavigationExpanded(false);
                          followLink(event);
                          if (page === route.page)
                            featureHeading.current?.focus();
                        }}
                        aria-label={incidentPages[page].label}
                        title={incidentPages[page].label}
                        aria-current={route.page === page ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{incidentPages[page].label}</span>
                      </a>
                    );
                  })}
                </nav>
                <p>
                  Sources, selected evidence and investigation context stay with
                  this incident.
                </p>
              </aside>
              <div className="incident-feature-content">
                <header className="incident-feature-heading">
                  <h2 ref={featureHeading} tabIndex={-1}>
                    {route.page
                      ? incidentPages[route.page].label
                      : "Page not found"}
                  </h2>
                  <p>
                    {route.page
                      ? incidentPages[route.page].description
                      : "This incident page does not exist. Choose a feature from the navigation to continue."}
                  </p>
                </header>
                {route.invalid && (
                  <a
                    className="incident-button-link"
                    href={incidentPageUrl(incident.id, "investigation")}
                    onClick={followLink}
                  >
                    Return to Investigation
                  </a>
                )}
                {historicalRevision !== null && (
                  <p className="incident-notice">
                    Historical assessment at revision {historicalRevision}; the
                    evidence page shows current records, including later
                    arrivals. The mechanism follows this saved assessment, not a
                    historical sensor state.{" "}
                    <button
                      type="button"
                      onClick={() => setHistoricalRevision(null)}
                    >
                      Return to current evidence
                    </button>
                  </p>
                )}
                {route.visited.includes("investigation") && (
                  <Activity
                    mode={route.page === "investigation" ? "visible" : "hidden"}
                  >
                    <section aria-label="Investigation workspace">
                      <div className="incident-action-bar">
                        <div className="incident-actions">
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
                                Saved assessment · revision{" "}
                                {item.incident_revision}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {!assessment && (
                        <p className="incident-investigation-intro">
                          A partial incident package is ready.{" "}
                          <a
                            href={incidentPageUrl(incident.id, "evidence")}
                            onClick={followLink}
                          >
                            Collect and inspect evidence
                          </a>{" "}
                          before choosing the next investigation step.
                        </p>
                      )}
                      <InvestigationPanel
                        assessment={assessment}
                        observations={visibleObservations}
                        onObserve={(input) =>
                          onAction({ action: "record_result", ...input })
                        }
                        onSelectEvidence={(id) => {
                          setSelectedEvent(id);
                          navigate(incidentPageUrl(incident.id, "evidence"));
                        }}
                        onSelectHypothesis={setSelectedHypothesis}
                        selectedHypothesisId={hypothesisId}
                        busy={
                          busy ||
                          !canEdit ||
                          historicalRevision !== null ||
                          !!closed
                        }
                      />
                      <p className="incident-page-next">
                        <a
                          href={incidentPageUrl(incident.id, "simulation")}
                          onClick={followLink}
                        >
                          Explore the selected mechanism in Simulation{" "}
                          <ArrowRight aria-hidden="true" />
                        </a>
                      </p>
                    </section>
                  </Activity>
                )}
                {route.visited.includes("evidence") && (
                  <Activity
                    mode={route.page === "evidence" ? "visible" : "hidden"}
                  >
                    <section
                      className="incident-evidence-workspace"
                      aria-label="Evidence workspace"
                    >
                      <EvidenceExplorer
                        actions={
                          <>
                            {!closed &&
                              incident.mode === "replay" &&
                              incident.replay_stage < 1 && (
                                <div className="incident-collect-action">
                                  <button
                                    disabled={busy || !canEdit}
                                    onClick={() =>
                                      perform({ action: "advance_replay" })
                                    }
                                  >
                                    {busy
                                      ? "Collecting…"
                                      : "Collect next evidence"}
                                  </button>
                                </div>
                              )}

                            <details
                              className="incident-source-tools"
                              name="evidence-tools"
                            >
                              <summary>
                                <UploadSimple aria-hidden="true" /> Source files
                              </summary>
                              <div className="incident-source-drawer">
                                <AddEvidence
                                  busy={busy || !canEdit}
                                  onAction={onAction}
                                  closed={!!closed}
                                />
                                <RawArtifacts
                                  incident={incident}
                                  busy={busy}
                                  onAction={onAction}
                                />
                              </div>
                            </details>
                          </>
                        }
                        evidence={incident.evidence ?? []}
                        selectedId={eventId}
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
                            {selectedObservation.synthetic
                              ? "Simulated"
                              : "Observed"}
                          </span>
                          <h3>
                            {selectedObservation.check_id.replaceAll("_", " ")}
                          </h3>
                          <p>
                            {selectedObservation.result} ·{" "}
                            {displayTime(selectedObservation.recorded_at)}
                          </p>
                          <p>{selectedObservation.notes}</p>
                          <span className="mono">{selectedObservation.id}</span>
                        </article>
                      )}
                      <p className="incident-page-next">
                        <a
                          href={incidentPageUrl(incident.id, "investigation")}
                          onClick={followLink}
                        >
                          Continue the investigation{" "}
                          <ArrowRight aria-hidden="true" />
                        </a>
                      </p>
                    </section>
                  </Activity>
                )}
                {route.visited.includes("simulation") && (
                  <Activity
                    mode={route.page === "simulation" ? "visible" : "hidden"}
                  >
                    <section aria-label="Simulation workspace">
                      <MechanismView
                        hypothesisId={hypothesisId}
                        componentIds={
                          assessment?.hypotheses.find(
                            (item) => item.id === hypothesisId,
                          )?.component_ids ?? []
                        }
                        revision={
                          snapshot?.incident_revision ?? incident.revision
                        }
                        eventLabel={
                          incident.evidence?.find((item) => item.id === eventId)
                            ?.label ?? selectedObservation?.check_id
                        }
                      />
                      <SimulationPanel
                        incident={incident}
                        selectedHypothesis={hypothesisId}
                        onSelectHypothesis={setSelectedHypothesis}
                        selectedEvidenceId={eventId}
                        onRefresh={refreshSaved}
                        busy={busy || historicalRevision !== null}
                      />
                    </section>
                  </Activity>
                )}
                {route.visited.includes("experiments") && (
                  <Activity
                    mode={route.page === "experiments" ? "visible" : "hidden"}
                  >
                    <ExperimentsPanel
                      incident={incident}
                      busy={busy || historicalRevision !== null}
                    />
                  </Activity>
                )}
                {route.visited.includes("handoff") && (
                  <Activity
                    mode={route.page === "handoff" ? "visible" : "hidden"}
                  >
                    <HandoffPage
                      incident={incident}
                      busy={busy}
                      onAction={onAction}
                    />
                  </Activity>
                )}
                {route.visited.includes("knowledge") && (
                  <Activity
                    mode={route.page === "knowledge" ? "visible" : "hidden"}
                  >
                    <section
                      className="incident-knowledge-page"
                      aria-label="Knowledge workspace"
                    >
                      <PastIncidents incident={incident} />
                      <KnowledgeRegistry
                        configuration={incident.configuration}
                      />
                    </section>
                  </Activity>
                )}
                {route.visited.includes("review") && (
                  <Activity
                    mode={route.page === "review" ? "visible" : "hidden"}
                  >
                    <section aria-label="Review workspace">
                      <IncidentReview
                        incident={incident}
                        busy={busy}
                        onAction={onAction}
                      />
                      <details className="incident-audit">
                        <summary>
                          Application activity (
                          {(incident.history ?? []).length})
                        </summary>
                        <p className="incident-muted">
                          These are application actions, separate from machine
                          and source event times.
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
                    </section>
                  </Activity>
                )}
              </div>
            </div>
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
  const navigation = useIncidentRoute();
  return (
    <AccessPanel>
      <IncidentWorkspaceContent
        key={navigation.route.incidentId ?? "incident-list"}
        {...navigation}
      />
    </AccessPanel>
  );
}
