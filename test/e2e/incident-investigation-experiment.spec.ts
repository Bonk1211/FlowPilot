import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Incident } from "@flowpilot/contracts";

test("an experiment previews, confirms, and designs before opening Simulation with its context", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await answer("intermittent");
  await page.goto(`/incidents/${incident.id}/investigation`);
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await expect(page.locator(".stage-experiment.flowchart-node")).toHaveCount(0);
  await answer("unstable");
  const source = incident.investigation!.answers!.at(-1)!;
  const activeId = incident.investigation!.active_node_id;
  await page.reload();
  const branch = page.locator(".stage-experiment.flowchart-node");
  await expect(branch).toContainText("Preview experiment");
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Focus current question", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Adaptive investigation", exact: true })
    .screenshot({ path: testInfo.outputPath("inline-experiment.png") });
  await branch.getByRole("button").click();
  const preview = page.getByRole("dialog", {
    name: "Experiment preview",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("A · Baseline");
  await expect(preview).toContainText("B · Comparison");
  await expect(preview).toContainText("Hold constant");
  await expect(preview).toContainText("Pressure records show variation.");
  await expect(page).toHaveURL(`/incidents/${incident.id}/investigation`);
  await preview.screenshot({
    path: testInfo.outputPath("experiment-preview.png"),
  });
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(branch.getByRole("button")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Exit full screen", exact: true }),
  ).toBeVisible();
  await branch.getByRole("button").click();
  await preview
    .getByRole("button", { name: "Confirm & design experiment", exact: true })
    .click();
  const designing = page.getByRole("dialog", {
    name: "Experiment design",
    exact: true,
  });
  await expect(designing.getByRole("status")).toContainText(
    "Designing your experiment",
  );
  await expect(
    designing.getByRole("button", {
      name: "Designing experiment…",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(designing.locator(".investigation-progress-ring")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page).toHaveURL(`/incidents/${incident.id}/investigation`);
  await designing.screenshot({
    path: testInfo.outputPath("experiment-designing.png"),
  });
  await expect(page).toHaveURL(
    new RegExp(`/simulation\\?check=.+&from=${source.id}`),
  );
  const simulationUrl = page.url();
  const checkId = new URL(simulationUrl).searchParams.get("check")!;
  const check = incident.assessment!.checks.find(
    (check) => check.id === checkId,
  )!;
  await expect(
    page.getByRole("region", { name: "Experiment from investigation" }),
  ).toContainText(check.title);
  await expect(
    page.getByRole("combobox", { name: "Hypothetical mechanism", exact: true }),
  ).toHaveValue(check.hypothesis_id);
  await expect(
    page.getByRole("combobox", { name: "Hypothetical mechanism", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Hypothetical mechanism", exact: true }),
  ).toHaveValue(check.hypothesis_id);
  const beforeRun: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(beforeRun.simulations).toEqual(incident.simulations);
  expect(beforeRun.investigation!.answers).toEqual(
    incident.investigation!.answers,
  );
  await page
    .getByRole("button", { name: "Run and save simulation", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Simulated response saved" }),
  ).toBeVisible();
  const after: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(after.simulations!.at(-1)!.scenario).toBe(check.hypothesis_id);
  expect(after.investigation!.active_node_id).toBe(activeId);
  expect(after.investigation!.answers).toEqual(incident.investigation!.answers);
  expect(after.assessment!.hypotheses).toEqual(incident.assessment!.hypotheses);
  await page
    .getByRole("region", { name: "Simulation workspace" })
    .screenshot({ path: testInfo.outputPath("experiment-simulation.png") });
  await page
    .getByRole("button", { name: "Return to investigation", exact: true })
    .click();
  await expect(page).toHaveURL(`/incidents/${incident.id}/investigation`);
  await expect(branch).toBeVisible();
  await page.setViewportSize({ width: 375, height: 844 });
  await page
    .getByRole("button", {
      name: "Preview mini experiment",
      exact: true,
    })
    .click();
  await expect(preview).toBeVisible();
  const bounds = await preview.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await preview.screenshot({
    path: testInfo.outputPath("experiment-preview-mobile.png"),
  });
  await preview
    .getByRole("button", { name: "Confirm & design experiment", exact: true })
    .click();
  await expect(page).toHaveURL(simulationUrl);
  await expect(
    page.getByRole("region", { name: "Experiment from investigation" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Experiment from investigation" })
    .screenshot({ path: testInfo.outputPath("experiment-mobile.png") });
  await page.goto(
    simulationUrl.replace(`from=${source.id}`, "from=missing-answer"),
  );
  await expect(
    page.getByRole("region", { name: "Experiment from investigation" }),
  ).toContainText("no longer current");
});

test("experiment preparation can be cancelled and handles a stale response without navigating", async ({
  page,
  request,
}) => {
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `experiment-cancel-${randomUUID()}` },
    })
  ).json();
  incident = await (
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: { revision: incident.revision, action: "analyze" },
    })
  ).json();
  for (const choice of ["intermittent", "unstable"]) {
    incident = await (
      await request.post(`/api/incidents/${incident.id}/actions`, {
        data: {
          revision: incident.revision,
          action: "answer_investigation",
          node_id: incident.investigation!.active_node_id,
          answer_id: `ANS-${randomUUID()}`,
          choice,
        },
      })
    ).json();
  }
  await page.goto(`/incidents/${incident.id}/investigation`);
  const trigger = page.getByRole("button", {
    name: "Preview mini experiment",
    exact: true,
  });
  await expect(trigger).toBeVisible();
  await page.clock.install();
  let stale = false;
  await page.route(`**/api/incidents/${incident.id}`, (route) => {
    return route.fulfill({
      json: stale
        ? {
            ...incident,
            investigation: { ...incident.investigation, answers: [] },
          }
        : incident,
    });
  });
  await trigger.click();
  const preview = page.getByRole("dialog", {
    name: "Experiment preview",
    exact: true,
  });
  await expect(preview.locator(".investigation-progress")).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Back to investigation", exact: true })
    .click();
  await trigger.click();
  await preview
    .getByRole("button", { name: "Confirm & design experiment", exact: true })
    .click();
  const designing = page.getByRole("dialog", {
    name: "Experiment design",
    exact: true,
  });
  await expect(designing.getByRole("status")).toContainText(
    "Designing your experiment",
  );
  await expect(designing.locator(".investigation-progress-ring")).toHaveCSS(
    "animation-name",
    "investigation-progress-orbit",
  );
  await designing
    .getByRole("button", { name: "Cancel preparation", exact: true })
    .click();
  await page.clock.fastForward(5000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(`/incidents/${incident.id}/investigation`);
  await expect(trigger).toBeFocused();
  stale = true;
  await trigger.click();
  await preview
    .getByRole("button", { name: "Confirm & design experiment", exact: true })
    .click();
  await expect(designing.getByRole("status")).toBeVisible();
  await page.clock.fastForward(2000);
  await expect(preview.getByRole("alert")).toContainText("no longer current");
  await expect(page).toHaveURL(`/incidents/${incident.id}/investigation`);
  await expect(
    preview.getByRole("button", {
      name: "Confirm & design experiment",
      exact: true,
    }),
  ).toBeEnabled();
});
