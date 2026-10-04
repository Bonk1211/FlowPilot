import { useCallback, useEffect, useRef, useState } from "react";
import type { IncidentExperiment } from "@flowpilot/contracts";
import { incidentJson, loadIncident } from "./api";
import { useIncidentAccess } from "./AccessPanel";
import {
  defaultProposal,
  mechanismChecks,
  mechanismIds,
  type MechanismId,
} from "./experimentDefaults";
import { settledPlan } from "./experimentRuns";

export type TrackStage =
  "idle" | "saving" | "approving" | "simulating" | "done" | "failed";

export type Track = {
  id: MechanismId;
  stage: TrackStage;
  plan: IncidentExperiment | null;
  error: string;
};

/** The real requests each experiment makes, in order. */
export const trackStages = [
  { id: "saving", label: "Plan saved" },
  { id: "approving", label: "Approved" },
  { id: "simulating", label: "Simulated" },
] as const;

// Each request finishes in a fraction of a second. Hold a stage on screen
// briefly so a reader can follow it; this paces the display, not the work.
const MIN_STAGE_MS = 450;
const pause = (since: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, MIN_STAGE_MS - (Date.now() - since))),
  );

function message(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "The experiment could not be run. Try again.";
}

const idle = () =>
  Object.fromEntries(
    mechanismIds.map((id) => [
      id,
      { id, stage: "idle", plan: null, error: "" },
    ]),
  ) as Record<MechanismId, Track>;

/** The mechanism a saved plan simulates, if it holds just one. */
export function planMechanism(plan: IncidentExperiment) {
  const [only, ...rest] = plan.proposal.hypothesis_ids;
  return rest.length ? null : (only as MechanismId);
}

function stageOf(plan: IncidentExperiment): TrackStage {
  if (plan.status === "completed") return "done";
  if (plan.status === "running") return "simulating";
  if (plan.status === "withdrawn") return "failed";
  return "idle";
}

/**
 * Runs each experiment as its own saved plan: propose, approve as the demo
 * engineer, run, then follow the background run as its conditions are saved.
 * Several run at once. A plan the incident already has is followed, never run
 * twice, and plans are reported as soon as they exist so a reload finds them.
 */
