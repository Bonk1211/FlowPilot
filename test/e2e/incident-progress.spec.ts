import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import type { Incident, IncidentJob } from "@flowpilot/contracts";

async function replay(request: APIRequestContext, analyze = true) {
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `progress-${randomUUID()}` },
    })
  ).json();
  if (analyze)
    incident = await (
      await request.post(`/api/incidents/${incident.id}/actions`, {
        data: { action: "analyze", revision: incident.revision },
      })
    ).json();
  return incident;
}

test("initial analysis shows animated progress, elapsed time and a responsive reduced-motion state", async ({
  page,
  request,
}, testInfo) => {
  const incident = await replay(request, false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/incidents/${incident.id}/actions`, async (route) => {
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  await page.goto(`/incidents/${incident.id}/investigation`);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const progress = page.locator(
    '.investigation-progress[data-mode="analysis"]',
  );
  try {
    await expect(progress).toBeVisible();
    await expect(progress.getByRole("status")).toContainText(
      "Analyzing current evidence",
    );
    await expect(
      page.getByRole("heading", { name: "Ready to investigate" }),
    ).toBeHidden();
    await expect(progress.locator(".investigation-progress-ring")).toHaveCSS(
      "animation-name",
      "investigation-progress-orbit",
    );
    await expect(progress.getByRole("timer")).not.toHaveText("0:00");
    await page.screenshot({
      path: testInfo.outputPath("analysis-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(progress).toBeInViewport();
    await expect(progress.locator(".investigation-progress-ring")).toHaveCSS(
      "animation-name",
      "none",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath("analysis-mobile.png"),
      fullPage: true,
    });
  } finally {
    release();
  }
  await expect(
    page.getByRole("region", { name: "Adaptive investigation", exact: true }),
  ).toBeVisible();
  await expect(progress).toBeHidden();
});

test("answer progress stays on the chart through queued analysis, running work and the final refresh", async ({
  page,
  request,
}, testInfo) => {
  const incident = await replay(request);
  await page.setViewportSize({ width: 1440, height: 1000 });
  let job: IncidentJob | null = null;
  let initialStatusChecked = false;
  let releaseAnswer = () => {};
  const pendingAnswer = new Promise<void>((resolve) => {
    releaseAnswer = resolve;
  });
  let releaseRefresh = () => {};
  const pendingRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let holdRefresh = false;
  let refreshStarted = false;
  await page.route("**/api/incident-jobs/status", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route(`**/api/incidents/${incident.id}/jobs`, (route) => {
    initialStatusChecked = true;
    return route.fulfill({ json: job ? [job] : [] });
  });
  await page.route(`**/api/incidents/${incident.id}`, async (route) => {
    if (!holdRefresh) return route.continue();
    const response = await route.fetch();
    refreshStarted = true;
    await pendingRefresh;
    await route.fulfill({ response });
  });
  await page.route(`**/api/incidents/${incident.id}/actions`, async (route) => {
    // Persist the real answer; simulate the asynchronous response before its analysis is ready.
    const response = await route.fetch();
    const updated: Incident = await response.json();
    await pendingAnswer;
    job = {
      id: "progress-analysis-job",
      incident_id: incident.id,
      input_fingerprint: "progress-test",
      source_revision: updated.revision,
      kind: "analysis",
      state: "pending",
      attempts: 0,
      max_attempts: 3,
      created_at: "2026-10-03T00:00:00+00:00",
      updated_at: "2026-10-03T00:00:00+00:00",
      lease_until: null,
      worker_token: null,
      error: null,
    };
    await route.fulfill({ response, json: { ...updated, assessment: null } });
  });
  await page.goto(`/incidents/${incident.id}/investigation`);
  await expect.poll(() => initialStatusChecked).toBeTruthy();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const progress = graph.locator(".investigation-progress");
  const live = graph.getByRole("complementary", {
    name: "Live investigation timeline",
  });
  const selected = graph.locator(
    '.investigation-answer-card input[value="intermittent"]',
  );
  await selected.check();
  await selected.locator("+ span").click();
  try {
    await expect(progress).toHaveAttribute("data-mode", "answer");
    await expect(graph.locator(".investigation-canvas")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(graph.locator(".flowchart-node.is-processing")).toHaveCount(1);
    await expect(
      graph.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(live).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("answer-desktop.png") });
    releaseAnswer();
    await expect(progress).toHaveAttribute("data-mode", "queued");
    await expect(graph).toHaveClass(/is-expanded/);
    job!.state = "running";
    job!.attempts = 1;
    await expect(progress).toHaveAttribute("data-mode", "updating", {
      timeout: 10000,
    });
    await expect(live).toContainText("Frequency · Intermittent");
    await page.setViewportSize({ width: 375, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(progress).toBeInViewport();
    await expect(progress.locator(".investigation-progress-ring")).toHaveCSS(
      "animation-name",
      "none",
    );
    await expect
      .poll(() =>
        graph
          .locator(".flowchart-node.is-processing .flowchart-node-status")
          .evaluate(
            (element) => getComputedStyle(element, "::before").animationName,
          ),
      )
      .toBe("none");
    await expect
      .poll(async () => {
        const question = (await graph
          .locator(".flowchart-node[data-spotlight] button")
          .boundingBox())!;
        const composer = (await graph
          .locator(".investigation-conversation")
          .boundingBox())!;
        return question.y + question.height < composer.y;
      })
      .toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath("answer-mobile.png") });
    holdRefresh = true;
    job!.state = "succeeded";
    job!.updated_at = "2026-10-03T00:00:01+00:00";
    await expect.poll(() => refreshStarted, { timeout: 10000 }).toBeTruthy();
    await expect(progress).toHaveAttribute("data-mode", "updating");
    releaseRefresh();
    await expect(progress).toBeHidden();
    await expect(graph.locator(".investigation-canvas")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(graph.locator(".flowchart-node.is-processing")).toHaveCount(0);
    await expect(
      graph.locator(".investigation-response.is-active input").first(),
    ).toBeEnabled();
  } finally {
    releaseAnswer();
    releaseRefresh();
  }
});

test("conversation requests show activity and failed answers restore the saved draft controls", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/incidents/${incident.id}/conversation`,
    async (route) => {
      const response = await route.fetch();
      await pending;
      await route.fulfill({ response });
    },
  );
  await page.goto(`/incidents/${incident.id}/investigation`);
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const conversation = graph.locator(".investigation-conversation");
  await conversation
    .getByLabel("Talk through what you're seeing")
    .fill("It is intermittent");
  await conversation.getByRole("button", { name: "Send message" }).click();
  try {
    await expect(
      conversation.locator(".investigation-progress"),
    ).toHaveAttribute("data-mode", "conversation");
    await expect(conversation).toContainText("Reviewing your message");
    await expect(graph.locator(".investigation-canvas")).toBeVisible();
  } finally {
    release();
  }
  await expect(
    conversation.getByRole("button", { name: "Confirm answer" }),
  ).toBeVisible();
  await expect(conversation.locator(".investigation-progress")).toBeHidden();
  await conversation.getByRole("button", { name: "Correct me" }).click();
  await expect(
    conversation.getByRole("button", { name: "Confirm answer" }),
  ).toBeHidden();
  let releaseFailure = () => {};
  const pendingFailure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await page.route(`**/api/incidents/${incident.id}/actions`, async (route) => {
    await pendingFailure;
    await route.fulfill({
      status: 503,
      json: { detail: "Analysis temporarily unavailable. Try again." },
    });
  });
  const selected = conversation.locator(
    '.investigation-answer-card input[value="intermittent"]',
  );
  await selected.check();
  await selected.locator("+ span").click();
  try {
    await expect(conversation.locator(".investigation-progress")).toBeVisible();
  } finally {
    releaseFailure();
  }
  await expect(conversation.locator(".investigation-progress")).toBeHidden();
  await expect(selected).toBeEnabled();
  await expect(selected).toBeChecked();
  await expect(conversation.getByRole("alert")).toContainText(
    "Analysis temporarily unavailable. Try again.",
  );
});

