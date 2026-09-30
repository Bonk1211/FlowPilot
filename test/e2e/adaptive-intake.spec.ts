import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/legacy");
  await page
    .getByLabel("Upload a photo", { exact: true })
    .setInputFiles("fixtures/vision/incomplete-coverage.png");
  await page
    .getByRole("button", { name: "Analyze photo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to context", exact: true })
    .click();
  await page.getByLabel("Incomplete coverage", { exact: true }).check();
}
const prompts: Record<string, string> = {
  continuous: "Has measured flux weight been falling?",
  change: "What does fluid pressure show?",
  temperature: "Any material-condition or idle-purge concerns?",
  service: "Was there a collision or recent setup change?",
};
function planned(
  body: { state_id: string; observations: Record<string, unknown> },
  order = ["temperature", "continuous", "change", "service"],
) {
  return {
    state_id: body.state_id,
    mode: "live",
    model: "test-planner",
    fallback_reason: null,
    summary: "Confirm the material history before the remaining measurements.",
    source_refs: ["answer:frequency"],
    questions: order
      .filter((id) => !body.observations[id])
      .map((id) => ({
        question_id: id,
        prompt: prompts[id],
        rationale: "This condition helps distinguish possible causes.",
        source_refs: ["answer:frequency"],
      })),
    replan_when: [],
    clarification: null,
    ready: false,
    elapsed_ms: 10,
  };
}
const next = (page: Page) =>
  page.getByRole("button", { name: "Continue", exact: true });

test("AI changes order; ordinary answers use one plan and retain compatible case evidence", async ({
  page,
}, testInfo) => {
  let calls = 0;
  await page.route("**/api/intake/question-plan", async (route) => {
    calls++;
    await route.fulfill({ json: planned(route.request().postDataJSON()) });
  });
  await enter(page);
  await expect(
    page.getByRole("heading", { name: prompts.temperature, exact: true }),
  ).toHaveCount(0);
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: prompts.temperature, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("guided-context-desktop.png"),
    fullPage: true,
  });
  for (const answer of [
    "Not recorded",
    "Yes",
    "Stable / no known change",
    "Not recorded",
  ]) {
    await page
      .locator("fieldset.intake-question")
      .getByLabel(answer, { exact: true })
      .check();
    await next(page).click();
  }
  expect(calls).toBe(1);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/investigations") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Generate diagnosis", exact: true })
    .click();
  const saved = await (await response).json();
  expect(saved.answers.continuous).toBe("yes");
  expect(saved.answers.temperature).toBe("unknown");
});

test("text interpretation is explicit; two-call budget persists through edits", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/intake/question-plan", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    const plan = {
      ...planned(body, ["continuous", "change", "temperature", "service"]),
      clarification:
        calls === 2
          ? {
              question_id: "temperature",
              prompt: "Does this mean a material concern?",
              proposed_value: "yes",
              source_ref: "note:continuous",
            }
          : null,
    };
    await route.fulfill({ json: plan });
  });
  await enter(page);
  await next(page).click();
  await page.getByLabel("Yes", { exact: true }).check();
  await page
    .getByLabel("Additional detail for this answer")
    .fill("It began after a material change.");
  await next(page).click();
  await expect(
    page.getByText("Please confirm this interpretation", { exact: true }),
  ).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await expect(
    page.locator("fieldset.intake-question").getByLabel("Yes", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Use this interpretation", exact: true })
    .click();
  await expect(
    page.locator("fieldset.intake-question").getByLabel("Yes", { exact: true }),
  ).toBeChecked();
  await next(page).click();
  await page
    .getByRole("button", {
      name: "Edit Which spray symptom was observed?",
      exact: true,
    })
    .click();
  await page.getByLabel("Blobs or line-end droplets", { exact: true }).check();
  await next(page).click();
  await expect(
    page.getByRole("heading", {
      name: "Does flux weight pass despite blobs or droplets?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/AI request budget reached/)).toBeVisible();
  expect(calls).toBe(2);
});

test("a four-second deadline falls back and a late response cannot change the question", async ({
  page,
}) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/intake/question-plan", async (route) => {
    calls++;
    await gate;
    await route
      .fulfill({ json: planned(route.request().postDataJSON()) })
      .catch(() => {});
  });
  await enter(page);
  const started = Date.now();
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: prompts.continuous, exact: true }),
  ).toBeVisible({ timeout: 5500 });
  expect(Date.now() - started).toBeLessThan(5500);
  await expect(page.getByText("Rule guidance", { exact: true })).toBeVisible();
  release();
  await page.getByLabel("Yes", { exact: true }).check();
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: prompts.change, exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test("editing during a request discards stale results and preserves keyboard flow on mobile", async ({
  page,
}, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  await page.route("**/api/intake/question-plan", async (route) => {
    calls++;
    if (calls === 1) await gate;
    await route
      .fulfill({ json: planned(route.request().postDataJSON()) })
      .catch(() => {});
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await next(page).click();
  await page
    .getByRole("button", {
      name: "Edit Which spray symptom was observed?",
      exact: true,
    })
    .click();
  release();
  await expect(
    page.getByRole("heading", {
      name: "Which spray symptom was observed?",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Additional detail for this answer")
    .fill("Started after a material change.");
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: prompts.temperature, exact: true }),
  ).toBeFocused();
  expect(calls).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("guided-context-mobile.png"),
    fullPage: true,
  });
});

test("adopting the log retains a conflicting observation and triggers a bounded replan", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/intake/question-plan", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    if (calls === 2) {
      expect(body.observations.continuous.source).toBe("machine_log");
      expect(body.observations.continuous.observed_value).toBe("no");
      expect(body.observations.continuous.reason).toBe(
        "Use the selected Board measurement.",
      );
    }
    await route.fulfill({
      json: planned(body, ["continuous", "change", "temperature", "service"]),
    });
  });
  await enter(page);
  await page
    .getByLabel("Upload machine log", { exact: true })
    .setInputFiles("fixtures/logs/synthetic-incomplete-coverage.log");
  await page.getByRole("checkbox", { name: /I confirm this log/ }).check();
  await next(page).click();
  await page.getByLabel("No", { exact: true }).check();
  await page
    .getByRole("button", { name: "Use log evidence", exact: true })
    .click();
  await expect(next(page)).toBeDisabled();
  await page
    .getByLabel("Why use this source?")
    .fill("Use the selected Board measurement.");
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: prompts.change, exact: true }),
  ).toBeVisible();
  expect(calls).toBe(2);
});
