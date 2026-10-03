import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
  Database,
  MagnifyingGlass,
  Files,
  SealCheck,
  ClockCountdown,
  FileText,
  GitBranch,
  ArrowRight,
} from "@phosphor-icons/react";
import type {
  Case,
  KnowledgeEntry,
  LibraryOverview,
  SourcePassage,
} from "@flowpilot/contracts";
import {
  draftKnowledge,
  knowledgeForCase,
  loadCase,
  loadKnowledge,
  loadLearningDatabase,
} from "./api";
import { ApplicationFrame } from "./components/ApplicationFrame";
import { KnowledgeGraph } from "./components/KnowledgeGraph";
import { graphConnectivity } from "./knowledgeGraph";
import { KnowledgeReview } from "./components/KnowledgeReview";
import { humanize, knowledgeState } from "./presentation";
import "./knowledge.css";

const initial = new URLSearchParams(window.location.search);
export function LearningDatabase() {
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [q, setQ] = useState("");
  const [layer, setLayer] = useState("all");
  const [status, setStatus] = useState("all");
  const [process, setProcess] = useState("");
  const [symptom, setSymptom] = useState("");
  const [limit, setLimit] = useState(40);
  const [selected, setSelected] = useState(
    initial.get("source") ? `case:${initial.get("source")}` : "",
  );
  const [caseId, setCaseId] = useState(initial.get("source") ?? "");
  const [directEntry, setDirectEntry] = useState(initial.get("entry") ?? "");
  const [requestedVersion, setRequestedVersion] = useState<number | undefined>(
    Number(initial.get("version")) || undefined,
  );
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [source, setSource] = useState<Case | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(
    !!(initial.get("source") || initial.get("entry")),
  );
  const [attempt, setAttempt] = useState(0);
  const [detailRequest, setDetailRequest] = useState(0);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void loadLearningDatabase({
        q,
        status,
        process,
        symptom,
        limit: String(limit),
      })
        .then((value) => {
          if (active) {
            setOverview((previous) =>
              JSON.stringify(previous) === JSON.stringify(value)
                ? previous
                : value,
            );
            setError("");
          }
        })
        .catch((failure) => {
          if (active)
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not load the database.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, status, process, symptom, limit, attempt]);
  useEffect(() => {
    let active = true;
    if (!caseId && !directEntry) return;
    const read = async () => {
      const knowledge = directEntry
        ? await loadKnowledge(directEntry)
        : await knowledgeForCase(caseId);
      const value = await loadCase(knowledge?.source_case_id ?? caseId);
      if (active) {
        setEntry(knowledge);
        setSource(value);
        setDetailError("");
      }
    };
    void read()
      .catch((failure) => {
        if (active)
          setDetailError(
            failure instanceof Error
              ? failure.message
              : "Could not load the record.",
          );
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId, directEntry, attempt, detailRequest]);
  useEffect(() => {
    if (entry?.generation?.mode !== "pending") return;
    const timer = window.setInterval(refresh, 2500);
    return () => window.clearInterval(timer);
  }, [entry?.generation?.mode, refresh]);
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const choose = useCallback((id: string) => {
    if (id.startsWith("case:"))
      setLayer((current) => (current === "reference" ? "all" : current));
    setRequestedVersion(undefined);
    setDetailRequest((n) => n + 1);
    setDetailLoading(id.startsWith("case:"));
    setDetailError("");
    setEntry(null);
    setSource(null);
    setSelected(id);
    setDirectEntry("");
    setCaseId(id.startsWith("case:") ? id.slice(5) : "");
    setNotice("");
    window.history.replaceState(
      null,
      "",
      id.startsWith("case:")
        ? `/knowledge?source=${encodeURIComponent(id.slice(5))}`
        : "/knowledge",
    );
  }, []);
  const node = overview?.graph.nodes.find((n) => n.id === selected);
  const edge = overview?.graph.edges.find((e) => e.id === selected);
  const edgeSource = overview?.graph.nodes.find(
    (item) => item.id === edge?.source,
  );
  const related =
    node?.case_ids ??
    (edge?.case_id ? [edge.case_id] : (edgeSource?.case_ids ?? []));
  const topicReferences = node
    ? (overview?.graph.edges
        .filter(
          (item) => item.source_type === "reference" && item.target === node.id,
        )
        .flatMap(
          (item) =>
            overview.graph.nodes
              .find((value) => value.id === item.source)
              ?.sources?.filter((value) => value.id === item.citation) ?? [],
        ) ?? [])
    : [];
  const references = node?.sources?.length
    ? node.sources
    : edge?.source_type === "reference"
      ? (edgeSource?.sources?.filter((item) => item.id === edge.citation) ?? [])
      : [...new Map(topicReferences.map((item) => [item.id, item])).values()];
  const graph = useMemo(() => {
    const original = overview?.graph;
    if (!original || layer === "all") return original;
    const edges = original.edges.filter((item) =>
      layer === "reference"
        ? item.source_type === "reference"
        : item.source_type !== "reference",
    );
    const connected = new Set(
      edges.flatMap((item) => [item.source, item.target]),
    );
    return {
      edges,
      nodes: original.nodes.filter((item) =>
        layer === "reference"
          ? item.source_type === "reference" || connected.has(item.id)
          : item.source_type !== "reference",
      ),
    };
  }, [overview, layer]);
  const connectivity = useMemo(
    () => graphConnectivity(overview?.graph ?? { nodes: [], edges: [] }),
    [overview],
  );
  function showRecords(nextStatus: string) {
    setLayer("experience");
    setQ("");
    setProcess("");
    setSymptom("");
    setStatus(nextStatus);
  }
  function changed(value: KnowledgeEntry) {
    setRequestedVersion(undefined);
    setEntry(value);
    setNotice(
      value.status === "published"
        ? "Available to AI. New diagnoses can now use this experience."
        : `${knowledgeState(value.status)}. The database has been updated.`,
    );
    refresh();
  }
  return (
    <ApplicationFrame
      phase="Learning Database"
      showPhaseRail={false}
      showDemoBadge={false}
    >
      <main id="main" className="learning-workspace" tabIndex={-1}>
        <header className="learning-masthead">
          <div className="learning-title-block">
            <a href="/" className="learning-back">
              <ArrowLeft aria-hidden="true" /> Investigation workspace
            </a>
            <h1>
              Learning Database
              <span className="learning-title-dot" aria-hidden="true" />
            </h1>
            <p>
              Explore reference knowledge and case experience through shared
              topics.
            </p>
          </div>
          <div
            className="learning-counts"
            aria-label="Database totals"
            aria-busy={loading}
          >
            <button
              className="learning-stat stat-reference"
              onClick={() => {
                choose("");
                setLayer("reference");
              }}
              aria-label="Show reference knowledge"
            >
              <FileText aria-hidden="true" />
              <strong>{overview?.reference_passages ?? "—"}</strong>
              <span>Reference passages</span>
            </button>
            <button
              className="learning-stat"
              onClick={() => showRecords("all")}
              aria-label="Show all saved cases"
            >
              <Files aria-hidden="true" />
              <strong>{overview?.saved_cases ?? "—"}</strong>
              <span>Saved cases</span>
            </button>
            <button
              className="learning-stat stat-reusable"
              onClick={() => showRecords("published")}
              aria-label="Show reusable experiences"
            >
              <SealCheck aria-hidden="true" />
              <strong>{overview?.reusable_experiences ?? "—"}</strong>
              <span>Reusable experiences</span>
            </button>
            <button
              className="learning-stat stat-pending"
              onClick={() => showRecords("draft")}
              aria-label="Show pending review records"
            >
              <ClockCountdown aria-hidden="true" />
              <strong>{overview?.pending_review ?? "—"}</strong>
              <span>Pending review</span>
            </button>
          </div>
        </header>
        <div className="learning-lifecycle" aria-label="Experience lifecycle">
          <span>
            <b>01</b>
            <span>
              Save a case<small>Photos, logs & findings</small>
            </span>
          </span>
          <ArrowRight aria-hidden="true" />
          <span>
            <b>02</b>
            <span>
              Prepare experience<small>Gemini or evidence template</small>
            </span>
          </span>
          <ArrowRight aria-hidden="true" />
          <span>
            <b>03</b>
            <span>
              Review & publish<small>Technician confirmation</small>
            </span>
          </span>
          <ArrowRight aria-hidden="true" />
          <span>
            <b>04</b>
            <span>
              Reuse in diagnosis<small>Relevant cases, with sources</small>
            </span>
          </span>
          <button
            className="secondary"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh database"
          >
            <ArrowsClockwise aria-hidden="true" />
          </button>
        </div>
        {error && (
          <div role="alert" className="knowledge-warning">
            {error}{" "}
            <button className="secondary" onClick={refresh}>
              Retry database
            </button>
          </div>
        )}
        {notice && (
          <p className="knowledge-notice" role="status">
            {notice}
          </p>
        )}
        <div className="learning-shell">
          <aside className="learning-browser" aria-label="Database browser">
            <div className="learning-pane-heading">
              <p className="eyebrow">01 / Find</p>
              <h2>Knowledge sources</h2>
            </div>
            <label>
              Knowledge layers
              <select
                value={layer}
                onChange={(event) => {
                  choose("");
                  setLayer(event.target.value);
                }}
              >
                <option value="all">References + experience</option>
                <option value="reference">Reference knowledge</option>
                <option value="experience">Case experience</option>
              </select>
            </label>
            <label className="learning-search">
              <span>Search database</span>
              <span>
                <MagnifyingGlass aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Topic, reference or case"
                />
              </span>
            </label>
            <label>
              Experience status
              <select
                disabled={layer === "reference"}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All records</option>
                <option value="recorded">Saved, no experience yet</option>
                <option value="draft">Pending review</option>
                <option value="published">Available to AI</option>
                <option value="disputed">Disputed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <details className="learning-more-filters">
              <summary>
                More filters{(process || symptom) && " · active"}
              </summary>
              <label>
                Process
                <select
                  value={process}
                  onChange={(event) => setProcess(event.target.value)}
                >
                  <option value="">All processes</option>
                  {overview?.processes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Symptom
                <select
                  value={symptom}
                  onChange={(event) => setSymptom(event.target.value)}
                >
                  <option value="">All symptoms</option>
                  {[
                    "incomplete_coverage",
                    "coarse_deposits",
                    "shifted_pattern",
                    "overspray",
                  ].map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </label>
            </details>
            {layer !== "experience" && (
              <section
                className="learning-reference-browser"
                aria-label="Reference documents"
              >
                <h3>References · {overview?.reference_documents ?? 0}</h3>
                {overview?.graph.nodes
                  .filter((item) => item.kind === "Reference document")
                  .map((item) => (
                    <button
                      className="graph-list-button"
                      key={item.id}
                      aria-pressed={selected === item.id}
                      onClick={() => choose(item.id)}
                    >
                      <span className="knowledge-state draft">
                        {humanize(
                          item.sources?.[0]?.approval_status ?? "unverified",
                        )}
                      </span>
                      <strong>{item.label}</strong>
                      <span>
                        {item.sources?.length ?? 0} passages ·{" "}
                        {item.indexed_passages ?? 0} indexed
                      </span>
                    </button>
                  ))}
                {!overview?.reference_documents && !loading && (
                  <p>No references registered yet.</p>
                )}
              </section>
            )}
            {layer !== "reference" && <h3>Case experience</h3>}
            <p className="learning-result-count" role="status">
              {loading
                ? "Updating database view…"
                : layer === "reference"
                  ? `${graph?.nodes.filter((item) => item.kind === "Reference section").length ?? 0} matching reference sections`
                  : `${overview?.total_matching ?? 0} matching record groups`}
            </p>
            <ul className="learning-case-list">
              {layer !== "reference" &&
                overview?.cases.map((item) => (
                  <li key={item.id}>
                    <button
                      className="graph-list-button"
                      aria-pressed={
                        caseId === item.id ||
                        (source?.investigation.id === item.id && !!directEntry)
                      }
                      onClick={() => choose(`case:${item.id}`)}
                    >
                      <span
                        className={`knowledge-state ${item.knowledge_status}`}
                      >
                        {knowledgeState(item.knowledge_status)}
                      </span>
                      <strong>{item.title}</strong>
                      <span>
                        {item.symptoms.map(humanize).join(" · ") ||
                          "Symptom not yet recorded"}
                      </span>
                      {item.group_size > 1 && (
                        <span>
                          {item.group_size} equivalent simulated records
                        </span>
                      )}
                      <div className="case-record-meta">
                        <span className="mono">{item.id.slice(-8)}</span>
                        <time>
                          {new Date(item.updated_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                        </time>
                      </div>
                    </button>
                  </li>
                ))}
            </ul>
            {layer !== "reference" && overview?.truncated && (
              <button
                className="secondary"
                disabled={limit >= 100}
                onClick={() => setLimit(Math.min(100, limit + 30))}
              >
                {limit >= 100
                  ? "Narrow filters to see more"
                  : "Load more records"}
              </button>
            )}
            {layer !== "reference" && (
              <p className="learning-footnote">
                One case is one record. Equivalent simulated experiences are
                grouped; counts are not success probabilities.
              </p>
            )}
          </aside>
          <section className="learning-map" aria-label="Learning graph">
            {graph?.nodes.length ? (
              <KnowledgeGraph
                graph={graph}
                connectivity={connectivity}
                selected={selected}
                onSelect={choose}
              />
            ) : (
              <div className="learning-empty">
                <Database aria-hidden="true" />
                <h2>
                  {loading
                    ? "Loading your database…"
                    : overview?.saved_cases || overview?.reference_documents
                      ? "No records match these filters"
                      : "Your experience starts with a case"}
                </h2>
                <p>
                  {overview?.saved_cases || overview?.reference_documents
                    ? "Adjust the search or filters to explore recorded connections."
                    : "Saved investigations will appear here. Confirmed findings become drafts for review before AI reuse."}
                </p>
                {!overview?.saved_cases &&
                  !overview?.reference_documents &&
                  !loading && (
                    <a className="primary" href="/">
                      Start an investigation
                    </a>
                  )}
              </div>
            )}
          </section>
          <aside className="learning-inspector" aria-label="Selected record">
            <div className="learning-pane-heading inspector-pane-heading">
              <div>
                <p className="eyebrow">03 / Understand</p>
                <h2>Evidence & review</h2>
              </div>
              <FileText aria-hidden="true" />
            </div>
            {node && (
              <p className="reference-limitation" aria-label="Node connections">
                {connectivity.get(node.id)?.connections ?? 0} unique connections
                in the current search. Node size reflects these connections.
              </p>
            )}
            {detailError && (
              <p role="alert" className="knowledge-warning">
                {detailError}{" "}
                <button className="secondary" onClick={refresh}>
                  Reload experience
                </button>
              </p>
            )}
            {caseId || directEntry ? (
              detailLoading ? (
                <p role="status">Loading source and experience…</p>
              ) : entry ? (
                <KnowledgeReview
                  key={`${entry.id}-${entry.revision}`}
                  entry={entry}
                  initialVersion={requestedVersion}
                  onChanged={changed}
                />
              ) : source ? (
                <section>
                  <span className="knowledge-state">Saved to database</span>
                  <h2>{source.investigation.title}</h2>
                  <p>{humanize(source.investigation.state)}</p>
                  <p>
                    This case is retained. A confirmed inspection is needed
                    before preparing reusable experience.
                  </p>
                  <a href={`/?case=${source.investigation.id}`}>
                    Continue investigation →
                  </a>
                  {source.investigation.evidence?.some(
                    (e) =>
                      e.key === "inspection" &&
                      e.verification_state === "verified",
                  ) && (
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          changed(
                            await draftKnowledge(
                              source.investigation.id,
                              source.revision,
                              "system",
                            ),
                          );
                        } catch (failure) {
                          setDetailError(
                            failure instanceof Error
                              ? failure.message
                              : "Could not prepare experience.",
                          );
                        }
                      }}
                    >
                      Prepare experience from saved case
                    </button>
                  )}
                </section>
              ) : null
            ) : node || edge ? (
              <section className="relationship-inspector">
                <p className="eyebrow">
                  {node?.kind ?? "Recorded relationship"}
                </p>
                <h2>{node?.label ?? edge?.relation}</h2>
                <p>
                  {node?.detail ??
                    (edge?.source_type === "reference"
                      ? "This connection cites reference text associated with a shared topic."
                      : "This connection retains the case and evidence that support it.")}
                </p>
                {edge && (
                  <>
                    <span className="knowledge-state">
                      {humanize(edge.status)}
                    </span>
                    <p className="mono">{edge.citation}</p>
                    <p>
                      Evidence:{" "}
                      {edge.source_type === "reference"
                        ? "Reference text association"
                        : edge.evidence_ids.join(", ") ||
                          "Process context only"}
                    </p>
                    {edge.matched_text && (
                      <p>
                        Matched phrase: <strong>{edge.matched_text}</strong>.
                        This topic connection does not confirm a cause.
                      </p>
                    )}
                  </>
                )}
                {node?.kind === "Reference document" && (
                  <section aria-label="Reference sections">
                    <h3>Explore sections</h3>
                    {overview?.graph.edges
                      .filter((item) => item.source === node.id)
                      .map((item) => (
                        <button
                          className="graph-list-button"
                          key={item.id}
                          onClick={() => choose(item.target)}
                        >
                          {
                            overview.graph.nodes.find(
                              (value) => value.id === item.target,
                            )?.label
                          }
                        </button>
                      ))}
                  </section>
                )}
                {!!references.length && (
                  <ReferenceDetails
                    sources={references}
                    indexed={
                      node?.source_type === "reference"
                        ? node.indexed_passages
                        : undefined
                    }
                  />
                )}
                {!!related.length && <h3>Related investigations</h3>}
                {related.map((id) => (
                  <button
                    className="graph-list-button"
                    key={id}
                    onClick={() => choose(`case:${id}`)}
                  >
                    {overview?.cases.find((c) => c.id === id)?.title ?? id}
                    <span>Open evidence and review →</span>
                  </button>
                ))}
              </section>
            ) : (
              <div className="inspector-empty">
                <div className="inspector-empty-icon">
                  <GitBranch aria-hidden="true" />
                </div>
                <p className="eyebrow">Follow a connection</p>
                <h2>The story behind each node.</h2>
                <p>
                  Select a reference section, case, shared topic or relationship
                  to explore its sources and review status.
                </p>
                <ol className="inspector-guide">
                  <li>
                    <strong>Choose a case or connection</strong>
                    <span>See the original evidence.</span>
                  </li>
                  <li>
                    <strong>Check what is known</strong>
                    <span>Findings stay separate from hypotheses.</span>
                  </li>
                  <li>
                    <strong>Review before AI reuse</strong>
                    <span>Drafts only become reusable after publication.</span>
                  </li>
                </ol>
              </div>
            )}
            {source &&
              (caseId || directEntry) &&
              (overview?.cases.find((c) => c.id === source.investigation.id)
                ?.group_size ?? 1) > 1 && (
                <details>
                  <summary>Equivalent source records</summary>
                  {overview?.cases
                    .find((c) => c.id === source.investigation.id)
                    ?.group_case_ids?.map((id) => (
                      <button
                        className="graph-list-button"
                        key={id}
                        onClick={() => choose(`case:${id}`)}
                      >
                        {id}
                      </button>
                    ))}
                </details>
              )}
          </aside>
        </div>
      </main>
    </ApplicationFrame>
  );
}

function ReferenceDetails({
  sources,
  indexed,
}: {
  sources: SourcePassage[];
  indexed?: number;
}) {
  const groups = new Map<string, SourcePassage[]>();
  for (const source of sources) {
    const key = `${source.document_id}:${source.revision}`;
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  if (groups.size > 1)
    return (
      <>
        {[...groups].map(([key, group]) => (
          <ReferenceDetails key={key} sources={group} />
        ))}
      </>
    );
  const first = sources[0];
  return (
    <section className="reference-inspector" aria-label="Reference evidence">
      <span
        className={`knowledge-state ${first.approval_status === "approved" ? "published" : "draft"}`}
      >
        {humanize(first.approval_status)}
      </span>
      <dl className="knowledge-facts">
        <div>
          <dt>Source</dt>
          <dd>{first.title}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{first.revision}</dd>
        </div>
        <div>
          <dt>Authority</dt>
          <dd>{humanize(first.authority)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{first.file_path}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{first.configurations.join(" · ")}</dd>
        </div>
        {indexed !== undefined && (
          <div>
            <dt>Index</dt>
            <dd>{indexed} indexed passages</dd>
          </div>
        )}
      </dl>
      <p className="reference-limitation">{first.limitation}</p>
      <h3>Exact reference passages</h3>
      {sources.map((source) => (
        <details key={source.id}>
          <summary>{source.section}</summary>
          <blockquote>{source.passage}</blockquote>
          <p className="mono">{source.id}</p>
        </details>
      ))}
    </section>
  );
}
