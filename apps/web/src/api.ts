import type {
  DemoScenario,
  IngestionResult,
  LogPreviewRequest,
  GoldenScenario,
} from "@flowpilot/contracts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 422
          ? "The log could not be previewed. Check the log text and timezone, then try again."
          : "The service could not complete this request. Please try again.",
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError")
    ) {
      throw new Error(
        "The service is unavailable. Check your connection and try again.",
      );
    }
    throw error;
  }
}

export const loadScenario = () => request<DemoScenario>("/demo/scenario");
export const loadGoldenScenario = () =>
  request<GoldenScenario>("/demo/golden-scenario");
export const previewLog = (body: LogPreviewRequest) =>
  request<IngestionResult>("/logs/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
