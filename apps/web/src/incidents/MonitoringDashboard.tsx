import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BellRinging,
  Check,
  CheckCircle,
  CircleNotch,
  Database,
  DownloadSimple,
  Gauge,
  Lightning,
  X,
} from "@phosphor-icons/react";
import type { Incident } from "./api";
import "./MonitoringDashboard.css";

// Illustrative process values and limits, independent of the saved evidence.
const parameters = [
  {
    name: "Flux flow rate",
    unit: "mL/min",
    normal: 42,
    critical: 18,
    min: 0,
    max: 60,
    low: 35,
    high: 50,
    precision: 1,
    tag: "FT-201",
  },
  {
    name: "Supply pressure",
    unit: "bar",
    normal: 2.4,
    critical: 1.1,
    min: 0,
    max: 4,
    low: 2,
    high: 3,
    precision: 2,
    tag: "PT-202",
  },
  {
    name: "Coverage",
    unit: "%",
    normal: 98,
    critical: 62,
    min: 40,
    max: 100,
    low: 90,
    high: 100,
    precision: 1,
    tag: "VI-203",
  },
  {
    name: "Nozzle temperature",
    unit: "°C",
    normal: 24.5,
    critical: 25.2,
    min: 15,
    max: 40,
    low: 20,
    high: 30,
    precision: 1,
    tag: "TT-204",
  },
  {
    name: "Pump vibration",
    unit: "mm/s",
    normal: 1.2,
    critical: 4.8,
    min: 0,
    max: 6,
    low: 0,
    high: 3,
    precision: 2,
    tag: "VT-205",
  },
  {
    name: "Conveyor speed",
    unit: "mm/s",
    normal: 120,
    critical: 120,
    min: 80,
    max: 160,
    low: 110,
    high: 130,
    precision: 0,
    tag: "ST-206",
  },
];

const pipeline = [
  {
    title: "Capture the alarm window",
    detail: "Stage simulated trends before and after the threshold breach.",
  },
  {
    title: "Retrieve source records",
    detail: "Locate the evidence already saved with this incident.",
  },
  {
    title: "Align context and provenance",
    detail:
      "Keep source references, timestamps and timing uncertainty attached.",
  },
  {
    title: "Prepare the evidence package",
    detail: "Link the saved package for the existing investigation.",
  },
];

function valueAt(
  parameter: (typeof parameters)[number],
  index: number,
  step: number,
) {
  const deviation =
    (parameter.max - parameter.min) * 0.008 * Math.sin(index * 1.7);
  const ramp = index < 24 ? 0 : Math.min((index - 23) / 8, step / 8);
  return (
    parameter.normal +
    (parameter.critical - parameter.normal) * ramp +
    deviation
  );
}

