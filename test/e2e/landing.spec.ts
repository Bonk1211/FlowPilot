import { expect, test } from "@playwright/test";

test("scroll continuously moves the 3D story, reverses it, and holds when scrolling stops", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const scene = page.locator(".story-canvas");
  await expect(scene).toHaveAttribute("data-renderer", "ready");
  await expect(scene.locator("canvas")).toBeVisible();
  expect(await scene.boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  });
  const phase = async () =>
    Number(await scene.getAttribute("data-scene-phase"));
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 160);
  await expect.poll(phase).toBeGreaterThan(0.1);
  expect(await phase()).toBeLessThan(0.3);
  // The scene settles to the native scroll position, then holds without a clock.
  await expect
    .poll(async () => Math.abs((await phase()) - (160 / 3060) * 3))
    .toBeLessThan(0.002);
  const held = await phase();
  await page.waitForTimeout(300);
  expect(await phase()).toBeCloseTo(held, 2);
  await page.mouse.wheel(0, -160);
  await expect.poll(phase).toBeLessThan(0.002);
  for (const i of [1, 2, 3, 0, 3, 1]) {
    await page.locator(".story-scroll").evaluate((element, i) => {
      element.scrollTop =
        ((element.scrollHeight - element.clientHeight) * i) / 3;
    }, i);
    await expect
      .poll(async () => Math.abs((await phase()) - i))
      .toBeLessThan(0.002);
  }
  expect(errors).toEqual([]);
});

test("chapter navigation, deep links and browser history lead to the workspace", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/landing#approach");
  const scene = page.locator(".story-canvas");
  await expect(scene).toHaveAttribute("data-renderer", "ready");
  await expect(
    page.getByRole("heading", { name: "A reason for the next check." }),
  ).toBeVisible();
  for (const [i, chapter] of [
    "Dispense",
    "Timeline",
    "Plan",
    "Report",
  ].entries()) {
    const link = page
      .getByRole("navigation", { name: "Story chapters" })
      .getByRole("link", { name: chapter, exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "step");
    await expect
      .poll(async () =>
        Math.abs(Number(await scene.getAttribute("data-scene-phase")) - i),
      )
      .toBeLessThan(0.002);
    await page.screenshot({
      path: testInfo.outputPath(`story-${chapter}.png`),
    });
  }
  await page.goBack();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Plan", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await page.goForward();
  await expect(
    page.getByRole("link", { name: "Explore the real workspace" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore the real workspace" }).click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(
    page.getByRole("button", { name: "Start S932 replay" }),
  ).toBeVisible();
});

test("phone chapters fit the screen and reduced motion supports native keyboard scrolling", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.locator(".story-canvas");
  await expect(scene).toHaveAttribute("data-renderer", "ready");
  for (const [i, chapter] of [
    "Dispense",
    "Timeline",
    "Plan",
    "Report",
  ].entries()) {
    const link = page
      .getByRole("navigation")
      .getByRole("link", { name: chapter, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(scene).toHaveAttribute("data-scene-phase", `${i}.000`);
    await expect(
      page.locator('.story-panel[aria-hidden="false"]'),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page
        .locator(".story-scroll")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`phone-${chapter}.png`),
    });
  }
  await page.getByRole("link", { name: "Back to start" }).click();
  await expect(scene).toHaveAttribute("data-scene-phase", "0.000");
  await page.locator(".story-scroll").focus();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() =>
      page.locator(".story-scroll").evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(200);
  await expect(scene).toHaveAttribute("data-scene-phase", "1.000");
});

test("the story remains readable and navigable without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".story-canvas")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(
    page.getByText("3D is unavailable on this device.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Report", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "One investigation. Ready to hand over.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore the real workspace" }),
  ).toHaveAttribute("href", "/incidents");
});
