import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Incident } from "@flowpilot/contracts";

test("replay scans the saved sources, waits for analysis and opens the response flow", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/incidents/*/actions", async (route) => {
    if (route.request().postDataJSON().action !== "analyze")
      return route.continue();
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  await page.goto("/incidents");
  await expect(
    page.getByRole("button", { name: "Start S932 replay" }),
  ).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  const pipeline = page.locator(".replay-pipeline");
  await expect(pipeline).toHaveAttribute("data-stage", "0");
  await expect(pipeline.locator(".replay-image img")).toHaveCount(2);
  await expect(pipeline.getByRole("heading", { level: 1 })).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("01-image-scan.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Pause animation" }).click();
  await page.clock.runFor(3000);
  await expect(pipeline).toHaveAttribute("data-stage", "0");
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.clock.runFor(5200);
  await expect(pipeline).toHaveAttribute("data-stage", "1");
  const transcript = await readFile(
    "fixtures/demo-industry-machine.log",
    "utf8",
  );
  const log = pipeline.getByLabel("Machine log transcript");
  await expect(log).toContainText(transcript.split("\n")[0]);
  await expect(log.locator("mark").first()).toHaveText("Run Started");
  await expect(pipeline.getByLabel("Keywords found in the log")).toContainText(
    "Fid Found",
  );
  await page.screenshot({
    path: testInfo.outputPath("02-log-scan.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.clock.runFor(2300);
  await expect(pipeline).toHaveAttribute("data-stage", "2");
  await page.screenshot({
    path: testInfo.outputPath("03-evidence-assembly.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.clock.runFor(6000);
  await expect(
    page.getByRole("button", { name: "Open response flow", exact: true }),
  ).toBeDisabled();
  await expect(pipeline).toBeVisible();
  release();
  await expect(page).toHaveURL(/\/incidents\/INC-[^/]+\/investigation$/);
  await expect(
    page.getByRole("heading", { name: "Investigation path" }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/")[2];
  const saved: Incident = await (
    await request.get(`/api/incidents/${id}`)
  ).json();
  const logEvidence = saved.evidence?.find(
    (item) => item.id === "photo-machine-log",
  );
  expect(logEvidence?.values?.raw_text).toBe(transcript);
  expect(logEvidence?.role).toBe("context");
  expect(logEvidence?.provenance).toContain("Not the original machine file");
  await page.clock.resume();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Investigation path" }),
  ).toBeVisible();
});

test("a failed analysis retries without duplicating evidence; reduced motion works on mobile", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let fail = true;
  await page.route("**/api/incidents/*/actions", (route) => {
    if (fail && route.request().postDataJSON().action === "analyze") {
      fail = false;
      return route.fulfill({
        status: 503,
        json: {
          detail: "Analysis temporarily unavailable. Retry the pipeline.",
        },
      });
    }
    return route.continue();
  });
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  const pipeline = page.locator(".replay-pipeline");
  await expect(pipeline.getByRole("alert")).toContainText(
    "Analysis temporarily unavailable",
  );
  await expect(pipeline).toHaveAttribute("data-stage", "2");
  await expect(pipeline.locator(".replay-connector span").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("pipeline-mobile-reduced-motion.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Retry pipeline" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-[^/]+\/investigation$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const saved: Incident = await (
    await request.get(`/api/incidents/${id}`)
  ).json();
  expect(
    saved.evidence?.filter((item) => item.id === "photo-machine-log"),
  ).toHaveLength(1);
});

test("leaving a pending replay never redirects later", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/incidents/replay", async (route) => {
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page.locator(".replay-pipeline")).toBeVisible();
  await page.getByRole("button", { name: "Back to incidents" }).click();
  const completed = page.waitForResponse("**/api/incidents/replay");
  release();
  await (await completed).finished();
  await expect(
    page.getByRole("button", { name: "Start S932 replay" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/incidents");
});
