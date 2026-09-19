import { expect, test } from "@playwright/test";
import { inspect } from "../helpers/caseJourney";

async function submitContext(
  page: import("@playwright/test").Page,
  coarse = false,
  withLog = true,
) {
  await page
    .getByRole("group", {
      name: "Which spray symptom was observed?",
      exact: true,
    })
    .getByLabel(coarse ? "Blobs or line-end droplets" : "Incomplete coverage", {
      exact: true,
    })
    .check();
  if (withLog) {
    const details = page.locator(".intake-log-disclosure");
    if (!(await details.getAttribute("open")))
      await details.locator(":scope > summary").click();
    await page
      .getByLabel("Upload machine log", { exact: true })
      .setInputFiles(
        `fixtures/logs/synthetic-${coarse ? "coarse-deposits" : "incomplete-coverage"}.log`,
      );
    await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const answer of [
    "Yes",
    "Stable / no known change",
    "Not recorded",
    "Not recorded",
  ]) {
    const question = page.locator("fieldset.intake-question");
    const log = question.getByRole("button", {
      name: "Use log evidence",
      exact: true,
    });
    if (withLog && (await log.count())) await log.click();
    else await question.getByLabel(answer, { exact: true }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Generate diagnosis", exact: true })
    .click();
  await expect(page).toHaveURL(/\?case=CASE-/);
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Diagnosis evidence sources" }),
  ).toBeVisible();
}

async function startPhoto(
  page: import("@playwright/test").Page,
  file = "incomplete-coverage.png",
) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start investigation", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Upload a photo")
    .setInputFiles(`fixtures/vision/${file}`);
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to context" }).click();
}

test("photo inspection, failed comparison, recovery and persisted before/after", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await startPhoto(page);
  await submitContext(page);
  await inspect(page, true);
  await page.getByLabel("I confirm the corrective action is complete.").check();
  await page.getByRole("button", { name: "Record action complete" }).click();
  await expect(
    page.getByRole("button", { name: "Verify recovery", exact: true }),
  ).toBeDisabled();
  const photo = page.getByRole("region", {
    name: "Post-action photo",
    exact: true,
  });
  await photo
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/coarse-deposits.png");
  await photo
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    photo.getByRole("heading", {
      name: "Visual anomaly detected",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Demo shortcut", { exact: true }).click();
  await page
    .getByRole("button", { name: "Use simulated passing check results" })
    .click();
  await page.getByLabel("I confirm these recovery observations.").check();
  await page
    .getByRole("button", { name: "Verify recovery", exact: true })
    .click();
  await expect(
    page.getByText("Verification failed. The case remains open.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Verification failed. The case remains open.", {
      exact: true,
    }),
  ).toBeVisible();
  await photo
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/normal.png");
  await photo
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    photo.getByText("Within reference range", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("I confirm these recovery observations.").check();
  await page
    .getByRole("button", { name: "Verify recovery", exact: true })
    .click();
  await page.getByLabel("I confirm this case is ready to resolve.").check();
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("img", {
      name: "Before action: anomaly heatmap",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "After action: anomaly heatmap",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Resolved · saved to this case", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("photo-recovery.png"),
    fullPage: true,
  });
});

test("coarse photo supports technician discovery and clear-nozzle handoff", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/coarse-deposits.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to context" }).click();
  await submitContext(page, true);
  await inspect(page, false);
  await expect(
    page.getByRole("heading", {
      name: "Maintenance handoff needed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve case", exact: true }),
  ).toHaveCount(0);
});

test("photo upload rejects invalid input and stays usable on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Upload a photo").setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start investigation", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/incomplete-coverage.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("photo-mobile.png"),
    fullPage: true,
  });
});

test("uploaded image is analyzed and replacing it invalidates the previous result", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/incomplete-coverage.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toBeVisible();
  const start = page.getByRole("button", {
    name: "Continue to context",
    exact: true,
  });
  await expect(start).toBeEnabled();
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/normal.png");
  await expect(start).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Within reference range", exact: true }),
  ).toBeVisible();
  await expect(start).toBeEnabled();
});

