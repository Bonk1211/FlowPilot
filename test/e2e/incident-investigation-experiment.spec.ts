import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Incident, IncidentExperiment } from "@flowpilot/contracts";

async function replayed(request: APIRequestContext) {
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `inline-experiment-${randomUUID()}` },
    })
  ).json();
  const act = async (command: Record<string, unknown>) => {
    const response = await request.post(
      `/api/incidents/${incident.id}/actions`,
      { data: { revision: incident.revision, ...command } },
    );
    expect(response.ok()).toBeTruthy();
    incident = await response.json();
  };
  const answer = (choice: string) =>
    act({
      action: "answer_investigation",
      node_id: incident.investigation!.active_node_id,
      answer_id: `ANS-${randomUUID()}`,
      choice,
    });
  await act({ action: "analyze" });
  return { incident: () => incident, answer };
}

const plans = async (request: APIRequestContext, id: string) =>
  (await (
    await request.get(`/api/incidents/${id}/experiments`)
  ).json()) as IncidentExperiment[];

test("the mini experiment branch opens its explanation in the rail without running anything", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const source = await replayed(request);
  await source.answer("intermittent");
  const id = source.incident().id;
  await page.goto(`/incidents/${id}/investigation`);
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await expect(page.locator(".stage-experiment.flowchart-node")).toHaveCount(0);
  await source.answer("unstable");
  await page.reload();
  const branch = page.locator(".stage-experiment.flowchart-node");
  await expect(branch).toContainText("Open experiment");
  await page
    .getByRole("button", { name: "Focus current question", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Adaptive investigation", exact: true })
    .screenshot({ path: testInfo.outputPath("inline-experiment.png") });

  const offer = page.getByRole("complementary", {
    name: "Suggested experiments",
  });
  const row = offer.getByRole("button", { name: /^Unstable fluid delivery/ });
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await branch.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(row).toBeFocused();
  await expect(offer).toContainText("What we predict");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(`/incidents/${id}/investigation`);

  // The answer panel's button does the same, even after the row was closed.
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Open the experiment" }).click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  expect(await plans(request, id)).toHaveLength(0);
});

test("an older single-experiment link opens the lab running just that experiment", async ({
  page,
  request,
}) => {
  const source = await replayed(request);
  await source.answer("intermittent");
  await source.answer("unstable");
  const id = source.incident().id;
  await page.goto(
    `/incidents/${id}/simulation?check=delivery_review&from=ANS-old-link`,
  );
  const lab = page.getByRole("region", { name: "Experiments", exact: true });
  await expect(
    lab.getByRole("progressbar", { name: "Unstable fluid delivery progress" }),
  ).toHaveAttribute("aria-valuetext", "Finished: 3 of 3 conditions simulated", {
    timeout: 20000,
  });
  await expect(page).toHaveURL(/\/simulation\?plan=DOE-[0-9a-f]+$/);
  await expect(
    lab.getByRole("progressbar", { name: "Fluid-path restriction progress" }),
  ).toHaveAttribute("aria-valuetext", "Not run yet");
  const saved = await plans(request, id);
  expect(saved.map((plan) => plan.proposal.hypothesis_ids)).toEqual([
    ["unstable_delivery"],
  ]);

  // An unknown check just opens Simulation; nothing runs.
  await page.goto(`/incidents/${id}/simulation?check=invented&from=x`);
  await expect(page).toHaveURL(`/incidents/${id}/simulation`);
  await expect(
    page.getByRole("heading", { name: "Simulation sandbox" }),
  ).toBeVisible();
  expect(await plans(request, id)).toHaveLength(1);
});
