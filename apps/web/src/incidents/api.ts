import type {
  CreateIncident,
  Incident,
  IncidentAction,
} from "@flowpilot/contracts";
export type {
  Incident,
  IncidentEvidence,
  EvidenceInput,
  IncidentObservation,
  DiagnosticAssessment,
  IncidentAction,
  CreateIncident,
} from "@flowpilot/contracts";
export type IncidentCommand = IncidentAction extends infer A
  ? A extends { revision: number }
    ? Omit<A, "revision">
    : never
  : never;

const SESSION_TOKEN_KEY = "flowpilot.incident-token";
export type IncidentAccess = {
  mode: "demo" | "configured";
  subject: string | null;
  permissions: string[];
  authenticated: boolean;
};

export function setIncidentToken(token: string | null) {
  if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  else sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function incidentHeaders(role?: string): Record<string, string> {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(role ? { "X-Incident-Role": role } : {}),
  };
}

export function incidentFetch(path: string, options: RequestInit = {}) {
  if (new URL(path, window.location.origin).origin !== window.location.origin) {
    throw new Error(
      "Incident credentials can only be used with this workspace.",
    );
  }
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(incidentHeaders()))
    headers.set(name, value);
  return fetch(path, { ...options, headers });
}

export async function loadIncidentAccess(): Promise<IncidentAccess> {
  const response = await incidentFetch("/api/incident-access", {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "Access settings could not be loaded. Retry when the service is available.",
    );
  return response.json() as Promise<IncidentAccess>;
}

export async function incidentJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await incidentFetch(path, {
    signal: AbortSignal.timeout(20000),
    ...options,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(
      typeof problem?.detail === "string"
        ? problem.detail
        : "This request could not be completed. Check the supplied values and try again.",
    );
  }
  return response.json() as Promise<T>;
}

async function request<T>(
  path: string,
  body?: unknown,
  role = "technician",
): Promise<T> {
  try {
    const response = await incidentFetch(`/api/incidents${path}`, {
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Incident-Role": role,
            },
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new Error(
        typeof problem?.detail === "string"
          ? problem.detail
          : response.status === 422
            ? "Review the supplied values and required fields, then try again."
            : "The incident service could not complete this request. Try again.",
      );
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError")
    ) {
      throw new Error(
        "The incident service is unavailable. Your last saved evidence is unchanged. Retry when connected.",
      );
    }
    throw error;
  }
}

export const listIncidents = () => request<Incident[]>("");
export const loadIncident = (id: string) =>
  request<Incident>(`/${encodeURIComponent(id)}`);
export const createIncident = (body: CreateIncident) =>
  request<Incident>("", body);
export const startReplay = (trigger_id: string) =>
  request<Incident>("/replay", { trigger_id });
export const actOnIncident = (
  id: string,
  body: IncidentAction,
  role?: "technician" | "engineer",
) => request<Incident>(`/${encodeURIComponent(id)}/actions`, body, role);
export const incidentReportUrl = (id: string) =>
  `/api/incidents/${encodeURIComponent(id)}/report.md`;

export async function downloadIncidentFile(path: string, filename: string) {
  const response = await incidentFetch(path, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(
      typeof problem?.detail === "string"
        ? problem.detail
        : "The saved report could not be downloaded.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadIncidentReport = (id: string) =>
  downloadIncidentFile(incidentReportUrl(id), `${id}-report.md`);
