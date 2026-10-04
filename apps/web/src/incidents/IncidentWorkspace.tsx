import {
  Activity,
  lazy,
  Suspense,
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
  ClockCounterClockwise,
  Cube,
  Info,
  MagnifyingGlass,
  PaperPlaneTilt,
  SidebarSimple,
  X,
  ArrowRight,
  DownloadSimple,
  Flask,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  actOnIncident,
  createIncident,
  listIncidents,
  loadIncident,
  startReplay,
  type CreateIncident,
  type EvidenceInput,
  type Incident,
  type IncidentCommand,
} from "./api";
import { downloadIncidentReport } from "./reportExports";
import { EvidenceExplorer } from "./EvidenceExplorer";
import { WorkspaceLoading } from "../components/WorkspaceLoading";
import { displayTime } from "./time";
import { MechanismView } from "./MechanismView";
import { MonitoringDashboard } from "./MonitoringDashboard";
import { InvestigationPanel } from "./InvestigationPanel";
import { InvestigationGraph } from "./InvestigationGraph";
import { AccessPanel, AccessStatus, useIncidentAccess } from "./AccessPanel";
import { RawArtifacts } from "./RawArtifacts";
import { JobStatus, type AnalysisJobStatus } from "./JobStatus";
import {
  InvestigationProgress,
  type InvestigationProgressMode,
} from "./InvestigationProgress";
import { HandoffPage } from "./HandoffPage";
import { SimulationPanel } from "./SimulationPanel";
import { ExperimentLab } from "./ExperimentLab";
import { ExperimentsPanel } from "./ExperimentsPanel";
import {
  incidentPages,
  incidentPageUrl,
  pageNames,
  useIncidentRoute,
  type IncidentRoute,
  experimentQuery,
} from "./navigation";
import {
  mechanismChecks,
  mechanismIds,
  type MechanismId,
} from "./experimentDefaults";
import "./incidents.css";

const IncidentLearningDatabase = lazy(() =>
  import("./IncidentLearningDatabase").then((module) => ({
    default: module.IncidentLearningDatabase,
  })),
);

