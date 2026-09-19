import type { ProcedureStep } from "@flowpilot/contracts";
import { ProcedureViewer } from "./ProcedureViewer";

export function InspectionGuide({
  steps,
  step,
  onStep,
}: {
  steps: ProcedureStep[];
  step: number;
  onStep: (step: number) => void;
}) {
  const current = steps[step];
  if (!current) return <p role="status">Inspection guide unavailable.</p>;
  return (
    <section className="inspection-stage" aria-label="Guided inspection">
      <div className="inspection-stage-header">
        <div>
          <p className="eyebrow">Locate · inspect · record</p>
          <h2>Assembly guide</h2>
        </div>
        <span className="step-count">
          {step + 1} / {steps.length}
        </span>
      </div>
      <div className="inspection-stage-grid">
        <ProcedureViewer steps={steps} index={step} onStep={onStep} />
        <div className="inspection-instructions">
          <section
            className="active-instruction"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="eyebrow">
              Step {step + 1} of {steps.length}
            </p>
            <h3>{current.title}</h3>
            <p>{current.instruction}</p>
            <p className="context-safety">{current.caution}</p>
          </section>
          <ol className="inspection-step-list" aria-label="Inspection steps">
            {steps.map((item, index) => (
              <li
                key={item.step_id}
                aria-current={index === step ? "step" : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
          <p className="inspection-note">
            The model locates parts. An authorized person supplies the
            observation; playback does not confirm a fault.
          </p>
        </div>
      </div>
    </section>
  );
}
