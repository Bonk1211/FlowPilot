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
        get?: never;
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
            /** Diagnosis Supported */
            diagnosis_supported: boolean;
            /** Findings */
            findings: components["schemas"]["AgentFinding"][];
            /**
             * Findings Mode
             * @default cached_templates
             * @constant
             */
            findings_mode: "cached_templates";
            investigation: components["schemas"]["Investigation"];
            log: components["schemas"]["IngestionResult"] | null;
            measurement: components["schemas"]["Measurement"];
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
            recommendation: components["schemas"]["TestRecommendation"] | null;
            /**
             * Revision
             * @default 0
             */
            revision: number;
            /**
             * Rules Version
             * @default 1.0
             * @constant
             */
            rules_version: "1.0";
            summary: components["schemas"]["CaseSummary"] | null;
            /** Timeline */
            timeline: components["schemas"]["TimelineEntry"][];
            verification: components["schemas"]["Measurement"] | null;
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
        /** Confirm */
        Confirm: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "complete_action" | "confirm_observation" | "resolve";
            /**
             * Confirmed
             * @constant
             */
            confirmed: true;
            /** Revision */
            revision: number;
        };
        /** CreateCase */
        CreateCase: {
            /** Report */
            report: string;
            /**
             * Sample Id
             * @default undersized
             * @enum {string}
             */
            sample_id: "normal" | "undersized" | "oversized" | "missing";
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
            schema_version: "1.0";
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
        /** Dot */
        Dot: {
            /**
             * Classification
             * @enum {string}
             */
            classification: "normal" | "undersized" | "oversized" | "missing";
            /** Diameter Px */
            diameter_px: number;
            /** Id */
            id: string;
            /** X */
            x: number;
            /** Y */
            y: number;
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
            source_type: "synthetic_image_measurement" | "machine_log" | "technician_input" | "heuristic_inference";
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
            fixture_version: "1.0";
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
            procedure_review: "pending_expert_review";
            /** Procedure Steps */
            procedure_steps: components["schemas"]["ProcedureStep"][];
            /** Questions */
            questions: components["schemas"]["DiscoveryQuestion"][];
            /** Recommendations */
            recommendations: components["schemas"]["TestRecommendation"][];
            /**
             * Schema Version
             * @constant
             */
            schema_version: "1.0";
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
            /** Dots */
            dots: components["schemas"]["Dot"][];
            /** Evidence Ids */
            evidence_ids: string[];
            /** Golden Max Px */
            golden_max_px: number;
            /** Golden Min Px */
            golden_min_px: number;
            /** Height */
            height: number;
            /** Id */
            id: string;
            /** Label */
            label: string;
            /** Mean Diameter Px */
            mean_diameter_px: number;
            /** Quality Summary */
            quality_summary: string;
            /**
             * Synthetic
             * @constant
             */
            synthetic: true;
            /** Variation Px */
            variation_px: number;
            /** Width */
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
             * @constant
             */
            schema_version: "1.0";
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
            model_node_id: "fluid_reservoir" | "feed_tube" | "jet_actuator" | "service_cartridge" | "nozzle" | "vision_camera" | "substrate_tray";
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
            /** Revision */
            revision: number;
            /**
             * Sample Id
             * @enum {string}
             */
            sample_id: "normal" | "undersized" | "oversized" | "missing";
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
                sample_id: "normal" | "undersized" | "oversized" | "missing";
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
                "application/json": components["schemas"]["AttachLog"] | components["schemas"]["Answer"] | components["schemas"]["Diagnose"] | components["schemas"]["Inspect"] | components["schemas"]["Confirm"] | components["schemas"]["Verify"];
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
}