test("upload-only intake exposes model findings and original/heatmap comparison", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText(/try an example/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analyze photo", exact: true }),
  ).toHaveCount(0);
  const choosePhoto = page.getByRole("button", {
    name: "Choose photo",
    exact: true,
  });
  await expect(choosePhoto).toBeEnabled();
  const chooserPromise = page.waitForEvent("filechooser");
  await choosePhoto.focus();
  await expect(choosePhoto).toBeFocused();
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles("fixtures/vision/incomplete-coverage.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visual anomaly detected", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Anomaly score.*Reference threshold/ }),
  ).toBeVisible();
  await expect(
    page.getByText("PatchCore", { exact: false }).first(),
  ).toBeVisible();
  const image = page.getByRole("img", {
    name: "Analysis result: anomaly heatmap",
    exact: true,
  });
  await expect(image).toBeVisible();
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Analysis result: inspection photo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Original", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "AI heatmap", exact: true }).click();
  await expect(image).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("vision-result-desktop.png"),
  });
});

test("pending analysis is cancellable and respects reduced motion", async ({
  page,
  request,
}, testInfo) => {
  const response = await request.post("/api/vision/examples/incomplete/assess");
  const assessment = await response.json();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/vision/assessments", async (route) => {
    await gate;
    await route.fulfill({ json: assessment }).catch(() => undefined);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/incomplete-coverage.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Analyzing image" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replace photo", exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".vision-scan-line")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("vision-analyzing.png") });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Analyze photo", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Start investigation", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("context draft survives back navigation, log changes require new confirmation", async ({
  page,
}, testInfo) => {
  await startPhoto(page);
  await page.getByLabel("Incomplete coverage", { exact: true }).check();
  await page
    .getByLabel("Additional detail for this answer")
    .fill("Missing coverage after Board 103.");
  await page
    .getByLabel("Upload machine log", { exact: true })
    .setInputFiles("fixtures/logs/synthetic-incomplete-coverage.log");
  await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Use log evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to photo" }).click();
  await page.getByRole("button", { name: "Continue to context" }).click();
  await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
  await page.locator(".intake-log-disclosure > summary").click();
  await page.getByLabel("Board shown in the photo").selectOption("101");
  await expect(
    page.getByRole("checkbox", { name: /I confirm this log/ }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Yes", { exact: true })).not.toBeChecked();
  await page.getByLabel("Board shown in the photo").selectOption("103");
  await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  await page
    .getByRole("button", { name: "Use log evidence", exact: true })
    .click();
  await page.locator(".intake-log-disclosure > summary").click();
  await page.getByRole("button", { name: "Remove log" }).click();
  await expect(page.getByLabel("Yes", { exact: true })).not.toBeChecked();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("context-mobile.png") });
  await page
    .getByRole("button", {
      name: "Edit Which spray symptom was observed?",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Additional detail for this answer"),
  ).toHaveValue("Missing coverage after Board 103.");
  await submitContext(page, false, false);
  await expect(
    page
      .getByRole("region", { name: "Diagnosis evidence sources" })
      .getByText("Not provided", { exact: true }),
  ).toBeVisible();
});

test("contradictory log and observation requires a reason and retains the selected source", async ({
  page,
}, testInfo) => {
  await startPhoto(page);
  await page.getByLabel("Incomplete coverage", { exact: true }).check();
  await page
    .getByLabel("Upload machine log", { exact: true })
    .setInputFiles("fixtures/logs/synthetic-incomplete-coverage.log");
  await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("No", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Why use this source?")
    .fill("Independent reweighing after the logged run was stable.");
  await page.screenshot({
    path: testInfo.outputPath("context-evidence-conflict.png"),
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Use log evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("Not recorded", { exact: true }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/investigations") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Generate diagnosis", exact: true })
    .click();
  const saved = await (await responsePromise).json();
  expect(saved.answers.continuous).toBe("no");
  expect(saved.intake.signals.continuous.answer).toBe("yes");
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
});

test("replacing a photo requires matching the retained log again", async ({
  page,
}) => {
  await startPhoto(page);
  await page
    .getByLabel("Upload machine log", { exact: true })
    .setInputFiles("fixtures/logs/synthetic-incomplete-coverage.log");
  await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  await page.getByRole("button", { name: "Back to photo" }).click();
  await page
    .getByLabel("Upload a photo", { exact: true })
    .setInputFiles("fixtures/vision/coarse-deposits.png");
  await expect(
    page.getByRole("button", { name: "Continue to context" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue to context" }).click();
  await expect(
    page.getByRole("checkbox", { name: /I confirm this log/ }),
  ).not.toBeChecked();
  await page
    .getByLabel("Upload machine log", { exact: true })
    .setInputFiles("fixtures/logs/synthetic-coarse-deposits.log");
  await expect(page.getByLabel("Board shown in the photo")).toHaveValue("203");
  await expect(
    page.getByRole("checkbox", { name: /I confirm this log/ }),
  ).not.toBeChecked();
});
