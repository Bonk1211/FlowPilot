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
    "/api/incident-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Access */
        get: operations["access_api_incident_access_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-access/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Access History */
        get: operations["access_history_api_incident_access_audit_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-artifacts/retention": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enforce Retention */
        post: operations["enforce_retention_api_incident_artifacts_retention_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-jobs/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Coordinator Status */
        get: operations["coordinator_status_api_incident_jobs_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Documents */
        get: operations["list_documents_api_incident_knowledge_get"];
        put?: never;
        /** Add Document */
        post: operations["add_document_api_incident_knowledge_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge/conflicts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Conflicts */
        get: operations["conflicts_api_incident_knowledge_conflicts_get"];
        put?: never;
        /** Add Conflict */
        post: operations["add_conflict_api_incident_knowledge_conflicts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge/conflicts/{conflict_id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review Conflict */
        post: operations["review_conflict_api_incident_knowledge_conflicts__conflict_id__reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge/passages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Passages */
        get: operations["passages_api_incident_knowledge_passages_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge/{source_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Document */
        get: operations["get_document_api_incident_knowledge__source_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-knowledge/{source_id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish Document */
        post: operations["publish_document_api_incident_knowledge__source_id__reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incident-simulation/demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Demo */
        get: operations["demo_api_incident_simulation_demo_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listing */
        get: operations["listing_api_incidents_get"];
        put?: never;
        /** Create */
        post: operations["create_api_incidents_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/replay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replay */
        post: operations["replay_api_incidents_replay_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get */
        get: operations["get_api_incidents__incident_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Action */
        post: operations["action_api_incidents__incident_id__actions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/artifacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Originals */
        get: operations["list_originals_api_incidents__incident_id__artifacts_get"];
        put?: never;
        /** Upload Original */
        post: operations["upload_original_api_incidents__incident_id__artifacts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/artifacts/{artifact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Original */
        get: operations["download_original_api_incidents__incident_id__artifacts__artifact_id__get"];
        put?: never;
        post?: never;
        /** Delete Original */
        delete: operations["delete_original_api_incidents__incident_id__artifacts__artifact_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Communications */
        get: operations["list_communications_api_incidents__incident_id__communications_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications/approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve */
        post: operations["approve_api_incidents__incident_id__communications_approvals_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications/mock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mock Approval */
        post: operations["mock_approval_api_incidents__incident_id__communications_mock_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications/{communication_id}/mock-event": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mock Event */
        post: operations["mock_event_api_incidents__incident_id__communications__communication_id__mock_event_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications/{communication_id}/receipts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record Receipt */
        post: operations["record_receipt_api_incidents__incident_id__communications__communication_id__receipts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/communications/{communication_id}/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send */
        post: operations["send_api_incidents__incident_id__communications__communication_id__send_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/experience": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Past Experience */
        get: operations["past_experience_api_incidents__incident_id__experience_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/experiments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Plans */
        get: operations["list_plans_api_incidents__incident_id__experiments_get"];
        put?: never;
        /** Propose Plan */
        post: operations["propose_plan_api_incidents__incident_id__experiments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/experiments/{plan_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve */
        post: operations["approve_api_incidents__incident_id__experiments__plan_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/experiments/{plan_id}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Execute */
        post: operations["execute_api_incidents__incident_id__experiments__plan_id__run_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/experiments/{plan_id}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Withdraw */
        post: operations["withdraw_api_incidents__incident_id__experiments__plan_id__withdraw_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Jobs */
        get: operations["get_jobs_api_incidents__incident_id__jobs_get"];
        put?: never;
        /** Schedule Jobs */
        post: operations["schedule_jobs_api_incidents__incident_id__jobs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/report.md": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Report */
        get: operations["report_api_incidents__incident_id__report_md_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/incidents/{incident_id}/simulation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record Simulation */
        post: operations["record_simulation_api_incidents__incident_id__simulation_post"];
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
        /** AccessAudit */
        AccessAudit: {
            /** Id */
            id: string;
            /** Method */
            method: string;
            /** Resource */
            resource: string;
            /** Status Code */
            status_code: number;
            /** Subject */
            subject: string | null;
            /** Timestamp */
            timestamp: string;
        };
        /** Actor */
        Actor: {
            /** Authenticated */
            authenticated: boolean;
            /**
             * Mode
             * @enum {string}
             */
            mode: "demo" | "configured";
            /** Permissions */
            permissions: ("view" | "edit" | "authorize_test" | "send_email" | "close" | "publish_knowledge" | "manage_data")[];
            /** Subject */
            subject: string | null;
        };
        /** AddEvidenceAction */
        AddEvidenceAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "add_evidence";
            evidence: components["schemas"]["EvidenceInput"];
            /** Revision */
            revision: number;
        };
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
        /** ApplicableSourcePassage */
        ApplicableSourcePassage: {
            /** Applicable */
            applicable: boolean;
            /**
             * Approval Status
             * @enum {string}
             */
            approval_status: "approved" | "reviewed_reference" | "unverified" | "withdrawn" | "conflicted";
            /**
             * Authority
             * @enum {string}
             */
            authority: "controlled_procedure" | "secondary_summary" | "example";
            /** Configurations */
            configurations: string[];
            /** Conflict Ids */
            conflict_ids: string[];
            /** Content Digest */
            content_digest: string;
            /** Document Id */
            document_id: string;
            /**
             * Excerpt Kind
             * @default exact_excerpt
             * @constant
             */
            excerpt_kind: "exact_excerpt";
            /** File Path */
            file_path: string;
            /** Id */
            id: string;
            /** Limitation */
            limitation: string;
            /** Operational Allowed */
            operational_allowed: boolean;
            /** Original Sha256 */
            original_sha256: string | null;
            /** Page */
            page: string | null;
            /** Passage */
            passage: string;
            /** Publication Version */
            publication_version: number;
            /** Revision */
            revision: string;
            /** Section */
            section: string;
            /** Source Id */
            source_id: string;
            /** Title */
            title: string;
        };
        /** Artifact */
        Artifact: {
            /** Created At */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Deleted At */
            deleted_at?: string | null;
            /** Deleted By */
            deleted_by?: string | null;
            /** Deletion Reason */
            deletion_reason?: string | null;
            /** Expires At */
            expires_at: string;
            /** Filename */
            filename: string;
            /** Id */
            id: string;
            /** Incident Id */
            incident_id: string;
            /** Media Type */
            media_type: string;
            /** Sha256 */
            sha256: string;
            /** Size Bytes */
            size_bytes: number;
            /**
             * Status
             * @default available
             * @enum {string}
             */
            status: "available" | "deleted" | "expired";
        };
        /** AssessmentSnapshot */
        AssessmentSnapshot: {
            assessment: components["schemas"]["DiagnosticAssessment"];
            /** Created At */
            created_at: string;
            /** Incident Revision */
            incident_revision: number;
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
        /** CausalStep */
        CausalStep: {
            /** Evidence Ids */
            evidence_ids: string[];
            /** Explanation */
            explanation: string;
            /** Question */
            question: string;
            /**
             * Status
             * @enum {string}
             */
            status: "observed" | "inferred" | "unsupported";
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
        /** CloseIncidentAction */
        CloseIncidentAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "close";
            /** Conclusion */
            conclusion?: string | null;
            /** Notes */
            notes: string;
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "supported" | "inconclusive";
            /** Reviewer */
            reviewer: string;
            /** Revision */
            revision: number;
        };
        /** Closure */
        Closure: {
            /** Closed At */
            closed_at: string;
            /** Conclusion */
            conclusion: string | null;
            /** Evidence Revision */
            evidence_revision: number;
            /** Notes */
            notes: string;
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "supported" | "inconclusive";
            /** Reviewer */
            reviewer: string;
        };
        /** CommunicationApprovalRequest */
        CommunicationApprovalRequest: {
            /** Draft Version */
            draft_version: number;
            /** Incident Revision */
            incident_revision: number;
            /** Recipients */
            recipients: string[];
        };
        /** CommunicationAttempt */
        CommunicationAttempt: {
            /** Actor */
            actor: string;
            /**
             * Detail
             * @default SMTP attempt claimed; delivery has not been established.
             */
            detail: string;
            /** Finished At */
            finished_at?: string | null;
            /** Message Id */
            message_id: string;
            /** Number */
            number: number;
            /**
             * Retryable
             * @default false
             */
            retryable: boolean;
            /** Started At */
            started_at: string;
            /**
             * Status
             * @default sending
             * @enum {string}
             */
            status: "sending" | "accepted" | "failed" | "unknown";
        };
        /** CommunicationReceipt */
        CommunicationReceipt: {
            /** Actor */
            actor: string;
            /** Notes */
            notes: string;
            /** Recorded At */
            recorded_at: string;
            /** Reference */
            reference: string;
            /**
             * Status
             * @enum {string}
             */
            status: "unknown" | "delivered" | "acknowledged";
            /** Version */
            version: number;
        };
        /** CommunicationReceiptRequest */
        CommunicationReceiptRequest: {
            /** Notes */
            notes: string;
            /** Reference */
            reference: string;
            /** Revision */
            revision: number;
            /**
             * Status
             * @enum {string}
             */
            status: "unknown" | "delivered" | "acknowledged";
        };
        /** CommunicationSendRequest */
        CommunicationSendRequest: {
            /** Revision */
            revision: number;
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
        /** ConflictReview */
        ConflictReview: {
            /** Actor */
            actor: string;
            /**
             * Decision
             * @enum {string}
             */
            decision: "resolve" | "reopen";
            /** Notes */
            notes: string;
            /** Timestamp */
            timestamp: string;
            /** Version */
            version: number;
        };
        /** ConflictReviewRequest */
        ConflictReviewRequest: {
            /**
             * Decision
             * @enum {string}
             */
            decision: "resolve" | "reopen";
            /** Notes */
            notes: string;
            /** Revision */
            revision: number;
        };
        /** CoordinatorStatus */
        CoordinatorStatus: {
            /** Enabled */
            enabled: boolean;
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
        /** CorrectEvidenceAction */
        CorrectEvidenceAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "correct_evidence";
            /** Evidence Id */
            evidence_id: string;
            /** Reason */
            reason: string;
            replacement: components["schemas"]["EvidenceInput"];
            /** Revision */
            revision: number;
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
        /** CreateIncident */
        CreateIncident: {
            /**
             * Configuration
             * @default S932 / DJ-2200 / BFS
             */
            configuration: string;
            /** Evidence */
            evidence?: components["schemas"]["EvidenceInput"][];
            /**
             * Mode
             * @default synthetic
             * @enum {string}
             */
            mode: "live" | "replay" | "synthetic";
            /**
             * Symptom
             * @default Progressively insufficient flux coverage
             */
            symptom: string;
            /**
             * Tool Id
             * @default S932-DEMO-01
             */
            tool_id: string;
            /** Trigger Id */
            trigger_id: string;
            /**
             * Trigger Origin
             * @default manual
             * @enum {string}
             */
            trigger_origin: "manual" | "alarm" | "image_quality" | "replay";
            /** Trigger Time */
            trigger_time?: string | null;
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
        /** DecisionRun */
        DecisionRun: {
            /**
             * Adapter Version
             * @default s932-jev-1
             * @constant
             */
            adapter_version: "s932-jev-1";
            /** Baseline Id */
            baseline_id: string;
            /** Eligible Ids */
            eligible_ids: string[];
            /** Input Sha256 */
            input_sha256?: string | null;
            /**
             * Limitation
             * @default Choice probabilities concern the next-step selection only, not root-cause certainty. The threshold is a prototype setting requiring held-out incident evaluation.
             */
            limitation: string;
            /** Minimum Probability */
            minimum_probability: number;
            /** Model Version */
            model_version?: string | null;
            /**
             * Provider
             * @default deterministic
             * @enum {string}
             */
            provider: "jev" | "deterministic";
            /** Reason */
            reason: string;
            /** Request */
            request?: {
                [key: string]: components["schemas"]["JsonValue"];
            } | null;
            /** Requested Model */
            requested_model: string;
            response?: components["schemas"]["JevResponse"] | null;
            /** Selected Id */
            selected_id: string;
            /**
             * Status
             * @default fallback
             * @enum {string}
             */
            status: "selected" | "fallback";
        };
        /** DeleteArtifact */
        DeleteArtifact: {
            /** Reason */
            reason: string;
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
        /** DiagnosticAssessment */
        DiagnosticAssessment: {
            /** Checks */
            checks: components["schemas"]["DiagnosticCheck"][];
            decision?: components["schemas"]["DecisionRun"] | null;
            /** Discovery */
            discovery: components["schemas"]["DiscoveryField"][];
            explanation?: components["schemas"]["ExplanationRun"];
            /**
             * Fallback
             * @default true
             */
            fallback: boolean;
            /** Hypotheses */
            hypotheses: components["schemas"]["IncidentHypothesis"][];
            next_step: components["schemas"]["DiagnosticNextStep"];
            /**
             * Provider
             * @default deterministic
             * @enum {string}
             */
            provider: "deterministic" | "jev";
            /**
             * Provider Status
             * @default Deterministic baseline. Jev is not connected; no provider probabilities are used.
             */
            provider_status: string;
            /** Sources */
            sources: components["schemas"]["SourcePassage"][];
            /**
             * Status
             * @enum {string}
             */
            status: "insufficient_evidence" | "investigating" | "review_required";
            /** Summary */
            summary: string;
            /** Unresolved */
            unresolved: string[];
            /**
             * Version
             * @default s932-rules-1
             * @constant
             */
            version: "s932-rules-1";
            /** Warnings */
            warnings?: string[];
        };
        /** DiagnosticCheck */
        DiagnosticCheck: {
            /** Blocked Reason */
            blocked_reason: string;
            /** Distinguishes */
            distinguishes: string[];
            /** Eligible */
            eligible: boolean;
            /** Expected Outcomes */
            expected_outcomes: components["schemas"]["ExpectedOutcome"][];
            /** Hypothesis Id */
            hypothesis_id: string;
            /** Id */
            id: string;
            /** Measured Response */
            measured_response: string;
            /** Method */
            method: string;
            /**
             * Mode
             * @default replay
             * @constant
             */
            mode: "replay";
            /**
             * Operational Allowed
             * @default false
             */
            operational_allowed: boolean;
            /** Prerequisites */
            prerequisites: string[];
            /** Purpose */
            purpose: string;
            /** Responsible Role */
            responsible_role: string;
            /** Source Refs */
            source_refs: string[];
            /** Stopping Conditions */
            stopping_conditions: string[];
            /** Title */
            title: string;
        };
        /** DiagnosticNextStep */
        DiagnosticNextStep: {
            /** Evidence Ids */
            evidence_ids?: string[];
            /** Id */
            id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "question" | "check" | "review" | "escalate";
            /** Reason */
            reason: string;
            /** Title */
            title: string;
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
        /** DiscoveryField */
        DiscoveryField: {
            /** Evidence Ids */
            evidence_ids: string[];
            /** Id */
            id: string;
            /** Label */
            label: string;
            /** Question */
            question: string;
            /**
             * Status
             * @enum {string}
             */
            status: "prefilled" | "confirmed" | "unknown" | "missing";
            /** Value */
            value: string | null;
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
        /** EditHandoffAction */
        EditHandoffAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "edit_handoff";
            /** Body */
            body: string;
            /** Revision */
            revision: number;
        };
        /** ErrorMetrics */
        ErrorMetrics: {
            /** Coverage Fraction Mae */
            coverage_fraction_mae: number;
            /** Coverage Fraction Max Error */
            coverage_fraction_max_error: number;
            /** Relative Mass Mae */
            relative_mass_mae: number;
            /** Relative Mass Max Error */
            relative_mass_max_error: number;
        };
        /** EscalateAction */
        EscalateAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "escalate";
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Revision */
            revision: number;
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
        /** EvidenceInput */
        EvidenceInput: {
            /** Artifact Id */
            artifact_id?: string | null;
            /** Clock Offset Seconds */
            clock_offset_seconds?: number | null;
            /** Configuration */
            configuration?: string | null;
            /** Event Time */
            event_time?: string | null;
            /** Event Timezone */
            event_timezone?: string | null;
            /** Id */
            id: string;
            /** Image Url */
            image_url?: string | null;
            /**
             * Kind
             * @enum {string}
             */
            kind: "image" | "log" | "maintenance" | "context";
            /** Label */
            label: string;
            /** Lot Id */
            lot_id?: string | null;
            /**
             * Provenance
             * @default User-supplied development evidence
             */
            provenance: string;
            /**
             * Role
             * @enum {string}
             */
            role: "last_good" | "first_bad" | "machine_log" | "pm" | "context";
            /** Source Ref */
            source_ref: string;
            /**
             * Status
             * @default collected
             * @enum {string}
             */
            status: "pending" | "collected" | "unavailable" | "failed";
            /**
             * Synthetic
             * @default true
             */
            synthetic: boolean;
            /**
             * Time Uncertain
             * @default true
             */
            time_uncertain: boolean;
            /** Tool Id */
            tool_id?: string | null;
            /** Tray Id */
            tray_id?: string | null;
            /** Unit Id */
            unit_id?: string | null;
            /** Values */
            values?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** EvidenceReason */
        EvidenceReason: {
            /** Evidence Id */
            evidence_id: string;
            /** Explanation */
            explanation: string;
        };
        /** ExpectedOutcome */
        ExpectedOutcome: {
            /** Interpretation */
            interpretation: string;
            /** Label */
            label: string;
            /**
             * Value
             * @enum {string}
             */
            value: "supported" | "contradicted" | "inconclusive";
        };
        /** ExperimentAnalysis */
        ExperimentAnalysis: {
            /**
             * Demonstration Contrast Threshold
             * @default 0.02
             */
            demonstration_contrast_threshold: number;
            /**
             * Diagnostic Confirmation
             * @default false
             * @constant
             */
            diagnostic_confirmation: false;
            /** Effects */
            effects: components["schemas"]["ExperimentEffect"][];
            /** Limitations */
            limitations: string[];
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "simulated_difference" | "inconclusive";
            /**
             * Response Aggregation
             * @default arithmetic mean over all 13 normalized sequence positions
             * @constant
             */
            response_aggregation: "arithmetic mean over all 13 normalized sequence positions";
            /** Summary */
            summary: string;
            /**
             * Threshold Validated For Machine
             * @default false
             * @constant
             */
            threshold_validated_for_machine: false;
        };
        /** ExperimentCommand */
        ExperimentCommand: {
            /** Revision */
            revision: number;
        };
        /** ExperimentCondition */
        ExperimentCondition: {
            /** Baseline */
            baseline: boolean;
            /**
             * Hypothesis Id
             * @enum {string}
             */
            hypothesis_id: "restriction" | "unstable_delivery" | "material_condition";
            /** Index */
            index: number;
            parameters: components["schemas"]["SimulationParameters"];
            /** Repetition */
            repetition: number;
        };
        /** ExperimentEffect */
        ExperimentEffect: {
            /**
             * Factor
             * @enum {string}
             */
            factor: "severity" | "delivery_ratio" | "material_ratio";
            /** High Level */
            high_level: number;
            /** High Mean */
            high_mean: number;
            /**
             * Hypothesis Id
             * @enum {string}
             */
            hypothesis_id: "restriction" | "unstable_delivery" | "material_condition";
            /** Low Level */
            low_level: number;
            /** Low Mean */
            low_mean: number;
            /** Main Effect */
            main_effect: number;
        };
        /** ExperimentEvent */
        ExperimentEvent: {
            /**
             * Action
             * @enum {string}
             */
            action: "propose" | "approve" | "complete" | "withdraw";
            /** Actor */
            actor: string;
            /** Detail */
            detail: string;
            /** Timestamp */
            timestamp: string;
        };
        /** ExperimentFactor */
        ExperimentFactor: {
            /** Levels */
            levels: number[];
            /**
             * Name
             * @enum {string}
             */
            name: "severity" | "delivery_ratio" | "material_ratio";
        };
        /** ExperimentProposal */
        ExperimentProposal: {
            /**
             * Check Id
             * @enum {string}
             */
            check_id: "delivery_review" | "restriction_review" | "material_review";
            controls?: components["schemas"]["SimulationParameters"];
            /**
             * Expected Discrimination
             * @default Compare hypothetical response changes across the selected competing mechanisms.
             */
            expected_discrimination: string;
            /** Factors */
            factors: components["schemas"]["ExperimentFactor"][];
            /** Hypothesis Ids */
            hypothesis_ids: ("restriction" | "unstable_delivery" | "material_condition")[];
            /** Incident Revision */
            incident_revision: number;
            /**
             * Repetitions
             * @default 1
             */
            repetitions: number;
            /**
             * Response
             * @default relative_mass
             * @enum {string}
             */
            response: "relative_mass" | "coverage_fraction";
        };
        /** ExperimentResult */
        ExperimentResult: {
            condition: components["schemas"]["ExperimentCondition"];
            /** Contrast From Baseline */
            contrast_from_baseline: number;
            /** Response Mean */
            response_mean: number;
            run: components["schemas"]["SimulationRun"];
        };
        /** ExperimentWithdrawal */
        ExperimentWithdrawal: {
            /** Notes */
            notes: string;
            /** Revision */
            revision: number;
        };
        /** ExplanationRun */
        ExplanationRun: {
            /** Fallback Reason */
            fallback_reason?: string | null;
            /**
             * Mode
             * @default unavailable
             * @enum {string}
             */
            mode: "live" | "unavailable";
            /** Model */
            model?: string | null;
            /**
             * Prompt Version
             * @default s932-explanation-1
             * @constant
             */
            prompt_version: "s932-explanation-1";
            result?: components["schemas"]["IncidentExplanation"] | null;
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
        /** HandoffDraft */
        HandoffDraft: {
            /** Body */
            body: string;
            /** Created At */
            created_at: string;
            /** Evidence Ids */
            evidence_ids?: string[];
            /** Fallback Reason */
            fallback_reason?: string | null;
            /**
             * Generation Mode
             * @default template
             * @enum {string}
             */
            generation_mode: "template" | "gemini";
            /**
             * Human Edited
             * @default false
             */
            human_edited: boolean;
            /** Model */
            model?: string | null;
            /** Prompt Version */
            prompt_version?: string | null;
            /** Source Refs */
            source_refs?: string[];
            /** Source Revision */
            source_revision: number;
            /**
             * Status
             * @default draft
             * @constant
             */
            status: "draft";
            /** Subject */
            subject: string;
            /** Version */
            version: number;
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
        /** Incident */
        Incident: {
            assessment?: components["schemas"]["DiagnosticAssessment"] | null;
            /** Assessment History */
            assessment_history?: components["schemas"]["AssessmentSnapshot"][];
            closure?: components["schemas"]["Closure"] | null;
            /** Closure History */
            closure_history?: components["schemas"]["Closure"][];
            /** Configuration */
            configuration: string;
            /** Created At */
            created_at: string;
            /**
             * Disposition
             * @default not_assessed
             * @constant
             */
            disposition: "not_assessed";
            /**
             * Escalated
             * @default false
             */
            escalated: boolean;
            /** Evidence */
            evidence?: components["schemas"]["IncidentEvidence"][];
            handoff: components["schemas"]["HandoffDraft"];
            /** Handoff History */
            handoff_history?: components["schemas"]["HandoffDraft"][];
            /** History */
            history?: components["schemas"]["IncidentEvent"][];
            /** Id */
            id: string;
            learning?: components["schemas"]["LearningCandidate"] | null;
            /** Learning History */
            learning_history?: components["schemas"]["LearningCandidate"][];
            /**
             * Mode
             * @enum {string}
             */
            mode: "live" | "replay" | "synthetic";
            /** Observations */
            observations?: components["schemas"]["IncidentObservation"][];
            /** Owner */
            owner?: string | null;
            /**
             * Replay Stage
             * @default 0
             */
            replay_stage: number;
            /**
             * Revision
             * @default 0
             */
            revision: number;
            /**
             * Schema Version
             * @default 3.0
             * @constant
             */
            schema_version: "3.0";
            /** Simulations */
            simulations?: components["schemas"]["SimulationRun"][];
            /**
             * Status
             * @enum {string}
             */
            status: "open" | "evidence_collecting" | "investigating" | "review" | "closed";
            /** Symptom */
            symptom: string;
            /** Tool Id */
            tool_id: string;
            /** Trigger Fingerprint */
            trigger_fingerprint: string;
            /** Trigger Id */
            trigger_id: string;
            /**
             * Trigger Origin
             * @enum {string}
             */
            trigger_origin: "manual" | "alarm" | "image_quality" | "replay";
            /** Trigger Time */
            trigger_time: string;
            /** Updated At */
            updated_at: string;
            /** Waiting For */
            waiting_for?: ("observation" | "test_authorization" | "engineer" | "missing_data") | null;
        };
        /** IncidentCommunication */
        IncidentCommunication: {
            /** Approved At */
            approved_at: string;
            /** Approved By */
            approved_by: string;
            /** Attempts */
            attempts?: components["schemas"]["CommunicationAttempt"][];
            /** Body */
            body: string;
            /** Draft Version */
            draft_version: number;
            /** Id */
            id: string;
            /** Incident Id */
            incident_id: string;
            /** Incident Revision */
            incident_revision: number;
            /** Receipts */
            receipts?: components["schemas"]["CommunicationReceipt"][];
            /** Recipients */
            recipients: string[];
            /**
             * Revision
             * @default 1
             */
            revision: number;
            /** Snapshot Sha256 */
            snapshot_sha256: string;
            /**
             * Status
             * @default approved
             * @enum {string}
             */
            status: "approved" | "sending" | "accepted" | "failed" | "unknown" | "delivered" | "acknowledged";
            /** Subject */
            subject: string;
            /**
             * Transport
             * @default smtp
             * @enum {string}
             */
            transport: "smtp" | "mock";
        };
        /** IncidentEvent */
        IncidentEvent: {
            /** Action */
            action: string;
            /** Actor */
            actor?: string | null;
            /** Detail */
            detail: string;
            /** Revision */
            revision: number;
            /** Timestamp */
            timestamp: string;
        };
        /** IncidentEvidence */
        IncidentEvidence: {
            /** Artifact Id */
            artifact_id?: string | null;
            /** Clock Offset Seconds */
            clock_offset_seconds?: number | null;
            /** Configuration */
            configuration?: string | null;
            /** Correction Reason */
            correction_reason?: string | null;
            /** Event Time */
            event_time?: string | null;
            /** Event Timezone */
            event_timezone?: string | null;
            /** Id */
            id: string;
            /** Image Url */
            image_url?: string | null;
            /** Ingested At */
            ingested_at: string;
            /** Integrity Ref */
            integrity_ref: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "image" | "log" | "maintenance" | "context";
            /** Label */
            label: string;
            /** Lot Id */
            lot_id?: string | null;
            /**
             * Provenance
             * @default User-supplied development evidence
             */
            provenance: string;
            /** Raw Integrity Ref */
            raw_integrity_ref?: string | null;
            /**
             * Role
             * @enum {string}
             */
            role: "last_good" | "first_bad" | "machine_log" | "pm" | "context";
            /** Source Ref */
            source_ref: string;
            /**
             * Status
             * @default collected
             * @enum {string}
             */
            status: "pending" | "collected" | "unavailable" | "failed";
            /** Supersedes Id */
            supersedes_id?: string | null;
            /**
             * Synthetic
             * @default true
             */
            synthetic: boolean;
            /**
             * Time Uncertain
             * @default true
             */
            time_uncertain: boolean;
            /** Tool Id */
            tool_id?: string | null;
            /** Tray Id */
            tray_id?: string | null;
            /** Unit Id */
            unit_id?: string | null;
            /** Values */
            values?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** IncidentExperience */
        IncidentExperience: {
            /** Citation */
            citation: string;
            /** Configuration */
            configuration: string;
            /** Evidence Ids */
            evidence_ids: string[];
            /** Incident Id */
            incident_id: string;
            /**
             * Limitation
             * @default Reviewed development experience, not an approved operating procedure or evidence that this incident has the same cause.
             */
            limitation: string;
            /** Mode */
            mode: string;
            /** Outcome */
            outcome: string;
            /** Review Version */
            review_version: number;
            /** Reviewed At */
            reviewed_at: string;
            /** Reviewed By */
            reviewed_by: string;
            /** Source Refs */
            source_refs: string[];
            /** Source Revision */
            source_revision: number;
            /** Summary */
            summary: string;
            /** Symptom */
            symptom: string;
        };
        /** IncidentExperiment */
        IncidentExperiment: {
            analysis?: components["schemas"]["ExperimentAnalysis"] | null;
            /**
             * Analysis Plan
             * @default factorial main effects and contrasts against a per-hypothesis baseline
             * @constant
             */
            analysis_plan: "factorial main effects and contrasts against a per-hypothesis baseline";
            /** Approved At */
            approved_at?: string | null;
            /** Approved By */
            approved_by?: string | null;
            /**
             * Domain
             * @default synthetic_only
             * @constant
             */
            domain: "synthetic_only";
            /** Fixture Version */
            fixture_version: string;
            /** History */
            history: components["schemas"]["ExperimentEvent"][];
            /** Id */
            id: string;
            /** Incident Id */
            incident_id: string;
            /** Matrix */
            matrix: components["schemas"]["ExperimentCondition"][];
            /** Model Version */
            model_version: string;
            /**
             * Physical Execution Allowed
             * @default false
             * @constant
             */
            physical_execution_allowed: false;
            /**
             * Plan Revision
             * @default 1
             * @constant
             */
            plan_revision: 1;
            /** Prerequisites */
            prerequisites: string[];
            proposal: components["schemas"]["ExperimentProposal"];
            /**
             * Responsible Role
             * @default authorized mock-experiment reviewer
             * @constant
             */
            responsible_role: "authorized mock-experiment reviewer";
            /** Results */
            results?: components["schemas"]["ExperimentResult"][];
            /**
             * Revision
             * @default 1
             */
            revision: number;
            /**
             * Source Current
             * @default true
             */
            source_current: boolean;
            /** Source Evidence */
            source_evidence: components["schemas"]["IncidentEvidence"][];
            /** Source Fingerprint */
            source_fingerprint: string;
            /** Source Incident Revision */
            source_incident_revision: number;
            /** Source Observations */
            source_observations: components["schemas"]["IncidentObservation"][];
            source_passage: components["schemas"]["SourcePassage"];
            /**
             * Status
             * @default proposed
             * @enum {string}
             */
            status: "proposed" | "approved" | "completed" | "withdrawn";
            /** Stopping Conditions */
            stopping_conditions: string[];
            /**
             * Synthetic
             * @default true
             * @constant
             */
            synthetic: true;
        };
        /** IncidentExplanation */
        IncidentExplanation: {
            /** Evidence Ids */
            evidence_ids: string[];
            /** Source Refs */
            source_refs: string[];
            /** Text */
            text: string;
            /** Uncertainties */
            uncertainties: string[];
        };
        /** IncidentHypothesis */
        IncidentHypothesis: {
            /** Component Ids */
            component_ids: string[];
            /** Conflicting Evidence */
            conflicting_evidence: components["schemas"]["EvidenceReason"][];
            /** Explanation */
            explanation: string;
            /** How Mechanism */
            how_mechanism: string;
            /** How To Test */
            how_to_test: string;
            /** Id */
            id: string;
            /** Mechanism */
            mechanism: string;
            /** Missing Evidence */
            missing_evidence: string[];
            /** Rank */
            rank: number;
            /** Source Refs */
            source_refs: string[];
            /**
             * Status
             * @enum {string}
             */
            status: "possible" | "supported" | "contradicted" | "inconclusive";
            /** Supporting Evidence */
            supporting_evidence: components["schemas"]["EvidenceReason"][];
            /** Title */
            title: string;
            /** Why Chain */
            why_chain: components["schemas"]["CausalStep"][];
        };
        /** IncidentJob */
        IncidentJob: {
            /** Attempts */
            attempts: number;
            /** Created At */
            created_at: string;
            /** Error */
            error: string | null;
            /** Id */
            id: string;
            /** Incident Id */
            incident_id: string;
            /** Input Fingerprint */
            input_fingerprint: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "analysis" | "handoff";
            /** Lease Until */
            lease_until: string | null;
            /** Max Attempts */
            max_attempts: number;
            /** Source Revision */
            source_revision: number;
            /**
             * State
             * @enum {string}
             */
            state: "pending" | "running" | "succeeded" | "failed" | "superseded";
            /** Updated At */
            updated_at: string;
            /** Worker Token */
            worker_token: string | null;
        };
        /** IncidentObservation */
        IncidentObservation: {
            /** Author */
            author?: string | null;
            /** Check Id */
            check_id: string;
            /** Evidence Ids */
            evidence_ids?: string[];
            /** Extraction Confidence */
            extraction_confidence?: number | null;
            /** Id */
            id: string;
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Recorded At */
            recorded_at: string;
            /** Result */
            result: string;
            /** Supersedes Id */
            supersedes_id?: string | null;
            /**
             * Synthetic
             * @default true
             */
            synthetic: boolean;
        };
        /** IncidentSourceDocument */
        IncidentSourceDocument: {
            content: components["schemas"]["SourceDocumentInput"];
            /** Content Digest */
            content_digest: string;
            /** Created At */
            created_at: string;
            /** Id */
            id: string;
            /** Reviews */
            reviews?: components["schemas"]["SourceReview"][];
            /**
             * Revision
             * @default 1
             */
            revision: number;
            /**
             * Status
             * @default draft
             * @enum {string}
             */
            status: "draft" | "published" | "withdrawn";
            /** Submitted By */
            submitted_by: string;
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
        /** JevChoice */
        JevChoice: {
            /** Choice */
            choice: string;
            /** Confidence */
            confidence: number;
            /** Probabilities */
            probabilities: {
                [key: string]: number;
            };
            /**
             * Type
             * @constant
             */
            type: "choice";
        };
        /** JevResponse */
        JevResponse: {
            /** Answers */
            answers: {
                [key: string]: components["schemas"]["JevChoice"];
            };
            /** Model */
            model: string;
            usage: components["schemas"]["JevUsage"];
        };
        /** JevUsage */
        JevUsage: {
            /** Input Tokens */
            input_tokens: number;
            /** Output Tokens */
            output_tokens: number;
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
        /** LearningCandidate */
        LearningCandidate: {
            /** Evidence Ids */
            evidence_ids: string[];
            /**
             * Outcome
             * @enum {string}
             */
            outcome: "supported" | "inconclusive";
            /** Reviews */
            reviews?: components["schemas"]["LearningReview"][];
            /** Source Evidence */
            source_evidence: components["schemas"]["IncidentEvidence"][];
            /** Source Fingerprint */
            source_fingerprint: string;
            /** Source Observations */
            source_observations: components["schemas"]["IncidentObservation"][];
            /** Source Refs */
            source_refs: string[];
            /** Source Revision */
            source_revision: number;
            /** Source Versions */
            source_versions: {
                [key: string]: string;
            };
            /**
             * Status
             * @default candidate
             * @enum {string}
             */
            status: "candidate" | "published" | "withdrawn";
            /** Summary */
            summary: string;
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
        /** LearningReview */
        LearningReview: {
            /**
             * Decision
             * @enum {string}
             */
            decision: "approve" | "withdraw";
            /** Notes */
            notes: string;
            /** Reviewer */
            reviewer: string;
            /** Timestamp */
            timestamp: string;
            /** Version */
            version: number;
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
        /** MockApproval */
        MockApproval: {
            /** Draft Version */
            draft_version: number;
            /** Incident Revision */
            incident_revision: number;
        };
        /** MockCommunicationEvent */
        MockCommunicationEvent: {
            /** Revision */
            revision: number;
            /**
             * Status
             * @enum {string}
             */
            status: "accepted" | "failed" | "unknown" | "delivered" | "acknowledged";
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
        /** RecordResultAction */
        RecordResultAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "record_result";
            /** Check Id */
            check_id: string;
            /** Evidence Ids */
            evidence_ids?: string[];
            /** Extraction Confidence */
            extraction_confidence?: number | null;
            /**
             * Notes
             * @default
             */
            notes: string;
            /** Result */
            result: string;
            /** Revision */
            revision: number;
            /**
             * Synthetic
             * @default true
             */
            synthetic: boolean;
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
        /** ReplayRequest */
        ReplayRequest: {
            /** Trigger Id */
            trigger_id: string;
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
        /** RetentionResult */
        RetentionResult: {
            /** Artifact Ids */
            artifact_ids: string[];
            /** Dry Run */
            dry_run: boolean;
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
        /** ReviewLearningAction */
        ReviewLearningAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "review_learning";
            /**
             * Decision
             * @enum {string}
             */
            decision: "approve" | "withdraw";
            /** Notes */
            notes: string;
            /** Reviewer */
            reviewer: string;
            /** Revision */
            revision: number;
        };
        /** ScheduleRequest */
        ScheduleRequest: {
            /**
             * Retry Failed
             * @default false
             */
            retry_failed: boolean;
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
        /** SimpleAction */
        SimpleAction: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            action: "advance_replay" | "analyze" | "refresh_handoff";
            /** Revision */
            revision: number;
        };
        /** SimulationDemo */
        SimulationDemo: {
            /**
             * Approved For Diagnosis
             * @default false
             * @constant
             */
            approved_for_diagnosis: false;
            /** Assumptions */
            assumptions: string[];
            /**
             * Domain
             * @default synthetic_only
             * @constant
             */
            domain: "synthetic_only";
            /** Equations */
            equations: {
                [key: string]: string;
            };
            evaluation: components["schemas"]["SyntheticEvaluation"];
            /**
             * Fixture Version
             * @default synthetic-flux-fixture-1
             */
            fixture_version: string;
            /** Input Domain */
            input_domain: {
                [key: string]: number[];
            };
            /** Method */
            method: string;
            /**
             * Model Version
             * @default s932-illustrative-surrogate-1
             */
            model_version: string;
            /** Scenarios */
            scenarios: components["schemas"]["SimulationRun"][];
            /**
             * Status
             * @default simulated
             * @constant
             */
            status: "simulated";
            /** Validity Limits */
            validity_limits: string[];
        };
        /** SimulationParameters */
        SimulationParameters: {
            /**
             * Delivery Ratio
             * @default 1
             */
            delivery_ratio: number;
            /**
             * Material Ratio
             * @default 1
             */
            material_ratio: number;
            /**
             * Severity
             * @default 0.7
             */
            severity: number;
        };
        /** SimulationPoint */
        SimulationPoint: {
            /** Coverage Fraction */
            coverage_fraction: number;
            /** Learned Coverage Fraction */
            learned_coverage_fraction: number;
            /** Learned Relative Mass */
            learned_relative_mass: number;
            /** Position */
            position: number;
            /** Relative Mass */
            relative_mass: number;
            /** Step */
            step: number;
        };
        /** SimulationRequest */
        SimulationRequest: {
            /** Evidence Ids */
            evidence_ids?: string[];
            parameters?: components["schemas"]["SimulationParameters"];
            /** Revision */
            revision?: number | null;
            /**
             * Scenario
             * @enum {string}
             */
            scenario: "restriction" | "unstable_delivery" | "material_condition";
        };
        /** SimulationRun */
        SimulationRun: {
            /**
             * Approved For Diagnosis
             * @default false
             * @constant
             */
            approved_for_diagnosis: false;
            /** Assumptions */
            assumptions: string[];
            /** Component Ids */
            component_ids: string[];
            /** Created At */
            created_at: string;
            /**
             * Domain
             * @default synthetic_only
             * @constant
             */
            domain: "synthetic_only";
            /** Evidence Ids */
            evidence_ids: string[];
            /**
             * Fixture Version
             * @default synthetic-flux-fixture-1
             */
            fixture_version: string;
            /** Id */
            id: string;
            /** Incident Id */
            incident_id: string;
            /**
             * Model Version
             * @default s932-illustrative-surrogate-1
             */
            model_version: string;
            parameters: components["schemas"]["SimulationParameters"];
            /** Points */
            points: components["schemas"]["SimulationPoint"][];
            /**
             * Scenario
             * @enum {string}
             */
            scenario: "restriction" | "unstable_delivery" | "material_condition";
            /** Source Revision */
            source_revision: number;
            /**
             * Status
             * @default simulated
             * @constant
             */
            status: "simulated";
            /** Units */
            units: {
                [key: string]: string;
            };
            /** Validity Limits */
            validity_limits: string[];
        };
        /** SourceConflict */
        SourceConflict: {
            /** Created At */
            created_at: string;
            /** Description */
            description: string;
            /** Id */
            id: string;
            /** Reviews */
            reviews?: components["schemas"]["ConflictReview"][];
            /**
             * Revision
             * @default 1
             */
            revision: number;
            /** Source Ids */
            source_ids: string[];
            /**
             * Status
             * @default unresolved
             * @enum {string}
             */
            status: "unresolved" | "resolved";
            /** Submitted By */
            submitted_by: string;
        };
        /** SourceConflictInput */
        SourceConflictInput: {
            /** Description */
            description: string;
            /** Source Ids */
            source_ids: string[];
        };
        /** SourceDocumentInput */
        SourceDocumentInput: {
            /**
             * Authority
             * @enum {string}
             */
            authority: "controlled_procedure" | "secondary_summary" | "example";
            /** Configurations */
            configurations: string[];
            /** Document Id */
            document_id: string;
            /** Document Revision */
            document_revision: string;
            /** Original Ref */
            original_ref: string;
            /** Original Sha256 */
            original_sha256?: string | null;
            /** Passages */
            passages: components["schemas"]["SourcePassageInput"][];
            /** Title */
            title: string;
        };
        /** SourcePassage */
        SourcePassage: {
            /**
             * Applicable
             * @default false
             */
            applicable: boolean;
            /**
             * Approval Status
             * @enum {string}
             */
            approval_status: "unverified" | "prototype_only" | "approved" | "reviewed_reference" | "withdrawn" | "conflicted";
            /**
             * Authority
             * @enum {string}
             */
            authority: "secondary_summary" | "prototype_specification" | "controlled_procedure" | "example";
            /** Configurations */
            configurations: string[];
            /** Conflict Ids */
            conflict_ids?: string[];
            /** Content Digest */
            content_digest?: string | null;
            /** Document Id */
            document_id: string;
            /**
             * Excerpt Kind
             * @default exact_excerpt
             * @constant
             */
            excerpt_kind: "exact_excerpt";
            /** File Path */
            file_path: string;
            /** Id */
            id: string;
            /** Limitation */
            limitation: string;
            /**
             * Operational Allowed
             * @default false
             */
            operational_allowed: boolean;
            /** Original Sha256 */
            original_sha256?: string | null;
            /** Page */
            page?: string | null;
            /** Passage */
            passage: string;
            /** Publication Version */
            publication_version?: number | null;
            /** Revision */
            revision: string;
            /** Section */
            section: string;
            /** Source Id */
            source_id?: string | null;
            /** Title */
            title: string;
        };
        /** SourcePassageInput */
        SourcePassageInput: {
            /** Id */
            id: string;
            /** Page */
            page?: string | null;
            /** Section */
            section: string;
            /** Text */
            text: string;
        };
        /** SourceReview */
        SourceReview: {
            /** Actor */
            actor: string;
            /**
             * Decision
             * @enum {string}
             */
            decision: "publish" | "withdraw";
            /** Notes */
            notes: string;
            /** Timestamp */
            timestamp: string;
            /** Version */
            version: number;
        };
        /** SourceReviewRequest */
        SourceReviewRequest: {
            /**
             * Decision
             * @enum {string}
             */
            decision: "publish" | "withdraw";
            /** Notes */
            notes: string;
            /** Revision */
            revision: number;
        };
        /** SyntheticEvaluation */
        SyntheticEvaluation: {
            /** Accepted Error Tolerance */
            accepted_error_tolerance: {
                [key: string]: number;
            };
            constant_baseline_heldout_metrics: components["schemas"]["ErrorMetrics"];
            /** Heldout Condition Ids */
            heldout_condition_ids: string[];
            /** Heldout Incident Ids */
            heldout_incident_ids: string[];
            heldout_metrics: components["schemas"]["ErrorMetrics"];
            /** Heldout Samples */
            heldout_samples: number;
            /** Per Scenario Heldout Metrics */
            per_scenario_heldout_metrics: {
                [key: string]: components["schemas"]["ErrorMetrics"];
            };
            /**
             * Real Machine Validated
             * @default false
             * @constant
             */
            real_machine_validated: false;
            /** Split Method */
            split_method: string;
            /** Synthetic Acceptance Passed */
            synthetic_acceptance_passed: boolean;
            /** Training Condition Ids */
            training_condition_ids: string[];
            /** Training Incident Ids */
            training_incident_ids: string[];
            training_metrics: components["schemas"]["ErrorMetrics"];
            /** Training Samples */
            training_samples: number;
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
    access_api_incident_access_get: {
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
                    "application/json": components["schemas"]["Actor"];
                };
            };
        };
    };
    access_history_api_incident_access_audit_get: {
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
                    "application/json": components["schemas"]["AccessAudit"][];
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
    enforce_retention_api_incident_artifacts_retention_post: {
        parameters: {
            query?: {
                dry_run?: boolean;
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
                    "application/json": components["schemas"]["RetentionResult"];
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
    coordinator_status_api_incident_jobs_status_get: {
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
                    "application/json": components["schemas"]["CoordinatorStatus"];
                };
            };
        };
    };
    list_documents_api_incident_knowledge_get: {
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
                    "application/json": components["schemas"]["IncidentSourceDocument"][];
                };
            };
        };
    };
    add_document_api_incident_knowledge_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SourceDocumentInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentSourceDocument"];
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
    conflicts_api_incident_knowledge_conflicts_get: {
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
                    "application/json": components["schemas"]["SourceConflict"][];
                };
            };
        };
    };
    add_conflict_api_incident_knowledge_conflicts_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SourceConflictInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourceConflict"];
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
    review_conflict_api_incident_knowledge_conflicts__conflict_id__reviews_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conflict_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConflictReviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourceConflict"];
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
    passages_api_incident_knowledge_passages_get: {
        parameters: {
            query?: {
                configuration?: string;
                q?: string;
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
                    "application/json": components["schemas"]["ApplicableSourcePassage"][];
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
    get_document_api_incident_knowledge__source_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                source_id: string;
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
                    "application/json": components["schemas"]["IncidentSourceDocument"];
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
    publish_document_api_incident_knowledge__source_id__reviews_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                source_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SourceReviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentSourceDocument"];
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
    demo_api_incident_simulation_demo_get: {
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
                    "application/json": components["schemas"]["SimulationDemo"];
                };
            };
        };
    };
    listing_api_incidents_get: {
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
                    "application/json": components["schemas"]["Incident"][];
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
    create_api_incidents_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateIncident"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Incident"];
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
    replay_api_incidents_replay_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplayRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Incident"];
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
    get_api_incidents__incident_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["Incident"];
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
    action_api_incidents__incident_id__actions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SimpleAction"] | components["schemas"]["AddEvidenceAction"] | components["schemas"]["CorrectEvidenceAction"] | components["schemas"]["RecordResultAction"] | components["schemas"]["EditHandoffAction"] | components["schemas"]["EscalateAction"] | components["schemas"]["CloseIncidentAction"] | components["schemas"]["ReviewLearningAction"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Incident"];
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
    list_originals_api_incidents__incident_id__artifacts_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["Artifact"][];
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
    upload_original_api_incidents__incident_id__artifacts_post: {
        parameters: {
            query: {
                filename: string;
            };
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Artifact"];
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
    download_original_api_incidents__incident_id__artifacts__artifact_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                artifact_id: string;
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
    delete_original_api_incidents__incident_id__artifacts__artifact_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeleteArtifact"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Artifact"];
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
    list_communications_api_incidents__incident_id__communications_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["IncidentCommunication"][];
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
    approve_api_incidents__incident_id__communications_approvals_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommunicationApprovalRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentCommunication"];
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
    mock_approval_api_incidents__incident_id__communications_mock_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MockApproval"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentCommunication"];
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
    mock_event_api_incidents__incident_id__communications__communication_id__mock_event_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                communication_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MockCommunicationEvent"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentCommunication"];
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
    record_receipt_api_incidents__incident_id__communications__communication_id__receipts_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                communication_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommunicationReceiptRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentCommunication"];
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
    send_api_incidents__incident_id__communications__communication_id__send_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                communication_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommunicationSendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentCommunication"];
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
    past_experience_api_incidents__incident_id__experience_get: {
        parameters: {
            query?: {
                q?: string;
                limit?: number;
            };
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["IncidentExperience"][];
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
    list_plans_api_incidents__incident_id__experiments_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["IncidentExperiment"][];
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
    propose_plan_api_incidents__incident_id__experiments_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentProposal"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentExperiment"];
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
    approve_api_incidents__incident_id__experiments__plan_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentExperiment"];
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
    execute_api_incidents__incident_id__experiments__plan_id__run_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentExperiment"];
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
    withdraw_api_incidents__incident_id__experiments__plan_id__withdraw_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentWithdrawal"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentExperiment"];
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
    get_jobs_api_incidents__incident_id__jobs_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
                    "application/json": components["schemas"]["IncidentJob"][];
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
    schedule_jobs_api_incidents__incident_id__jobs_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScheduleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentJob"][];
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
    report_api_incidents__incident_id__report_md_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
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
    record_simulation_api_incidents__incident_id__simulation_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                incident_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SimulationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SimulationRun"];
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
