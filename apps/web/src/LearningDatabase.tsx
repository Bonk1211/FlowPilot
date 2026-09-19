import { useCallback, useEffect, useState } from "react";
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
import { KnowledgeReview } from "./components/KnowledgeReview";
import { humanize, knowledgeState } from "./presentation";
import "./knowledge.css";

const initial = new URLSearchParams(window.location.search);
export function LearningDatabase() {
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [q, setQ] = useState("");
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
  const related = node?.case_ids ?? (edge ? [edge.case_id] : []);
  function showRecords(nextStatus: string) {
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
            <p>Every case adds context. Reviewed experience guides the next.</p>
          </div>
          <div
            className="learning-counts"
            aria-label="Database totals"
            aria-busy={loading}
          >
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
              <h2>Case records</h2>
            </div>
            <label className="learning-search">
              <span>Search database</span>
              <span>
                <MagnifyingGlass aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Symptom, lesson or case"
                />
              </span>
            </label>
            <label>
              Experience status
              <select
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
            <p className="learning-result-count" role="status">
              {loading
                ? "Updating database view…"
                : `${overview?.total_matching ?? 0} matching record groups`}
            </p>
            <ul className="learning-case-list">
              {overview?.cases.map((item) => (
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
            {overview?.truncated && (
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
            <p className="learning-footnote">
              One case is one record. Equivalent simulated experiences are
              grouped; counts are not success probabilities.
            </p>
          </aside>
          <section className="learning-map" aria-label="Learning graph">
            {overview?.graph.nodes.length ? (
              <KnowledgeGraph
                graph={overview.graph}
                selected={selected}
                onSelect={choose}
              />
            ) : (
              <div className="learning-empty">
                <Database aria-hidden="true" />
                <h2>
                  {loading
                    ? "Loading your database…"
                    : overview?.saved_cases
                      ? "No records match these filters"
                      : "Your experience starts with a case"}
                </h2>
                <p>
                  {overview?.saved_cases
                    ? "Adjust the search or filters to explore recorded connections."
                    : "Saved investigations will appear here. Confirmed findings become drafts for review before AI reuse."}
                </p>
                {!overview?.saved_cases && !loading && (
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
                    "This connection retains the case and evidence that support it."}
                </p>
                {edge && (
                  <>
                    <span className="knowledge-state">
                      {humanize(edge.status)}
                    </span>
                    <p className="mono">{edge.citation}</p>
                    <p>
                      Evidence:{" "}
                      {edge.evidence_ids.join(", ") || "Process context only"}
                    </p>
                  </>
                )}
                <h3>Related investigations</h3>
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
                  Select a case, symptom or relationship to explore its evidence
                  and review status.
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
