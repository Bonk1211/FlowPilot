import type { IncidentExperiment } from "@flowpilot/contracts";
import { incidentJson } from "./api";

const POLL_MS = 300;
// The server lets a run resume once its worker has been silent for 30 seconds.
const RESUME_AFTER_MS = 32000;
const GIVE_UP_MS = 70000;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/**
 * Follow a started plan until its background run ends. `onProgress` sees each
 * saved state, so callers can show how many conditions have finished.
 */
export async function settledPlan(
  path: string,
  started: IncidentExperiment,
  {
    signal,
    onProgress,
  }: {
    signal?: AbortSignal;
    onProgress?: (plan: IncidentExperiment) => void;
  } = {},
) {
  const began = Date.now();
  let resumed = false;
  let plan = started;
  while (plan.status === "running") {
    if (Date.now() - began > GIVE_UP_MS)
      throw new Error(
        "The run stopped responding. Its saved conditions are kept; open the Experiments page to review them.",
      );
    if (!resumed && Date.now() - began > RESUME_AFTER_MS) {
      resumed = true;
      await incidentJson<IncidentExperiment>(
        `${path}/${encodeURIComponent(plan.id)}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: plan.revision }),
          signal,
        },
      );
    }
    await wait(POLL_MS, signal);
    const plans = await incidentJson<IncidentExperiment[]>(path, { signal });
    const next = plans.find((item) => item.id === plan.id);
    if (!next) throw new Error("The experiment plan is no longer available.");
    plan = next;
    onProgress?.(plan);
  }
  return plan;
}
