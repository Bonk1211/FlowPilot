import type {
  QuestionPlan,
  QuestionPlanRequest,
  KnowledgeEntry,
  KnowledgeCommand,
  KnowledgeGraph,
  CitationStatus,
  DemoScenario,
  IngestionResult,
  LogPreviewRequest,
  LogContext,
  GoldenScenario,
  Case,
  CaseAction,
  CreateCase,
  Measurement,
  VisionAssessment,
  CaseListItem,
  CaseExplanation,
} from "@flowpilot/contracts";

async function request<T>(
  path: string,
  init?: RequestInit,
  timeout = 15000,
): Promise<T> {
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new Error(
        typeof problem?.detail === "string"
          ? problem.detail
          : response.status === 422
            ? path === "/logs/preview"
              ? "The log could not be previewed. Check the log text and timezone, then try again."
              : "The submitted values are invalid. Review the required fields and try again."
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

export const loadImages = () => request<Measurement[]>("/demo/images");
export const loadCase = (id: string) =>
  request<Case>(`/investigations/${encodeURIComponent(id)}`);
export const createCase = (body: CreateCase) =>
  request<Case>(
    "/investigations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    45000,
  );
export const listCases = (limit = 20) =>
  request<CaseListItem[]>(`/investigations?limit=${limit}`);
export const explainCase = (id: string, revision: number, question: string) =>
  request<CaseExplanation>(
    `/investigations/${encodeURIComponent(id)}/explanations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, question }),
    },
  );
export const resetDemo = (body: CreateCase) =>
  request<Case>("/demo/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const actOnCase = (id: string, body: CaseAction) =>
  request<Case>(
    `/investigations/${encodeURIComponent(id)}/actions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    45000,
  );

export const assessPhoto = (file: File, signal?: AbortSignal) =>
  request<VisionAssessment>(
    "/vision/assessments",
    {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal,
    },
    60000,
  );

export const previewLogContext = (log: LogPreviewRequest, board_id?: string) =>
  request<LogContext>("/logs/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log, board_id }),
  });

export const listKnowledge = () => request<KnowledgeEntry[]>("/knowledge");
export const loadKnowledge = (id: string) =>
  request<KnowledgeEntry>(`/knowledge/${encodeURIComponent(id)}`);
export const draftKnowledge = (
  id: string,
  source_revision: number,
  actor: string,
) =>
  request<KnowledgeEntry>(`/knowledge/from-case/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_revision, actor }),
  });
export const changeKnowledge = (id: string, body: KnowledgeCommand) =>
  request<KnowledgeEntry>(`/knowledge/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const loadKnowledgeGraph = (id: string, version: number) =>
  request<KnowledgeGraph>(
    `/knowledge/${encodeURIComponent(id)}/graph?version=${version}`,
  );
export const knowledgeStatus = (id: string) =>
  request<CitationStatus[]>(
    `/investigations/${encodeURIComponent(id)}/knowledge-status`,
  );

export const loadLearningDatabase = (
  filters: {
    q?: string;
    status?: string;
    process?: string;
    symptom?: string;
    limit?: string;
  } = {},
) =>
  request<import("@flowpilot/contracts").LibraryOverview>(
    `/knowledge/graph?${new URLSearchParams(filters)}`,
  );
export const prepareKnowledge = (id: string, source_revision: number) =>
  request<KnowledgeEntry>(`/knowledge/${encodeURIComponent(id)}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_revision, actor: "system" }),
  });
export const knowledgeForCase = (id: string) =>
  request<KnowledgeEntry | null>(
    `/knowledge/by-source/${encodeURIComponent(id)}`,
  );

export const planIntakeQuestions = (
  body: QuestionPlanRequest,
  signal: AbortSignal,
) =>
  request<QuestionPlan>(
    "/intake/question-plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    },
    4000,
  );
