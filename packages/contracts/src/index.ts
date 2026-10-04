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
export type SourcePassage = components["schemas"]["SourcePassage"];
export type LearningCase = components["schemas"]["LearningCase"];

export type QuestionPlan = components["schemas"]["QuestionPlan"];
export type QuestionPlanRequest = components["schemas"]["QuestionPlanRequest"];

export type Incident = components["schemas"]["Incident"];
export type IncidentEvidence = components["schemas"]["IncidentEvidence"];
export type EvidenceInput = components["schemas"]["EvidenceInput"];
export type IncidentObservation = components["schemas"]["IncidentObservation"];
export type InvestigationGraph = components["schemas"]["InvestigationGraph"];
export type InvestigationNode = components["schemas"]["InvestigationNode"];
export type InvestigationAnswer = components["schemas"]["InvestigationAnswer"];
export type InvestigationConversationTurn =
  components["schemas"]["InvestigationConversationTurn"];
export type ConversationRequest = components["schemas"]["ConversationRequest"];
export type DiagnosticAssessment =
  components["schemas"]["DiagnosticAssessment"];
export type CreateIncident = components["schemas"]["CreateIncident"];
export type IncidentExperience = components["schemas"]["IncidentExperience"];
export type Artifact = components["schemas"]["Artifact"];
export type IncidentSourceDocument =
  components["schemas"]["IncidentSourceDocument"];
export type SourceDocumentInput = components["schemas"]["SourceDocumentInput"];
export type ApplicableSourcePassage =
  components["schemas"]["ApplicableSourcePassage"];
export type SourceConflict = components["schemas"]["SourceConflict"];
export type IncidentJob = components["schemas"]["IncidentJob"];
export type SimulationRun = components["schemas"]["SimulationRun"];
export type SimulationDemo = components["schemas"]["SimulationDemo"];
export type SimulationRequest = components["schemas"]["SimulationRequest"];
export type IncidentExperiment = components["schemas"]["IncidentExperiment"];
export type ExperimentProposal = components["schemas"]["ExperimentProposal"];
export type ExperimentCommand = components["schemas"]["ExperimentCommand"];
export type ExperimentWithdrawal =
  components["schemas"]["ExperimentWithdrawal"];
export type ExperimentFactor = components["schemas"]["ExperimentFactor"];
export type ExperimentBrief = components["schemas"]["ExperimentBrief"];
export type ExperimentPrediction =
  components["schemas"]["ExperimentPrediction"];
export type IncidentCommunication =
  components["schemas"]["IncidentCommunication"];
export type CommunicationApprovalRequest =
  components["schemas"]["CommunicationApprovalRequest"];
export type CommunicationSendRequest =
  components["schemas"]["CommunicationSendRequest"];
export type CommunicationReceiptRequest =
  components["schemas"]["CommunicationReceiptRequest"];
export type IncidentAction =
  | components["schemas"]["SimpleAction"]
  | components["schemas"]["AddEvidenceAction"]
  | components["schemas"]["CorrectEvidenceAction"]
  | components["schemas"]["RecordResultAction"]
  | components["schemas"]["AnswerInvestigationAction"]
  | components["schemas"]["ConfirmInvestigationAction"]
  | components["schemas"]["SelectInvestigationAction"]
  | components["schemas"]["RetryInvestigationAction"]
  | components["schemas"]["EditHandoffAction"]
  | components["schemas"]["EscalateAction"]
  | components["schemas"]["CloseIncidentAction"]
  | components["schemas"]["ReviewLearningAction"];
