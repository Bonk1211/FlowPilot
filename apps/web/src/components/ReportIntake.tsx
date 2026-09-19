import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileText,
  ImageSquare,
  ListChecks,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  CreateCase,
  GoldenScenario,
  IntakeContext,
  LogContext,
  LogPreviewRequest,
  ObservationChoice,
  VisionAssessment,
  Case,
} from "@flowpilot/contracts";
import { loadGoldenScenario, previewLogContext } from "../api";
import { PhotoInput } from "./PhotoAnalysis";
import "../intake.css";

const failure = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Could not read this log. Try again.";
const weightQuestion = (symptom?: string) =>
  symptom === "intermittent" ? "intermittent" : "continuous";

export function ReportIntake({
  onSubmit,
  busy,
}: {
  onSubmit: (request: CreateCase) => void;
  busy: boolean;
}) {
  const [step, setStep] = useState<"photo" | "context">("photo");
  const [photo, setPhoto] = useState<VisionAssessment | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [scenario, setScenario] = useState<GoldenScenario | null>(null);
  const [questionsError, setQuestionsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ObservationChoice>>({});
  const [notes, setNotes] = useState("");
  const [logInput, setLogInput] = useState<LogPreviewRequest | null>(null);
  const [context, setContext] = useState<LogContext | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const sequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const contextHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    loadGoldenScenario()
      .then((value) => {
        if (active) {
          setScenario(value);
          setQuestionsError("");
        }
      })
      .catch((error) => {
        if (active) setQuestionsError(failure(error));
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  function move(next: "photo" | "context") {
    setStep(next);
    requestAnimationFrame(() =>
      (next === "photo" ? heading : contextHeading).current?.focus(),
    );
  }
  function invalidateLogAnswers() {
    setConfirmed(false);
    setAnswers((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(([, answer]) => answer.source !== "machine_log")
          .map(([key, answer]) => [key, { ...answer, reason: "" }]),
      ),
    );
  }
  function removeLog(clearInput = true) {
    sequence.current += 1;
    invalidateLogAnswers();
    setLogInput(null);
    setContext(null);
    setLogBusy(false);
    setLogError("");
    if (clearInput && fileInput.current) fileInput.current.value = "";
  }
  async function parseLog(input: LogPreviewRequest, board?: string) {
    const token = ++sequence.current;
    invalidateLogAnswers();
    setContext(null);
    setLogBusy(true);
    setLogError("");
    try {
      const result = await previewLogContext(input, board);
      if (token === sequence.current) {
        setContext(result);
        setLogInput(input);
      }
    } catch (error) {
      if (token === sequence.current) {
        setLogError(failure(error));
        setLogInput(null);
      }
    } finally {
      if (token === sequence.current) setLogBusy(false);
    }
  }
  async function upload(file: File) {
    removeLog(false);
    if (
      !/\.(log|txt)$/i.test(file.name) ||
      file.size > 2_000_000 ||
      file.size === 0
    ) {
      setLogError("Choose a non-empty .log or .txt file up to 2 MB.");
      return;
    }
    const token = ++sequence.current;
    setLogBusy(true);
    try {
      const text = await file.text();
      if (token !== sequence.current) return;
      await parseLog({ text, sourceName: file.name, timezoneOffset: null });
    } catch (error) {
      if (token === sequence.current) {
        setLogError(failure(error));
        setLogBusy(false);
      }
    }
  }
  const ids = [
    "frequency",
    weightQuestion(answers.frequency?.value),
    "change",
    "temperature",
    "service",
  ];
  const questions = ids
    .map((id) => scenario?.questions.find((q) => q.id === id))
    .filter((q) => !!q);
  const signals = context?.signals ?? {};
  const complete =
    questions.length === 5 &&
    ids.every((id) => {
      const answer = answers[id];
      if (!answer?.value) return false;
      const signal = signals[id];
      const disagreement =
        signal &&
        ((answer.source !== "machine_log" &&
          ![signal.answer, "unknown"].includes(answer.value)) ||
          (answer.observed_value != null &&
            ![signal.answer, "unknown"].includes(answer.observed_value)));
      return !disagreement || !!answer.reason?.trim();
    }) &&
    (!context || confirmed) &&
    !logBusy &&
    !!photo;
  function select(id: string, value: string) {
    setAnswers((current) => {
      const next = {
        ...current,
        [id]: { value, source: "technician_input" as const, reason: "" },
      };
      if (id === "frequency" && value !== current.frequency?.value) {
        delete next.continuous;
        delete next.intermittent;
      }
      return next;
    });
  }
  function applyLogEvidence(id: string) {
    const signal = signals[id];
    if (!signal || !confirmed) return;
    setAnswers((current) => ({
      ...current,
      [id]: {
        value: signal.answer,
        source: "machine_log",
        observed_value:
          current[id]?.observed_value ??
          (current[id]?.source === "technician_input"
            ? current[id].value
            : null),
        reason: current[id]?.reason ?? "",
      },
    }));
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || !photo || busy) return;
    const observations = Object.fromEntries(ids.map((id) => [id, answers[id]]));
    const symptom =
      questions[0]?.options.find((o) => o.value === answers.frequency.value)
        ?.label ?? "Spray concern";
    const contextBody: IntakeContext = {
      log: logInput,
      board_id: context?.board_id ?? null,
      log_confirmed: !!context && confirmed,
      observations,
      notes,
    };
    onSubmit({
      report: notes.trim() || `Reported spray symptom: ${symptom}.`,
      assessment_id: photo.assessment_id,
      context: contextBody,
    });
  }
  return (
    <section className="report-intake" aria-label="New investigation report">
      <ol className="intake-steps" aria-label="Report steps">
        <li aria-current={step === "photo" ? "step" : undefined}>
          <span>
            {step === "context" ? <CheckCircle aria-hidden="true" /> : "01"}
          </span>
          Inspect photo
        </li>
        <li aria-current={step === "context" ? "step" : undefined}>
          <span>02</span>Add context
        </li>
        <li>
          <span>03</span>Review diagnosis
        </li>
      </ol>
      <div hidden={step !== "photo"}>
        <h2 ref={heading} tabIndex={-1} className="intake-section-title">
          Start with the inspection photo
        </h2>
        <PhotoInput
          value={photo}
          onChange={(next) => {
            setPhoto(next);
            invalidateLogAnswers();
          }}
          onBusy={setPhotoBusy}
        />
        {photo && (
          <div className="intake-footer">
            <p>Review the highlighted area, then add the machine context.</p>
            <button
              type="button"
              className="primary"
              disabled={photoBusy}
              onClick={() => move("context")}
            >
              Continue to context
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div hidden={step !== "context"}>
        <div className="intake-title">
          <div>
            <p className="eyebrow">02 / REPORT CONTEXT</p>
            <h2 ref={contextHeading} tabIndex={-1}>
              Connect the evidence
            </h2>
            <p>Bring the machine record and your observations together.</p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => move("photo")}
          >
            <ArrowLeft aria-hidden="true" />
            Back to photo
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="intake-layout">
            <div className="intake-main">
              <section
                className="intake-card"
                aria-labelledby="intake-log-title"
              >
                <div className="intake-card-heading">
                  <FileText aria-hidden="true" />
                  <div>
                    <h3 id="intake-log-title">Machine log</h3>
                    <p>Optional · use measurements from the same inspection.</p>
                  </div>
                </div>
                <label htmlFor="intake-log" className="intake-upload-label">
                  Upload machine log
                </label>
                <input
                  ref={fileInput}
                  id="intake-log"
                  type="file"
                  accept=".log,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                <p className="intake-help">.log or .txt · up to 2 MB</p>
                {logBusy && <p role="status">Reading machine events…</p>}
                {logError && (
                  <p className="intake-error" role="alert">
                    {logError}
                  </p>
                )}
                {(context || logBusy) && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeLog()}
                  >
                    Remove log
                  </button>
                )}
                {!context && !logBusy && (
                  <p className="intake-muted">
                    No log attached. You can continue using your observations.
                  </p>
                )}
                {context && (
                  <div className="intake-log-result">
                    <p className="intake-filename">
                      <FileText aria-hidden="true" />
                      {context.parsed.sourceName}
                    </p>
                    <p className="intake-help">
                      {context.parsed.timeRange.start ?? "No timestamp"} →{" "}
                      {context.parsed.timeRange.end ?? "No timestamp"} ·{" "}
                      {context.parsed.stats.recognizedEventCount} recognized
                      events
                    </p>
                    {context.boards.length > 0 ? (
                      <label className="intake-board">
                        Board shown in the photo
                        <select
                          value={context.board_id ?? ""}
                          onChange={(e) => {
                            if (logInput)
                              void parseLog(logInput, e.target.value);
                          }}
                        >
                          {context.boards.map((board) => (
                            <option key={board} value={board}>
                              Board {board}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="intake-note">
                        No complete, unambiguous Board found. This log can be
                        retained as context; use your observations below.
                      </p>
                    )}
                    {Object.keys(signals).length ? (
                      <div className="intake-measurements">
                        {[
                          weightQuestion(answers.frequency?.value),
                          "change",
                        ].map(
                          (key) =>
                            signals[key] && (
                              <div key={key}>
                                <strong>
                                  {key === "change"
                                    ? "Recorded pressure"
                                    : "Recorded flux weight"}
                                </strong>
                                <p>{signals[key].summary}</p>
                              </div>
                            ),
                        )}
                      </div>
                    ) : (
                      <p className="intake-note">
                        Not enough comparable measurements to suggest weight or
                        pressure answers.
                      </p>
                    )}
                    <label className="intake-confirm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => {
                          if (!e.target.checked) invalidateLogAnswers();
                          else setConfirmed(true);
                        }}
                      />
                      <span>
                        I confirm this log
                        {context.board_id
                          ? ` and Board ${context.board_id}`
                          : ""}{" "}
                        match the inspection.
                      </span>
                    </label>
                    <details className="intake-raw">
                      <summary>
                        Raw events & parsing notes (
                        {context.parsed.warnings.length})
                      </summary>
                      <p>
                        Run PASS records machine completion; it does not
                        establish coating quality. Times remain local when no
                        timezone is supplied.
                      </p>
                      {context.parsed.warnings.map((warning, i) => (
                        <p key={i}>
                          Line {warning.line}: {warning.message}
                        </p>
                      ))}
                      <ol>
                        {context.parsed.events.map((event) => (
                          <li key={event.id}>
                            <span>{event.sourceRef}</span>
                            <pre>{event.raw}</pre>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                )}
              </section>
              <section
                className="intake-card"
                aria-labelledby="intake-observations-title"
              >
                <div className="intake-card-heading">
                  <ListChecks aria-hidden="true" />
                  <div>
                    <h3 id="intake-observations-title">Your observations</h3>
                    <p>
                      Record what is known. “Not recorded” is a valid answer.
                    </p>
                  </div>
                </div>
                {questionsError && (
                  <div role="alert">
                    <p>{questionsError}</p>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setRetry((v) => v + 1)}
                    >
                      Retry questions
                    </button>
                  </div>
                )}
                {!scenario && !questionsError && (
                  <p role="status">Loading observation questions…</p>
                )}
                {questions.map((q) => {
                  const answer = answers[q.id];
                  const signal = signals[q.id];
                  const conflict =
                    signal &&
                    answer &&
                    ((answer.source !== "machine_log" &&
                      ![signal.answer, "unknown"].includes(answer.value)) ||
                      (answer.observed_value != null &&
                        ![signal.answer, "unknown"].includes(
                          answer.observed_value,
                        )));
                  return (
                    <fieldset className="intake-question" key={q.id}>
                      <legend>{q.prompt}</legend>
                      <p className="intake-help">{q.rationale}</p>
                      <div className="intake-options">
                        {q.options.map((option) => (
                          <label
                            key={option.value}
                            className={
                              answer?.value === option.value
                                ? "is-selected"
                                : ""
                            }
                          >
                            <input
                              type="radio"
                              name={`observation-${q.id}`}
                              value={option.value}
                              checked={answer?.value === option.value}
                              onChange={() => select(q.id, option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {signal && (
                        <div className="intake-suggestion">
                          <div>
                            <span className="intake-source">Machine log</span>
                            <p>{signal.summary}</p>
                            <small>{signal.source_refs.join(" · ")}</small>
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            disabled={!confirmed}
                            onClick={() => applyLogEvidence(q.id)}
                          >
                            {answer?.source === "machine_log"
                              ? "Using log evidence"
                              : "Use log evidence"}
                          </button>
                          {!confirmed && (
                            <small>
                              Confirm the log above to use this measurement.
                            </small>
                          )}
                        </div>
                      )}
                      {answer && (
                        <p className="intake-answer-source">
                          Answer source:{" "}
                          {answer.source === "machine_log"
                            ? "confirmed machine record"
                            : "technician observation"}
                        </p>
                      )}
                      {conflict && (
                        <div className="intake-conflict">
                          <p>
                            <WarningCircle aria-hidden="true" />
                            The log and your observation differ.{" "}
                            {answer.source === "machine_log"
                              ? "The log answer is selected; your original observation will be retained."
                              : "Your observation is selected. You can keep it or use the log evidence above."}
                          </p>
                          <label>
                            Why use this source?
                            <textarea
                              required
                              maxLength={500}
                              value={answer.reason ?? ""}
                              onChange={(e) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [q.id]: {
                                    ...current[q.id],
                                    reason: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                      )}
                    </fieldset>
                  );
                })}
                <label className="intake-notes" htmlFor="intake-notes">
                  Additional observations <span>Optional</span>
                </label>
                <textarea
                  id="intake-notes"
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  placeholder="Anything else noticed during this inspection?"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </section>
            </div>
            <aside
              className="intake-photo-summary"
              aria-label="Photo evidence summary"
            >
              <span className="intake-source">
                <ImageSquare aria-hidden="true" />
                PHOTO EVIDENCE
              </span>
              {photo && (
                <>
                  <img
                    src={photo.heatmap_url}
                    alt="Analyzed photo: anomaly heatmap"
                  />
                  <h3>
                    {photo.passed
                      ? "Within reference range"
                      : "Visual anomaly detected"}
                  </h3>
                  <p className="intake-score">
                    {photo.raw_score.toFixed(2)}
                    <span> / {photo.threshold.toFixed(2)} threshold</span>
                  </p>
                  <p>
                    PatchCore highlights visual differences. Your context helps
                    decide what to inspect next.
                  </p>
                </>
              )}
              <div className="intake-checklist">
                <p>
                  <CheckCircle aria-hidden="true" />
                  Photo analyzed
                </p>
                <p>
                  {context && confirmed ? (
                    <CheckCircle aria-hidden="true" />
                  ) : (
                    <FileText aria-hidden="true" />
                  )}
                  {context
                    ? confirmed
                      ? "Log confirmed"
                      : "Log needs confirmation"
                    : "Machine log optional"}
                </p>
                <p>
                  <ListChecks aria-hidden="true" />
                  {ids.filter((id) => answers[id]).length} of 5 observations
                  recorded
                </p>
              </div>
            </aside>
          </div>
          <footer className="intake-footer">
            <p>
              {complete
                ? "Evidence ready. Generate the diagnosis to choose the next check."
                : "Complete the observations and confirm any attached log."}
            </p>
            <button
              className="primary"
              type="submit"
              disabled={!complete || busy}
            >
              {busy ? "Generating diagnosis…" : "Generate diagnosis"}
              <ArrowRight aria-hidden="true" />
            </button>
          </footer>
        </form>
      </div>
    </section>
  );
}

export function IntakeEvidenceSummary({ value }: { value: Case }) {
  if (!value.intake || !("assessment_id" in value.measurement)) return null;
  const record = value.intake;
  return (
    <section
      className="intake-evidence-summary"
      aria-label="Diagnosis evidence sources"
    >
      <article>
        <span className="intake-source">
          <ImageSquare aria-hidden="true" />
          Photo
        </span>
        <strong>
          {value.measurement.passed
            ? "Within reference range"
            : "Visual difference detected"}
        </strong>
        <p>
          Score {value.measurement.raw_score.toFixed(2)} · threshold{" "}
          {value.measurement.threshold.toFixed(2)}
        </p>
      </article>
      <article>
        <span className="intake-source">
          <FileText aria-hidden="true" />
          Machine log
        </span>
        <strong>
          {value.log
            ? `Board ${record.board_id ?? "not identified"}`
            : "Not provided"}
        </strong>
        <p>
          {value.log?.sourceName ??
            "Diagnosis uses the photo and technician observations."}
        </p>
        {value.log && (
          <details>
            <summary>Measurements & source lines</summary>
            {Object.entries(record.signals)
              .filter(([key]) => key in record.observations)
              .map(([key, signal]) => (
                <div key={key}>
                  <p>{signal.summary}</p>
                  <small>{signal.source_refs.join(" · ")}</small>
                </div>
              ))}
            <pre>
              {value.log.events
                .map((event) => `${event.sourceRef}\n${event.raw}`)
                .join("\n\n")}
            </pre>
          </details>
        )}
      </article>
      <article>
        <span className="intake-source">
          <ListChecks aria-hidden="true" />
          Technician
        </span>
        <strong>Context recorded</strong>
        <p>{record.notes || value.investigation.title}</p>
        <small>
          Confirmed inspection is still needed to establish a mechanical cause.
        </small>
      </article>
    </section>
  );
}
