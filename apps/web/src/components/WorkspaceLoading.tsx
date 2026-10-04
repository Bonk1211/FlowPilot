import { Flask } from "@phosphor-icons/react";
import "./WorkspaceLoading.css";

export function WorkspaceLoading({
  detail = "Preparing the demo workspace…",
}: {
  detail?: string;
}) {
  return (
    <div
      className="workspace-loading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="workspace-loading-content">
        <div className="workspace-loading-mark" aria-hidden="true">
          <Flask />
        </div>
        <p className="workspace-loading-eyebrow">FLOWPILOT / S932</p>
        <h1>Opening your workspace</h1>
        <p className="workspace-loading-detail">{detail}</p>
        <div className="workspace-loading-track" aria-hidden="true">
          <span />
        </div>
        <p className="workspace-loading-note">
          Every investigation starts with the evidence.
        </p>
      </div>
    </div>
  );
}
