export interface paths {
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
            unit?: string | null;
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
        /** TimeRange */
        TimeRange: {
            /** End */
            end: string | null;
            /** Start */
            start: string | null;
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
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
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
