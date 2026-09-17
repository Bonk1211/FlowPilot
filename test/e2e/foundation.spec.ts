import { expect, test, type Page } from "@playwright/test";

async function checkTextContrast(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const ratio = await page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const foreground = rgb(getComputedStyle(element).color);
        let parent: Element | null = element;
        let background = [255, 255, 255];
        while (parent) {
          const color = rgb(getComputedStyle(parent).backgroundColor);
          if (color.length === 3 || color[3] === 1) {
            background = color;
            break;
          }
          parent = parent.parentElement;
        }
        const luminance = (channels: number[]) =>
          channels
            .slice(0, 3)
            .map((c) => c / 255)
            .map((c) =>
              c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
            )
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const values = [luminance(foreground), luminance(background)].sort(
          (a, b) => b - a,
        );
        return (values[0] + 0.05) / (values[1] + 0.05);
      });
    expect(ratio, `${selector} text contrast`).toBeGreaterThanOrEqual(4.5);
  }
}

test("loads the scenario and previews the real API response", async ({
  page,
}) => {
  await page.goto("/log-preview");
  await expect(
    page.getByRole("heading", { name: "Declining flux spray coverage" }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo / Simulated Data", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "15 of 15 events recognized. 0 unknown events retained.",
  );
  await expect(page.getByText(/timestamps moved backwards/)).toBeVisible();
  await expect(
    page.getByText("machine run status", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "View raw events" }).click();
  await expect(page.locator(".event-detail:visible pre").first()).toContainText(
    "Run Started",
  );
  await expect(page.getByText("Out of order", { exact: true })).toBeVisible();
  await expect(page.getByText("Continuation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to preview" }).first().click();
  await expect(
    page.getByRole("button", { name: "View raw events" }),
  ).toBeFocused();
});

test("shows a recoverable connection failure", async ({ page }) => {
  await page.route("**/api/demo/scenario", (route) => route.abort());
  await page.goto("/log-preview");
  await expect(page.getByRole("alert")).toContainText("service is unavailable");
  await page.unroute("**/api/demo/scenario");
  await page.getByRole("button", { name: "Retry loading scenario" }).click();
  await expect(
    page.getByRole("heading", { name: "Declining flux spray coverage" }),
  ).toBeVisible();
});

test("supports keyboard entry and narrow layouts", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/log-preview");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await expect(
    page.getByRole("heading", { name: "Log preview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const width of [1440, 1280, 834, 375]) {
  test(`keeps the desktop workspace readable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/log-preview");
    await expect(
      page.getByRole("heading", { name: "Declining flux spray coverage" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preview sample log" }),
    ).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("report.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Preview sample log" }).click();
    await expect(
      page.getByRole("heading", { name: "Log preview" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("preview.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "View raw events" }).click();
    await expect(
      page.getByRole("heading", { name: "Raw machine events" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("events.png"),
      fullPage: true,
    });
  });
}

test("source navigation selects the matching event and restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/log-preview");
  await page.getByRole("button", { name: "Preview sample log" }).click();
  const source = page.locator("#source-1");
  await source.focus();
  await page.keyboard.press("Enter");
  const selected = page.locator(".event-selected .event-selector");
  await expect(selected).toBeFocused();
  await expect(selected).toHaveAttribute("aria-expanded", "true");
  const selectedId = await selected.getAttribute("id");
  await expect(page.locator(".event-detail:visible pre").first()).toContainText(
    "Duration = 123.493 sec.",
  );
  await page.keyboard.press("Enter");
  await expect(page.locator(`[id="${selectedId}"]`)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByRole("button", { name: "Back to preview" }).first().click();
  await expect(source).toBeFocused();
});

test("mobile source disclosures reopen when returning from the viewer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/log-preview");
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await expect(page.locator("#source-0")).not.toBeVisible();
  await page.getByText("Source & time", { exact: true }).first().click();
  await page.locator("#source-0").click();
  await page.getByRole("button", { name: "Back to preview" }).first().click();
  await expect(page.locator("#source-0")).toBeFocused();
  await expect(page.locator("#source-0")).toBeVisible();
});

test("failed refresh retains the last preview and can recover", async ({
  page,
}) => {
  await page.goto("/log-preview");
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await expect(
    page.getByRole("heading", { name: "Log preview" }),
  ).toBeVisible();
  await page.route("**/api/logs/preview", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh log preview" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "last successful preview is still shown",
  );
  await expect(
    page.getByRole("article", { name: "time between boards" }),
  ).toContainText("123.493 s");
  await page.unroute("**/api/logs/preview");
  await page.getByRole("button", { name: "Retry log preview" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const content of [
  "",
  "2026-09-13,01:00:00.000,Vendor-specific message,with,commas",
]) {
  test(`retains ${content ? "unknown" : "empty"} log state without invented evidence`, async ({
    page,
  }) => {
    await page.route("**/api/logs/preview", async (route) => {
      const response = await route.fetch({
        postData: { ...route.request().postDataJSON(), text: content },
      });
      await route.fulfill({ response });
    });
    await page.goto("/log-preview");
    await page.getByRole("button", { name: "Preview sample log" }).click();
    await expect(
      page.getByText(/No supported evidence candidates/),
    ).toBeVisible();
    await page.getByRole("button", { name: "View raw events" }).click();
    if (content) {
      await expect(
        page.getByText("Unknown", { exact: true }).last(),
      ).toBeVisible();
      await expect(
        page.locator(".event-detail:visible pre").first(),
      ).toContainText(content);
    } else {
      await expect(
        page.getByText("No events were found in this log.", { exact: true }),
      ).toBeVisible();
    }
  });
}

test("reflows at the effective viewport of 200 percent desktop zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/log-preview");
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await page.getByRole("button", { name: "View raw events" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Back to preview" }).first(),
  ).toBeVisible();
});

test("maintains readable text on paper and instrument surfaces", async ({
  page,
}) => {
  await page.goto("/log-preview");
  await page.getByRole("button", { name: "Preview sample log" }).click();
  await checkTextContrast(page, [
    ".phase-rail li[aria-current]",
    ".source-link",
    ".status",
    ".recognition-summary",
    ".parser-warnings li",
    ".primary",
  ]);
  await page.getByRole("button", { name: "View raw events" }).click();
  await checkTextContrast(page, [
    ".stage-note",
    ".event-stage .eyebrow",
    ".event-description > span",
    ".event-caution",
    ".stage-back",
  ]);
});