test("a failed background analysis stops animating and returns the manual retry controls", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  let failed = false;
  await page.route("**/api/incident-jobs/status", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route(`**/api/incidents/${incident.id}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), assessment: null },
    });
  });
  await page.route(`**/api/incidents/${incident.id}/jobs`, (route) =>
    route.fulfill({
      json: [
        {
          id: "failed-progress-job",
          incident_id: incident.id,
          input_fingerprint: "failure-test",
          source_revision: incident.revision,
          kind: "analysis",
          state: failed ? "failed" : "running",
          attempts: 3,
          max_attempts: 3,
          created_at: "2026-10-03T00:00:00+00:00",
          updated_at: "2026-10-03T00:00:01+00:00",
          lease_until: null,
          worker_token: null,
          error: failed ? "Provider unavailable" : null,
        } satisfies IncidentJob,
      ],
    }),
  );
  await page.goto(`/incidents/${incident.id}/investigation`);
  await expect(page.locator(".investigation-progress")).toBeVisible();
  failed = true;
  await expect(page.locator(".investigation-progress")).toBeHidden({
    timeout: 10000,
  });
  await expect(
    page.getByRole("button", { name: "Analyze available evidence" }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText(
    "Evidence analysis did not finish. Your evidence is saved.",
  );
});

test("a failed results refresh clears progress and can retry the completed analysis", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  let completed = false;
  let failRefresh = true;
  let refreshAttempts = 0;
  await page.route("**/api/incident-jobs/status", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route(`**/api/incidents/${incident.id}`, async (route) => {
    if (completed) refreshAttempts += 1;
    if (completed && failRefresh)
      return route.fulfill({
        status: 503,
        json: { detail: "Results refresh temporarily unavailable." },
      });
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: {
        ...(await response.json()),
        ...(!completed ? { assessment: null } : {}),
      },
    });
  });
  await page.route(`**/api/incidents/${incident.id}/jobs`, (route) =>
    route.fulfill({
      json: [
        {
          id: "refresh-progress-job",
          incident_id: incident.id,
          input_fingerprint: "refresh-test",
          source_revision: incident.revision,
          kind: "analysis",
          state: completed ? "succeeded" : "running",
          attempts: 1,
          max_attempts: 3,
          created_at: "2026-10-03T00:00:00+00:00",
          updated_at: "2026-10-03T00:00:01+00:00",
          lease_until: null,
          worker_token: null,
          error: null,
        } satisfies IncidentJob,
      ],
    }),
  );
  await page.goto(`/incidents/${incident.id}/investigation`);
  await expect(page.locator(".investigation-progress")).toBeVisible();
  completed = true;
  await expect(page.locator(".investigation-progress")).toBeHidden({
    timeout: 10000,
  });
  await expect(page.getByRole("alert")).toContainText(
    "Background analysis status is unavailable",
  );
  failRefresh = false;
  await page.locator(".incident-jobs > summary").click();
  await page
    .getByRole("button", { name: "Refresh job status", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Adaptive investigation", exact: true }),
  ).toHaveClass(/is-expanded/);
  await expect(page.getByRole("alert")).toBeHidden();
  expect(refreshAttempts).toBeGreaterThanOrEqual(2);
});
