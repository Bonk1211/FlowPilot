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
export type CaseAction =
  | components["schemas"]["CorrectEvidence"]
  | components["schemas"]["AttachLog"]
  | components["schemas"]["Answer"]
  | components["schemas"]["Diagnose"]
  | components["schemas"]["Inspect"]
  | components["schemas"]["Confirm"]
  | components["schemas"]["CompleteAction"]
  | components["schemas"]["Verify"];

export type RecoveryChecks = components["schemas"]["RecoveryChecks"];
