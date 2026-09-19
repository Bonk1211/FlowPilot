import type { components } from "./generated";

export type DemoScenario = components["schemas"]["DemoScenario"];
export type IngestionResult = components["schemas"]["IngestionResult"];
export type LogPreviewRequest = components["schemas"]["LogPreviewRequest"];
export type Investigation = components["schemas"]["Investigation"];
export type Evidence = components["schemas"]["Evidence"];
export type AgentFinding = components["schemas"]["AgentFinding"];
export type ProcedureStep = components["schemas"]["ProcedureStep"];
export type GoldenScenario = components["schemas"]["GoldenScenario"];
export type GoldenSnapshot = components["schemas"]["GoldenSnapshot"];
export type Case = components["schemas"]["Case"];
export type Measurement = components["schemas"]["Measurement"];
export type CreateCase = components["schemas"]["CreateCase"];
export type CaseListItem = components["schemas"]["CaseListItem"];
export type CaseExplanation = components["schemas"]["CaseExplanation"];
export type CaseExplanationRequest =
  components["schemas"]["CaseExplanationRequest"];
export type CaseAction =
  | components["schemas"]["CorrectEvidence"]
  | components["schemas"]["AttachLog"]
  | components["schemas"]["Answer"]
  | components["schemas"]["Diagnose"]
  | components["schemas"]["RefreshKnowledge"]
  | components["schemas"]["Inspect"]
  | components["schemas"]["Confirm"]
  | components["schemas"]["Resolve"]
  | components["schemas"]["CompleteAction"]
  | components["schemas"]["Verify"];

export type RecoveryChecks = components["schemas"]["RecoveryChecks"];

export type VisionAssessment = components["schemas"]["VisionAssessment"];
export type VisionExample = components["schemas"]["VisionExample"];

export type IntakeContext = components["schemas"]["IntakeContext"];
export type LogContext = components["schemas"]["LogContext"];
export type ObservationChoice = components["schemas"]["ObservationChoice"];

export type KnowledgeEntry = components["schemas"]["KnowledgeEntry"];
export type KnowledgeContent = components["schemas"]["KnowledgeContent"];
export type KnowledgeCommand = components["schemas"]["KnowledgeCommand"];
export type KnowledgeGraph = components["schemas"]["KnowledgeGraph"];
export type PastExperience = components["schemas"]["PastExperience"];
export type CitationStatus = components["schemas"]["CitationStatus"];
export type LibraryOverview = components["schemas"]["LibraryOverview"];
export type LearningCase = components["schemas"]["LearningCase"];

export type QuestionPlan = components["schemas"]["QuestionPlan"];
export type QuestionPlanRequest = components["schemas"]["QuestionPlanRequest"];
