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
            investigation: components["schemas"]["Investigation"];
            log: components["schemas"]["IngestionResult"] | null;
            /** Measurement */
            measurement: components["schemas"]["Measurement"] | components["schemas"]["LegacyMeasurement"] | components["schemas"]["VisionAssessment"];
            next_question: components["schemas"]["DiscoveryQuestion"] | null;
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
            trigger: "retained_baseline" | "diagnose" | "confirm_observation" | "correct_evidence";
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
             * @default flux-2.0
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
                "application/json": components["schemas"]["AttachLog"] | components["schemas"]["Answer"] | components["schemas"]["Diagnose"] | components["schemas"]["Inspect"] | components["schemas"]["Confirm"] | components["schemas"]["Resolve"] | components["schemas"]["CompleteAction"] | components["schemas"]["Verify"] | components["schemas"]["CorrectEvidence"];
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
