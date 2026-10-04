import { useEffect, useRef, useState } from "react";
import type { IncidentExperiment } from "@flowpilot/contracts";
import { incidentJson, loadIncident } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import { defaultProposal } from "./experimentDefaults";
import { settledPlan } from "./experimentRuns";

export type RunStage =
  "idle" | "proposing" | "approving" | "running" | "done" | "failed";

/** The real requests a run makes, in order. */
export const runStages = [
  { id: "proposing", label: "Saving the experiment plan" },
  { id: "approving", label: "Approving as demo engineer" },
  { id: "running", label: "Simulating the planned conditions" },
] as const;

// Each request takes a fraction of a second. Hold a finished stage on screen
// briefly so a reader can follow which step happened; this paces the display
// and does not stand in for any computation.
const MIN_STAGE_MS = 550;
const pause = (since: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, MIN_STAGE_MS - (Date.now() - since))),
  );

function message(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "The experiments could not be run. Try again.";
}

/**
 * Runs the three suggested experiments as one saved plan: propose, approve as
 * the demo engineer, run. It never repeats a plan the incident already has
 * (the server treats an identical proposal as the same plan) and it works from
 * the incident's latest revision.
 */
export function useExperimentRun({
  incidentId,
  planId,
  runRequested,
  checkId,
  onPlan,
  onRefresh,
}: {
  incidentId: string;
  planId: string | null;
  runRequested: boolean;
  checkId: IncidentExperiment["proposal"]["check_id"] | null;
  onPlan: (planId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const access = useIncidentAccess();
  const [stage, setStage] = useState<RunStage>("idle");
  const [plan, setPlan] = useState<IncidentExperiment | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const started = useRef("");
  const callbacks = useRef({ onPlan, onRefresh });
  useEffect(() => {
    callbacks.current = { onPlan, onRefresh };
  });

  useEffect(() => {
    const key = `${incidentId}|${planId}|${runRequested}|${checkId}|${attempt}`;
    if (started.current === key) return;
    started.current = key;
    const path = `/api/incidents/${encodeURIComponent(incidentId)}/experiments`;
    const post = (url: string, body: unknown, role?: string) =>
      incidentJson<IncidentExperiment>(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(role ? { "X-Incident-Role": role } : {}),
        },
        body: JSON.stringify(body),
      });
    void (async () => {
      try {
        if (planId) {
          const plans = await incidentJson<IncidentExperiment[]>(path);
          const found = plans.find((item) => item.id === planId);
          if (!found)
            throw new Error(
              "This experiment plan was not found for the incident. Run the experiments again from the investigation.",
            );
          setPlan(found);
          setStage(found.status === "completed" ? "done" : "failed");
          if (found.status !== "completed")
            setError(
              found.status === "withdrawn"
                ? "This plan was withdrawn before it finished. Its saved results are kept on the Experiments page."
                : "This plan has not been run yet. Run or approve it on the Experiments page.",
            );
          return;
        }
        if (!runRequested || !checkId) return;
        if (
          access.mode === "configured" &&
          !access.permissions.includes("authorize_test")
        )
          throw new Error(
            "Running these experiments needs the authorize_test permission. Ask an engineer to approve a plan on the Experiments page.",
          );
        setError("");
        setStage("proposing");
        let began = Date.now();
        // Work from the latest revision; background jobs may have saved since the page loaded.
        let proposed: IncidentExperiment;
        try {
          proposed = await post(
            path,
            defaultProposal((await loadIncident(incidentId)).revision, checkId),
          );
        } catch {
          proposed = await post(
            path,
            defaultProposal((await loadIncident(incidentId)).revision, checkId),
          );
        }
        await pause(began);
        setPlan(proposed);
        let current = proposed;
        if (current.status === "proposed") {
          setStage("approving");
          began = Date.now();
          current = await post(
            `${path}/${encodeURIComponent(current.id)}/approve`,
            { revision: current.revision },
            access.mode === "demo" ? "engineer" : undefined,
          );
          await pause(began);
          setPlan(current);
        }
        if (current.status === "approved") {
          setStage("running");
          began = Date.now();
          current = await settledPlan(
            path,
            await post(`${path}/${encodeURIComponent(current.id)}/run`, {
              revision: current.revision,
            }),
          );
          await pause(began);
          setPlan(current);
        }
        if (current.status !== "completed")
          throw new Error(
            "The plan did not finish. Its saved state is on the Experiments page.",
          );
        setStage("done");
        callbacks.current.onPlan(current.id);
        void callbacks.current.onRefresh().catch(() => undefined);
      } catch (cause) {
        setError(message(cause));
        setStage("failed");
      }
    })();
  }, [incidentId, planId, runRequested, checkId, attempt, access]);

  return {
    stage,
    plan,
    error,
    retry: () => {
      setStage("idle");
      setError("");
      setAttempt((value) => value + 1);
    },
  };
}
