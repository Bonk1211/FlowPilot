import { CircleHalf, WarningCircle } from "@phosphor-icons/react";

export function ProvisionalStatus() {
  return (
    <span className="status provisional">
      <CircleHalf aria-hidden="true" />
      Provisional
    </span>
  );
}

export function ErrorNotice({
  message,
  action,
  onRetry,
}: {
  message: string;
  action: string;
  onRetry: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <WarningCircle aria-hidden="true" />
      <div>
        <p>{message}</p>
        <button className="secondary" onClick={onRetry}>
          {action}
        </button>
      </div>
    </div>
  );
}
