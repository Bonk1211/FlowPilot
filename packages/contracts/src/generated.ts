export interface paths {
    "/api/demo/golden-scenario": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Golden Scenario
         * @description Read-only, validated M0 storyboard; no workflow or database side effects.
         */
        get: operations["golden_scenario_api_demo_golden_scenario_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Images */
        get: operations["images_api_demo_images_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/images/{sample_id}.png": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Image */
        get: operations["image_api_demo_images__sample_id__png_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset Demo
         * @description Start a fresh simulated investigation; retain all existing case history.
         */
        post: operations["reset_demo_api_demo_reset_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/scenario": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Scenario */
        get: operations["scenario_api_demo_scenario_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health
         * @description Process liveness only; does not open or initialize the database.
         */
        get: operations["health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/intake/question-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Question Plan */
        post: operations["question_plan_api_intake_question_plan_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/investigations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Cases */
        get: operations["list_cases_api_investigations_get"];
        put?: never;
        /** New Case */
        post: operations["new_case_api_investigations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/investigations/{case_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Case */
        get: operations["get_case_api_investigations__case_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/investigations/{case_id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Act */
        post: operations["act_api_investigations__case_id__actions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/investigations/{case_id}/explanations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Explain */
        post: operations["explain_api_investigations__case_id__explanations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/investigations/{case_id}/knowledge-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Reference Status */
        get: operations["reference_status_api_investigations__case_id__knowledge_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Entries */
        get: operations["entries_api_knowledge_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/by-source/{case_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** By Source */
        get: operations["by_source_api_knowledge_by_source__case_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/from-case/{case_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Draft */
        post: operations["draft_api_knowledge_from_case__case_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Library Graph */
        get: operations["library_graph_api_knowledge_graph_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/{entry_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detail */
        get: operations["detail_api_knowledge__entry_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/{entry_id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Command */
        post: operations["command_api_knowledge__entry_id__actions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/{entry_id}/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Graph */
        get: operations["graph_api_knowledge__entry_id__graph_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/knowledge/{entry_id}/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry Preparation */
        post: operations["retry_preparation_api_knowledge__entry_id__prepare_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/logs/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview Context */
        post: operations["preview_context_api_logs_context_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/logs/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Log
         * @description Parse text without attaching events or evidence to an investigation.
         */
        post: operations["preview_log_api_logs_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vision/assessments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload Assessment */
        post: operations["upload_assessment_api_vision_assessments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vision/assessments/{assessment_id}/{asset}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Assessment Image */
        get: operations["assessment_image_api_vision_assessments__assessment_id___asset__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vision/examples": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Examples */
        get: operations["examples_api_vision_examples_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vision/examples/{example_id}/assess": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assess Example */
        post: operations["assess_example_api_vision_examples__example_id__assess_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vision/examples/{example_id}/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Example Image */
        get: operations["example_image_api_vision_examples__example_id__image_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AgentFinding */
        AgentFinding: {
            /**
             * Agent
             * @enum {string}
             */
            agent: "fluid_path_specialist" | "material_process_specialist" | "diagnostic_critic";
            /**
             * Confidence Band
             * @enum {string}
             */
            confidence_band: "high" | "medium" | "low";
            /** Conflicting Evidence Ids */
            conflicting_evidence_ids: string[];
            /** Hypothesis Id */
            hypothesis_id: string;
            /** Knowledge Refs */
            knowledge_refs?: string[];
            /** Missing Evidence */
            missing_evidence: string[];
            /** Source Refs */
            source_refs: string[];
            /** Summary */
            summary: string;
            /** Supporting Evidence Ids */
            supporting_evidence_ids: string[];
        };
        /** Answer */
        Answer: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "answer";
            /** Question Id */
            question_id: string;
            /** Revision */
            revision: number;
            /** Value */
            value: string;
        };
        /** AnswerClarification */
        AnswerClarification: {
            /** Prompt */
            prompt: string;
            /** Proposed Value */
            proposed_value: string;
            /**
             * Question Id
             * @enum {string}
             */
            question_id: "frequency" | "continuous" | "intermittent" | "change" | "temperature" | "service";
            /** Source Ref */
            source_ref: string;
        };
        /** AttachLog */
        AttachLog: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "attach_log";
            log: components["schemas"]["LogPreviewRequest"];
            /** Revision */
            revision: number;
        };
        /** Case */
        Case: {
            /** Answers */
            answers: {
                [key: string]: string;
            };
            /**
             * Calibration Attempts
             * @default 0
             */
            calibration_attempts: number;
            /**
             * Calibration Failures
             * @default 0
             */
            calibration_failures: number;
            /** Corrective Action */
            corrective_action: ("nozzle_cleaning" | "nozzle_replacement") | null;
            /** Diagnosis Supported */
            diagnosis_supported: boolean;
            /** Diagnostic History */
            diagnostic_history: components["schemas"]["DiagnosticSnapshot"][];
            /**
             * Escalated
             * @default false
             */
            escalated: boolean;
            /** Findings */
            findings: components["schemas"]["AgentFinding"][];
            /**
             * Findings Mode
             * @default cached_templates
             * @enum {string}
             */
            findings_mode: "cached_templates" | "live";
            intake: components["schemas"]["IntakeRecord"] | null;
            investigation: components["schemas"]["Investigation"];
            log: components["schemas"]["IngestionResult"] | null;
            /** Measurement */
            measurement: components["schemas"]["Measurement"] | components["schemas"]["LegacyMeasurement"] | components["schemas"]["VisionAssessment"];
            next_question: components["schemas"]["DiscoveryQuestion"] | null;
            past_experience: components["schemas"]["RetrievalSnapshot"];
            /** Pending Outcome */
            pending_outcome: ("obstruction_found" | "no_obstruction_found") | null;
            /** Procedure */
            procedure: components["schemas"]["ProcedureStep"][];
            /**
             * Questions Complete
             * @default false
             */
            questions_complete: boolean;
            /** Ranking */
            ranking: components["schemas"]["RankedCause"][];
            reasoning: components["schemas"]["ReasoningRun"] | null;
            recommendation: components["schemas"]["TestRecommendation"] | null;
            recovery: components["schemas"]["RecoveryChecks"] | null;
            /**
             * Revision
             * @default 0
             */
            revision: number;
            /**
             * Rules Version
             * @default 1.0
             * @enum {string}
             */
            rules_version: "1.0" | "2.0";
            /**
             * Scenario Version
             * @default 1.0
             * @enum {string}
             */
            scenario_version: "1.0" | "2.0";
            summary: components["schemas"]["CompletionSummary"] | null;
            /** Timeline */
            timeline: components["schemas"]["TimelineEntry"][];
            /** Verification */
            verification: components["schemas"]["Measurement"] | components["schemas"]["LegacyMeasurement"] | components["schemas"]["VisionAssessment"] | null;
        };
        /** CaseExplanation */
        CaseExplanation: {
            /** Answer */
            answer: string;
            /** Evidence Ids */
            evidence_ids: string[];
            /** Knowledge Refs */
            knowledge_refs?: string[];
            /**
             * Mode
             * @default cached
             * @constant
             */
            mode: "cached";
            /**
             * Non Mutating
             * @default true
             * @constant
             */
            non_mutating: true;
            /** Source Refs */
            source_refs: string[];
            /** Timestamp */
            timestamp: string;
        };
        /** CaseExplanationRequest */
        CaseExplanationRequest: {
            /** Question */
            question: string;
            /** Revision */
            revision: number;
        };
        /** CaseListItem */
        CaseListItem: {
            /** Id */
            id: string;
            /**
             * Phase
             * @enum {string}
             */
            phase: "Report" | "Diagnose" | "Inspect" | "Correct" | "Verify" | "Summary";
            /** Read Only */
            read_only: boolean;
            /** Scenario Version */
            scenario_version: string;
            /** Simulated */
            simulated: boolean;
            /** State */
            state: string;
            /** Title */
            title: string;
            /** Updated At */
            updated_at: string;
        };
        /** CaseSummary */
        CaseSummary: {
            /** Confirmed Cause */
            confirmed_cause: string;
            /** Corrective Action */
            corrective_action: string;
            /** Evidence Ids */
            evidence_ids: string[];
            /** Problem */
            problem: string;
            /** Verification */
            verification: string;
        };
        /** CitationStatus */
        CitationStatus: {
            /** Citation */
            citation: string;
            /** Current */
            current: boolean;
            /** Latest Version */
            latest_version: number | null;
            /** Status */
            status: string;
        };
        /** CompleteAction */
        CompleteAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "complete_action";
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            /**
             * Corrective Action
             * @default nozzle_replacement
             * @enum {string}
             */
            corrective_action: "nozzle_cleaning" | "nozzle_replacement";
            /** Revision */
            revision: number;
        };
        /** CompletionSummary */
        CompletionSummary: {
            /** Confirmed Cause */
            confirmed_cause: string;
            /** Corrective Action */
            corrective_action: string;
            /** Evidence Ids */
            evidence_ids: string[];
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Problem */
            problem: string;
            /** Verification */
            verification: string;
        };
        /** Confirm */
        Confirm: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "confirm_observation";
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            /** Revision */
            revision: number;
        };
        /** CorrectEvidence */
        CorrectEvidence: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "correct_evidence";
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            /** Evidence Id */
            evidence_id: string;
            /**
             * Operation
             * @enum {string}
             */
            operation: "edit" | "reject";
            /** Reason */
            reason: string;
            /** Revision */
            revision: number;
            /** Value */
            value?: string | null;
        };
        /** CreateCase */
        CreateCase: {
            /** Assessment Id */
            assessment_id?: string | null;
            context?: components["schemas"]["IntakeContext"] | null;
            /** Report */
            report: string;
            /** Sample Id */
            sample_id?: ("normal" | "incomplete" | "coarse" | "shifted" | "overspray") | null;
        };
        /** CriticResult */
        CriticResult: {
            /**
             * Accepted
             * @description True only when ALL supplied specialist findings are grounded.
             */
            accepted: boolean;
            assessment: components["schemas"]["AgentFinding"];
            /**
             * Reasons
             * @description Reasons for accepting or rejecting the supplied findings.
             */
            reasons: string[];
            /**
             * Rejected Hypotheses
             * @description Hypothesis IDs of supplied findings rejected for unsupported CLAIMS. Not hypotheses made less likely by evidence. Empty when accepted is true.
             */
            rejected_hypotheses: string[];
        };
        /** DemoLogMetadata */
        DemoLogMetadata: {
            /** Assumed Timezone Offset */
            assumed_timezone_offset: string;
            /**
             * Format Profile
             * @constant
             */
            format_profile: "industry_event_log_v1";
            /** Label */
            label: string;
            /** Limitations */
            limitations: string[];
            /** Source */
            source: string;
        };
        /** DemoScenario */
        DemoScenario: {
            investigation: components["schemas"]["Investigation"];
            log_metadata: components["schemas"]["DemoLogMetadata"];
            sample_log: components["schemas"]["LogPreviewRequest"];
            /**
             * Schema Version
             * @constant
             */
            schema_version: "2.0";
        };
        /** Diagnose */
        Diagnose: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "diagnose";
            /** Revision */
            revision: number;
        };
        /** DiagnosticSnapshot */
        DiagnosticSnapshot: {
            /** Evidence */
            evidence: components["schemas"]["Evidence"][];
            /** Findings */
            findings: components["schemas"]["AgentFinding"][];
            /**
             * Findings Mode
             * @enum {string}
             */
            findings_mode: "cached_templates" | "live";
            past_experience?: components["schemas"]["RetrievalSnapshot"];
            /** Ranking */
            ranking: components["schemas"]["RankedCause"][];
            reasoning: components["schemas"]["ReasoningRun"] | null;
            /** Revision */
            revision: number;
            /** State */
            state: string;
            /** Timestamp */
            timestamp: string;
            /**
             * Trigger
             * @enum {string}
             */
            trigger: "retained_baseline" | "diagnose" | "confirm_observation" | "correct_evidence" | "refresh_knowledge";
        };
        /** DiscoveryQuestion */
        DiscoveryQuestion: {
            /** Id */
            id: string;
            /** Options */
            options: components["schemas"]["QuestionOption"][];
            /** Prompt */
            prompt: string;
            /** Rationale */
            rationale: string;
        };
        /** DraftGeneration */
        DraftGeneration: {
            /**
             * Mode
             * @default cached
             * @enum {string}
             */
            mode: "pending" | "live" | "cached" | "manual";
            /** Model */
            model?: string | null;
            /** Reason */
            reason?: string | null;
            /** Timestamp */
            timestamp?: string | null;
        };
        /** Evidence */
        Evidence: {
            /** Id */
            id: string;
            /** Key */
            key: string;
            /**
             * Quality
             * @enum {string}
             */
            quality: "high" | "medium" | "low";
            /** Source Ref */
            source_ref: string;
            /**
             * Source Type
             * @enum {string}
             */
            source_type: "synthetic_image_measurement" | "machine_log" | "technician_input" | "heuristic_inference" | "model_inference";
            /** Timestamp */
            timestamp: string;
            /** Unit */
            unit?: string | {
                [key: string]: string;
            } | null;
            value: components["schemas"]["JsonValue"];
            /**
             * Verification State
             * @enum {string}
             */
            verification_state: "provisional" | "verified" | "rejected";
        };
        /** EvidenceCandidate */
        EvidenceCandidate: {
            /** Context */
            context: {
                [key: string]: components["schemas"]["JsonValue"];
            } | null;
            /** Key */
            key: string;
            /** Sourceref */
            sourceRef: string;
            /**
             * Sourcetype
             * @constant
             */
            sourceType: "machine_log";
            /** Timestamp */
            timestamp: string | null;
            /** Unit */
            unit: string | {
                [key: string]: string;
            } | null;
            value: components["schemas"]["JsonValue"];
            /**
             * Verificationstate
             * @constant
             */
            verificationState: "provisional";
        };
        /** GoldenScenario */
        GoldenScenario: {
            /** Findings */
            findings: components["schemas"]["AgentFinding"][];
            /** First Question Id */
            first_question_id: string;
            /**
             * Fixture Version
             * @constant
             */
            fixture_version: "2.0";
            /** Images */
            images: components["schemas"]["ImageMeasurement"][];
            /** Initial Snapshot Id */
            initial_snapshot_id: string;
            investigation: components["schemas"]["Investigation"];
            log_preview: components["schemas"]["IngestionResult"];
            /** Outcomes */
            outcomes: components["schemas"]["InspectionOutcome"][];
            /**
             * Procedure Review
             * @constant
             */
            procedure_review: "feedback_received_approval_pending";
            /** Procedure Steps */
            procedure_steps: components["schemas"]["ProcedureStep"][];
            /** Questions */
            questions: components["schemas"]["DiscoveryQuestion"][];
            /** Recommendations */
            recommendations: components["schemas"]["TestRecommendation"][];
            recovery_checks: components["schemas"]["RecoveryChecks"];
            /**
             * Schema Version
             * @constant
             */
            schema_version: "2.0";
            /**
             * Simulated
             * @constant
             */
            simulated: true;
            /** Snapshots */
            snapshots: components["schemas"]["GoldenSnapshot"][];
            summary: components["schemas"]["CaseSummary"];
            verification: components["schemas"]["VerificationComparison"];
        };
        /** GoldenSnapshot */
        GoldenSnapshot: {
            /** Evidence Ids */
            evidence_ids: string[];
            /** Id */
            id: string;
            /** Next Snapshot Id */
            next_snapshot_id: string | null;
            /** Ranking */
            ranking: components["schemas"]["RankedCause"][];
            /** Recommendation Id */
            recommendation_id: string | null;
            /**
             * Screen
             * @enum {string}
             */
            screen: "report" | "log" | "questions" | "diagnosis" | "inspection" | "confirmation" | "corrective" | "verification" | "summary";
            /**
             * State
             * @enum {string}
             */
            state: "reported" | "diagnosing" | "inspection_recommended" | "inspection_completed" | "cause_confirmed" | "corrective_action_completed" | "verification_passed" | "resolved";
            /** Timeline */
            timeline: components["schemas"]["TimelineEntry"][];
            /** Title */
            title: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** Health */
        Health: {
            /**
             * Service
             * @default flowpilot-api
             * @constant
             */
            service: "flowpilot-api";
            /**
             * Status
             * @default ok
             * @constant
             */
            status: "ok";
            /**
             * Version
             * @default 0.1.0
             * @constant
             */
            version: "0.1.0";
        };
        /** ImageMeasurement */
        ImageMeasurement: {
            /** Coarse Area Px */
            coarse_area_px: number;
            /** Coverage Pct */
            coverage_pct: number;
            /** Displacement Px */
            displacement_px: number;
            /** Evidence Ids */
            evidence_ids: string[];
            /**
             * Height
             * @default 160
             */
            height: number;
            /** Id */
            id: string;
            /** Image Url */
            image_url: string;
            /** Keep Out Bounds */
            keep_out_bounds?: number[];
            /** Label */
            label: string;
            /** Outside Keep Out Px */
            outside_keep_out_px: number;
            /** Passed */
            passed: boolean;
            /**
             * Sample Id
             * @enum {string}
             */
            sample_id: "normal" | "incomplete" | "coarse" | "shifted" | "overspray";
            /**
             * Simulated
             * @default true
             * @constant
             */
            simulated: true;
            /** Target Bounds */
            target_bounds?: number[];
            /** Uncovered Area Px */
            uncovered_area_px: number;
            /**
             * Width
             * @default 360
             */
            width: number;
        };
        /** IngestionResult */
        IngestionResult: {
            /** Events */
            events: components["schemas"]["MachineEvent"][];
            /** Evidencecandidates */
            evidenceCandidates: components["schemas"]["EvidenceCandidate"][];
            /**
             * Format
             * @constant
             */
            format: "industry_event_log_v1";
            /** Runs */
            runs: components["schemas"]["MachineRun"][];
            /** Sourcedigest */
            sourceDigest: string;
            /** Sourcename */
            sourceName: string;
            stats: components["schemas"]["IngestionStats"];
            timeRange: components["schemas"]["TimeRange"];
            /** Timezone */
            timezone: string | null;
            /** Warnings */
            warnings: components["schemas"]["IngestionWarning"][];
        };
        /** IngestionStats */
        IngestionStats: {
            /** Eventcount */
            eventCount: number;
            /** Recognizedeventcount */
            recognizedEventCount: number;
            /** Runcount */
            runCount: number;
            /** Unknowneventcount */
            unknownEventCount: number;
        };
        /** IngestionWarning */
        IngestionWarning: {
            /** Code */
            code: string;
            /** Count */
            count?: number | null;
            /** Line */
            line: number;
            /** Message */
            message: string;
            /** Relatedline */
            relatedLine?: number | null;
        };
        /** Inspect */
        Inspect: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "inspect";
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "obstruction_found" | "no_obstruction_found";
            /** Revision */
            revision: number;
        };
        /** InspectionOutcome */
        InspectionOutcome: {
            /** Evidence Id */
            evidence_id: string;
            /** Next Snapshot Id */
            next_snapshot_id: string;
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "obstruction_found" | "no_obstruction_found";
        };
        /** IntakeContext */
        IntakeContext: {
            /** Board Id */
            board_id?: string | null;
            log?: components["schemas"]["LogPreviewRequest"] | null;
            /**
             * Log Confirmed
             * @default false
             */
            log_confirmed: boolean;
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Observations */
            observations: {
                [key: string]: components["schemas"]["ObservationChoice"];
            };
        };
        /** IntakeRecord */
        IntakeRecord: {
            /** Board Id */
            board_id?: string | null;
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Observations */
            observations: {
                [key: string]: components["schemas"]["ObservationChoice"];
            };
            /** Signals */
            signals: {
                [key: string]: components["schemas"]["LogSignal"];
            };
        };
        /** Investigation */
        Investigation: {
            /** Evidence */
            evidence?: components["schemas"]["Evidence"][];
            /** Id */
            id: string;
            /** Process */
            process: string;
            /** Reported At */
            reported_at: string;
            /**
             * Schema Version
             * @default 1.0
             * @enum {string}
             */
            schema_version: "1.0" | "2.0";
            /** Simulated */
            simulated: boolean;
            /**
             * State
             * @enum {string}
             */
            state: "reported" | "diagnosing" | "inspection_recommended" | "inspection_completed" | "cause_confirmed" | "corrective_action_completed" | "verification_passed" | "resolved";
            /** Title */
            title: string;
        };
        JsonValue: unknown;
        /** KnowledgeCommand */
        KnowledgeCommand: {
            /**
             * Action
             * @enum {string}
             */
            action: "revise" | "publish" | "dispute" | "archive";
            /** Actor */
            actor: string;
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            content?: components["schemas"]["KnowledgeContent"] | null;
            /** Reason */
            reason: string;
            /** Revision */
            revision: number;
        };
        /** KnowledgeContent */
        KnowledgeContent: {
            /**
             * Check Focus
             * @enum {string}
             */
            check_focus: "nozzle_inspection" | "air_supply_review" | "material_review";
            /**
             * Finding
             * @enum {string}
             */
            finding: "obstruction_found" | "no_obstruction_found" | "uncertain";
            /** Lesson */
            lesson: string;
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "recovered" | "not_recovered" | "unresolved";
            /** Supporting Evidence Ids */
            supporting_evidence_ids: string[];
            /** Title */
            title: string;
        };
        /** KnowledgeCreate */
        KnowledgeCreate: {
            /** Actor */
            actor: string;
            /** Source Revision */
            source_revision: number;
        };
        /** KnowledgeEdge */
        KnowledgeEdge: {
            /** Case Id */
            case_id: string;
            /** Citation */
            citation: string;
            /** Evidence Ids */
            evidence_ids: string[];
            /** Id */
            id: string;
            /** Relation */
            relation: string;
            /** Source */
            source: string;
            /** Status */
            status: string;
            /** Target */
            target: string;
        };
        /** KnowledgeEntry */
        KnowledgeEntry: {
            /** Events */
            events: components["schemas"]["KnowledgeEvent"][];
            generation?: components["schemas"]["DraftGeneration"];
            /** Id */
            id: string;
            /** Revision */
            revision: number;
            /** Source Case Id */
            source_case_id: string;
            /**
             * Status
             * @enum {string}
             */
            status: "draft" | "published" | "disputed" | "archived";
            /** Versions */
            versions: components["schemas"]["KnowledgeVersion"][];
        };
        /** KnowledgeEvent */
        KnowledgeEvent: {
            /** Actor */
            actor: string;
            /** Reason */
            reason: string;
            /** Revision */
            revision: number;
            /**
             * State
             * @enum {string}
             */
            state: "draft" | "published" | "disputed" | "archived";
            /** Timestamp */
            timestamp: string;
            /** Version */
            version: number;
        };
        /** KnowledgeGraph */
        KnowledgeGraph: {
            /** Edges */
            edges: components["schemas"]["KnowledgeEdge"][];
            /** Nodes */
            nodes: components["schemas"]["KnowledgeNode"][];
        };
        /** KnowledgeNode */
        KnowledgeNode: {
            /** Case Ids */
            case_ids?: string[];
            /** Detail */
            detail: string;
            /** Href */
            href?: string | null;
            /** Id */
            id: string;
            /** Kind */
            kind: string;
            /** Label */
            label: string;
        };
        /** KnowledgeSource */
        KnowledgeSource: {
            /** Action */
            action: string | null;
            /**
             * Actual Finding
             * @enum {string}
             */
            actual_finding: "obstruction_found" | "no_obstruction_found" | "uncertain";
            /**
             * Actual Outcome
             * @enum {string}
             */
            actual_outcome: "recovered" | "not_recovered" | "unresolved";
            /** Case Id */
            case_id: string;
            /** Conditions */
            conditions: {
                [key: string]: string;
            };
            /** Evidence */
            evidence: components["schemas"]["Evidence"][];
            /** Fingerprint */
            fingerprint: string;
            /** Image Url */
            image_url: string;
            /** Log Digest */
            log_digest: string | null;
            /** Possible Causes */
            possible_causes: string[];
            /** Problem */
            problem: string;
            /** Process */
            process: string;
            /** Recorded At */
            recorded_at: string;
            /** Revision */
            revision: number;
            /** Signature */
            signature: string;
            /** Simulated */
            simulated: boolean;
            /** Verification Image Url */
            verification_image_url: string | null;
        };
        /** KnowledgeVersion */
        KnowledgeVersion: {
            /** Actor */
            actor: string;
            content: components["schemas"]["KnowledgeContent"];
            /** Created At */
            created_at: string;
            /** Reason */
            reason: string;
            source: components["schemas"]["KnowledgeSource"];
            /** Version */
            version: number;
        };
        /** LaneCheck */
        LaneCheck: {
            /**
             * All Units Accepted
             * @default unknown
             * @enum {string}
             */
            all_units_accepted: "pass" | "fail" | "unknown";
            /** Lane */
            lane: string;
        };
        /** LearningCase */
        LearningCase: {
            /** Group Case Ids */
            group_case_ids?: string[];
            /**
             * Group Size
             * @default 1
             */
            group_size: number;
            /** Id */
            id: string;
            /** Knowledge Id */
            knowledge_id: string | null;
            /** Knowledge Status */
            knowledge_status: string;
            /** Process */
            process: string;
            /** Simulated */
            simulated: boolean;
            /** State */
            state: string;
            /** Symptoms */
            symptoms: string[];
            /** Title */
            title: string;
            /** Updated At */
            updated_at: string;
            /** Version */
            version: number | null;
        };
        /** LegacyMeasurement */
        LegacyMeasurement: {
            /** Abnormal Count */
            abnormal_count: number;
            /** Deviation Px */
            deviation_px: number;
            /** Dots */
            dots: components["schemas"]["MeasuredDot"][];
            /**
             * Golden Max Px
             * @default 32
             */
            golden_max_px: number;
            /**
             * Golden Min Px
             * @default 28
             */
            golden_min_px: number;
            /**
             * Height
             * @default 160
             */
            height: number;
            /** Image Url */
            image_url: string;
            /** Mean Diameter Px */
            mean_diameter_px: number;
            /** Mean Position Error Px */
            mean_position_error_px: number;
            /** Mean Shape Consistency */
            mean_shape_consistency: number;
            /** Missing Count */
            missing_count: number;
            /** Passed */
            passed: boolean;
            /**
             * Sample Id
             * @enum {string}
             */
            sample_id: "normal" | "undersized" | "oversized" | "missing";
            /**
             * Simulated
             * @default true
             * @constant
             */
            simulated: true;
            /** Variation Px */
            variation_px: number;
            /**
             * Width
             * @default 360
             */
            width: number;
        };
        /** LibraryOverview */
        LibraryOverview: {
            /** Cases */
            cases: components["schemas"]["LearningCase"][];
            graph: components["schemas"]["KnowledgeGraph"];
            /** Pending Review */
            pending_review: number;
            /** Processes */
            processes: string[];
            /** Reusable Experiences */
            reusable_experiences: number;
            /** Saved Cases */
            saved_cases: number;
            /** Total Matching */
            total_matching: number;
            /** Truncated */
            truncated: boolean;
        };
        /** LogContext */
        LogContext: {
            /** Board Id */
            board_id: string | null;
            /** Boards */
            boards: string[];
            parsed: components["schemas"]["IngestionResult"];
            /** Signals */
            signals: {
                [key: string]: components["schemas"]["LogSignal"];
            };
        };
        /** LogContextRequest */
        LogContextRequest: {
            /** Board Id */
            board_id?: string | null;
            log: components["schemas"]["LogPreviewRequest"];
        };
        /** LogPreviewRequest */
        LogPreviewRequest: {
            /**
             * Sourcename
             * @default machine.log
             */
            sourceName: string;
            /** Text */
            text: string;
            /** Timezoneoffset */
            timezoneOffset?: string | null;
        };
        /** LogSignal */
        LogSignal: {
            /** Answer */
            answer: string;
            /** Question Id */
            question_id: string;
            /** Source Refs */
            source_refs: string[];
            /** Summary */
            summary: string;
        };
        /** MachineEvent */
        MachineEvent: {
            /** Fields */
            fields: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Id */
            id: string;
            /** Kind */
            kind: string;
            /** Lineend */
            lineEnd: number;
            /** Linestart */
            lineStart: number;
            /** Localtimestamp */
            localTimestamp: string | null;
            /** Occurredat */
            occurredAt: string | null;
            /** Payload */
            payload: string;
            /** Raw */
            raw: string;
            /** Sourceref */
            sourceRef: string;
        };
        /** MachineRun */
        MachineRun: {
            /** Boardid */
            boardId: string;
            /** Complete */
            complete: boolean;
            /** Finishsourceref */
            finishSourceRef: string | null;
            /** Finishedat */
            finishedAt: string | null;
            /** Startsourceref */
            startSourceRef: string | null;
            /** Startedat */
            startedAt: string | null;
            /** Status */
            status: string | null;
        };
        /** MeasuredDot */
        MeasuredDot: {
            /**
             * Classification
             * @enum {string}
             */
            classification: "normal" | "undersized" | "oversized" | "missing";
            /** Diameter Px */
            diameter_px: number;
            /** Id */
            id: string;
            /** Position Error Px */
            position_error_px: number;
            /** Shape Consistency */
            shape_consistency: number;
            /** X */
            x: number;
            /** Y */
            y: number;
        };
        /** Measurement */
        Measurement: {
            /** Coarse Area Px */
            coarse_area_px: number;
            /** Coverage Pct */
            coverage_pct: number;
            /** Displacement Px */
            displacement_px: number;
            /**
             * Height
             * @default 160
             */
            height: number;
            /** Image Url */
            image_url: string;
            /** Keep Out Bounds */
            keep_out_bounds?: number[];
            /** Outside Keep Out Px */
            outside_keep_out_px: number;
            /** Passed */
            passed: boolean;
            /**
             * Sample Id
             * @enum {string}
             */
            sample_id: "normal" | "incomplete" | "coarse" | "shifted" | "overspray";
            /**
             * Simulated
             * @default true
             * @constant
             */
            simulated: true;
            /** Target Bounds */
            target_bounds?: number[];
            /** Uncovered Area Px */
            uncovered_area_px: number;
            /**
             * Width
             * @default 360
             */
            width: number;
        };
        /** ObservationChoice */
        ObservationChoice: {
            /** Observed Value */
            observed_value?: string | null;
            /**
             * Reason
             * @default
             */
            reason: string;
            /**
             * Source
             * @default technician_input
             * @enum {string}
             */
            source: "technician_input" | "machine_log";
            /** Value */
            value: string;
        };
        /** PastExperience */
        PastExperience: {
            /** Citation */
            citation: string;
            content: components["schemas"]["KnowledgeContent"];
            /** Historical Action */
            historical_action: string | null;
            /** Knowledge Id */
            knowledge_id: string;
            /** Matched Conditions */
            matched_conditions: string[];
            /** Simulated */
            simulated: boolean;
            /** Source Case Id */
            source_case_id: string;
            /** Source Refs */
            source_refs: string[];
            /** Source Revision */
            source_revision: number;
            /** Unknown Conditions */
            unknown_conditions: string[];
            /** Version */
            version: number;
        };
        /** PlannedQuestion */
        PlannedQuestion: {
            /** Prompt */
            prompt: string;
            /**
             * Question Id
             * @enum {string}
             */
            question_id: "frequency" | "continuous" | "intermittent" | "change" | "temperature" | "service";
            /** Rationale */
            rationale: string;
            /** Source Refs */
            source_refs: string[];
        };
        /** ProcedureStep */
        ProcedureStep: {
            /** Camera Preset */
            camera_preset: string;
            /** Caution */
            caution: string;
            /**
             * Highlight
             * @enum {string}
             */
            highlight: "warning" | "active" | "none";
            /** Instruction */
            instruction: string;
            /**
             * Model Node Id
             * @enum {string}
             */
            model_node_id: "bfs_bottle" | "pickup_tube" | "fluid_qd" | "dj2200_valve" | "air_cap" | "coaxial_air" | "valve_air" | "bfs_air" | "fluid_reservoir" | "feed_tube" | "jet_actuator" | "service_cartridge" | "nozzle" | "vision_camera" | "substrate_tray";
            /** Step Id */
            step_id: string;
            /** Title */
            title: string;
        };
        /** QuestionOption */
        QuestionOption: {
            /** Label */
            label: string;
            /** Next Question Id */
            next_question_id: string | null;
            /** Value */
            value: string;
        };
        /** QuestionPlan */
        QuestionPlan: {
            clarification?: components["schemas"]["AnswerClarification"] | null;
            /** Elapsed Ms */
            elapsed_ms: number;
            /** Fallback Reason */
            fallback_reason?: string | null;
            /**
             * Mode
             * @enum {string}
             */
            mode: "live" | "fallback";
            /** Model */
            model?: string | null;
            /** Questions */
            questions: components["schemas"]["PlannedQuestion"][];
            /** Ready */
            ready: boolean;
            /** Replan When */
            replan_when?: components["schemas"]["ReplanTrigger"][];
            /** Source Refs */
            source_refs: string[];
            /** State Id */
            state_id: string;
            /** Summary */
            summary: string;
        };
        /** QuestionPlanRequest */
        QuestionPlanRequest: {
            /** Assessment Id */
            assessment_id: string;
            /** Board Id */
            board_id?: string | null;
            /** Clarified */
            clarified?: ("frequency" | "continuous" | "intermittent" | "change" | "temperature" | "service")[];
            log?: components["schemas"]["LogPreviewRequest"] | null;
            /**
             * Log Confirmed
             * @default false
             */
            log_confirmed: boolean;
            /** Observations */
            observations?: {
                [key: string]: components["schemas"]["ObservationChoice"];
            };
            /** State Id */
            state_id: string;
            /** Supplements */
            supplements?: {
                [key: string]: string;
            };
        };
        /** RankedCause */
        RankedCause: {
            /** Confirmed */
            confirmed: boolean;
            /** Contributions */
            contributions: components["schemas"]["ScoreContribution"][];
            /** Hypothesis Id */
            hypothesis_id: string;
            /** Label */
            label: string;
            /** Missing Evidence */
            missing_evidence: string[];
            /** Score */
            score: number;
        };
        /** ReasoningRun */
        ReasoningRun: {
            critic?: components["schemas"]["CriticResult"] | null;
            /** Evidence Revision */
            evidence_revision: number;
            /** Fallback Reason */
            fallback_reason?: string | null;
            /**
             * Mode
             * @enum {string}
             */
            mode: "live" | "cached";
            /** Model */
            model: string | null;
            /**
             * Prompt Version
             * @default flux-2.1-knowledge
             */
            prompt_version: string;
            /** Timestamp */
            timestamp: string;
        };
        /** RecoveryChecks */
        RecoveryChecks: {
            /**
             * Calibration
             * @default unknown
             * @enum {string}
             */
            calibration: "pass" | "fail" | "unknown";
            /**
             * Confirmed
             * @default false
             */
            confirmed: boolean;
            /** Expected Lanes */
            expected_lanes?: string[];
            /** First Carriers */
            first_carriers?: components["schemas"]["LaneCheck"][];
            /**
             * Limits Reference
             * @default
             */
            limits_reference: string;
            /**
             * Pressure Within Limits
             * @default unknown
             * @enum {string}
             */
            pressure_within_limits: "pass" | "fail" | "unknown";
            /**
             * Profile
             * @default synthetic_demo
             * @constant
             */
            profile: "synthetic_demo";
            /**
             * Prompted Setup
             * @default unknown
             * @enum {string}
             */
            prompted_setup: "pass" | "fail" | "unknown";
            /**
             * Subsequent Required
             * @default unknown
             * @enum {string}
             */
            subsequent_required: "yes" | "no" | "unknown";
            /**
             * Subsequent Trays Accepted
             * @default 0
             */
            subsequent_trays_accepted: number;
            /**
             * Weight Within Limits
             * @default unknown
             * @enum {string}
             */
            weight_within_limits: "pass" | "fail" | "unknown";
        };
        /** RefreshKnowledge */
        RefreshKnowledge: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "refresh_knowledge";
            /** Revision */
            revision: number;
        };
        /** ReplanTrigger */
        ReplanTrigger: {
            /** Answer */
            answer: string;
            /**
             * Question Id
             * @enum {string}
             */
            question_id: "frequency" | "continuous" | "intermittent" | "change" | "temperature" | "service";
        };
        /** Resolve */
        Resolve: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "resolve";
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Revision */
            revision: number;
        };
        /** RetrievalSnapshot */
        RetrievalSnapshot: {
            /**
             * Explanation
             * @default Past experience has not been retrieved.
             */
            explanation: string;
            /**
             * Library Revision
             * @default 0
             */
            library_revision: number;
            /** Matches */
            matches?: components["schemas"]["PastExperience"][];
            /** Retrieved At */
            retrieved_at?: string | null;
            /** Suggested Check */
            suggested_check?: string | null;
        };
        /** ScoreContribution */
        ScoreContribution: {
            /** Evidence Id */
            evidence_id: string;
            /** Explanation */
            explanation: string;
            /** Weight */
            weight: number;
        };
        /** TestRecommendation */
        TestRecommendation: {
            /** Duration Minutes */
            duration_minutes: number;
            /** Expected Outcomes */
            expected_outcomes: string[];
            /** Id */
            id: string;
            /** Instructions */
            instructions: string;
            /** Name */
            name: string;
            /** Rationale */
            rationale: string;
            /** Required Parts */
            required_parts: string[];
            /** Safety Note */
            safety_note: string;
        };
        /** TimeRange */
        TimeRange: {
            /** End */
            end: string | null;
            /** Start */
            start: string | null;
        };
        /** TimelineEntry */
        TimelineEntry: {
            /** Description */
            description: string;
            /** Diagnostic Revision */
            diagnostic_revision?: number | null;
            /**
             * State
             * @enum {string}
             */
            state: "reported" | "diagnosing" | "inspection_recommended" | "inspection_completed" | "cause_confirmed" | "corrective_action_completed" | "verification_passed" | "resolved";
            /** Timestamp */
            timestamp: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /** VerificationComparison */
        VerificationComparison: {
            /** After Image Id */
            after_image_id: string;
            /** Before Image Id */
            before_image_id: string;
            /** Explanation */
            explanation: string;
            /** Passed */
            passed: boolean;
        };
        /** Verify */
        Verify: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "verify";
            /** Assessment Id */
            assessment_id?: string | null;
            checks?: components["schemas"]["RecoveryChecks"];
            /** Revision */
            revision: number;
            /** Sample Id */
            sample_id?: ("normal" | "incomplete" | "coarse" | "shifted" | "overspray") | null;
        };
        /** VisionAssessment */
        VisionAssessment: {
            /** Assessment Id */
            assessment_id: string;
            /** Heatmap Url */
            heatmap_url: string;
            /** Height */
            height: number;
            /** Image Url */
            image_url: string;
            /**
             * Kind
             * @default vision
             * @constant
             */
            kind: "vision";
            /** Model Id */
            model_id: string;
            /** Passed */
            passed: boolean;
            /** Preprocessing Id */
            preprocessing_id: string;
            /** Raw Score */
            raw_score: number;
            /**
             * Result
             * @enum {string}
             */
            result: "anomaly" | "within_reference";
            /** Threshold */
            threshold: number;
            /** Timestamp */
            timestamp: string;
            /** Width */
            width: number;
        };
        /** VisionExample */
        VisionExample: {
            /**
             * Id
             * @enum {string}
             */
            id: "incomplete" | "coarse" | "normal";
            /** Image Url */
            image_url: string;
            /** Label */
            label: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    golden_scenario_api_demo_golden_scenario_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GoldenScenario"];
                };
            };
        };
    };
    images_api_demo_images_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Measurement"][];
                };
            };
        };
    };
    image_api_demo_images__sample_id__png_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sample_id: "normal" | "incomplete" | "coarse" | "shifted" | "overspray";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reset_demo_api_demo_reset_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCase"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Case"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    scenario_api_demo_scenario_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DemoScenario"];
                };
            };
        };
    };
    health_api_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
        };
    };
    question_plan_api_intake_question_plan_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["QuestionPlanRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuestionPlan"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_cases_api_investigations_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaseListItem"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    new_case_api_investigations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCase"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Case"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_case_api_investigations__case_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Case"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    act_api_investigations__case_id__actions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AttachLog"] | components["schemas"]["Answer"] | components["schemas"]["Diagnose"] | components["schemas"]["RefreshKnowledge"] | components["schemas"]["Inspect"] | components["schemas"]["Confirm"] | components["schemas"]["Resolve"] | components["schemas"]["CompleteAction"] | components["schemas"]["Verify"] | components["schemas"]["CorrectEvidence"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Case"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    explain_api_investigations__case_id__explanations_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CaseExplanationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaseExplanation"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reference_status_api_investigations__case_id__knowledge_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CitationStatus"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    entries_api_knowledge_get: {
        parameters: {
            query?: {
                q?: string;
                status?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    by_source_api_knowledge_by_source__case_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"] | null;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    draft_api_knowledge_from_case__case_id__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["KnowledgeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    library_graph_api_knowledge_graph_get: {
        parameters: {
            query?: {
                q?: string;
                status?: string;
                process?: string;
                symptom?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibraryOverview"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    detail_api_knowledge__entry_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entry_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    command_api_knowledge__entry_id__actions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entry_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["KnowledgeCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    graph_api_knowledge__entry_id__graph_get: {
        parameters: {
            query?: {
                version?: number | null;
            };
            header?: never;
            path: {
                entry_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeGraph"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retry_preparation_api_knowledge__entry_id__prepare_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entry_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["KnowledgeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KnowledgeEntry"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_context_api_logs_context_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LogContextRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogContext"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_log_api_logs_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LogPreviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestionResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_assessment_api_vision_assessments_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VisionAssessment"];
                };
            };
        };
    };
    assessment_image_api_vision_assessments__assessment_id___asset__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                assessment_id: string;
                asset: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    examples_api_vision_examples_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VisionExample"][];
                };
            };
        };
    };
    assess_example_api_vision_examples__example_id__assess_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                example_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VisionAssessment"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    example_image_api_vision_examples__example_id__image_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                example_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
