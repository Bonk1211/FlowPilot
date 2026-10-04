import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  X,
  ArrowsClockwise,
  CheckCircle,
  Database,
  Plus,
  Play,
  ArrowRight,
} from "@phosphor-icons/react";
import type { LibraryOverview } from "@flowpilot/contracts";
import { KnowledgeGraph } from "../components/KnowledgeGraph";
import { graphConnectivity } from "../knowledgeGraph";
import {
  actOnIncident,
  loadIncident,
  incidentJson,
  type Incident,
  type IncidentCommand,
} from "./api";
import { useIncidentAccess } from "./AccessPanel";
import { incidentKnowledgeGraph } from "./incidentKnowledgeGraph";
import { incidentPageUrl } from "./navigation";
import { IncidentReview } from "./IncidentReview";
import { PastIncidents } from "./PastIncidents";
import { KnowledgeRegistry } from "./KnowledgeRegistry";
import "../knowledge.css";
import "./IncidentLearningDatabase.css";

const emptyGraph = { nodes: [], edges: [] };

export function IncidentLearningDatabase({
  incident,
  busy,
  onAction,
  onRefresh,
  followLink,
  children,
}: {
  children?: ReactNode;
  incident: Incident;
  busy: boolean;
  onAction: (
    command: IncidentCommand,
    role?: "technician" | "engineer",
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  followLink: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const access = useIncidentAccess();
  const [saved, setSaved] = useState<Incident[]>([]);
  const [library, setLibrary] = useState<LibraryOverview | null>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(
    () => !window.matchMedia("(max-width: 700px)").matches,
  );
  const demoInFlight = useRef(false);
  const [arrival, setArrival] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const request = useRef<{ content: string; id: string } | null>(null);
  const map = useRef<HTMLElement>(null);
  const findingsPanel = useRef<HTMLDetailsElement>(null);
  const evidence = (incident.evidence ?? []).filter(
    (item) =>
      item.status === "collected" &&
      !incident.evidence?.some((other) => other.supersedes_id === item.id),
  );
  const [evidenceIds, setEvidenceIds] = useState(() =>
    evidence.map((item) => item.id),
  );
  const linkedEvidenceIds = evidenceIds.filter((id) =>
    evidence.some((item) => item.id === id),
  );
  const lastObservation = incident.observations?.at(-1);
  const [title, setTitle] = useState(
    lastObservation
      ? "A new finding from the recorded check"
      : "Compare coverage changes with their source context",
  );
  const [summary, setSummary] = useState(
    lastObservation
      ? `${lastObservation.check_id.replaceAll("_", " ")}: ${lastObservation.result}. ${lastObservation.notes ?? ""}`
      : `This investigation reports "${incident.symptom.toLowerCase()}". Keep the before/after evidence together and check the material and process context before attributing a cause.`,
  );

  useEffect(() => {
    const controller = new AbortController();
    const options = {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    };
    void Promise.all([
      incidentJson<Incident[]>("/api/incidents?limit=100", options),
      incidentJson<LibraryOverview>("/api/knowledge/graph?limit=40", options),
      onRefresh(),
    ])
      .then(([items, overview]) => {
        if (!controller.signal.aborted) {
          setSaved(items);
          setLibrary(overview);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "The overall knowledge graph could not be loaded. Retry to reconnect the library.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [incident.id, attempt, onRefresh]);

  const records = useMemo(
    () => [incident, ...saved.filter((item) => item.id !== incident.id)],
    [incident, saved],
  );
  const graph = useMemo(
    () => incidentKnowledgeGraph(records, library?.graph ?? emptyGraph),
    [records, library],
  );
  const connectivity = useMemo(() => graphConnectivity(graph), [graph]);
  const findings = records.flatMap((record) =>
    (record.captured_knowledge ?? []).map((finding) => ({
      ...finding,
      incident: record,
      graphId: `knowledge:${record.id}:${finding.id}`,
    })),
  );
  const matching = findings.filter((finding) =>
    `${finding.title} ${finding.summary}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const existing = findings.find(
    (finding) =>
      finding.incident.id === incident.id &&
      finding.title === title.trim() &&
      finding.summary === summary.trim() &&
      [...finding.evidence_ids].sort().join() ===
        [...linkedEvidenceIds].sort().join(),
  );
  const selectedFinding = findings.find(
    (finding) => finding.graphId === selected,
  );
  const node = graph.nodes.find((item) => item.id === selected);
  const edge = graph.edges.find((item) => item.id === selected);
  const arrived = findings.find((finding) => finding.graphId === arrival?.id);
  const libraryIds = new Set(library?.graph.nodes.map((item) => item.id));
  const arrivalLibraryLinks = graph.edges.filter(
    (item) => item.source === arrived?.graphId && libraryIds.has(item.target),
  );
  const reviewed = incident.status === "closed" && !!incident.closure;
  const canCapture =
    access.permissions.includes("edit") && incident.mode !== "live";
  const canSave = canCapture && reviewed;

  function showArrival(id: string) {
    setSelected(id);
    if (window.matchMedia("(max-width: 700px)").matches) {
      setContributionOpen(false);
      if (findingsPanel.current) findingsPanel.current.open = false;
    }
    setArrival((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
    if (window.matchMedia("(max-width: 900px)").matches)
      map.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  async function save() {
    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      evidence_ids: linkedEvidenceIds,
    };
    const content = JSON.stringify(payload);
    if (request.current?.content !== content)
      request.current = { content, id: `KN-${crypto.randomUUID()}` };
    const id = request.current.id;
    setSaving(true);
    setSaveError("");
    try {
      await onAction({
        action: "capture_knowledge",
        knowledge_id: id,
        ...payload,
      });
      showArrival(`knowledge:${incident.id}:${id}`);
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : "Knowledge could not be saved. Your finding is still here; try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordDemo(
    review: Extract<IncidentCommand, { action: "close" }>,
  ) {
    if (demoInFlight.current || busy || saving || loading || error) return;
    if (access.mode !== "demo" || !canCapture || !evidence.length)
      throw new Error(
        "The demo needs a replay or synthetic investigation with collected evidence.",
      );
    demoInFlight.current = true;
    setDemoRunning(true);
    setSaveError("");
    setTitle(`Demo finding: ${incident.symptom}`.slice(0, 160));
    setSummary(review.conclusion || review.notes);
    setEvidenceIds(evidence.slice(0, 100).map((item) => item.id));
    try {
      // Each command uses the revision returned by the preceding request.
      let current = await loadIncident(incident.id);
      if (current.mode === "live")
        throw new Error("Demo capture is unavailable for live investigations.");
      const sourceIds = (current.evidence ?? [])
        .filter(
          (item) =>
            item.status === "collected" &&
            !current.evidence?.some((other) => other.supersedes_id === item.id),
        )
        .slice(0, 100)
        .map((item) => item.id);
      if (!sourceIds.length)
        throw new Error("Collect evidence before running the demo.");
      if (current.status !== "closed" || !current.closure)
        current = await actOnIncident(
          current.id,
          { ...review, revision: current.revision },
          "engineer",
        );
      const closure = current.closure!;
      const id = `KN-demo-${current.id}-${closure.evidence_revision}`;
      const previous = current.captured_knowledge?.find(
        (finding) => finding.id === id,
      );
      const payload = previous ?? {
        title: `Demo finding: ${current.symptom}`.slice(0, 160),
        summary: closure.conclusion || closure.notes,
        evidence_ids: sourceIds,
      };
      setTitle(payload.title);
      setSummary(payload.summary);
      setEvidenceIds(payload.evidence_ids);
      if (!previous)
        await actOnIncident(current.id, {
          action: "capture_knowledge",
          revision: current.revision,
          knowledge_id: id,
          title: payload.title,
          summary: payload.summary,
          evidence_ids: payload.evidence_ids,
        });
      await onRefresh();
      showArrival(`knowledge:${current.id}:${id}`);
    } catch (cause) {
      // A close or capture may have committed even if its response was interrupted.
      await onRefresh().catch(() => undefined);
      throw cause;
    } finally {
      demoInFlight.current = false;
      setDemoRunning(false);
    }
  }

  return (
    <section className="incident-learning" aria-label="Learning Database">
      <div className="knowledge-demo-workspace">
        <details
          className="knowledge-contribution"
          open={contributionOpen}
          onToggle={(event) => setContributionOpen(event.currentTarget.open)}
        >
          <summary>Conclusion & save</summary>
          <div className="knowledge-contribution-body">
            <IncidentReview
              incident={incident}
              busy={busy || saving || demoRunning}
              onAction={onAction}
              onDemo={
                access.mode === "demo" && canCapture ? recordDemo : undefined
              }
              demoDisabled={loading || !!error || !evidence.length}
              demoRunning={demoRunning}
            />
            <aside
              className="knowledge-capture-panel"
              aria-label="New knowledge from this investigation"
            >
              <details className="knowledge-capture-fields" open={reviewed}>
                <summary>Save a finding</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      canSave &&
                      !saving &&
                      !busy &&
                      !demoRunning &&
                      !loading &&
                      !error &&
                      !existing &&
                      linkedEvidenceIds.length
                    )
                      void save();
                  }}
                >
                  <label>
                    Knowledge title
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label>
                    New knowledge
                    <textarea
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      rows={3}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <details className="knowledge-capture-evidence">
                    <summary>
                      Linked evidence · {linkedEvidenceIds.length}
                    </summary>
                    {evidence.map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={evidenceIds.includes(item.id)}
                          onChange={(event) =>
                            setEvidenceIds((ids) =>
                              event.target.checked
                                ? [...ids, item.id]
                                : ids.filter((id) => id !== item.id),
                            )
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                    {!evidence.length && (
                      <p>Collect source evidence before saving a finding.</p>
                    )}
                  </details>
                  {saveError && <p role="alert">{saveError}</p>}
                  <button
                    className="knowledge-demo-save"
                    type="submit"
                    disabled={
                      !canSave ||
                      saving ||
                      busy ||
                      demoRunning ||
                      loading ||
                      !!error ||
                      !!existing ||
                      !title.trim() ||
                      !summary.trim() ||
                      !linkedEvidenceIds.length
                    }
                  >
                    {saving ? (
                      <ArrowsClockwise aria-hidden="true" />
                    ) : existing ? (
                      <CheckCircle aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                    {saving ? "Saving knowledge…" : "Save knowledge"}
                    <ArrowRight aria-hidden="true" />
                  </button>
                  {existing && (
                    <p className="knowledge-saved-inline">
                      <CheckCircle aria-hidden="true" /> This finding is saved
                      in the graph.
                    </p>
                  )}
                  {(existing || arrived) && (
                    <button
                      className="knowledge-replay"
                      type="button"
                      onClick={() =>
                        showArrival((existing ?? arrived)!.graphId)
                      }
                    >
                      <Play aria-hidden="true" /> Replay animation
                    </button>
                  )}
                  {!canCapture && (
                    <p className="incident-muted">
                      Demo capture requires edit access and a replay or
                      synthetic investigation.
                    </p>
                  )}
                  <p className="knowledge-capture-note">
                    Demo draft · publication requires review.
                  </p>
                </form>
              </details>
              {!reviewed && (
                <p className="knowledge-capture-note" role="status">
                  Record a conclusion or an inconclusive outcome before saving
                  knowledge.{" "}
                  <a href="#knowledge-review">Complete the review above</a>.
                </p>
              )}
            </aside>
          </div>
        </details>
        <div className="knowledge-base">
          <header className="incident-learning-heading">
            <div>
              <h2 id="incident-learning-title">Knowledge base</h2>
            </div>
            <button
              className="secondary"
              aria-label="Refresh database"
              disabled={loading || saving || demoRunning}
              onClick={() => {
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              <ArrowsClockwise aria-hidden="true" /> Refresh
            </button>
          </header>
          {error && (
            <p className="knowledge-load-error" role="alert">
              {error}{" "}
              <button
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry database
              </button>
            </p>
          )}
          <section
            ref={map}
            className="knowledge-global-stage"
            aria-label="Overall knowledge graph"
            data-arrival={arrived ? "saved" : "idle"}
          >
            {loading && <p role="status">Loading knowledge…</p>}
            <KnowledgeGraph
              graph={graph}
              connectivity={connectivity}
              selected={selected}
              onSelect={setSelected}
              arrival={arrival}
              preserveLayout
            />
            {arrived && (
              <div
                className="knowledge-arrival-notice"
                role="status"
                key={arrival?.sequence ?? 0}
              >
                <>
                  <CheckCircle aria-hidden="true" />
                  <div>
                    <strong>New knowledge added</strong>
                    <span>{arrived.title}</span>
                  </div>
                  <b>
                    +{connectivity.get(arrived.graphId)?.connections ?? 0}{" "}
                    connections
                  </b>
                </>
              </div>
            )}
            {arrived && (
              <details
                className="knowledge-linked-library"
                aria-label="Connections to the main library"
              >
                <summary>
                  {arrivalLibraryLinks.length
                    ? "Linked to existing knowledge"
                    : "No matching library topics yet"}
                </summary>
                {arrivalLibraryLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => setSelected(link.id)}
                    title={`${link.relation}: ${graph.nodes.find((item) => item.id === link.target)?.label}`}
                  >
                    <CheckCircle aria-hidden="true" />
                    {graph.nodes.find((item) => item.id === link.target)?.label}
                  </button>
                ))}
                <small>Context matches · finding pending review</small>
              </details>
            )}
          </section>
          <div className="knowledge-library-details">
            <details ref={findingsPanel} className="knowledge-saved-findings">
              <summary>Saved findings ({findings.length})</summary>
              <section aria-label="Captured knowledge">
                <div className="incident-section-title">
                  <h3>
                    Captured knowledge <span>{findings.length}</span>
                  </h3>
                  <label className="sr-only" htmlFor="knowledge-search">
                    Search captured knowledge
                  </label>
                  <input
                    id="knowledge-search"
                    type="search"
                    placeholder="Find a discovery"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                {!matching.length && (
                  <p className="incident-muted">
                    {findings.length
                      ? "No findings match this search."
                      : "Your first discovery will appear here with its source investigation."}
                  </p>
                )}
                <ul className="knowledge-findings-list">
                  {matching.map((finding) => (
                    <li key={finding.graphId}>
                      <button
                        onClick={() => setSelected(finding.graphId)}
                        aria-pressed={selected === finding.graphId}
                      >
                        <span className="knowledge-finding-icon">
                          <Database aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{finding.title}</strong>
                          <small>
                            {finding.incident.id} · Demo · Pending review
                          </small>
                        </span>
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <details className="knowledge-supporting">
                <summary>Sources & past investigations</summary>
                <PastIncidents incident={incident} />
                <KnowledgeRegistry configuration={incident.configuration} />
                {children}
              </details>
            </details>
            {selected && (
              <aside aria-label="Selected knowledge details">
                <button
                  className="knowledge-inspector-close"
                  aria-label="Close knowledge details"
                  onClick={() => setSelected("")}
                >
                  <X aria-hidden="true" />
                </button>
                <h3>
                  {node?.label ?? edge?.relation ?? "Knowledge with context"}
                </h3>
                <p className="knowledge-detail-text">
                  {node?.detail ??
                    (edge
                      ? `${edge.citation}${edge.matched_text ? `\nContext match: ${edge.matched_text}. This association does not establish a cause.` : ""}${edge.evidence_ids.length ? `\n${edge.evidence_ids.join(", ")}` : ""}`
                      : "Select any node or connection to inspect its source. Saved findings link to their investigation and matching topics in the shared library.")}
                </p>
                {selectedFinding && (
                  <>
                    <p>
                      Source revision {selectedFinding.source_revision} ·{" "}
                      {selectedFinding.evidence_ids.length} evidence references
                    </p>
                    <ul>
                      {selectedFinding.source_refs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                    <a
                      href={incidentPageUrl(
                        selectedFinding.incident.id,
                        "investigation",
                      )}
                      onClick={followLink}
                    >
                      Open source investigation{" "}
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
