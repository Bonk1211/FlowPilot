import type { ReactNode } from "react";
import type { Investigation } from "@flowpilot/contracts";
import { Flask, CaretRight } from "@phosphor-icons/react";

const phases = ["Report", "Diagnose", "Inspect", "Correct", "Verify"];

export function ApplicationFrame({
  investigation,
  children,
  phase = "Report",
  showPhaseRail = true,
  showDemoBadge = true,
}: {
  investigation?: Investigation;
  children: ReactNode;
  phase?: string;
  showPhaseRail?: boolean;
  showDemoBadge?: boolean;
}) {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="command-bar">
        <a className="wordmark" href="/" aria-label="FlowPilot home">
          <Flask aria-hidden="true" weight="regular" />
          FlowPilot
        </a>
        <div className="command-context">
          <span className="mono">
            {investigation?.id ?? "New investigation"}
          </span>
          <span className="command-defect">
            {investigation?.title ?? "Spray inspection"}
          </span>
          <span className="command-phase">{phase}</span>
        </div>
        {showDemoBadge && (
          <span className="demo-badge">Demo / Simulated Data</span>
        )}
      </header>
      {showPhaseRail && (
        <div className="phase-rail" aria-label="Investigation phases">
          <ol>
            {phases.map((item, index) => (
              <li key={item} aria-current={item === phase ? "step" : undefined}>
                <span className="phase-number mono">0{index + 1}</span>
                <span>
                  {item}
                  <span className="sr-only">
                    {item === phase ? ": current phase" : ": workflow phase"}
                  </span>
                </span>
                {index < phases.length - 1 && (
                  <CaretRight className="phase-separator" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
          <span className="rail-note">Operator-reported investigation</span>
        </div>
      )}
      {children}
    </div>
  );
}
