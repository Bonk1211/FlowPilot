import { useEffect, useRef, useState } from "react";
import type {
  Case,
  CaseAction,
  CaseListItem,
  DemoScenario,
  IngestionResult,
  LogPreviewRequest,
  Measurement,
  VisionAssessment,
} from "@flowpilot/contracts";
import {
  actOnCase,
  createCase,
  loadCase,
  loadImages,
  listCases,
  explainCase,
  loadScenario,
  previewLog,
  resetDemo,
} from "./api";
import { ApplicationFrame } from "./components/ApplicationFrame";
import { EvidencePreview } from "./components/EvidencePreview";
import { EventViewer } from "./components/EventViewer";
import { EvidenceCorrection } from "./components/EvidenceCorrection";
import { candidateValue, humanize } from "./presentation";
import "./prototype/prototype.css";
import "./case.css";
import { sampleNames, emptyRecovery } from "./fluxModel";
import { SprayMeasurement as ImageMeasurement } from "./components/SprayMeasurement";
import { RecoveryForm } from "./components/RecoveryForm";
import { DiagnosticHistory, SummaryEvidence } from "./components/CaseAudit";
import { CaseNavigator } from "./components/CaseNavigator";
import {
  GuidanceComposer,
  type GuidanceExchange,
} from "./components/GuidanceComposer";
import { InspectionGuide } from "./components/InspectionGuide";
import { WorkflowStatus } from "./components/WorkflowStatus";
import "./workflow.css";
import { PhotoInput } from "./components/PhotoAnalysis";
import { ReportIntake, IntakeEvidenceSummary } from "./components/ReportIntake";
import {
  PastExperiencePanel,
  KnowledgeCapture,
} from "./components/PastExperience";

type WithoutRevision<T> = T extends unknown ? Omit<T, "revision"> : never;
type Command = WithoutRevision<CaseAction>;
const defaultReport =
  "The latest inspected tray has declining flux spray coverage.";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "The request failed. Try again.";