export function useExperimentRuns({
  incidentId,
  requested,
  planIds,
  onPlans,
  onRefresh,
}: {
  incidentId: string;
  requested: readonly MechanismId[];
  planIds: readonly string[];
  onPlans: (planIds: string[]) => void;
  onRefresh: () => Promise<void>;
}) {
  const access = useIncidentAccess();
  const [tracks, setTracks] = useState(idle);
  const [loadError, setLoadError] = useState("");
  const started = useRef(new Set<string>());
  const known = useRef(new Map<MechanismId, string>());
  const alive = useRef(true);
  const callbacks = useRef({ onPlans, onRefresh });
  useEffect(() => {
    callbacks.current = { onPlans, onRefresh };
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const path = `/api/incidents/${encodeURIComponent(incidentId)}/experiments`;
  const update = useCallback((id: MechanismId, patch: Partial<Track>) => {
    if (alive.current)
      setTracks((current) => ({
        ...current,
        [id]: { ...current[id], ...patch },
      }));
  }, []);
  const remember = useCallback((id: MechanismId, plan: IncidentExperiment) => {
    if (known.current.get(id) === plan.id) return;
    known.current.set(id, plan.id);
    callbacks.current.onPlans([...new Set(known.current.values())]);
  }, []);

  const follow = useCallback(
    async (id: MechanismId, plan: IncidentExperiment) => {
      const began = Date.now();
      update(id, { stage: "simulating", plan });
      const done = await settledPlan(path, plan, {
        onProgress: (progress) => update(id, { plan: progress }),
      });
      await pause(began);
      update(id, {
        plan: done,
        stage: stageOf(done),
        error:
          done.status === "completed"
            ? ""
            : "The run stopped before every condition finished. Its partial results are kept as inconclusive.",
      });
      if (done.status === "completed")
        void callbacks.current.onRefresh().catch(() => undefined);
    },
    [path, update],
  );

  const run = useCallback(
    async (id: MechanismId) => {
      const post = (url: string, body: unknown, role?: string) =>
        incidentJson<IncidentExperiment>(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(role ? { "X-Incident-Role": role } : {}),
          },
          body: JSON.stringify(body),
        });
      try {
        if (
          access.mode === "configured" &&
          !access.permissions.includes("authorize_test")
        )
          throw new Error(
            "Running an experiment needs the authorize_test permission. Ask an engineer to approve a plan on the Experiments page.",
          );
        update(id, { stage: "saving", error: "" });
        let began = Date.now();
        const proposal = async () =>
          defaultProposal(
            // Work from the latest revision; background jobs may have saved since the page loaded.
            (await loadIncident(incidentId)).revision,
            mechanismChecks[id],
            [id],
          );
        let plan: IncidentExperiment;
        try {
          plan = await post(path, await proposal());
        } catch {
          plan = await post(path, await proposal());
        }
        remember(id, plan);
        await pause(began);
        update(id, { plan });
        if (plan.status === "proposed") {
          update(id, { stage: "approving" });
          began = Date.now();
          plan = await post(
            `${path}/${encodeURIComponent(plan.id)}/approve`,
            { revision: plan.revision },
            access.mode === "demo" ? "engineer" : undefined,
          );
          await pause(began);
          update(id, { plan });
        }
        if (plan.status === "approved" || plan.status === "running") {
          if (plan.status === "approved") {
            update(id, { stage: "simulating" });
            plan = await post(`${path}/${encodeURIComponent(plan.id)}/run`, {
              revision: plan.revision,
            });
          }
          await follow(id, plan);
          return;
        }
        update(id, { plan, stage: stageOf(plan) });
      } catch (cause) {
        update(id, { stage: "failed", error: message(cause) });
      }
    },
    [access, incidentId, path, follow, remember, update],
  );

  // Plans already started for this incident: show them, follow any still running.
  const planKey = planIds.join(",");
  useEffect(() => {
    if (!planKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const plans = await incidentJson<IncidentExperiment[]>(path);
        if (cancelled) return;
        const wanted = planKey.split(",");
        const found = plans.filter((plan) => wanted.includes(plan.id));
        if (!found.length)
          throw new Error(
            "These experiment plans were not found for the incident. Run the experiments again from the investigation.",
          );
        for (const plan of found) {
          const ids = planMechanism(plan)
            ? [planMechanism(plan)!]
            : (plan.proposal.hypothesis_ids as MechanismId[]);
          for (const id of ids) {
            if (started.current.has(`${incidentId}|${id}`)) continue;
            started.current.add(`${incidentId}|${id}`);
            known.current.set(id, plan.id);
            if (plan.status === "running") void follow(id, plan);
            else
              update(id, {
                plan,
                stage: stageOf(plan),
                error:
                  plan.status === "withdrawn"
                    ? "This plan was withdrawn before it finished. Its saved results are kept on the Experiments page."
                    : "",
              });
          }
        }
      } catch (cause) {
        if (!cancelled) setLoadError(message(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planKey, path, incidentId, follow, update]);

  // Experiments asked for in the address run once each, all at the same time.
  const requestKey = requested.join(",");
  useEffect(() => {
    if (!requestKey) return;
    for (const id of requestKey.split(",") as MechanismId[]) {
      const key = `${incidentId}|${id}`;
      if (started.current.has(key)) continue;
      started.current.add(key);
      void run(id);
    }
  }, [requestKey, incidentId, run]);

  return {
    tracks,
    loadError,
    /** Run one experiment that has not run yet, or retry one that failed. */
    start: (id: MechanismId) => {
      started.current.add(`${incidentId}|${id}`);
      void run(id);
    },
    /** Show a plan saved elsewhere, such as after a hand-back. */
    replace: (id: MechanismId, plan: IncidentExperiment) =>
      update(id, { plan }),
  };
}
