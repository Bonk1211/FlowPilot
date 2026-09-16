import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  Flask,
} from "@phosphor-icons/react";
import type { GoldenScenario, GoldenSnapshot } from "@flowpilot/contracts";
import goldenJson from "../../../../fixtures/v1/golden-scenario.json";
import { loadGoldenScenario } from "../api";
import { humanize } from "../presentation";
import { ProcedureDiagram } from "./ProcedureDiagram";
import "./prototype.css";

// JSON imports widen string literals. Backend validation and parity tests enforce this boundary.
const bundled = goldenJson as GoldenScenario;
const screenNames = [
  "Report",
  "Log",
  "Questions",
  "Diagnose",
  "Inspect",
  "Correct",
  "Verify",
  "Summary",
];
const phaseIndex = (screen: GoldenSnapshot["screen"]) =>
  ({
    report: 0,
    log: 1,
    questions: 2,
    diagnosis: 3,
    inspection: 4,
    confirmation: 4,
    corrective: 5,
    verification: 6,
    summary: 7,
  })[screen];

function ImageReview({ image }: { image: GoldenScenario["images"][number] }) {
  return (
    <figure className="prototype-image">
      <figcaption>{image.label} · Synthetic image</figcaption>
      <svg
        viewBox={`0 0 ${image.width} ${image.height}`}
        role="img"
        aria-label={`${image.label}: ${image.quality_summary}`}
      >
        {image.dots.map((dot) => (
          <g key={dot.id}>
            <circle
              cx={dot.x}
              cy={dot.y}
              r={dot.diameter_px / 2}
              className="sample-dot"
            />
            {dot.classification !== "normal" && (
              <circle cx={dot.x} cy={dot.y} r={18} className="dot-overlay" />
            )}
          </g>
        ))}
      </svg>
      <p>{image.quality_summary}</p>
      <dl className="prototype-metrics">
        <div>
          <dt>Mean diameter</dt>
          <dd>{image.mean_diameter_px} px</dd>
        </div>
        <div>
          <dt>Variation</dt>
          <dd>{image.variation_px} px</dd>
        </div>
        <div>
          <dt>Golden range</dt>
          <dd>
            {image.golden_min_px}–{image.golden_max_px} px
          </dd>
        </div>
      </dl>
      <small>
        Outline = abnormal dot. Ground truth and measurements are precomputed
        fixtures.
      </small>
    </figure>
  );
}

