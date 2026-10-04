import { expect, test } from "@playwright/test";

for (const reducedMotion of [false, true]) {
  test(`workspace loading follows the data request${reducedMotion ? " on mobile with reduced motion" : ""}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(
      reducedMotion
        ? { width: 375, height: 812 }
        : { width: 1440, height: 900 },
    );
    await page.emulateMedia({
      reducedMotion: reducedMotion ? "reduce" : "no-preference",
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/incidents", async (route) => {
      await pending;
      await route.fulfill({ json: [] });
    });
    await page.goto("/incidents");
    const loading = page.locator(".workspace-loading");
    await expect(loading).toBeVisible();
    await expect(loading).toContainText("Loading your saved investigations");
    await expect(
      page.getByRole("button", { name: "Start S932 replay" }),
    ).toHaveCount(0);
    if (reducedMotion) {
      expect(
        await loading
          .locator(".workspace-loading-track span")
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe("none");
    }
    await page.screenshot({
      path: testInfo.outputPath("workspace-loading.png"),
    });
    release();
    await expect(loading).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start S932 replay" }),
    ).toBeVisible();
  });
}
