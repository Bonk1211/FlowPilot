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
  QuestionPlan,
  QuestionPlanRequest,
} from "@flowpilot/contracts";
import {
  loadGoldenScenario,
  previewLogContext,
  planIntakeQuestions,
} from "../api";
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
  const [activeId, setActiveId] = useState("frequency");
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [supplements, setSupplements] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<QuestionPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planningReason, setPlanningReason] = useState("");
  const [clarification, setClarification] =
    useState<QuestionPlan["clarification"]>(null);
  const [clarified, setClarified] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const planningCalls = useRef(0);
  const planningSequence = useRef(0);
  const planningController = useRef<AbortController | null>(null);
  const requestedStates = useRef(new Set<string>());
  const needsReplan = useRef(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
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
      planningController.current?.abort();
    },
    [],
  );
  function move(next: "photo" | "context") {
    if (next === "photo" && planning) cancelPlan();
    setStep(next);
    requestAnimationFrame(() =>
      (next === "photo" ? heading : contextHeading).current?.focus(),
    );
  }
  function cancelPlan() {
    planningSequence.current += 1;
    planningController.current?.abort();
    setPlanning(false);
    setPlan(null);
    setClarification(null);
    needsReplan.current = true;
    if (planningCalls.current)
      setPlanningReason("Evidence changed. Confirm the updated conditions.");
  }
  function invalidateLogAnswers() {
    cancelPlan();
    setAccepted((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([id]) =>
            answers[id]?.source !== "machine_log" && !answers[id]?.reason,
        ),
      ),
    );
    setActiveId(
      ids.find((id) => answers[id]?.source === "machine_log") ??
        (activeId === "review" ? "frequency" : activeId),
    );
    setLogOpen(true);
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
  const signature = (id: string) =>
    JSON.stringify([answers[id], supplements[id] ?? ""]);
  const validAnswer = (id: string) => {
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
  };
  const isAccepted = (id: string) =>
    validAnswer(id) && accepted[id] === signature(id);
  const evidenceReady = (!context || confirmed) && !logBusy && !!photo;
  const complete =
    questions.length === 5 &&
    ids.every(isAccepted) &&
    evidenceReady &&
    !clarification;
  const combinedNotes = [
    notes.trim(),
    ...ids
      .filter((id) => supplements[id]?.trim())
      .map(
        (id) =>
          `${questions.find((q) => q.id === id)?.prompt ?? id}: ${supplements[id].trim()}`,
      ),
  ]
    .filter(Boolean)
    .join("\n");
  function focusQuestion(id: string) {
    setActiveId(id);
    requestAnimationFrame(() => {
      questionHeading.current?.focus({ preventScroll: true });
      questionHeading.current
        ?.closest(".intake-card")
        ?.scrollIntoView({ block: "start" });
    });
  }
  function editAnswer(id: string) {
    cancelPlan();
    setAccepted((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    focusQuestion(id);
  }
  async function continueQuestion() {
    if (
      !validAnswer(activeId) ||
      !evidenceReady ||
      planning ||
      busy ||
      !photo ||
      clarification
    )
      return;
    const nextAccepted = { ...accepted, [activeId]: signature(activeId) };
    setAccepted(nextAccepted);
    const done = ids.filter(
      (id) => validAnswer(id) && nextAccepted[id] === signature(id),
    );
    const observations = Object.fromEntries(
      done.map((id) => [id, answers[id]]),
    );
    const pending = ids.filter((id) => !done.includes(id));
    const chooseNext = (nextPlan: QuestionPlan | null) => {
      const order = nextPlan?.questions.map((q) => q.question_id) ?? [];
      focusQuestion(
        [...order, ...pending].find((id) => pending.includes(id)) ?? "review",
      );
    };
    const signal = signals[activeId];
    const currentAnswer = answers[activeId];
    const conflict =
      !!signal &&
      ((currentAnswer.source !== "machine_log" &&
        ![signal.answer, "unknown"].includes(currentAnswer.value)) ||
        (currentAnswer.observed_value != null &&
          ![signal.answer, "unknown"].includes(currentAnswer.observed_value)));
    const triggered = plan?.replan_when?.some(
      (t) =>
        t.question_id === activeId && t.answer === answers[activeId]?.value,
    );
    const shouldPlan =
      planningCalls.current === 0 ||
      needsReplan.current ||
      !!supplements[activeId]?.trim() ||
      conflict ||
      triggered;
    const snapshot = {
      assessment_id: photo.assessment_id,
      log: logInput,
      board_id: context?.board_id ?? null,
      log_confirmed: !!context && confirmed,
      observations,
      supplements: Object.fromEntries(
        ids
          .filter((id) => supplements[id]?.trim())
          .map((id) => [id, supplements[id]]),
      ),
      clarified: clarified as QuestionPlanRequest["clarified"],
    };
    const fingerprint = JSON.stringify(snapshot);
    if (!shouldPlan || requestedStates.current.has(fingerprint)) {
      chooseNext(plan);
      return;
    }
    if (planningCalls.current >= 2) {
      setPlan(null);
      setPlanningReason(
        "AI request budget reached. Continue with rule guidance; your observations are retained.",
      );
      chooseNext(null);
      return;
    }
    planningCalls.current += 1;
    requestedStates.current.add(fingerprint);
    needsReplan.current = false;
    const token = ++planningSequence.current;
    const stateId = `intake-${token}`;
    const controller = new AbortController();
    planningController.current = controller;
    setPlanning(true);
    setPlanningReason("");
    try {
      // A wall-clock race also bounds response-body processing and ignores late responses.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        planIntakeQuestions(
          { ...snapshot, state_id: stateId },
          controller.signal,
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new Error(
                "Planning reached the 4-second limit. Continue with rule guidance.",
              ),
            );
          }, 4000);
        }),
      ]).finally(() => clearTimeout(timer));
      if (token !== planningSequence.current || result.state_id !== stateId)
        return;
      setPlan(result);
      setPlanningReason(result.fallback_reason ?? "");
      if (
        result.clarification &&
        !clarified.includes(result.clarification.question_id)
      ) {
        const id = result.clarification.question_id;
        setClarification(result.clarification);
        setClarified((current) => [...current, id]);
        setAccepted((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        focusQuestion(id);
      } else chooseNext(result);
    } catch (error) {
      if (token !== planningSequence.current) return;
      setPlan(null);
      setPlanningReason(
        error instanceof Error && error.message.includes("4-second")
          ? error.message
          : "AI planning is unavailable. Continue with rule guidance.",
      );
      chooseNext(null);
    } finally {
      if (token === planningSequence.current) setPlanning(false);
    }
  }
  function select(id: string, value: string) {
    if (planning) cancelPlan();
    if (accepted[id]) needsReplan.current = true;
    if (id === "frequency" && value !== answers.frequency?.value) {
      setPlan(null);
      setClarification(null);
      setSupplements((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([key]) => !["continuous", "intermittent"].includes(key),
          ),
        ),
      );
    }
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
    if (!complete || !photo || busy || combinedNotes.length > 2000) return;
    const observations = Object.fromEntries(ids.map((id) => [id, answers[id]]));
    const symptom =
      questions[0]?.options.find((o) => o.value === answers.frequency.value)
        ?.label ?? "Spray concern";
    const contextBody: IntakeContext = {
      log: logInput,
      board_id: context?.board_id ?? null,
      log_confirmed: !!context && confirmed,
      observations,
      notes: combinedNotes,
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
              <details
                className="intake-card intake-log-disclosure"
                open={logOpen}
                onToggle={(event) => setLogOpen(event.currentTarget.open)}
              >
                <summary>
                  <FileText aria-hidden="true" /> Machine log ·{" "}
                  {context && confirmed
                    ? `Board ${context.board_id} confirmed — Review / change log`
                    : "Optional evidence"}
                </summary>
                <section aria-labelledby="intake-log-title">
                  <div className="intake-card-heading">
                    <FileText aria-hidden="true" />
                    <div>
                      <h3 id="intake-log-title">Machine log</h3>
                      <p>
                        Optional · use measurements from the same inspection.
                      </p>
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
                          Not enough comparable measurements to suggest weight
                          or pressure answers.
                        </p>
                      )}
                      <label className="intake-confirm">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => {
                            if (!e.target.checked) invalidateLogAnswers();
                            else {
                              setConfirmed(true);
                              setLogOpen(false);
                            }
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
              </details>
              <section
                className="intake-card intake-guided-card"
                aria-labelledby="intake-observations-title"
              >
                <div className="intake-card-heading">
                  <ListChecks aria-hidden="true" />
                  <div>
                    <h3 id="intake-observations-title">Guided observations</h3>
                    <p>
                      Confirm what is known. Your answers guide the next
                      question.
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
                <div className="intake-planner-status" role="status">
                  <strong>
                    {planning
                      ? "Reviewing evidence to plan the next question…"
                      : plan?.mode === "live"
                        ? "AI-guided questions"
                        : planningReason
                          ? "Rule guidance"
                          : "Start with the observed symptom"}
                  </strong>
                  <p>
                    {planningReason ||
                      (plan?.mode === "live"
                        ? plan.summary
                        : "Choose an answer, then continue. Not recorded is a valid answer.")}
                  </p>
                  <span>
                    {ids.filter(isAccepted).length} conditions confirmed ·{" "}
                    {ids.filter((id) => !isAccepted(id)).length} remaining
                  </span>
                </div>
                {questions
                  .filter((q) => q.id === activeId)
                  .map((q) => {
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
                    const planned = plan?.questions.find(
                      (item) => item.question_id === q.id,
                    );
                    return (
                      <fieldset
                        className="intake-question"
                        key={q.id}
                        disabled={planning || busy}
                      >
                        <legend className="sr-only">{q.prompt}</legend>
                        <h4 ref={questionHeading} tabIndex={-1}>
                          {planned?.prompt ?? q.prompt}
                        </h4>
                        <p className="intake-help">
                          {planned?.rationale ?? q.rationale}
                        </p>
                        {clarification?.question_id === q.id && (
                          <div className="intake-clarification">
                            <strong>Please confirm this interpretation</strong>
                            <p>{clarification.prompt}</p>
                            <p>
                              Suggested answer:{" "}
                              {
                                q.options.find(
                                  (o) =>
                                    o.value === clarification.proposed_value,
                                )?.label
                              }
                            </p>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                select(q.id, clarification.proposed_value);
                                setClarification(null);
                              }}
                            >
                              Use this interpretation
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setClarification(null)}
                            >
                              Choose my own answer
                            </button>
                          </div>
                        )}
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
                        <label className="intake-supplement">
                          Anything to add? <span>Optional</span>
                          <textarea
                            aria-label="Additional detail for this answer"
                            maxLength={300}
                            rows={2}
                            value={supplements[q.id] ?? ""}
                            onChange={(event) =>
                              setSupplements((current) => ({
                                ...current,
                                [q.id]: event.target.value,
                              }))
                            }
                            placeholder="For example, this started after changing material…"
                          />
                        </label>
                      </fieldset>
                    );
                  })}
                {activeId !== "review" && (
                  <div className="intake-question-navigation">
                    <button
                      type="button"
                      className="secondary"
                      disabled={planning || busy || activeId === "frequency"}
                      onClick={() => {
                        const previous =
                          ids
                            .slice(0, ids.indexOf(activeId))
                            .filter(isAccepted)
                            .at(-1) ?? "frequency";
                        editAnswer(previous);
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={
                        planning ||
                        busy ||
                        !validAnswer(activeId) ||
                        !evidenceReady ||
                        !!clarification
                      }
                      onClick={() => void continueQuestion()}
                    >
                      {planning ? "Planning…" : "Continue"}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                )}
                {!evidenceReady && (
                  <p role="status">
                    {logBusy
                      ? "Reading the machine log…"
                      : "Confirm or remove the attached log before continuing."}
                  </p>
                )}
                {activeId === "review" && (
                  <h4 ref={questionHeading} tabIndex={-1}>
                    Review your confirmed observations
                  </h4>
                )}
                <div hidden={activeId !== "review"}>
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
                  {combinedNotes.length > 2000 && (
                    <p role="alert">
                      Shorten your notes and answer details to 2,000 characters
                      in total.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <aside
              className="intake-photo-summary"
              aria-label="Photo evidence summary"
            >
              <div
                className="intake-answer-summary"
                aria-label="Confirmed observations"
              >
                <h3>Your observations</h3>
                {questions
                  .filter((q) => answers[q.id])
                  .map((q) => (
                    <div
                      key={q.id}
                      className={
                        isAccepted(q.id) ? "is-confirmed" : "is-pending"
                      }
                    >
                      <strong>
                        {
                          {
                            frequency: "Spray symptom",
                            continuous: "Weight trend",
                            intermittent: "Weight compliance",
                            change: "Fluid pressure",
                            temperature: "Material / idle purge",
                            service: "Setup / collision",
                          }[q.id]
                        }
                      </strong>
                      <p>
                        {isAccepted(q.id)
                          ? q.options.find(
                              (o) => o.value === answers[q.id]?.value,
                            )?.label
                          : "Needs confirmation"}
                      </p>
                      {isAccepted(q.id) && (
                        <small>
                          {answers[q.id].source === "machine_log"
                            ? "Machine log"
                            : "Technician observation"}
                        </small>
                      )}
                      {answers[q.id] && (
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Edit ${q.prompt}`}
                          disabled={busy}
                          onClick={() => editAnswer(q.id)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              <p className="intake-remaining">
                Still to confirm:{" "}
                {questions
                  .filter((q) => !isAccepted(q.id))
                  .map(
                    (q) =>
                      ({
                        frequency: "symptom",
                        continuous: "weight",
                        intermittent: "weight",
                        change: "pressure",
                        temperature: "material",
                        service: "setup",
                      })[q.id],
                  )
                  .join(", ") || "none"}
                .
              </p>
              {plan?.mode === "live" && (
                <details className="intake-plan-sources">
                  <summary>Planning evidence</summary>
                  <ul>
                    {plan.source_refs.map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                  </ul>
                </details>
              )}
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
                  {ids.filter(isAccepted).length} conditions recorded
                </p>
              </div>
            </aside>
          </div>
          <footer className="intake-footer" hidden={activeId !== "review"}>
            <p>
              {complete
                ? "Evidence ready. Generate the diagnosis to choose the next check."
                : "Complete the observations and confirm any attached log."}
            </p>
            <button
              className="primary"
              type="submit"
              disabled={!complete || busy || combinedNotes.length > 2000}
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
