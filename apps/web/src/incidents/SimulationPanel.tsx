import { useEffect, useState } from "react";
import type { SimulationDemo, SimulationRun } from "@flowpilot/contracts";
import { incidentJson, type Incident } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import "./simulation.css";

const scenarios = {
  restriction: "Fluid-path restriction",
  unstable_delivery: "Unstable fluid delivery",
  material_condition: "Material-condition change",
} as const;
type Scenario = keyof typeof scenarios;
const lines = [
  { key: "relative_mass", label: "Fixture mass", className: "fixture-mass" },
  {
    key: "learned_relative_mass",
    label: "Learned mass",
    className: "learned-mass",
  },
  {
    key: "coverage_fraction",
    label: "Fixture coverage",
    className: "fixture-coverage",
  },
  {
    key: "learned_coverage_fraction",
    label: "Learned coverage",
    className: "learned-coverage",
  },
] as const;

function ResponsePlot({ run }: { run: SimulationRun }) {
  const x = (value: number) => 50 + value * 500;
  const y = (value: number) => 225 - (value / 1.5) * 190;
  return (
    <div className="incident-simulation-result">
      <div className="incident-simulation-legend">
        {lines.map((line) => (
          <span key={line.key}>
            <svg viewBox="0 0 34 10" aria-hidden="true">
              <line x1="1" y1="5" x2="33" y2="5" className={line.className} />
            </svg>
            {line.label}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 600 278"
        className="incident-simulation-chart"
        role="img"
        aria-label={`Simulated ${scenarios[run.scenario]} response over 13 normalized sequence positions. Fixture and learned mass and coverage curves; all values are synthetic. Exact values are in the table below.`}
      >
        {[0, 0.5, 1, 1.5].map((tick) => (
          <g key={tick}>
            <line
              x1="50"
              y1={y(tick)}
              x2="550"
              y2={y(tick)}
              className="simulation-grid"
            />
            <text x="40" y={y(tick) + 4} textAnchor="end">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <text key={tick} x={x(tick)} y="248" textAnchor="middle">
            {tick.toFixed(2)}
          </text>
        ))}
        <text x="50" y="18">
          Normalized response · simulated
        </text>
        <text x="300" y="272" textAnchor="middle">
          Normalized sequence position · not elapsed time
        </text>
        {lines.map((line) => (
          <polyline
            key={line.key}
            className={line.className}
            points={run.points
              .map((point) => `${x(point.position)},${y(point[line.key])}`)
              .join(" ")}
          />
        ))}
      </svg>
      <details>
        <summary>
          Exact simulated values · {run.points.length} positions
        </summary>
        <div
          className="incident-simulation-table"
          tabIndex={0}
          role="region"
          aria-label="Scrollable simulated values"
        >
          <table>
            <caption>
              Dimensionless synthetic responses; no physical measurement units.
            </caption>
            <thead>
              <tr>
                <th scope="col">Position</th>
                {lines.map((line) => (
                  <th key={line.key} scope="col">
                    {line.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.points.map((point) => (
                <tr key={point.step}>
                  <th scope="row">{point.position.toFixed(3)}</th>
                  {lines.map((line) => (
                    <td key={line.key}>{point[line.key].toFixed(4)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function SimulationPanel({
  incident,
  selectedHypothesis,
  onSelectHypothesis,
  selectedEvidenceId,
  onRefresh,
  busy,
}: {
  incident: Incident;
  selectedHypothesis: string | null;
  onSelectHypothesis: (id: string) => void;
  selectedEvidenceId: string | null;
  onRefresh: () => Promise<void>;
  busy: boolean;
}) {
  const access = useIncidentAccess();
  const canEdit = access.mode === "demo" || access.permissions.includes("edit");
  const [demo, setDemo] = useState<SimulationDemo | null>(null);
  const [severity, setSeverity] = useState(0.7);
  const [delivery, setDelivery] = useState(1);
  const [material, setMaterial] = useState(1);
  const [context, setContext] = useState<string[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [freshRun, setFreshRun] = useState<SimulationRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const scenario: Scenario | null =
    selectedHypothesis && selectedHypothesis in scenarios
      ? (selectedHypothesis as Scenario)
      : null;
  const runs = incident.simulations ?? [];
  const run =
    runs.find((item) => item.id === selectedRunId) ?? freshRun ?? runs.at(-1);
  const superseded = new Set(
    (incident.evidence ?? []).map((item) => item.supersedes_id),
  );
  const active = (incident.evidence ?? []).filter(
    (item) => item.status === "collected" && !superseded.has(item.id),
  );
  const references = (
    context ?? (selectedEvidenceId ? [selectedEvidenceId] : [])
  ).filter((id) => active.some((item) => item.id === id));
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    incidentJson<SimulationDemo>("/api/incident-simulation/demo", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then((value) => {
        if (alive) setDemo(value);
      })
      .catch((cause: unknown) => {
        if (alive)
          setError(
            cause instanceof Error
              ? cause.message
              : "Synthetic model details could not be loaded.",
          );
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [attempt]);

  return (
    <section
      className="incident-card incident-simulation"
      aria-labelledby="simulation-title"
    >
      <div className="incident-section-title">
        <div>
          <p className="eyebrow">Compare a hypothetical response</p>
          <h2 id="simulation-title">Simulation sandbox</h2>
        </div>
        <span className="incident-tag">Simulated · not measured</span>
      </div>
      <p>
        Explore invented subsystem responses and a model fitted to synthetic
        examples. These normalized controls do not change machine settings or
        identify a cause.
      </p>
      {error && (
        <p role="alert" className="incident-simulation-error">
          {error}
          <button
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Reload model details
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <details className="incident-simulation-controls">
        <summary>Explore and save a simulated response</summary>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!scenario || !canEdit) return;
            setSaving(true);
            setError("");
            setNotice("");
            try {
              const saved = await incidentJson<SimulationRun>(
                `/api/incidents/${incident.id}/simulation`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    scenario,
                    parameters: {
                      severity,
                      delivery_ratio: delivery,
                      material_ratio: material,
                    },
                    evidence_ids: references,
                    revision: incident.revision,
                  }),
                },
              );
              setFreshRun(saved);
              setSelectedRunId(saved.id);
              await onRefresh();
              setNotice(
                "Simulated response saved. It is contextual modelling, not diagnostic evidence.",
              );
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Simulation could not be saved. Your chosen inputs are retained.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving || busy || !canEdit}>
            <label>
              Hypothetical mechanism
              <select
                value={scenario ?? ""}
                required
                onChange={(event) => onSelectHypothesis(event.target.value)}
              >
                <option value="" disabled>
                  Select a mechanism
                </option>
                {Object.entries(scenarios).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Illustrative fault severity · {severity.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={severity}
                onChange={(event) => setSeverity(Number(event.target.value))}
                aria-label="Illustrative fault severity"
              />
            </label>
            <label>
              Synthetic delivery ratio · {delivery.toFixed(2)}
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.01"
                value={delivery}
                onChange={(event) => setDelivery(Number(event.target.value))}
                aria-label="Synthetic delivery ratio"
              />
            </label>
            <label>
              Synthetic material ratio · {material.toFixed(2)}
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.01"
                value={material}
                onChange={(event) => setMaterial(Number(event.target.value))}
                aria-label="Synthetic material ratio"
              />
            </label>
            <details>
              <summary>
                Link contextual evidence · {references.length} selected
              </summary>
              <p className="incident-caption">
                References identify context only. No model parameter is inferred
                from a measurement.
              </p>
              <div className="incident-simulation-context">
                {active.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={references.includes(item.id)}
                      onChange={(event) =>
                        setContext(
                          event.target.checked
                            ? [...references, item.id]
                            : references.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </details>
            <button
              className="primary"
              disabled={!scenario || saving || busy || !canEdit}
            >
              {saving ? "Saving simulation…" : "Run and save simulation"}
            </button>
          </fieldset>
        </form>
      </details>
      {run && (
        <div className="incident-simulation-saved">
          <div className="incident-section-title">
            <h3>{scenarios[run.scenario]} · saved simulation</h3>
            <span className="incident-tag">{run.id}</span>
          </div>
          <p className="incident-caption">
            Context revision {run.source_revision} · severity{" "}
            {run.parameters.severity.toFixed(2)} / delivery{" "}
            {run.parameters.delivery_ratio.toFixed(2)} / material{" "}
            {run.parameters.material_ratio.toFixed(2)}. This plot shows the
            saved parameters; changing controls requires another run.
          </p>
          <ResponsePlot run={run} />
          <details>
            <summary>Model, assumptions and validity limits</summary>
            <p>
              {run.model_version} · {run.fixture_version}
            </p>
            <ul>
              {[...run.assumptions, ...run.validity_limits].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Context references:{" "}
              {run.evidence_ids.join(", ") || "None selected"}
            </p>
            <p>Components: {run.component_ids.join(", ")}</p>
          </details>
        </div>
      )}
      {runs.length > 0 && (
        <label>
          Saved simulation history
          <select
            value={run?.id ?? ""}
            onChange={(event) => {
              const item = runs.find(
                (saved) => saved.id === event.target.value,
              );
              if (!item) return;
              setSelectedRunId(item.id);
              onSelectHypothesis(item.scenario);
              setSeverity(item.parameters.severity);
              setDelivery(item.parameters.delivery_ratio);
              setMaterial(item.parameters.material_ratio);
              setContext(item.evidence_ids);
            }}
          >
            {runs.map((item) => (
              <option value={item.id} key={item.id}>
                {scenarios[item.scenario]} · context r{item.source_revision} ·{" "}
                {item.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {demo && (
        <details className="incident-simulation-evaluation">
          <summary>
            Synthetic held-out evaluation · not physical validation
          </summary>
          <p>{demo.method}</p>
          <p>{demo.evaluation.split_method}</p>
          <p>
            {demo.evaluation.training_samples} training samples /{" "}
            {demo.evaluation.heldout_samples} held-out samples from invented
            fixtures.
          </p>
          <div className="incident-simulation-table">
            <table>
              <caption>Held-out mean absolute error · dimensionless</caption>
              <thead>
                <tr>
                  <th scope="col">Predictor</th>
                  <th scope="col">Relative mass</th>
                  <th scope="col">Coverage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Learned synthetic model</th>
                  <td>
                    {demo.evaluation.heldout_metrics.relative_mass_mae.toFixed(
                      4,
                    )}
                  </td>
                  <td>
                    {demo.evaluation.heldout_metrics.coverage_fraction_mae.toFixed(
                      4,
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Constant baseline</th>
                  <td>
                    {demo.evaluation.constant_baseline_heldout_metrics.relative_mass_mae.toFixed(
                      4,
                    )}
                  </td>
                  <td>
                    {demo.evaluation.constant_baseline_heldout_metrics.coverage_fraction_mae.toFixed(
                      4,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Synthetic acceptance:{" "}
            {demo.evaluation.synthetic_acceptance_passed
              ? "passes declared fixture tolerances"
              : "does not pass declared fixture tolerances"}
            . No real-machine validation has been performed.
          </p>
          <details>
            <summary>Model version and invented equations</summary>
            <p>
              {demo.model_version} · {demo.fixture_version}
            </p>
            {Object.entries(demo.equations).map(([key, value]) => (
              <p className="mono" key={key}>
                {key}: {value}
              </p>
            ))}
          </details>
        </details>
      )}
    </section>
  );
}