function ParameterChart({
  parameter,
  step,
}: {
  parameter: (typeof parameters)[number];
  step: number;
}) {
  const values = Array.from({ length: 32 }, (_, index) =>
    valueAt(parameter, index, step),
  );
  const current = values.at(-1)!;
  const abnormal = current < parameter.low || current > parameter.high;
  const y = (value: number) =>
    112 - ((value - parameter.min) / (parameter.max - parameter.min)) * 96;
  const points = values
    .map((value, index) => `${40 + index * 10},${y(value)}`)
    .join(" ");
  const title = `${parameter.name}: ${current.toFixed(parameter.precision)} ${parameter.unit}. ${abnormal ? "Outside" : "Within"} demo operating range ${parameter.low}–${parameter.high} ${parameter.unit}.`;
  return (
    <article
      className={`monitor-parameter${abnormal ? " is-abnormal" : ""}`}
      aria-label={parameter.name}
    >
      <div className="monitor-parameter-heading">
        <h4>{parameter.name}</h4>
        <span className="monitor-tag">{parameter.tag}</span>
      </div>
      <div className="monitor-reading">
        <strong>
          {current.toFixed(parameter.precision)} <small>{parameter.unit}</small>
        </strong>
        <span className={`monitor-state${abnormal ? " is-critical" : ""}`}>
          {abnormal ? (
            <BellRinging aria-hidden="true" />
          ) : (
            <CheckCircle aria-hidden="true" />
          )}
          {abnormal ? "Abnormal" : "Normal"}
        </span>
      </div>
      <svg
        className="monitor-chart"
        viewBox="0 0 370 144"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <rect
          x="40"
          y={y(parameter.high)}
          width="310"
          height={y(parameter.low) - y(parameter.high)}
          className="monitor-range"
        />
        {[
          parameter.min,
          (parameter.min + parameter.max) / 2,
          parameter.max,
        ].map((value) => (
          <g key={value}>
            <line
              x1="40"
              x2="350"
              y1={y(value)}
              y2={y(value)}
              className="monitor-gridline"
            />
            <text x="30" y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {[parameter.low, parameter.high].map((value) => (
          <line
            key={value}
            x1="40"
            x2="350"
            y1={y(value)}
            y2={y(value)}
            className="monitor-limit"
          />
        ))}
        {step > 0 && (
          <line
            x1="280"
            x2="280"
            y1="8"
            y2="116"
            className="monitor-trigger-line"
          />
        )}
        <polyline points={points} className="monitor-trend" />
        <circle cx="350" cy={y(current)} r="4" className="monitor-endpoint" />
        <text x="40" y="137">
          −30 s
        </text>
        <text x="195" y="137" textAnchor="middle">
          −15 s
        </text>
        <text x="350" y="137" textAnchor="end">
          Now
        </text>
      </svg>
      <p className="monitor-range-caption">
        Demo range{" "}
        <strong>
          {parameter.low}–{parameter.high} {parameter.unit}
        </strong>
      </p>
    </article>
  );
}

export function MonitoringDashboard({
  incident,
  disabled,
  onAnalyze,
  onCollectEvidence,
}: {
  incident: Incident;
  disabled: boolean;
  onAnalyze: () => void;
  onCollectEvidence?: () => void;
}) {
  const [triggered, setTriggered] = useState(false);
  const [step, setStep] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retrieved, setRetrieved] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const retrievalButton = useRef<HTMLButtonElement>(null);
  const alarms = parameters.filter((parameter) => {
    const value = valueAt(parameter, 31, step);
    return value < parameter.low || value > parameter.high;
  });
  const evidence = incident.evidence ?? [];
  const collected = evidence.filter((item) => item.status === "collected");

  useEffect(() => {
    if (!triggered || step >= 8) return;
    const timer = setTimeout(() => setStep((current) => current + 1), 550);
    return () => clearTimeout(timer);
  }, [triggered, step]);

  useEffect(() => {
    if (step !== 8 || disabled) return;
    const timer = setTimeout(() => {
      if (onCollectEvidence) onCollectEvidence();
      else setDialogOpen(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [step, disabled, onCollectEvidence]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (dialogOpen) element.showModal();
    else element.close();
    return () => element.close();
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen || retrieved >= pipeline.length) return;
    const timer = setTimeout(() => setRetrieved((current) => current + 1), 850);
    return () => clearTimeout(timer);
  }, [dialogOpen, retrieved]);

  return (
    <section className="monitor-dashboard" aria-labelledby="monitor-title">
      <div className="monitor-header">
        <div>
          <h3 id="monitor-title">Equipment monitoring</h3>
        </div>
        <div className="monitor-header-actions">
          <span className="monitor-demo-label">
            <Gauge aria-hidden="true" /> Simulated data
          </span>
          {triggered ? (
            <button
              type="button"
              onClick={() => {
                setTriggered(false);
                setStep(0);
                setRetrieved(0);
                setDialogOpen(false);
              }}
            >
              Reset demo
            </button>
          ) : (
            <button
              type="button"
              className="monitor-trigger"
              disabled={disabled}
              onClick={() => setTriggered(true)}
            >
              <Lightning aria-hidden="true" /> Demo critical incident
            </button>
          )}
        </div>
      </div>
      <div
        className={`monitor-condition${alarms.length ? " is-critical" : ""}`}
        role="status"
        aria-atomic="true"
      >
        {alarms.length ? (
          <BellRinging aria-hidden="true" />
        ) : (
          <CheckCircle aria-hidden="true" />
        )}
        <div>
          <strong>
            {alarms.length
              ? "Critical incident · insufficient flux coverage"
              : "All parameters within demo limits"}
          </strong>
          {!!alarms.length && <p>{alarms.length} active alarms</p>}
          {triggered && onCollectEvidence && (
            <p>
              Evidence collection will begin automatically in a few seconds.
            </p>
          )}
        </div>
        <span>{alarms.length ? "ALARM TRIGGERED" : "SYSTEM NORMAL"}</span>
      </div>
      <div className="monitor-trends-heading">
        <h3>Physical parameters</h3>
        <div>
          <span className="monitor-legend-range" /> Demo operating range{" "}
          <span className="monitor-legend-line" /> Process reading{" "}
          <span>30-second demo window</span>
        </div>
      </div>
      <div className="monitor-parameters">
        {parameters.map((parameter) => (
          <ParameterChart
            key={parameter.tag}
            parameter={parameter}
            step={step}
          />
        ))}
      </div>
      {triggered && (
        <section
          className="monitor-alarms"
          aria-labelledby="monitor-alarm-title"
        >
          <div className="monitor-alarm-heading">
            <h3 id="monitor-alarm-title">
              <BellRinging aria-hidden="true" /> Alarm activity{" "}
              <span>{alarms.length}</span>
            </h3>
            {triggered && !onCollectEvidence && (
              <button
                ref={retrievalButton}
                type="button"
                onClick={() => setDialogOpen(true)}
              >
                <Database aria-hidden="true" /> View data retrieval
              </button>
            )}
          </div>
          {alarms.length ? (
            <ul>
              {alarms.map((parameter) => (
                <li key={parameter.tag}>
                  <span className="monitor-alarm-severity">Critical</span>
                  <strong>
                    {parameter.name}{" "}
                    {parameter.critical < parameter.low
                      ? "below lower limit"
                      : "above upper limit"}
                  </strong>
                  <span>
                    {valueAt(parameter, 31, step).toFixed(parameter.precision)}{" "}
                    {parameter.unit}
                  </span>
                  <span className="monitor-tag">{parameter.tag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="monitor-empty">
              <CheckCircle aria-hidden="true" /> No active alarms.
            </p>
          )}
        </section>
      )}
      <div className="monitor-footer">
        <p>
          <Database aria-hidden="true" /> {collected.length} saved evidence{" "}
          {collected.length === 1 ? "record" : "records"} available{" "}
        </p>
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={onAnalyze}
        >
          {onCollectEvidence
            ? "Collect evidence now"
            : "Analyze available evidence"}{" "}
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <dialog
        ref={dialog}
        className="monitor-retrieval-dialog"
        aria-labelledby="retrieval-title"
        aria-describedby="retrieval-description"
        onCancel={() => setDialogOpen(false)}
        onClose={() => {
          setDialogOpen(false);
          retrievalButton.current?.focus({ preventScroll: true });
        }}
      >
        <div className="monitor-dialog-heading">
          <div className="monitor-dialog-icon">
            <DownloadSimple aria-hidden="true" />
          </div>
          <button
            type="button"
            aria-label="Close data retrieval"
            onClick={() => setDialogOpen(false)}
            autoFocus
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <p className="monitor-eyebrow">ALARM → EVIDENCE → INVESTIGATION</p>
        <h2 id="retrieval-title">Data retrieval pipeline</h2>
        <p id="retrieval-description">
          Follow how an alarm becomes an investigation package. This demo links
          the existing saved evidence; it does not retrieve live equipment data.
        </p>
        <div className="monitor-pipeline-summary">
          <BellRinging aria-hidden="true" />
          <div>
            <strong>Insufficient flux coverage</strong>
            <span>{incident.tool_id} · Simulated critical incident</span>
          </div>
          <span className="monitor-alarm-severity">Critical</span>
        </div>
        <ol className="monitor-pipeline" aria-label="Retrieval stages">
          {pipeline.map((stage, index) => (
            <li
              key={stage.title}
              className={
                index < retrieved
                  ? "is-complete"
                  : index === retrieved
                    ? "is-running"
                    : ""
              }
            >
              <span className="monitor-pipeline-number">
                {index < retrieved ? (
                  <Check aria-hidden="true" />
                ) : index === retrieved ? (
                  <CircleNotch aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
              </div>
              <span>
                {index < retrieved
                  ? "Complete"
                  : index === retrieved
                    ? "In progress"
                    : "Pending"}
              </span>
            </li>
          ))}
        </ol>
        <div className="monitor-package" role="status" aria-atomic="true">
          <Database aria-hidden="true" />
          <div>
            <strong>
              {retrieved === pipeline.length
                ? "Existing evidence ready for analysis"
                : "Preparing the demo package…"}
            </strong>
            <p>
              {collected.length} collected / {evidence.length} source records ·
              Evidence revision {incident.revision}
            </p>
          </div>
        </div>
        <div className="monitor-dialog-footer">
          <button type="button" onClick={() => setDialogOpen(false)}>
            Back to monitoring
          </button>
          <button
            type="button"
            className="primary"
            disabled={disabled || retrieved < pipeline.length}
            onClick={() => {
              setDialogOpen(false);
              onAnalyze();
            }}
          >
            Analyze existing evidence <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </section>
  );
}