const featureIcons = {
  investigation: MagnifyingGlass,
  evidence: ClockCounterClockwise,
  simulation: Cube,
  experiments: Flask,
  handoff: PaperPlaneTilt,
  knowledge: Books,
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
  replace,
  followLink,
}: {
  route: IncidentRoute;
  navigate: (path: string) => void;
  replace: (path: string) => void;
  followLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [incident, setIncident] = useState<Incident | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(!route.invalid || !!route.incidentId);
  const [busy, setBusy] = useState(false);
  const [workingAction, setWorkingAction] = useState<
    IncidentCommand["action"] | null
  >(null);
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisJobStatus | null>(null);
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
  const labKey = `flowpilot.lab-plans.${route.incidentId}`;
  // The experiment plans started in this tab, so Simulation still shows them after a reload.
  const [labPlanIds, setLabPlanState] = useState<string[]>(() => {
    try {
      return (sessionStorage.getItem(labKey) ?? "").split(",").filter(Boolean);
    } catch {
      return [];
    }
  });
  const setLabPlanIds = (ids: string[]) => {
    setLabPlanState(ids);
    try {
      if (ids.length) sessionStorage.setItem(labKey, ids.join(","));
      else sessionStorage.removeItem(labKey);
    } catch {
      // Storage can be blocked; the plans are then remembered for this page only.
    }
  };
  const featureHeading = useRef<HTMLHeadingElement>(null);
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const timelinePage = route.page === "evidence" && !!incident;
  const [graphExpanded, setGraphExpanded] = useState(true);
  const jobStatus =
    analysisStatus?.incidentId === incident?.id ? analysisStatus : null;
  const backgroundProgress: InvestigationProgressMode | null =
    jobStatus?.enabled
      ? jobStatus.job?.state === "running"
        ? "updating"
        : jobStatus.job?.state === "pending" ||
            (!incident?.assessment && jobStatus.revision !== incident?.revision)
          ? "queued"
          : null
      : null;
  const progressMode: InvestigationProgressMode | null =
    workingAction === "analyze"
      ? "analysis"
      : [
            "answer_investigation",
            "confirm_investigation",
            "record_result",
          ].includes(workingAction ?? "")
        ? "answer"
        : ["retry_investigation", "select_investigation"].includes(
              workingAction ?? "",
            )
          ? "updating"
          : backgroundProgress;
  const analysisError =
    jobStatus &&
    jobStatus.revision === incident?.revision &&
    !progressMode &&
    jobStatus.job?.state === "failed"
      ? "Evidence analysis did not finish. Your evidence is saved. Analyze the available evidence to try again."
      : !progressMode &&
          jobStatus?.revision === incident?.revision &&
          jobStatus?.error
        ? "Background analysis status is unavailable. Refresh job status in Incident overview to check again."
        : "";
  const investigationCanvas =
    route.page === "investigation" &&
    (!!incident?.assessment || !!progressMode) &&
    !!incident?.investigation?.nodes?.length &&
    historicalRevision === null &&
    graphExpanded;
  const canvasPage = timelinePage || investigationCanvas;
  const handoffPage = route.page === "handoff";
  const compactOverview =
    canvasPage || handoffPage || route.page === "knowledge";

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
    setWorkingAction(command.action);
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
      setWorkingAction(null);
    }
  }
  const perform = (command: IncidentCommand) => {
    void onAction(command).catch(() => undefined);
  };
  const snapshot = incident?.assessment_history?.find(
    (item) => item.incident_revision === historicalRevision,
  );
  const assessment = snapshot?.assessment ?? incident?.assessment ?? null;
  const monitoringPage =
    route.page === "investigation" && !assessment && !progressMode;
  const hypothesisId = assessment
    ? assessment.hypotheses.some((item) => item.id === selectedHypothesis)
      ? selectedHypothesis
      : (assessment.hypotheses[0]?.id ?? null)
    : selectedHypothesis;
  // Older single-experiment links open the lab running that one experiment.
  const legacyCheck =
    route.page === "simulation" && route.experimentCheckId
      ? route.experimentCheckId
      : null;
  useEffect(() => {
    if (!legacyCheck || !route.incidentId) return;
    const mechanism = mechanismIds.find(
      (id) => mechanismChecks[id] === legacyCheck,
    );
    const page = incidentPageUrl(route.incidentId, "simulation");
    replace(
      mechanism ? `${page}?${experimentQuery({ runs: [mechanism] })}` : page,
    );
  }, [legacyCheck, route.incidentId, replace]);
  function runExperiments(ids: readonly MechanismId[] = mechanismIds) {
    if (!incident) return;
    setLabPlanIds([]);
    setHistoricalRevision(null);
    navigate(
      `${incidentPageUrl(incident.id, "simulation")}?${experimentQuery({ runs: ids })}`,
    );
  }
  // A plan id in the address wins; otherwise the lab keeps showing the plan it just ran.
  const labPlans = route.experimentPlanIds.length
    ? route.experimentPlanIds
    : route.experimentRuns.length
      ? []
      : labPlanIds;
  const showLab =
    !!incident && (route.experimentRuns.length > 0 || labPlans.length > 0);
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
  const simulationPanel = incident && (
    <SimulationPanel
      key={incident.id}
      incident={incident}
      selectedHypothesis={hypothesisId}
      onSelectHypothesis={setSelectedHypothesis}
      selectedEvidenceId={eventId}
      onRefresh={refreshSaved}
      busy={busy || historicalRevision !== null}
    />
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
      className={`incident-app${incident ? " incident-workspace" : ""}${canvasPage ? " incident-timeline-page" : ""}${investigationCanvas ? " incident-investigation-page" : ""}${monitoringPage ? " incident-monitoring-page" : ""}${handoffPage ? " incident-handoff-focus" : ""}${route.page === "knowledge" ? " incident-knowledge-focus" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="command-bar incident-command-bar">
        <a
          className="wordmark"
          href="http://localhost:5173/"
          aria-label="FlowPilot home"
        >
          <Flask aria-hidden="true" />
          FlowPilot
        </a>
        <span className="incident-nav-context">
          {compactOverview && incident
            ? `${incident.tool_id} · ${handoffPage ? "Handoff" : route.page === "knowledge" ? "Knowledge" : timelinePage ? "Evidence timeline" : "Investigation"}`
            : "S932 · Incident workspace"}
        </span>
        {compactOverview && (
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
          <a
            href={
              route.incidentId
                ? incidentPageUrl(route.incidentId, "knowledge")
                : "/knowledge"
            }
            onClick={route.incidentId ? followLink : undefined}
          >
            Learning database
          </a>
        </nav>
        <span className="demo-badge">Prototype / Simulated data</span>
      </header>
      <main id="main" tabIndex={-1} className="incident-main">
        {!compactOverview && (
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
          <WorkspaceLoading
            detail={
              route.incidentId
                ? "Loading the investigation and its evidence…"
                : "Loading your saved investigations…"
            }
          />
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
              hidden={compactOverview && !overviewOpen}
              onKeyDown={(event) => {
                if (compactOverview && event.key === "Escape") {
                  setOverviewOpen(false);
                  document
                    .querySelector<HTMLButtonElement>(
                      ".incident-overview-toggle",
                    )
                    ?.focus();
                }
              }}
            >
              {compactOverview && (
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
                    href={incidentPageUrl(incident.id, "handoff")}
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
                onAnalysisChange={setAnalysisStatus}
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
                <header
                  className={`incident-feature-heading${investigationCanvas || monitoringPage || handoffPage || route.page === "knowledge" ? " sr-only" : ""}`}
                >
                  <h2 ref={featureHeading} tabIndex={-1}>
                    {route.page
                      ? incidentPages[route.page].label
                      : "Page not found"}
                  </h2>
                  <p>
                    {route.page === "investigation" &&
                    !assessment &&
                    !progressMode
                      ? "Monitor process conditions, follow an alarm and investigate the available evidence."
                      : route.page
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
                    <section
                      className="incident-investigation-workspace"
                      aria-label="Investigation workspace"
                    >
                      {!assessment && !progressMode && (
                        <MonitoringDashboard
                          key={`monitoring-${incident.id}`}
                          incident={incident}
                          disabled={busy || !canEdit || !!closed}
                          onAnalyze={() => perform({ action: "analyze" })}
                        />
                      )}
                      <div hidden={investigationCanvas || !assessment}>
                        <div className="incident-action-bar">
                          <div className="incident-actions">
                            {!closed && (
                              <button
                                className="primary"
                                disabled={busy || !!progressMode || !canEdit}
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
                              {(incident.assessment_history ?? []).map(
                                (item) => (
                                  <option
                                    key={item.incident_revision}
                                    value={item.incident_revision}
                                  >
                                    Saved assessment · revision{" "}
                                    {item.incident_revision}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>
                      </div>
                      {analysisError && !investigationCanvas && (
                        <p className="incident-notice" role="alert">
                          {analysisError}
                        </p>
                      )}
                      {historicalRevision === null && (
                        <InvestigationGraph
                          key={incident.id}
                          incident={incident}
                          expanded={investigationCanvas}
                          onExpandedChange={setGraphExpanded}
                          onAction={onAction}
                          progressMode={progressMode}
                          progressError={
                            investigationCanvas ? analysisError : ""
                          }
                          onUpdated={(updated) => {
                            setIncident((current) =>
                              current &&
                              current.id === updated.id &&
                              current.revision > updated.revision
                                ? current
                                : updated,
                            );
                          }}
                          busy={busy || !canEdit || !!closed}
                          readOnly={!canEdit || !!closed}
                          onSelectHypothesis={setSelectedHypothesis}
                          selectedHypothesisId={hypothesisId}
                          onSelectEvidence={(id) => {
                            setSelectedEvent(id);
                            navigate(incidentPageUrl(incident.id, "evidence"));
                          }}
                          onOpenTimeline={() =>
                            navigate(incidentPageUrl(incident.id, "evidence"))
                          }
                          onRunExperiments={runExperiments}
                          focusFinding={route.experimentFinding}
                          onOpenLink={followLink}
                        />
                      )}
                      <div hidden={investigationCanvas}>
                        {progressMode &&
                        !incident.investigation?.nodes?.length &&
                        historicalRevision === null ? (
                          <InvestigationProgress
                            incident={incident}
                            mode={progressMode}
                          />
                        ) : assessment ? (
                          <InvestigationPanel
                            showForms={!incident.investigation?.nodes?.length}
                            assessment={assessment}
                            observations={visibleObservations}
                            onObserve={(input) =>
                              onAction({ action: "record_result", ...input })
                            }
                            onSelectEvidence={(id) => {
                              setSelectedEvent(id);
                              navigate(
                                incidentPageUrl(incident.id, "evidence"),
                              );
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
                        ) : null}
                        <p className="incident-page-next" hidden={!assessment}>
                          <a
                            href={incidentPageUrl(incident.id, "simulation")}
                            onClick={followLink}
                          >
                            Explore the selected mechanism in Simulation{" "}
                            <ArrowRight aria-hidden="true" />
                          </a>
                        </p>
                      </div>
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
                              <summary title="Source files">
                                <UploadSimple aria-hidden="true" />{" "}
                                <span className="incident-narrow-label">
                                  Source files
                                </span>
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
                        incident={incident}
                        activity={incident.history}
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
                      {showLab && (
                        <ExperimentLab
                          incident={incident}
                          planIds={labPlans}
                          requested={route.experimentRuns}
                          onPlans={(ids) => {
                            setLabPlanIds(ids);
                            // Record the plans in the address so a reload follows them
                            // instead of running again; never while another page is shown.
                            const page = incidentPageUrl(
                              incident.id,
                              "simulation",
                            );
                            if (window.location.pathname === page)
                              replace(
                                `${page}?${experimentQuery({ plans: ids })}`,
                              );
                          }}
                          onRefresh={refreshSaved}
                          experimentsHref={incidentPageUrl(
                            incident.id,
                            "experiments",
                          )}
                          onReturn={(hypothesisId) =>
                            navigate(
                              `${incidentPageUrl(incident.id, "investigation")}?finding=${encodeURIComponent(hypothesisId)}`,
                            )
                          }
                          onOpenLink={followLink}
                        />
                      )}
                      <MechanismView
                        hypotheses={assessment?.hypotheses}
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
                      {simulationPanel}
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
                      <Suspense
                        fallback={
                          <p role="status">Loading learning database…</p>
                        }
                      >
                        <IncidentLearningDatabase
                          key={incident.id}
                          incident={incident}
                          busy={busy}
                          onAction={onAction}
                          onRefresh={refreshSaved}
                          followLink={followLink}
                        >
                          <details className="incident-audit">
                            <summary>
                              Application activity (
                              {(incident.history ?? []).length})
                            </summary>
                            <p className="incident-muted">
                              These are application actions, separate from
                              machine and source event times.
                            </p>
                            <ol>
                              {(incident.history ?? []).map((item, index) => (
                                <li key={`${item.revision}-${index}`}>
                                  <span className="mono">r{item.revision}</span>{" "}
                                  · {displayTime(item.timestamp)} ·{" "}
                                  {item.action.replaceAll("_", " ")}
                                  <p>{item.detail}</p>
                                </li>
                              ))}
                            </ol>
                          </details>
                        </IncidentLearningDatabase>
                      </Suspense>
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