function Diagnosis({
  data,
  snapshot,
}: {
  data: GoldenScenario;
  snapshot: GoldenSnapshot;
}) {
  const recommendation = data.recommendations.find(
    (item) => item.id === snapshot.recommendation_id,
  );
  return (
    <div className="prototype-diagnosis">
      <section aria-label="Evidence ledger">
        <p className="eyebrow">01 / Evidence</p>
        <h2>What we know</h2>
        {(data.investigation.evidence ?? [])
          .filter((e) => snapshot.evidence_ids.includes(e.id))
          .map((e) => (
            <article
              id={`evidence-${e.id}`}
              key={e.id}
              tabIndex={-1}
              className="prototype-ledger-row"
            >
              <span className="status">{humanize(e.verification_state)}</span>
              <h3>{humanize(e.key)}</h3>
              <p>
                {String(e.value)} {e.unit}
              </p>
              <small>
                {e.id} · {humanize(e.source_type)}
              </small>
              <details>
                <summary>Source reference</summary>
                <p>{e.source_ref}</p>
                <p>{e.timestamp}</p>
              </details>
            </article>
          ))}
        <h3>Missing telemetry</h3>
        <p>
          Pressure, material temperature and material open time are not recorded
          in the sample log.
        </p>
      </section>
      <section aria-label="Ranked causes">
        <p className="eyebrow">02 / Diagnosis</p>
        <h2>Compare the causes</h2>
        <p>Precomputed heuristic scores · not probabilities</p>
        {snapshot.ranking.map((cause, index) => (
          <article className="prototype-cause" key={cause.hypothesis_id}>
            <div className="prototype-cause-title">
              <h3>
                {index + 1}. {cause.label}
              </h3>
              <strong>{cause.score} pts</strong>
            </div>
            {cause.confirmed && (
              <p className="status">Confirmed demo observation</p>
            )}
            <details>
              <summary>Why this score?</summary>
              {cause.contributions.map((c) => (
                <p key={c.evidence_id}>
                  <a href={`#evidence-${c.evidence_id}`}>{c.evidence_id}</a> ·{" "}
                  {c.weight > 0 ? "+" : ""}
                  {c.weight} — {c.explanation}
                </p>
              ))}
              <p>
                Missing:{" "}
                {cause.missing_evidence.join(", ") ||
                  "No additional inspection evidence"}
              </p>
            </details>
          </article>
        ))}
        <h3>Specialists & critic</h3>
        <p>Precomputed AI-generated finding examples · initial diagnosis</p>
        {data.findings.map((f) => (
          <details key={f.agent}>
            <summary>{humanize(f.agent)}</summary>
            <p>{f.summary}</p>
            <p>
              Supporting:{" "}
              {f.supporting_evidence_ids.map((id) => (
                <a key={id} href={`#evidence-${id}`}>
                  {id}{" "}
                </a>
              ))}
            </p>
            <p>
              Conflicting:{" "}
              {f.conflicting_evidence_ids.join(", ") || "None documented"}
            </p>
            <p>Missing: {f.missing_evidence.join(", ")}</p>
          </details>
        ))}
      </section>
      <aside className="prototype-next">
        <p className="eyebrow">03 / Next check</p>
        <h2>{recommendation?.name}</h2>
        <p>{recommendation?.rationale}</p>
        <p>{recommendation?.instructions}</p>
        <p>{recommendation?.duration_minutes} min · illustrative estimate</p>
        <p>Required: {recommendation?.required_parts.join(", ")}</p>
        <h3>Possible outcomes</h3>
        <ul>
          {recommendation?.expected_outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
        <p className="prototype-caution">{recommendation?.safety_note}</p>
        {snapshot.id === "negative" && (
          <p role="status">
            Case remains open. Material inspection is the next handoff; its
            workflow is outside this M0 prototype.
          </p>
        )}
      </aside>
    </div>
  );
}

export function Prototype() {
  const [data, setData] = useState<GoldenScenario>(bundled);
  const [source, setSource] = useState("Loading shared fixture…");
  const [snapshotId, setSnapshotId] = useState(bundled.initial_snapshot_id);
  const [history, setHistory] = useState<string[]>([]);
  const [questionId, setQuestionId] = useState(bundled.first_question_id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionsDone, setQuestionsDone] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const snapshot = data.snapshots.find((s) => s.id === snapshotId)!;
  const question = data.questions.find((q) => q.id === questionId)!;
  const step = data.procedure_steps[stepIndex];

  useEffect(() => {
    let active = true;
    loadGoldenScenario()
      .then((result) => {
        if (active) {
          setData(result);
          setSource(`Shared API fixture v${result.fixture_version}`);
        }
      })
      .catch(() => {
        if (active) setSource("Offline mode · bundled shared fixture v1.0");
      });
    return () => {
      active = false;
    };
  }, []);

  function go(id: string) {
    setHistory((old) => [...old, snapshotId]);
    setSnapshotId(id);
    setAcknowledged(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function restart() {
    setSnapshotId(data.initial_snapshot_id);
    setHistory([]);
    setAnswers({});
    setQuestionId(data.first_question_id);
    setQuestionsDone(false);
    setStepIndex(0);
    setAcknowledged(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function back() {
    if (!history.length) return;
    setSnapshotId(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setAcknowledged(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  const continueLabel =
    snapshot.id === "found"
      ? "Confirm demo observation"
      : snapshot.id === "corrective"
        ? "Record simulated action complete"
        : snapshot.id === "verification"
          ? "Run simulated verification"
          : snapshot.id === "verified"
            ? "Resolve demo case"
            : snapshot.id === "diagnosis"
              ? "Start illustrative inspection"
              : "Continue";
  const needsAcknowledgment =
    snapshot.screen === "confirmation" || snapshot.screen === "corrective";
  const canContinue =
    (snapshot.screen !== "questions" || questionsDone) &&
    (!needsAcknowledgment || acknowledged);

  return (
    <div className="app prototype-app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="command-bar">
        <a className="wordmark" href="/">
          <Flask aria-hidden="true" />
          FlowPilot
        </a>
        <span className="demo-badge">M0 prototype / Simulated data</span>
        <a className="prototype-exit" href="/">
          Exit prototype
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="prototype-banner">
          <span role="status">{source}</span>
          <span>
            Precomputed storyboard · changes stay in this browser session
          </span>
        </div>
        <ol className="prototype-phases" aria-label="Prototype journey">
          {screenNames.map((name, index) => (
            <li
              key={name}
              aria-current={
                phaseIndex(snapshot.screen) === index ? "step" : undefined
              }
            >
              <span className="mono">0{index + 1}</span> {name}
            </li>
          ))}
        </ol>
        <section className="masthead">
          <div>
            <p className="eyebrow">
              {data.investigation.id} / {humanize(snapshot.state)}
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {snapshot.title}
            </h1>
            <p className="phase-summary">
              {data.investigation.title} · Precision epoxy dispensing
            </p>
          </div>
          <button className="secondary" onClick={restart}>
            <ArrowClockwise aria-hidden="true" />
            Restart prototype
          </button>
        </section>

        {snapshot.screen === "report" && (
          <div className="prototype-two">
            <section>
              <p className="eyebrow">Operator report</p>
              <h2>Small dots. An unresolved cause.</h2>
              <p>
                The latest inspected tray has consistently undersized epoxy
                dots.
              </p>
              <p>
                Review the synthetic image and machine context, then compare
                three possible causes.
              </p>
              <p className="status">Provisional image evidence</p>
              <p>
                This M0 preview selects the curated image automatically. Upload
                and measurement processing belong to M1.
              </p>
            </section>
            <ImageReview image={data.images[0]} />
          </div>
        )}

        {snapshot.screen === "log" && (
          <section className="prototype-log">
            <h2>Sample log preview</h2>
            <p>
              {data.log_preview.stats.eventCount} events ·{" "}
              {
                data.log_preview.events.filter(
                  (e) => e.kind === "unknown" || e.kind === "unparsed_line",
                ).length
              }{" "}
              unknown events retained
            </p>
            <p>
              Precomputed output from the existing parser. Machine PASS is a
              run-status fact, not product-quality evidence.
            </p>
            <div className="prototype-two">
              <section>
                <h3>Recognized facts</h3>
                {data.log_preview.evidenceCandidates.map((e, index) => (
                  <p key={index}>
                    {humanize(e.key)} ·{" "}
                    <a
                      href={`#prototype-event-${data.log_preview.events.findIndex((event) => event.sourceRef === e.sourceRef)}`}
                    >
                      {e.sourceRef}
                    </a>
                  </p>
                ))}
                <h3>Import warnings</h3>
                {data.log_preview.warnings.map((w, index) => (
                  <p key={index}>
                    {humanize(w.code)} · line {w.line}
                  </p>
                ))}
              </section>
              <section>
                <h3>Original records</h3>
                {data.log_preview.events.map((e, index) => (
                  <details id={`prototype-event-${index}`} key={e.id}>
                    <summary>
                      {humanize(e.kind)} · lines {e.lineStart}–{e.lineEnd}
                    </summary>
                    <pre>{e.raw}</pre>
                  </details>
                ))}
              </section>
            </div>
          </section>
        )}

        {snapshot.screen === "questions" && (
          <section className="prototype-question">
            <p className="eyebrow">
              Discovery / {Math.min(Object.keys(answers).length + 1, 5)} of 5
            </p>
            {questionsDone ? (
              <>
                <h2>Discovery preview complete</h2>
                <p>
                  The answers demonstrate navigation. The next screen uses the
                  fixed continuous-undersizing golden scenario; these choices do
                  not run a diagnosis.
                </p>
                <dl>
                  {Object.entries(answers).map(([id, value]) => (
                    <div key={id}>
                      <dt>{data.questions.find((q) => q.id === id)?.prompt}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  className="secondary"
                  onClick={() => {
                    setQuestionId(data.first_question_id);
                    setAnswers({});
                    setQuestionsDone(false);
                  }}
                >
                  Review answers again
                </button>
              </>
            ) : (
              <>
                <h2>{question.prompt}</h2>
                <p>Why this matters: {question.rationale}</p>
                <div className="prototype-options">
                  {question.options.map((option) => (
                    <button
                      className="secondary"
                      key={option.value}
                      onClick={() => {
                        setAnswers((old) => ({
                          ...old,
                          [question.id]: option.label,
                        }));
                        if (option.next_question_id)
                          setQuestionId(option.next_question_id);
                        else setQuestionsDone(true);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p role="status">
                  {Object.keys(answers).length} answers recorded in this
                  preview.
                </p>
              </>
            )}
          </section>
        )}

        {snapshot.screen === "diagnosis" && (
          <Diagnosis data={data} snapshot={snapshot} />
        )}

        {snapshot.screen === "inspection" && (
          <div className="prototype-two">
            <ProcedureDiagram step={step} />
            <section>
              <p className="eyebrow">
                Step {stepIndex + 1} of {data.procedure_steps.length} / Expert
                review pending
              </p>
              <h2>{step.title}</h2>
              <p>{step.instruction}</p>
              <p className="prototype-caution">{step.caution}</p>
              <div className="prototype-options">
                <button
                  className="secondary"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex(stepIndex - 1)}
                >
                  Previous step
                </button>
                <button
                  className="secondary"
                  disabled={stepIndex === data.procedure_steps.length - 1}
                  onClick={() => setStepIndex(stepIndex + 1)}
                >
                  Next step
                </button>
              </div>
              <h3>Text alternative</h3>
              <ol>
                {data.procedure_steps.map((item, index) => (
                  <li
                    key={item.step_id}
                    aria-current={index === stepIndex ? "step" : undefined}
                  >
                    <button
                      className="prototype-text-step"
                      onClick={() => setStepIndex(index)}
                    >
                      {item.title}
                    </button>
                    <p>{item.instruction}</p>
                  </li>
                ))}
              </ol>
              <h3>Record a demo inspection outcome</h3>
              <p>
                These buttons simulate observations; they do not authorize a
                physical inspection.
              </p>
              <div className="prototype-options">
                {data.outcomes.map((outcome) => (
                  <button
                    key={outcome.outcome}
                    className="secondary"
                    disabled={stepIndex !== data.procedure_steps.length - 1}
                    onClick={() => go(outcome.next_snapshot_id)}
                  >
                    {outcome.outcome === "obstruction_found"
                      ? "Obstruction found"
                      : "No obstruction found"}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {needsAcknowledgment && (
          <section className="prototype-question">
            <h2>
              {snapshot.screen === "confirmation"
                ? "Obstruction found — observation awaiting confirmation"
                : "Site-approved action — simulated completion"}
            </h2>
            <p>
              {snapshot.screen === "confirmation"
                ? "Confirm this simulated technician observation before the prototype marks restriction as confirmed."
                : data.summary.corrective_action}
            </p>
            <p className="prototype-caution">
              Expert review pending. This is an illustrative workflow, not
              permission to service equipment. Follow the approved site
              procedure.
            </p>
            <label className="prototype-checkbox">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              {snapshot.screen === "confirmation"
                ? "I confirm the demo inspection observation."
                : "I am recording a simulated action, not controlling a machine."}
            </label>
          </section>
        )}

        {snapshot.screen === "verification" && (
          <section>
            <p>
              {snapshot.id === "verified"
                ? data.verification.explanation
                : "Compare the precomputed before and after samples, then run the simulated verification to record the separate verification state."}
            </p>
            <div className="prototype-two">
              {data.images.map((image) => (
                <ImageReview image={image} key={image.id} />
              ))}
            </div>
            {snapshot.id === "verified" && (
              <p role="status" className="status">
                Verification passed · case ready to resolve
              </p>
            )}
          </section>
        )}

        {snapshot.screen === "summary" && (
          <section className="prototype-summary">
            <p className="eyebrow">Resolved / Simulated case</p>
            <h2>From observed defect to verified recovery</h2>
            <dl>
              {Object.entries(data.summary)
                .filter(([key]) => key !== "evidence_ids")
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{humanize(key)}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
            <h3>Supporting observations</h3>
            {(data.investigation.evidence ?? [])
              .filter((e) => data.summary.evidence_ids.includes(e.id))
              .map((e) => (
                <p key={e.id}>
                  {e.id}: {String(e.value)} {e.unit}
                </p>
              ))}
            <p>
              This summary is a fixture preview and has not been saved as a
              case.
            </p>
          </section>
        )}

        <footer className="prototype-actions">
          <button
            className="secondary"
            onClick={back}
            disabled={!history.length}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          <span aria-live="polite">{humanize(snapshot.state)}</span>
          {snapshot.next_snapshot_id && (
            <button
              className="primary"
              disabled={!canContinue}
              onClick={() => go(snapshot.next_snapshot_id!)}
            >
              {continueLabel}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </footer>
        <details className="prototype-timeline">
          <summary>Snapshot timeline · precomputed</summary>
          <ol>
            {snapshot.timeline.map((entry, index) => (
              <li key={index}>
                <time>{entry.timestamp}</time> · {humanize(entry.state)} —{" "}
                {entry.description}
              </li>
            ))}
          </ol>
        </details>
      </main>
    </div>
  );
}
