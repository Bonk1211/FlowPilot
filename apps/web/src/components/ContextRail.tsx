import {
  ArrowsOut,
  CaretDown,
  CheckCircle,
  Flask,
  Wrench,
  X,
} from "@phosphor-icons/react";
import type { Case } from "@flowpilot/contracts";
import { useState } from "react";
import { ProcedureViewer } from "./ProcedureViewer";
import { humanize } from "../presentation";

export function ContextRail({
  value,
  phase,
  step,
  onStep,
  expanded,
  onExpanded,
}: {
  value: Case | null;
  phase: string;
  step: number;
  onStep: (step: number) => void;
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(phase === "Inspect");
  const current = value?.procedure[step];
  const top = value?.ranking[0];
  return (
    <aside
      className={`context-rail ${expanded ? "context-expanded" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      aria-label="Case context"
    >
      <header className="context-header">
        <div>
          <p className="eyebrow">Context / {phase}</p>
          <h2>{phase === "Inspect" ? "Assembly guide" : "Case focus"}</h2>
        </div>
        {phase === "Inspect" && (
          <button
            className="context-expand secondary"
            onClick={() => onExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <X aria-hidden="true" />
            ) : (
              <ArrowsOut aria-hidden="true" />
            )}
            {expanded ? "Exit expanded view" : "Expand workspace"}
          </button>
        )}
        <button
          type="button"
          className="context-mobile-toggle secondary"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? "Hide context" : "Show context"}
          <CaretDown aria-hidden="true" />
        </button>
      </header>

      <div className="context-content">
        {!value && (
          <div className="context-empty">
            <Flask aria-hidden="true" />
            <h3>Start with the observed defect</h3>
            <p>The active evidence and next safe action will remain here.</p>
          </div>
        )}

        {value && phase === "Report" && (
          <div className="context-card">
            <p className="context-kicker">Measured sample</p>
            <strong className="context-metric">
              {"coverage_pct" in value.measurement
                ? `${value.measurement.coverage_pct}%`
                : "Recorded"}
            </strong>
            <span>Target coverage</span>
            <hr />
            <p>
              {value.log ? "Machine log attached" : "Machine log not attached"}
            </p>
            <p>
              {Object.keys(value.answers).length} of 5 discovery answers saved
            </p>
          </div>
        )}

        {value && phase === "Diagnose" && (
          <>
            <div className="context-card context-cause">
              <p className="context-kicker">Leading hypothesis</p>
              <h3>{top?.label ?? "Diagnosis pending"}</h3>
              {top && (
                <>
                  <strong className="context-metric">{top.score} pts</strong>
                  <span>{top.confirmed ? "Confirmed" : "Unconfirmed"}</span>
                  <p>Heuristic score, not a probability.</p>
                </>
              )}
            </div>
            {value.recommendation && (
              <div className="context-card context-next">
                <p className="context-kicker">Next best test</p>
                <h3>{value.recommendation.name}</h3>
                <p>{value.recommendation.rationale}</p>
                <p className="context-safety">
                  {value.recommendation.safety_note}
                </p>
              </div>
            )}
          </>
        )}

        {value && phase === "Inspect" && current && (
          <>
            <ProcedureViewer
              steps={value.procedure}
              index={step}
              onStep={onStep}
            />
            <section
              className="context-step"
              aria-labelledby="active-step-title"
            >
              <p className="eyebrow">
                Step {step + 1} of {value.procedure.length}
              </p>
              <h3 id="active-step-title">{current.title}</h3>
              <p>{current.instruction}</p>
              <p className="context-safety">{current.caution}</p>
            </section>
          </>
        )}

        {value && phase === "Correct" && (
          <div className="context-card">
            <Wrench aria-hidden="true" className="context-icon" />
            <p className="context-kicker">Confirmed component</p>
            <h3>Nozzle / fluid path</h3>
            <p>
              Record only work completed under the controlled site procedure.
              FlowPilot does not authorize physical service.
            </p>
          </div>
        )}

        {value && phase === "Verify" && (
          <div className="context-card">
            <p className="context-kicker">Recovery gate</p>
            <h3>
              {value.verification
                ? "Latest verification"
                : "Verification required"}
            </h3>
            <p>
              Calibration attempts:{" "}
              <strong>{value.calibration_attempts}</strong>
              <br />
              Calibration failures:{" "}
              <strong>{value.calibration_failures}</strong>
            </p>
            <p>
              {value.escalated
                ? "Maintenance escalation required."
                : "Every required recovery check must pass before resolution."}
            </p>
          </div>
        )}

        {value && phase === "Summary" && (
          <div className="context-card">
            <CheckCircle aria-hidden="true" className="context-icon verified" />
            <p className="context-kicker">Saved outcome</p>
            <h3>Simulated case resolved</h3>
            <p>{value.summary?.confirmed_cause}</p>
            <p className="case-list-id mono">
              {humanize(value.investigation.state)}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
