import type { Case } from "@flowpilot/contracts";
import {
  ArrowRight,
  CheckCircle,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";

export function WorkflowStatus({
  value,
  phase,
  handoff,
}: {
  value: Case | null;
  phase: string;
  handoff: boolean;
}) {
  if (value && !value.diagnosis_supported)
    return (
      <section className="workflow-state state-warning" role="status">
        <WarningCircle aria-hidden="true" />
        <div>
          <h2>Image cannot support this diagnosis</h2>
          <p>
            This sample is unsupported or its evidence was rejected. Start a new
            case with a valid incomplete-coverage sample to explore the complete
            journey.
          </p>
          <a href="/">Start a new investigation</a>
        </div>
      </section>
    );
  if (phase === "Inspect") return null;
  if (handoff || value?.escalated)
    return (
      <section className="workflow-state state-warning" role="status">
        <Wrench aria-hidden="true" />
        <div>
          <p className="eyebrow">Case open · maintenance required</p>
          <h2>
            {handoff
              ? "No nozzle obstruction found"
              : "Calibration failed twice"}
          </h2>
          <p>
            {handoff
              ? "The inspection weakens the nozzle-blockage hypothesis. Air-cap and pressure-supply checks are the next handoff."
              : "Stop ordinary retries and hand the case to authorized maintenance."}
          </p>
          <p className="state-next">
            {handoff
              ? "This prototype ends this branch here. Review the next-check details below for the handoff; no further repair workflow is available in this case."
              : "The case cannot be resolved until the required recovery checks pass. Further maintenance is outside this prototype."}
          </p>
        </div>
      </section>
    );
  if (
    value?.investigation.state === "corrective_action_completed" &&
    value.verification
  )
    return (
      <section className="workflow-state state-warning" role="status">
        <WarningCircle aria-hidden="true" />
        <div>
          <p className="eyebrow">Case open · recovery not confirmed</p>
          <h2>Verification has not passed</h2>
          <p>
            {value.verification.passed
              ? "The visual sample passed, but required recovery checks are incomplete or failed."
              : "The post-action sample still fails the visual criteria. Completing a repair is not enough to close the case."}
          </p>
          <p className="state-next">
            Review the comparison and recovery results below. After further
            authorized checks, record a new simulated verification.
          </p>
        </div>
      </section>
    );
  if (
    phase === "Summary" ||
    value?.investigation.state === "verification_passed"
  )
    return (
      <section className="workflow-state state-success" role="status">
        <CheckCircle aria-hidden="true" />
        <div>
          <p className="eyebrow">
            {phase === "Summary"
              ? "Investigation complete"
              : "Ready for final review"}
          </p>
          <h2>
            {phase === "Summary"
              ? "Recovery verified and saved"
              : "Recovery checks passed"}
          </h2>
          <p>
            {phase === "Summary"
              ? "The problem, confirmed observation, action and recovery results are recorded below."
              : "Review the result, add any completion notes and confirm resolution to save the summary."}{" "}
            {value && "assessment_id" in value.measurement
              ? "Photo comparison and operator checks are recorded together."
              : "Simulated recovery only; this does not release a production lot."}
          </p>
        </div>
      </section>
    );
  // The diagnosis briefing already shows the hypothesis boundary and next check.
  if (
    phase === "Diagnose" &&
    value?.investigation.state === "inspection_recommended"
  )
    return null;
  const copy: Record<string, [string, string]> = {
    Report: value
      ? [
          "Tell us what you observed",
          "Five short questions help separate a coverage issue from supply, material or alignment problems. Choose Not recorded when evidence is unavailable.",
        ]
      : [
          "From a defect to a verified recovery",
          "Analyze an inspection photo. Answer five questions, inspect the suspected component, then check whether the corrective action worked.",
        ],
    Diagnose: value?.ranking.length
      ? [
          "A hypothesis is not a confirmed fault",
          "Review the possible causes, then collect a physical inspection observation to test them.",
        ]
      : [
          "One observation at a time",
          "Your answers help decide what to check first. Unknown observations stay unknown.",
        ],
    Inspect: [
      "Use the guide, then record what you find",
      "Review the five inspection steps. At the end, select whether an authorized nozzle inspection found an obstruction.",
    ],
    Correct: [
      "Record the completed corrective action",
      "The obstruction is confirmed. Record cleaning or replacement, then verify the recovery with a new sample and the required checks.",
    ],
    Verify: [
      "Did the corrective action work?",
      "Compare the post-action sample and record the recovery checks. Both must pass before you can resolve the case.",
    ],
  };
  const [title, description] = copy[phase] ?? copy.Report;
  return (
    <section className="workflow-intro">
      <ArrowRight aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