function Diagnosis({
  value,
  onCorrect,
}: {
  value: Case;
  onCorrect: (action: Command) => Promise<void>;
}) {
  const [source, setSource] = useState("all");
  const [verification, setVerification] = useState("all");
  const [citationTarget, setCitationTarget] = useState<{ id: string } | null>(
    null,
  );
  useEffect(() => {
    if (!citationTarget) return;
    const target = document.getElementById(citationTarget.id);
    let ancestor = target?.parentElement;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center" });
  }, [citationTarget]);
  function revealEvidence(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    event.preventDefault();
    setSource("all");
    setVerification("all");
    setCitationTarget({ id });
    window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }
  const inspection = value.investigation.evidence?.find(
    (e) => e.key === "inspection" && e.verification_state === "verified",
  );
  const locked = value.investigation.evidence?.some(
    (e) => e.key === "inspection" && e.verification_state === "verified",
  );
  return (
    <>
      <div className="diagnosis-briefing">
        <section
          className="diagnosis-key-evidence"
          aria-label="Current assessment"
        >
          <p className="eyebrow">Current assessment</p>
          <h2>{value.ranking[0]?.label ?? "Awaiting evidence"}</h2>
          <p>
            {value.ranking[0]?.confirmed
              ? "Inspection finding confirmed. Recovery still requires verification."
              : inspection?.value === "no_obstruction_found"
                ? "No nozzle obstruction found. Other causes remain unconfirmed."
                : "Working hypothesis · current-case evidence still requires inspection."}
          </p>
          <ul>
            {value.ranking[0]?.contributions
              .filter((c) => c.weight > 0)
              .slice(0, 2)
              .map((c) => (
                <li key={c.evidence_id}>{c.explanation}</li>
              ))}
          </ul>
        </section>
        <PastExperiencePanel
          value={value}
          onRefresh={() => {
            void onCorrect({ action: "refresh_knowledge" });
          }}
        />
      </div>
      <IntakeEvidenceSummary value={value} />
      <div className="prototype-diagnosis">
        <section aria-label="Evidence ledger">
          <p className="eyebrow">01 / Evidence</p>
          <h2>What we know</h2>
          <details className="diagnosis-disclosure">
            <summary>
              Review {value.investigation.evidence?.length ?? 0} recorded
              observations
            </summary>
            <div className="evidence-filters">
              <label>
                Evidence source
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="all">All sources</option>
                  {[
                    ...new Set(
                      (value.investigation.evidence ?? []).map(
                        (e) => e.source_type,
                      ),
                    ),
                  ].map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence status
                <select
                  value={verification}
                  onChange={(e) => setVerification(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {["verified", "provisional", "rejected"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {locked && (
              <p>
                Evidence is locked after confirmed inspection. Start another
                case for later corrections.
              </p>
            )}
            {value.investigation.evidence
              ?.filter(
                (e) =>
                  (source === "all" || e.source_type === source) &&
                  (verification === "all" ||
                    e.verification_state === verification),
              )
              .map((e) => (
                <article
                  className="prototype-ledger-row"
                  key={e.id}
                  id={e.id}
                  tabIndex={-1}
                >
                  <span className="status">
                    {humanize(e.verification_state)}
                  </span>
                  <h3>{humanize(e.key)}</h3>
                  <p>{candidateValue(e)}</p>
                  <small>
                    {e.id} · {humanize(e.source_type)}
                  </small>
                  <details>
                    <summary>Source reference</summary>
                    <p>{e.source_ref}</p>
                    <time>{e.timestamp}</time>
                  </details>
                  {!locked && e.verification_state !== "rejected" && (
                    <EvidenceCorrection evidence={e} onCorrect={onCorrect} />
                  )}
                </article>
              ))}
            <p>
              Missing telemetry stays unknown. Machine PASS is a run-status
              fact, not a product-quality result.
            </p>
          </details>
        </section>
        <section>
          <p className="eyebrow">Possible causes</p>
          <h2>Ranked causes</h2>
          <p>
            Diagnostic points, not probabilities. Rules v{value.rules_version}.
          </p>
          <p className="diagnosis-intro">
            These are working hypotheses. An inspection is needed to confirm a
            cause. Expand a cause to see its evidence.
          </p>
          {value.ranking.map((cause, index) => (
            <article className="prototype-cause" key={cause.hypothesis_id}>
              <details>
                <summary className="cause-summary">
                  <h3>
                    {index + 1}. {cause.label}
                  </h3>
                  <span>
                    <strong>{cause.score} points</strong> ·{" "}
                    {cause.confirmed ? "Confirmed" : "Unconfirmed"}
                  </span>
                </summary>
                <ul>
                  {cause.contributions.map((c, i) => (
                    <li key={i}>
                      <a
                        href={`#${c.evidence_id}`}
                        onClick={(event) =>
                          revealEvidence(event, c.evidence_id)
                        }
                      >
                        {c.evidence_id}
                      </a>{" "}
                      {c.weight > 0 ? "+" : ""}
                      {c.weight}: {c.explanation}
                    </li>
                  ))}
                </ul>
                <p>
                  Missing: {cause.missing_evidence.join(", ") || "None listed"}
                </p>
              </details>
            </article>
          ))}
          <details className="reasoning-disclosure">
            <summary>How this diagnosis was generated</summary>
            <h3>
              {value.findings_mode === "live"
                ? "Live specialist and critic findings"
                : "Cached specialist and critic findings"}
            </h3>
            <p>
              {value.reasoning?.mode === "live"
                ? `Gemini ${value.reasoning.model} · reviewed by the diagnostic critic.`
                : `Deterministic templates. ${value.reasoning?.fallback_reason ?? "Live reasoning has not run."}`}
            </p>
            {value.reasoning && (
              <details>
                <summary>Reasoning run</summary>
                <p>
                  Evidence revision {value.reasoning.evidence_revision} · prompt{" "}
                  {value.reasoning.prompt_version} · {value.reasoning.timestamp}
                </p>
                {value.reasoning.critic && (
                  <p>
                    Critic:{" "}
                    {value.reasoning.critic.accepted ? "Accepted" : "Rejected"}.{" "}
                    {value.reasoning.critic.reasons.join(" ")}
                  </p>
                )}
              </details>
            )}
            {value.findings.map((finding, i) => (
              <details key={i}>
                <summary>
                  {humanize(finding.agent)} · {humanize(finding.hypothesis_id)}
                </summary>
                <p>{finding.summary}</p>
                <p>
                  Supporting:{" "}
                  {finding.supporting_evidence_ids.map((id) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      onClick={(event) => revealEvidence(event, id)}
                    >
                      {id}{" "}
                    </a>
                  ))}
                </p>
                <p>
                  Conflicting:{" "}
                  {finding.conflicting_evidence_ids.map((id) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      onClick={(event) => revealEvidence(event, id)}
                    >
                      {id}{" "}
                    </a>
                  ))}
                </p>
                <p>
                  Missing:{" "}
                  {finding.missing_evidence.join(", ") || "None listed"}
                </p>
              </details>
            ))}
          </details>
        </section>
        <aside>
          <details open={!value.diagnosis_supported || undefined}>
            <summary>Inspection rationale and procedure details</summary>
            <p className="eyebrow">Next check</p>
            <h2>
              {!value.diagnosis_supported
                ? "Image evidence rejected"
                : (value.recommendation?.name ??
                  (inspection
                    ? "Inspection recorded"
                    : "No diagnostic check available"))}
            </h2>
            {!value.diagnosis_supported && (
              <div role="status">
                <p>
                  The image evidence and its derived measurements have been
                  rejected. This case cannot proceed to inspection from that
                  image.
                </p>
                <a href="/">Start a new case with a valid image sample</a>
              </div>
            )}
            {value.recommendation && (
              <>
                <p>{value.recommendation.rationale}</p>
                <p>{value.recommendation.instructions}</p>
                <p>
                  {value.recommendation.duration_minutes} minutes · Parts:{" "}
                  {value.recommendation.required_parts.join(", ") || "None"}
                </p>
                <ul>
                  {value.recommendation.expected_outcomes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <p className="prototype-caution">
                  {value.recommendation.safety_note}
                </p>
              </>
            )}
            {inspection?.value === "no_obstruction_found" &&
              value.recommendation?.id === "air_supply" && (
                <p role="status">
                  Case remains open. Air-cap and pressure-supply review is the
                  next handoff; further repair workflows require additional
                  reviewed procedures.
                </p>
              )}
          </details>
        </aside>
      </div>
    </>
  );
}

export function CaseApp() {
  const [value, setValue] = useState<Case | null>(null);
  const [rasterMode] = useState(
    () =>
      new URLSearchParams(window.location.search).get("samples") === "raster",
  );
  const [postPhoto, setPostPhoto] = useState<VisionAssessment | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [images, setImages] = useState<Measurement[]>([]);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [sample, setSample] = useState<Measurement["sample_id"]>("incomplete");
  const [report, setReport] = useState(
    rasterMode
      ? defaultReport
      : "The latest inspected tray has an unexpected spray pattern.",
  );
  const [reloadRequired, setReloadRequired] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [logInput, setLogInput] = useState<LogPreviewRequest | null>(null);
  const [preview, setPreview] = useState<IngestionResult | null>(null);
  const [viewer, setViewer] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [ack, setAck] = useState(false);
  const [verificationSample, setVerificationSample] =
    useState<Measurement["sample_id"]>("normal");
  const [checks, setChecks] = useState(emptyRecovery);
  const [correctiveAction, setCorrectiveAction] = useState<
    "nozzle_cleaning" | "nozzle_replacement"
  >("nozzle_replacement");
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [guidance, setGuidance] = useState<GuidanceExchange[]>([]);
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorPanel = useRef<HTMLElement>(null);
  const retainedLog = useRef<HTMLDetailsElement>(null);
  const lock = useRef(false);
  const returnTarget = useRef("open-events");

  useEffect(() => {
    if (error) errorPanel.current?.focus();
  }, [error]);

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("case");
    Promise.all([
      loadImages(),
      loadScenario(),
      listCases(),
      id ? loadCase(id) : Promise.resolve(null),
    ])
      .then(([samples, demo, savedCases, saved]) => {
        if (active) {
          setImages(samples);
          setScenario(demo);
          setCases(savedCases);
          setValue(saved);
          setChecks({
            ...(saved?.recovery ?? emptyRecovery),
            confirmed: false,
          });
          if (
            saved?.scenario_version === "2.0" &&
            saved.verification &&
            "sample_id" in saved.verification
          ) {
            setVerificationSample(
              saved.verification.sample_id as Measurement["sample_id"],
            );
          }
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function accept(next: Case) {
    setReloadRequired(false);
    setValue(next);
    setChecks({ ...(next.recovery ?? emptyRecovery), confirmed: false });
    setAck(false);
    setGuidance([]);
    window.history.replaceState(
      null,
      "",
      `/?case=${encodeURIComponent(next.investigation.id)}`,
    );
    requestAnimationFrame(() => heading.current?.focus());
    void listCases()
      .then(setCases)
      .catch(() => undefined);
  }

  async function askGuidance(question: string) {
    if (!value || guidanceBusy) return;
    setGuidanceBusy(true);
    setError("");
    try {
      const response = await explainCase(
        value.investigation.id,
        value.revision,
        question,
      );
      setGuidance((items) => [
        ...items,
        { id: `${response.timestamp}-${items.length}`, question, response },
      ]);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setGuidanceBusy(false);
    }
  }
  async function command(action: Command) {
    if (value && !reloadRequired)
      await run(async () => {
        if (action.action === "correct_evidence") {
          setInspecting(false);
          setStep(0);
        }
        try {
          accept(
            await actOnCase(value.investigation.id, {
              ...action,
              revision: value.revision,
            }),
          );
        } catch (failure) {
          setReloadRequired(true);
          throw failure;
        }
      });
  }
  async function restartDemo() {
    await run(async () => {
      const next = await resetDemo({
        report: defaultReport,
        sample_id: "incomplete",
      });
      setReport(defaultReport);
      setSample("incomplete");
      setLogInput(null);
      setPreview(null);
      setViewer(false);
      setEventId(null);
      setStep(0);
      setInspecting(false);
      setVerificationSample("normal");
      setCorrectiveAction("nozzle_replacement");
      setCompletionNotes("");
      accept(next);
    });
  }
  const photoCase = !!value && "assessment_id" in value.measurement;
  const state = value?.investigation.state;
  const handoff =
    value?.investigation.evidence?.some(
      (item) =>
        item.key === "inspection" &&
        item.verification_state === "verified" &&
        item.value === "no_obstruction_found",
    ) && value?.recommendation?.id === "air_supply";
  const phase =
    state === "resolved"
      ? "Summary"
      : state === "verification_passed" ||
          state === "corrective_action_completed"
        ? "Verify"
        : state === "cause_confirmed"
          ? "Correct"
          : state === "inspection_recommended" &&
              (inspecting || value?.pending_outcome)
            ? "Inspect"
            : value?.ranking.length || state === "diagnosing"
              ? "Diagnose"
              : "Report";
  const title = !value
    ? "Report a dispensing defect"
    : value.summary
      ? "Review the completed case"
      : handoff
        ? "Maintenance handoff needed"
        : value.escalated
          ? "Maintenance escalation needed"
          : value.pending_outcome
            ? "Confirm the inspection observation"
            : state === "cause_confirmed"
              ? photoCase
                ? "Record the corrective action"
                : "Record the simulated corrective action"
              : phase === "Verify"
                ? "Verify the recovery"
                : inspecting && state === "inspection_recommended"
                  ? "Follow the inspection guide"
                  : value.ranking.length
                    ? "Review the diagnosis"
                    : "Narrow down the cause";
  const selected = images.find((i) => i.sample_id === sample);
  const mayAttach = value && !value.log && !value.ranking.length;

  if (value?.scenario_version === "1.0")
    return (
      <ApplicationFrame investigation={value.investigation} phase="Archive">
        <main id="main" className="case-workspace prototype-app">
          <h1>Archived epoxy investigation</h1>
          <p role="status">
            Read-only legacy case. Original evidence and results are preserved.
          </p>
          <a href="/">Start a new flux investigation</a>
          <h2>{value.investigation.title}</h2>
          <ImageMeasurement
            value={value.measurement}
            title="Original measurement"
          />
          {value.verification && (
            <ImageMeasurement
              value={value.verification}
              title="Original verification"
            />
          )}
          {value.summary && (
            <section>
              <h2>Original summary</h2>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(value.summary, null, 2)}
              </pre>
            </section>
          )}
          <section>
            <h2>Original evidence and rankings</h2>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(
                {
                  evidence: value.investigation.evidence,
                  ranking: value.ranking,
                  findings: value.findings,
                },
                null,
                2,
              )}
            </pre>
          </section>
          <section>
            <h2>Original timeline</h2>
            <ol>
              {value.timeline.map((entry, i) => (
                <li key={i}>
                  {entry.timestamp} ? {entry.description}
                </li>
              ))}
            </ol>
          </section>
        </main>
      </ApplicationFrame>
    );
  return (
    <ApplicationFrame
      investigation={value?.investigation}
      phase={phase}
      showPhaseRail={false}
      showDemoBadge={value ? !photoCase : rasterMode}
    >
      <main id="main" tabIndex={-1} className="case-workspace prototype-app">
        <div className="technician-shell workflow-shell">
          <CaseNavigator
            cases={cases}
            activeId={value?.investigation.id}
            phase={phase}
            status={
              handoff
                ? "Awaiting maintenance"
                : value?.escalated
                  ? "Escalated"
                  : undefined
            }
          />
          <div className="investigation-column">
            <div
              className="investigation-scroll"
              role="region"
              aria-label="Investigation task"
            >
              <section className="masthead workspace-masthead">
                <div>
                  <p className="eyebrow">
                    {handoff
                      ? "Awaiting maintenance"
                      : value?.escalated
                        ? "Escalated"
                        : phase}{" "}
                    / {value ? "Investigation" : "New case"}
                  </p>
                  <h1 ref={heading} tabIndex={-1}>
                    {title}
                  </h1>
                  {(value || rasterMode) && (
                    <p className="workspace-status">
                      {value
                        ? `Saved to database · revision ${value.revision}${photoCase ? "" : ` · ${value.investigation.simulated ? "Simulated case" : "Recorded case"}`}`
                        : "Start with the observed defect and controlled sample."}
                    </p>
                  )}
                </div>
                {value && (
                  <div className="case-restart">
                    <button
                      className="secondary"
                      disabled={busy || loading}
                      onClick={() => {
                        if (photoCase) window.location.assign("/");
                        else void restartDemo();
                      }}
                    >
                      {photoCase ? "New investigation" : "Restart demo"}
                    </button>
                  </div>
                )}
              </section>
              {!loading && (value || rasterMode) && (
                <WorkflowStatus
                  value={value}
                  phase={phase}
                  handoff={!!handoff}
                />
              )}
              {error && (
                <section
                  ref={errorPanel}
                  tabIndex={-1}
                  role="alert"
                  className="case-error"
                >
                  <h2>Request not completed</h2>
                  <p>{error}</p>
                  <p>
                    Your last loaded case remains visible. Reload the saved case
                    to check whether an interrupted request completed.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const id =
                          value?.investigation.id ??
                          new URLSearchParams(window.location.search).get(
                            "case",
                          );
                        if (id) accept(await loadCase(id));
                        else {
                          setLoading(true);
                          setAttempt((a) => a + 1);
                        }
                      })
                    }
                  >
                    Reload saved case / retry connection
                  </button>
                </section>
              )}
              {loading && <p role="status">Loading workspace…</p>}
              <fieldset
                key={value?.investigation.id ?? "new-report"}
                className="case-controls"
                disabled={busy || loading || reloadRequired}
              >
                <legend className="sr-only">Investigation controls</legend>
                {!value && !rasterMode && (
                  <ReportIntake
                    busy={busy}
                    onSubmit={(request) => {
                      void run(async () => accept(await createCase(request)));
                    }}
                  />
                )}
                {!value && rasterMode && selected && (
                  <div className="prototype-two">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () =>
                          accept(
                            await createCase({ report, sample_id: sample }),
                          ),
                        );
                      }}
                    >
                      <label htmlFor="report">Operator report</label>
                      <textarea
                        id="report"
                        required
                        maxLength={2000}
                        value={report}
                        onChange={(e) => setReport(e.target.value)}
                      />
                      <label htmlFor="sample">Controlled image sample</label>
                      <select
                        id="sample"
                        value={sample}
                        onChange={(e) =>
                          setSample(e.target.value as Measurement["sample_id"])
                        }
                      >
                        {Object.entries(sampleNames).map(([id, name]) => (
                          <option value={id} key={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p>
                        All samples are generated demo images. This demo
                        diagnoses the flux-spray scenario; measurements do not
                        establish a root cause.
                      </p>
                      <button
                        className="primary"
                        disabled={!report.trim()}
                        type="submit"
                      >
                        Start investigation
                      </button>
                    </form>
                    <ImageMeasurement
                      value={selected}
                      title="Selected sample"
                    />
                  </div>
                )}
                {value && !value.ranking.length && (
                  <>
                    {value.next_question && (
                      <section className="prototype-question case-primary-task">
                        <p className="eyebrow">
                          Discovery / {Object.keys(value.answers).length + 1} of
                          5
                        </p>
                        <h2>{value.next_question.prompt}</h2>
                        <p>Why this matters: {value.next_question.rationale}</p>
                        <div className="prototype-options">
                          {value.next_question.options.map((option) => (
                            <button
                              className="secondary"
                              key={option.value}
                              onClick={() =>
                                command({
                                  action: "answer",
                                  question_id: value.next_question!.id,
                                  value: option.value,
                                })
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                    {value.questions_complete && value.diagnosis_supported && (
                      <section className="case-primary-task discovery-complete">
                        <div>
                          <p className="eyebrow">Discovery complete</p>
                          <h2>Generate the ranked diagnosis</h2>
                          <p>
                            Your observations are ready. Find out which causes
                            to check first.
                          </p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => command({ action: "diagnose" })}
                        >
                          Diagnose case
                        </button>
                      </section>
                    )}
                    <details className="supporting-details">
                      <summary>
                        Reported sample &amp; optional machine log
                      </summary>
                      <div className="prototype-two">
                        <section>
                          <h2>Reported defect</h2>
                          <p>{value.investigation.title}</p>
                          <p>
                            Image evidence is provisional. It can support
                            diagnosis but cannot confirm a cause.
                          </p>
                          {!value.diagnosis_supported && (
                            <p role="status">
                              This sample is measured, but its diagnosis is
                              outside the controlled defect rules. Start another
                              case with the incomplete-coverage sample to
                              explore the complete journey.
                            </p>
                          )}
                          {mayAttach && (
                            <div className="case-log-controls">
                              <h2>Machine context</h2>
                              <p>
                                Optional: preview before attaching machine
                                facts. You may continue discovery without a log.
                              </p>
                              <button
                                className="secondary"
                                onClick={() => {
                                  if (scenario)
                                    void run(async () => {
                                      const result = await previewLog(
                                        scenario.sample_log,
                                      );
                                      setLogInput(scenario.sample_log);
                                      setPreview(result);
                                    });
                                }}
                              >
                                Use sample machine log
                              </button>
                              <label htmlFor="log-file">
                                Upload controlled .log or .txt
                              </label>
                              <input
                                id="log-file"
                                type="file"
                                accept=".log,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  void run(async () => {
                                    if (
                                      !/\.(log|txt)$/i.test(file.name) ||
                                      file.size > 2_000_000
                                    )
                                      throw new Error(
                                        "Choose a .log or .txt file up to 2 MB.",
                                      );
                                    const input = {
                                      text: await file.text(),
                                      sourceName: file.name,
                                      timezoneOffset: null,
                                    };
                                    const result = await previewLog(input);
                                    setLogInput(input);
                                    setPreview(result);
                                  });
                                }}
                              />
                              {preview && (
                                <button
                                  className="primary"
                                  onClick={() => {
                                    if (logInput)
                                      command({
                                        action: "attach_log",
                                        log: logInput,
                                      });
                                  }}
                                >
                                  Attach previewed log
                                </button>
                              )}
                            </div>
                          )}
                          {value.log && (
                            <p role="status">
                              Attached {value.log.sourceName} ·{" "}
                              {value.log.stats.eventCount} events retained
                            </p>
                          )}
                        </section>
                        <ImageMeasurement
                          value={value.measurement}
                          title="Before action"
                        />
                      </div>
                      {(preview || value.log) && scenario && (
                        <section className="case-log">
                          {viewer ? (
                            <EventViewer
                              result={(value.log ?? preview)!}
                              selectedId={eventId}
                              onSelect={setEventId}
                              onClose={() => {
                                setViewer(false);
                                requestAnimationFrame(() => {
                                  const target = document.getElementById(
                                    returnTarget.current,
                                  );
                                  const details = target?.closest("details");
                                  if (details) details.open = true;
                                  target?.focus();
                                });
                              }}
                            />
                          ) : (
                            <EvidencePreview
                              result={(value.log ?? preview)!}
                              metadata={{
                                ...scenario.log_metadata,
                                limitations: [
                                  "Only direct facts from recognized events become provisional evidence.",
                                  "Missing timezone stays unknown; source order and raw records are retained.",
                                  "Machine PASS status is not interpreted as product quality.",
                                ],
                              }}
                              onOpenViewer={(target, sourceRef) => {
                                returnTarget.current = target;
                                setEventId(
                                  (value.log ?? preview)?.events.find(
                                    (e) => e.sourceRef === sourceRef,
                                  )?.id ?? null,
                                );
                                setViewer(true);
                              }}
                            />
                          )}
                        </section>
                      )}
                    </details>
                  </>
                )}
                {value && value.ranking.length > 0 && !value.summary && (
                  <>
                    {phase === "Diagnose" && (
                      <>
                        {state === "inspection_recommended" && (
                          <section className="next-action-banner">
                            <div>
                              <p className="eyebrow">Recommended next action</p>
                              <h2>Inspect the fluid path and nozzle</h2>
                              <p>
                                {value.ranking[0]?.label} leads the current
                                ranking, but is not confirmed. Use the 3D guide
                                to check the nozzle, then record what you find.
                              </p>
                            </div>
                            <button
                              className="primary"
                              aria-label="Start illustrative inspection"
                              onClick={() => {
                                setInspecting(true);
                                requestAnimationFrame(() =>
                                  heading.current?.focus(),
                                );
                              }}
                            >
                              Start inspection
                            </button>
                          </section>
                        )}
                        <Diagnosis value={value} onCorrect={command} />
                        {value.log && (
                          <details ref={retainedLog}>
                            <summary>
                              Retained machine events and raw log
                            </summary>
                            <EventViewer
                              result={value.log}
                              selectedId={eventId}
                              onSelect={setEventId}
                              onClose={() => {
                                setEventId(null);
                                if (retainedLog.current) {
                                  retainedLog.current.open = false;
                                  retainedLog.current
                                    .querySelector("summary")
                                    ?.focus();
                                }
                              }}
                            />
                          </details>
                        )}
                      </>
                    )}
                    {phase === "Inspect" && (
                      <InspectionGuide
                        steps={value.procedure}
                        step={step}
                        onStep={setStep}
                      />
                    )}
                    {phase === "Inspect" && !value.pending_outcome && (
                      <section className="inspection-outcome-card">
                        <p className="eyebrow">
                          Step {step + 1} of {value.procedure.length}
                        </p>
                        <h2>Record the inspection outcome</h2>
                        <p>
                          {step === value.procedure.length - 1
                            ? "After completing the guide, record what the authorized inspection found. The model does not detect an obstruction for you."
                            : "Review the five steps above first. You can record an observation after reaching the final step."}
                        </p>
                        <p className="prototype-caution">
                          Illustrative guide; expert review pending. These
                          observations are simulated.
                        </p>
                        <div className="prototype-options">
                          <button
                            className="secondary"
                            disabled={step !== value.procedure.length - 1}
                            onClick={() =>
                              command({
                                action: "inspect",
                                outcome: "obstruction_found",
                              })
                            }
                          >
                            Obstruction found
                          </button>
                          <button
                            className="secondary"
                            disabled={step !== value.procedure.length - 1}
                            onClick={() =>
                              command({
                                action: "inspect",
                                outcome: "no_obstruction_found",
                              })
                            }
                          >
                            No obstruction found
                          </button>
                        </div>
                      </section>
                    )}
                    {value.pending_outcome && (
                      <section className="prototype-question">
                        <h2>{humanize(value.pending_outcome)}</h2>
                        <p>
                          This observation has not yet changed the diagnosis.
                        </p>
                        <label className="prototype-checkbox">
                          <input
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                          />
                          {photoCase
                            ? "I confirm this inspection observation."
                            : "I confirm this simulated inspection observation."}
                        </label>
                        <button
                          className="primary"
                          disabled={!ack}
                          onClick={() => {
                            setInspecting(false);
                            command({
                              action: "confirm_observation",
                              confirmed: true,
                            });
                          }}
                        >
                          Confirm observation
                        </button>
                      </section>
                    )}
                    {phase === "Inspect" && (
                      <details className="case-section">
                        <summary>
                          Review or correct evidence before confirming
                        </summary>
                        <Diagnosis value={value} onCorrect={command} />
                      </details>
                    )}
                    {state === "cause_confirmed" && (
                      <section className="prototype-question">
                        <h2>Obstruction confirmed</h2>
                        <p>
                          Record the work completed. A separate recovery check
                          comes next to establish whether the issue is resolved.
                        </p>
                        <label>
                          {photoCase
                            ? "Corrective action"
                            : "Simulated corrective action"}
                          <select
                            value={correctiveAction}
                            onChange={(e) =>
                              setCorrectiveAction(
                                e.target.value as typeof correctiveAction,
                              )
                            }
                          >
                            <option value="nozzle_replacement">
                              Nozzle replacement
                            </option>
                            <option value="nozzle_cleaning">
                              Approved nozzle cleaning
                            </option>
                          </select>
                        </label>
                        <p>
                          {photoCase
                            ? "Record nozzle cleaning or replacement completed under the applicable site procedure."
                            : "Record simulated nozzle cleaning or replacement under the applicable site procedure."}
                        </p>
                        <p className="prototype-caution">
                          Expert review pending. Follow the approved site
                          procedure; this interface does not authorize physical
                          service.
                        </p>
                        <label className="prototype-checkbox">
                          <input
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                          />
                          {photoCase
                            ? "I confirm the corrective action is complete."
                            : "I confirm the simulated corrective action is complete."}
                        </label>
                        <button
                          className="primary"
                          disabled={!ack}
                          onClick={() =>
                            command({
                              action: "complete_action",
                              confirmed: true,
                              corrective_action: correctiveAction,
                            })
                          }
                        >
                          Record action complete
                        </button>
                      </section>
                    )}
                    {phase === "Verify" && (
                      <>
                        <div className="prototype-two verification-comparison">
                          <ImageMeasurement
                            value={value.measurement}
                            title="Before action"
                          />
                          {value.verification ? (
                            <ImageMeasurement
                              value={value.verification}
                              title="Verification result"
                            />
                          ) : (
                            <section>
                              <h2>
                                {photoCase
                                  ? "Compare the post-action photo"
                                  : "Measure the post-action sample"}
                              </h2>
                              <p>
                                {photoCase
                                  ? "Analyze a new photo after the repair, then confirm the equipment recovery checks."
                                  : "Passing requires accepted spray coverage and all required recovery checks."}
                              </p>
                            </section>
                          )}
                        </div>
                        {value.recovery && (
                          <details className="case-section">
                            <summary>Last submitted recovery checks</summary>
                            <dl>
                              {Object.entries(value.recovery).map(
                                ([key, result]) => (
                                  <div key={key}>
                                    <dt>{humanize(key)}</dt>
                                    <dd>{candidateValue({ value: result })}</dd>
                                  </div>
                                ),
                              )}
                            </dl>
                          </details>
                        )}
                        {state === "corrective_action_completed" && (
                          <section className="case-section">
                            {value.verification && (
                              <p role="status">
                                Verification failed. The case remains open.
                              </p>
                            )}
                            <p>
                              Calibration attempts: {value.calibration_attempts}
                              ; failures: {value.calibration_failures}.
                            </p>
                            {value.escalated ? (
                              <p role="alert">
                                Two calibration failures require maintenance
                                escalation. Ordinary retries are blocked.
                              </p>
                            ) : (
                              <RecoveryForm
                                value={checks}
                                onChange={setChecks}
                                photoMode={photoCase}
                              />
                            )}
                            {photoCase ? (
                              <div className="photo-verification">
                                <PhotoInput
                                  key={value.investigation.id}
                                  value={postPhoto}
                                  onChange={setPostPhoto}
                                  onBusy={setPhotoBusy}
                                  title="Post-action photo"
                                />
                              </div>
                            ) : (
                              <>
                                <h2>Check the post-action sample</h2>
                                <p>
                                  Choose the simulated result to compare with
                                  the original defect.
                                </p>
                                <label htmlFor="verification-sample">
                                  Verification sample
                                </label>
                                <select
                                  id="verification-sample"
                                  value={verificationSample}
                                  onChange={(e) =>
                                    setVerificationSample(
                                      e.target
                                        .value as Measurement["sample_id"],
                                    )
                                  }
                                >
                                  {Object.entries(sampleNames).map(
                                    ([id, name]) => (
                                      <option key={id} value={id}>
                                        {name}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </>
                            )}
                            {!checks.confirmed && !value.escalated && (
                              <p className="action-hint">
                                Confirm the recovery observations above to
                                enable verification.
                              </p>
                            )}
                            <button
                              className="primary"
                              disabled={
                                value.escalated ||
                                !checks.confirmed ||
                                (photoCase && (!postPhoto || photoBusy))
                              }
                              onClick={() =>
                                command({
                                  action: "verify",
                                  ...(photoCase
                                    ? {
                                        assessment_id: postPhoto!.assessment_id,
                                      }
                                    : { sample_id: verificationSample }),
                                  checks,
                                })
                              }
                            >
                              {photoCase
                                ? "Verify recovery"
                                : "Measure verification sample"}
                            </button>
                          </section>
                        )}
                        {state === "verification_passed" && (
                          <section className="case-section">
                            <p role="status">
                              Verification passed. Confirm resolution to save
                              the completed summary.
                            </p>
                            <label htmlFor="completion-notes">
                              Completion notes (optional)
                            </label>
                            <textarea
                              id="completion-notes"
                              maxLength={2000}
                              value={completionNotes}
                              onChange={(event) =>
                                setCompletionNotes(event.target.value)
                              }
                            />
                            <p>
                              Saved with the confirmed resolution. Up to 2,000
                              characters.
                            </p>
                            <label className="prototype-checkbox">
                              <input
                                type="checkbox"
                                checked={ack}
                                onChange={(e) => setAck(e.target.checked)}
                              />
                              {photoCase
                                ? "I confirm this case is ready to resolve."
                                : "I confirm this simulated case is ready to resolve."}
                            </label>
                            <button
                              className="primary"
                              disabled={!ack}
                              onClick={() =>
                                command({
                                  action: "resolve",
                                  confirmed: true,
                                  notes: completionNotes,
                                })
                              }
                            >
                              Resolve case
                            </button>
                          </section>
                        )}
                      </>
                    )}
                  </>
                )}
                {value?.summary && (
                  <section className="prototype-summary">
                    <h2>From observed defect to verified recovery</h2>
                    {photoCase && value.verification && (
                      <div className="prototype-two verification-comparison">
                        <ImageMeasurement
                          value={value.measurement}
                          title="Before action"
                        />
                        <ImageMeasurement
                          value={value.verification}
                          title="After action"
                        />
                      </div>
                    )}
                    <dl>
                      {Object.entries(value.summary)
                        .filter(([key]) => key !== "evidence_ids")
                        .map(([key, text]) => (
                          <div key={key}>
                            <dt>{humanize(key)}</dt>
                            <dd>{String(text) || "None recorded"}</dd>
                          </div>
                        ))}
                    </dl>
                    <h3>Inspection</h3>
                    <p>
                      {(value.investigation.evidence ?? [])
                        .filter(
                          (item) =>
                            item.key === "inspection" &&
                            item.verification_state === "verified",
                        )
                        .map(
                          (item) =>
                            `${humanize(candidateValue(item))} (confirmed, nozzle-only inspection)`,
                        )
                        .join("; ") || "No confirmed inspection recorded."}
                    </p>
                    <h3>Ranked causes</h3>
                    <ol>
                      {value.ranking.map((cause) => (
                        <li key={cause.hypothesis_id}>
                          {cause.label}: {cause.score} heuristic points
                        </li>
                      ))}
                    </ol>
                    <SummaryEvidence value={value} />
                    <p role="status">Resolved · saved to this case</p>
                    {!photoCase && (
                      <p>Simulated case; expert procedure review pending.</p>
                    )}
                  </section>
                )}
              </fieldset>
              {value && <KnowledgeCapture value={value} />}
              {busy && <p role="status">Saving or loading…</p>}
              {value &&
                (!!value.diagnostic_history?.length ||
                  !!value.ranking.length ||
                  !!value.summary) && (
                  <details className="supporting-details">
                    <summary>Diagnostic history · previous decisions</summary>
                    <DiagnosticHistory value={value} />
                  </details>
                )}
              {value && (
                <details className="prototype-timeline">
                  <summary>Case timeline · saved history</summary>
                  <ol>
                    {value.timeline.map((item, i) => (
                      <li key={i}>
                        <time>{item.timestamp}</time> · {humanize(item.state)} —{" "}
                        {item.description}
                        {item.diagnostic_revision != null && (
                          <p>
                            <a
                              href={`#diagnosis-revision-${item.diagnostic_revision}`}
                              onClick={(event) => {
                                event.preventDefault();
                                const target = document.getElementById(
                                  `diagnosis-revision-${item.diagnostic_revision}`,
                                ) as HTMLDetailsElement | null;
                                if (target) {
                                  let ancestor: HTMLElement | null = target;
                                  while (ancestor) {
                                    if (ancestor instanceof HTMLDetailsElement)
                                      ancestor.open = true;
                                    ancestor = ancestor.parentElement;
                                  }
                                  target.focus();
                                  target.scrollIntoView({ block: "nearest" });
                                }
                              }}
                            >
                              View diagnostic snapshot at revision{" "}
                              {item.diagnostic_revision}
                            </a>
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
            {value && (
              <GuidanceComposer
                exchanges={guidance}
                busy={guidanceBusy}
                onAsk={askGuidance}
              />
            )}
          </div>
        </div>
      </main>
    </ApplicationFrame>
  );
}
