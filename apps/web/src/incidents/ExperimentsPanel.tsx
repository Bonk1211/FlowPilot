import { useEffect, useState } from "react";
import type {
  ExperimentProposal,
  IncidentExperiment,
} from "@flowpilot/contracts";
import { incidentJson, type Incident } from "./api";
import { settledPlan } from "./experimentRuns";
import { useIncidentAccess } from "./AccessPanel";
import "./experiments.css";
import { StatusChip } from "./StatusChip";
import {
  defaultControls,
  defaultExpectation,
  defaultLevels,
  factorSpecs,
  mechanismTitles,
  type FactorName,
} from "./experimentDefaults";

const mechanisms = mechanismTitles;
const factors = factorSpecs;
const factorNames = Object.keys(factors) as FactorName[];
type PlanAction = "approve" | "run" | "withdraw";

function PlanDetail({ plan }: { plan: IncidentExperiment }) {
  return (
    <>
      <div className="incident-section-title">
        <h3>Stored mock plan · {plan.id}</h3>
        <StatusChip kind="simulated" detail={plan.status} />
      </div>
      <p>
        {plan.matrix.length} fixed runs including one baseline per mechanism.
        Response:{" "}
        {plan.proposal.response === "relative_mass"
          ? "normalized mass"
          : "coverage fraction"}
        . Repetitions: {plan.proposal.repetitions}.
      </p>
      <p className="incident-caption">
        Plan version {plan.plan_revision} · Source incident r
        {plan.source_incident_revision} · {plan.model_version} ·{" "}
        {plan.fixture_version}
      </p>
      <p
        className={
          plan.source_current ? "incident-caption" : "incident-experiment-error"
        }
      >
        {plan.source_current
          ? "Source snapshot is current."
          : "Source snapshot changed. Approval and execution are blocked; propose a fresh plan from the current incident."}
      </p>
      {plan.approved_by && (
        <p className="incident-caption">
          Mock execution approved by {plan.approved_by} · {plan.approved_at}
        </p>
      )}
      <div
        className="incident-experiment-table"
        tabIndex={0}
        role="region"
        aria-label="Stored experiment matrix and synthetic results"
      >
        <table>
          <caption>
            Immutable matrix · {plan.matrix.length} runs · all inputs and
            responses are dimensionless and synthetic.
          </caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Mechanism</th>
              <th scope="col">Condition</th>
              {factorNames.map((name) => (
                <th key={name} scope="col">
                  {factors[name].label}
                </th>
              ))}
              <th scope="col">Mean response</th>
              <th scope="col">Baseline contrast</th>
            </tr>
          </thead>
          <tbody>
            {plan.matrix.map((condition) => {
              const result = (plan.results ?? []).find(
                (item) => item.condition.index === condition.index,
              );
              return (
                <tr key={condition.index}>
                  <th scope="row">{condition.index}</th>
                  <td>{mechanisms[condition.hypothesis_id]}</td>
                  <td>
                    {condition.baseline
                      ? "Baseline"
                      : `Repetition ${condition.repetition}`}
                  </td>
                  {factorNames.map((name) => (
                    <td key={name}>{condition.parameters[name].toFixed(2)}</td>
                  ))}
                  <td>
                    {result ? result.response_mean.toFixed(5) : "Not run"}
                  </td>
                  <td>
                    {result
                      ? result.contrast_from_baseline.toFixed(5)
                      : "Not run"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {plan.analysis && (
        <section
          className="incident-experiment-analysis"
          aria-label="Mock experiment analysis"
        >
          <h4>
            {plan.analysis.outcome === "inconclusive"
              ? "Inconclusive simulated comparison"
              : "Simulated differences observed"}
          </h4>
          <p>{plan.analysis.summary}</p>
          <p>
            <strong>
              Synthetic responses do not confirm a physical cause.
            </strong>{" "}
            No machine test or measurement was performed.
          </p>
          <p className="incident-caption">
            Aggregation: {plan.analysis.response_aggregation}. The{" "}
            {plan.analysis.demonstration_contrast_threshold} comparison
            threshold is a demonstration choice, without machine validation.
          </p>
          <div
            className="incident-experiment-table"
            tabIndex={0}
            role="region"
            aria-label="Synthetic factorial main effects"
          >
            <table>
              <caption>
                Main effect = high-level mean minus low-level mean within the
                fixed matrix.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Mechanism</th>
                  <th scope="col">Factor</th>
                  <th scope="col">Low → high level</th>
                  <th scope="col">Low mean</th>
                  <th scope="col">High mean</th>
                  <th scope="col">Main effect</th>
                </tr>
              </thead>
              <tbody>
                {plan.analysis.effects.map((effect) => (
                  <tr key={`${effect.hypothesis_id}-${effect.factor}`}>
                    <th scope="row">{mechanisms[effect.hypothesis_id]}</th>
                    <td>{factors[effect.factor].label}</td>
                    <td>
                      {effect.low_level} → {effect.high_level}
                    </td>
                    <td>{effect.low_mean.toFixed(5)}</td>
                    <td>{effect.high_mean.toFixed(5)}</td>
                    <td>{effect.main_effect.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul>
            {plan.analysis.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      <details className="incident-experiment-context">
        <summary>Source, prerequisites and fixed analysis plan</summary>
        <p>{plan.proposal.expected_discrimination}</p>
        <p>Analysis: {plan.analysis_plan}.</p>
        <p>
          Reference: {plan.source_passage.title} ·{" "}
          {plan.source_passage.revision} · {plan.source_passage.section} ·{" "}
          {plan.source_passage.approval_status.replaceAll("_", " ")}.
        </p>
        <blockquote>{plan.source_passage.passage}</blockquote>
        <p>{plan.source_passage.limitation}</p>
        <p className="incident-caption">
          Source snapshot: {plan.source_evidence.length} evidence records and{" "}
          {plan.source_observations.length} observations. Source fingerprint:{" "}
          <code>{plan.source_fingerprint}</code>
        </p>
        <h4>Prerequisites</h4>
        <ul>
          {plan.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h4>Stopping conditions</h4>
        <ul>
          {plan.stopping_conditions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Physical execution is unavailable. This approval covers the stored
          synthetic matrix only.
        </p>
      </details>
      <details className="incident-experiment-context">
        <summary>Experiment history</summary>
        <ol>
          {plan.history.map((event, index) => (
            <li key={index}>
              <strong>{event.action}</strong> · {event.actor} ·{" "}
              {event.timestamp}
              <p>{event.detail}</p>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

export function ExperimentsPanel({
  incident,
  busy,
}: {
  incident: Incident;
  busy: boolean;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [demoEngineer, setDemoEngineer] = useState(false);
  const canAuthorize =
    access.mode === "demo"
      ? demoEngineer
      : access.permissions.includes("authorize_test");
  const [opened, setOpened] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [plans, setPlans] = useState<IncidentExperiment[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] =
    useState<ExperimentProposal["check_id"]>("delivery_review");
  const [response, setResponse] =
    useState<ExperimentProposal["response"]>("relative_mass");
  const [repetitions, setRepetitions] = useState(1);
  const [enabled, setEnabled] = useState<FactorName[]>(["severity"]);
  const [levels, setLevels] =
    useState<Record<FactorName, number[]>>(defaultLevels);
  const [controls, setControls] = useState(defaultControls);
  const [expectation, setExpectation] = useState(defaultExpectation);
  const [withdrawal, setWithdrawal] = useState("");
  const path = `/api/incidents/${encodeURIComponent(incident.id)}/experiments`;
  const plan = plans?.find((item) => item.id === selectedId) ?? plans?.at(-1);
  const runCount =
    3 *
    (enabled.reduce((count, name) => count * levels[name].length, 1) *
      repetitions +
      1);
  const validLevels =
    enabled.length > 0 &&
    enabled.every(
      (name) =>
        levels[name].every(
          (value) =>
            Number.isFinite(value) &&
            value >= factors[name].min &&
            value <= factors[name].max,
        ) && new Set(levels[name]).size === levels[name].length,
    );
  const synthetic =
    ["synthetic", "replay"].includes(incident.mode) &&
    (incident.evidence ?? []).every((item) => item.synthetic) &&
    (incident.observations ?? []).every((item) => item.synthetic);
  const blocked = busy || saving;

  useEffect(() => {
    if (!opened) return;
    let alive = true;
    const controller = new AbortController();
    incidentJson<IncidentExperiment[]>(path, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then((value) => {
        if (alive) {
          setPlans(value);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (alive)
          setError(
            cause instanceof Error
              ? cause.message
              : "Saved mock plans could not be loaded.",
          );
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [opened, path, incident.revision, attempt]);

  async function mutate(action: "propose" | PlanAction) {
    if (blocked) return;
    setSaving(true);
    setError("");
    setNotice("");
    const proposal: ExperimentProposal = {
      incident_revision: incident.revision,
      check_id: check,
      hypothesis_ids: [
        "restriction",
        "unstable_delivery",
        "material_condition",
      ],
      factors: enabled.map((name) => ({ name, levels: levels[name] })),
      controls,
      repetitions,
      response,
      expected_discrimination: expectation.trim(),
    };
    try {
      let result = await incidentJson<IncidentExperiment>(
        action === "propose"
          ? path
          : `${path}/${encodeURIComponent(plan!.id)}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(access.mode === "demo" &&
            canAuthorize &&
            action !== "propose" &&
            action !== "run"
              ? { "X-Incident-Role": "engineer" }
              : {}),
          },
          body: JSON.stringify(
            action === "propose"
              ? proposal
              : {
                  revision: plan!.revision,
                  ...(action === "withdraw"
                    ? { notes: withdrawal.trim() }
                    : {}),
                },
          ),
        },
      );
      if (result.status === "running") {
        setNotice(
          "Running the stored matrix. Each condition is saved as it finishes.",
        );
        result = await settledPlan(path, result, {
          onProgress: (progress) =>
            setNotice(
              `Running the stored matrix: ${progress.results?.length ?? 0} of ${progress.matrix.length} conditions saved.`,
            ),
        });
      }
      const saved = result;
      setPlans((current) => [
        ...(current ?? []).filter((item) => item.id !== saved.id),
        saved,
      ]);
      setSelectedId(result.id);
      setWithdrawal("");
      setDesignOpen(false);
      setNotice(
        action === "propose"
          ? "Mock plan saved. Review the complete matrix before separate authorization."
          : action === "approve"
            ? "Stored matrix approved for mock execution only."
            : action === "run"
              ? "Mock experiment saved. The incident diagnosis is unchanged."
              : "Mock plan withdrawn; its history is preserved.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The mock plan could not be saved.",
      );
      // A source conflict may withdraw the plan server-side; show the persisted status.
      try {
        setPlans(await incidentJson<IncidentExperiment[]>(path));
      } catch {
        /* Keep the original action error and saved local view. */
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <details
      className="incident-card incident-experiments"
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          setOpened(event.currentTarget.open);
      }}
    >
      <summary>
        Mock experiment planner <span>Simulated · no physical execution</span>
      </summary>
      <p>
        Predefine a bounded factorial comparison, review its complete matrix,
        then run the approved toy-model conditions once. All three competing
        mechanisms are compared. Synthetic responses cannot confirm a machine
        fault.
      </p>
      {!synthetic && (
        <p className="incident-experiment-error">
          Mock plans require a completely synthetic incident package. Observed
          evidence cannot be used as simulated experiment input.
        </p>
      )}
      {error && (
        <p role="alert" className="incident-experiment-error">
          {error}{" "}
          <button
            type="button"
            disabled={blocked}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reload mock plans
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {plans === null && !error && opened && (
        <p role="status">Loading saved mock plans…</p>
      )}
      <details
        className="incident-experiment-design"
        open={designOpen}
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setDesignOpen(event.currentTarget.open);
        }}
      >
        <summary>Design a new mock experiment</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (
              validLevels &&
              runCount <= 54 &&
              synthetic &&
              canEdit &&
              expectation.trim()
            )
              void mutate("propose");
          }}
        >
          <fieldset disabled={blocked || !canEdit || !synthetic}>
            <legend>Fixed design · normalized model inputs only</legend>
            <div className="incident-experiment-grid">
              <label>
                Diagnostic check
                <select
                  value={check}
                  onChange={(event) =>
                    setCheck(
                      event.target.value as ExperimentProposal["check_id"],
                    )
                  }
                >
                  <option value="delivery_review">
                    Recorded delivery comparison
                  </option>
                  <option value="restriction_review">
                    Recorded fluid-path review
                  </option>
                  <option value="material_review">
                    Recorded material review
                  </option>
                </select>
              </label>
              <label>
                Response to compare
                <select
                  value={response}
                  onChange={(event) =>
                    setResponse(
                      event.target.value as ExperimentProposal["response"],
                    )
                  }
                >
                  <option value="relative_mass">Normalized mass</option>
                  <option value="coverage_fraction">Coverage fraction</option>
                </select>
              </label>
              <label>
                Repetitions per condition
                <select
                  value={repetitions}
                  onChange={(event) =>
                    setRepetitions(Number(event.target.value))
                  }
                >
                  {[1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="incident-caption">
              Comparison: fluid-path restriction, unstable fluid delivery and
              material-condition change. Repetitions are deterministic and do
              not estimate physical variability.
            </p>
            {factorNames.map((name) => (
              <fieldset className="incident-experiment-factor" key={name}>
                <legend>
                  {factors[name].label} · domain {factors[name].min}–
                  {factors[name].max}
                </legend>
                <label className="incident-experiment-check">
                  <input
                    type="checkbox"
                    checked={enabled.includes(name)}
                    onChange={(event) =>
                      setEnabled((current) =>
                        event.target.checked
                          ? [...current, name]
                          : current.filter((item) => item !== name),
                      )
                    }
                  />
                  Vary {factors[name].label.toLowerCase()}
                </label>
                <div className="incident-experiment-grid">
                  <label>
                    {factors[name].label} baseline / control
                    <input
                      type="number"
                      required
                      min={factors[name].min}
                      max={factors[name].max}
                      step="0.01"
                      value={
                        Number.isFinite(controls[name]) ? controls[name] : ""
                      }
                      onChange={(event) =>
                        setControls((current) => ({
                          ...current,
                          [name]: event.target.valueAsNumber,
                        }))
                      }
                    />
                  </label>
                  {enabled.includes(name) && (
                    <>
                      <label>
                        {factors[name].label} level count
                        <select
                          value={levels[name].length}
                          onChange={(event) =>
                            setLevels((current) => ({
                              ...current,
                              [name]:
                                Number(event.target.value) === 2
                                  ? current[name].slice(0, 2)
                                  : [
                                      ...current[name],
                                      (factors[name].min + factors[name].max) /
                                        2,
                                    ],
                            }))
                          }
                        >
                          <option value={2}>2 levels</option>
                          <option value={3}>3 levels</option>
                        </select>
                      </label>
                      {levels[name].map((value, index) => (
                        <label key={index}>
                          {factors[name].label} level {index + 1}
                          <input
                            type="number"
                            required
                            min={factors[name].min}
                            max={factors[name].max}
                            step="0.01"
                            value={Number.isFinite(value) ? value : ""}
                            onChange={(event) =>
                              setLevels((current) => ({
                                ...current,
                                [name]: current[name].map((item, position) =>
                                  position === index
                                    ? event.target.valueAsNumber
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </fieldset>
            ))}
            <label>
              Expected discrimination
              <textarea
                required
                maxLength={2000}
                rows={2}
                value={expectation}
                onChange={(event) => setExpectation(event.target.value)}
              />
            </label>
            <p>
              <strong>{runCount} planned runs</strong> including three baselines
              · maximum 54. Factor levels replace the baseline controls in
              varied conditions.
            </p>
            {(!validLevels || runCount > 54) && (
              <p className="incident-experiment-error">
                Choose at least one factor with two or three distinct finite
                levels within its domain, and keep the complete design at 54
                runs or fewer.
              </p>
            )}
            <button
              className="primary"
              type="submit"
              disabled={!validLevels || runCount > 54 || !expectation.trim()}
            >
              Propose mock experiment
            </button>
          </fieldset>
        </form>
      </details>
      {plans?.length === 0 && (
        <p className="incident-caption">
          No saved mock plans. Propose a fixed matrix to begin.
        </p>
      )}
      {!!plans?.length && (
        <label>
          Saved mock plans
          <select
            value={plan?.id ?? ""}
            disabled={blocked}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setWithdrawal("");
            }}
          >
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.status} · source r
                {item.source_incident_revision}
              </option>
            ))}
          </select>
        </label>
      )}
      {plan && (
        <article className="incident-experiment-plan">
          <PlanDetail plan={plan} />
          {["proposed", "approved"].includes(plan.status) && (
            <div className="incident-experiment-authorization">
              {access.mode === "demo" ? (
                <label className="incident-experiment-check">
                  <input
                    type="checkbox"
                    checked={demoEngineer}
                    disabled={blocked}
                    onChange={(event) => setDemoEngineer(event.target.checked)}
                  />
                  Use the demo engineer role to authorize this mock experiment
                </label>
              ) : (
                <p className="incident-caption">
                  Reviewer: {access.subject}.{" "}
                  {canAuthorize
                    ? "Mock-test authorization permission available."
                    : "An account with mock-test authorization permission must approve or withdraw this plan."}
                </p>
              )}
              {access.mode === "demo" && (
                <p className="incident-caption">
                  Local demonstration role only; this is not production
                  authentication.
                </p>
              )}
              <div className="incident-actions">
                {plan.status === "proposed" && (
                  <button
                    type="button"
                    disabled={
                      blocked ||
                      !canAuthorize ||
                      !plan.source_current ||
                      !synthetic
                    }
                    onClick={() => void mutate("approve")}
                  >
                    Approve stored mock matrix
                  </button>
                )}
                {plan.status === "approved" && (
                  <button
                    className="primary"
                    type="button"
                    disabled={
                      blocked || !canEdit || !plan.source_current || !synthetic
                    }
                    onClick={() => void mutate("run")}
                  >
                    Run approved mock experiment
                  </button>
                )}
              </div>
              <details>
                <summary>Withdraw this mock plan</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (withdrawal.trim() && canAuthorize)
                      void mutate("withdraw");
                  }}
                >
                  <label>
                    Reason for withdrawing
                    <textarea
                      rows={2}
                      maxLength={2000}
                      required
                      value={withdrawal}
                      onChange={(event) => setWithdrawal(event.target.value)}
                      disabled={blocked || !canAuthorize}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={blocked || !canAuthorize || !withdrawal.trim()}
                  >
                    Withdraw mock plan
                  </button>
                </form>
              </details>
            </div>
          )}
          {plan.status === "completed" && (
            <p className="incident-caption">
              Completed matrix is preserved. Conditions cannot be added to this
              result, and the incident diagnosis is unchanged.
            </p>
          )}
        </article>
      )}
    </details>
  );
}
