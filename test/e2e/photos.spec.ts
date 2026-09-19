import { expect, test } from "@playwright/test";
import { discovery, inspect } from "../helpers/caseJourney";

async function startPhoto(
  page: import("@playwright/test").Page,
  label?: string,
) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start investigation", exact: true }),
  ).toBeDisabled();
  if (label)
    await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(page.getByText("Area to review", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Start investigation", exact: true })
    .click();
  await expect(page).toHaveURL(/\?case=CASE-/);
}

test("photo inspection, failed comparison, recovery and persisted before/after", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await startPhoto(page);
  await discovery(page);
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
  await photo.getByRole("button", { name: /Coarse|Material|deposit/i }).click();
  await photo
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    photo.getByText("Area to review", { exact: true }),
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
  await page.getByRole("button", { name: /Coarse|Material|deposit/i }).click();
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(page.getByText("Area to review", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Start investigation", exact: true })
    .click();
  await discovery(page, true);
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
  ).toBeDisabled();
  await page.getByRole("button", { name: /Incomplete/i }).click();
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(page.getByText("Area to review", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Area to review", { exact: true })).toBeVisible();
  const start = page.getByRole("button", {
    name: "Start investigation",
    exact: true,
  });
  await expect(start).toBeEnabled();
  await page
    .getByLabel("Upload a photo")
    .setInputFiles("fixtures/vision/normal.png");
  await expect(start).toBeDisabled();
  await expect(page.getByText("Area to review", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await expect(
    page.getByText("Within reference range", { exact: true }),
  ).toBeVisible();
  await expect(start).toBeEnabled();
});
