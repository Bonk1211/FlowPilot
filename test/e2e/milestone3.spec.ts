import { expect, test } from "@playwright/test";
import { start, discovery, inspect } from "../helpers/caseJourney";

test("M3 two consecutive clean journeys preserve the previous case", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const results = [];
  await start(page);
  for (let run = 1; run <= 2; run++) {
    const started = Date.now();
    const id = new URL(page.url()).searchParams.get("case")!;
    await page.getByRole("button", { name: "Use sample machine log" }).click();
    await page.getByRole("button", { name: "Attach previewed log" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Attached demo-industry-machine.log" }),
    ).toBeVisible();
    const diagnosisStarted = Date.now();
    await discovery(page);
    const discoveryAndDiagnosisMs = Date.now() - diagnosisStarted;
    await inspect(page, true);
    await expect(
      page.getByLabel("I confirm the simulated corrective action is complete."),
    ).not.toBeChecked();
    await page
      .getByLabel("I confirm the simulated corrective action is complete.")
      .check();
    await page.getByRole("button", { name: "Record action complete" }).click();
    await page
      .getByRole("button", { name: "Use simulated passing check results" })
      .click();
    await expect(
      page.getByLabel("I confirm these simulated recovery observations."),
    ).not.toBeChecked();
    await page
      .getByLabel("I confirm these simulated recovery observations.")
      .check();
    await page
      .getByRole("button", { name: "Measure verification sample" })
      .click();
    await page
      .getByLabel("I confirm this simulated case is ready to resolve.")
      .check();
    await page
      .getByRole("button", { name: "Resolve case", exact: true })
      .click();
    await expect(
      page.getByText("Resolved · saved to this case", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Evidence used", exact: true }),
    ).toBeVisible();
    await page.getByText(/Current evidence · \d+ observations/).click();
    await expect(page.locator(".prototype-summary")).toContainText(
      "coverage pct",
    );
    await page.getByText(/Current evidence · \d+ observations/).click();
    await expect(page.locator(".prototype-summary")).toContainText(
      "heuristic points",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Review the completed case" }),
    ).toBeVisible();
    const saved = await (await request.get(`/api/investigations/${id}`)).json();
    expect(saved.investigation.state).toBe("resolved");
    results.push({
      run,
      caseId: id,
      elapsedMs: Date.now() - started,
      discoveryAndDiagnosisMs,
      mode: saved.findings_mode,
    });
    await page.screenshot({
      path: testInfo.outputPath(`rehearsal-${run}-summary.png`),
      fullPage: true,
    });
    if (run === 1) {
      await page.getByRole("button", { name: "Restart demo" }).click();
      await expect(page).not.toHaveURL(new RegExp(id));
      await expect(
        page.getByRole("heading", {
          name: "Which spray symptom was observed?",
        }),
      ).toBeVisible();
      const freshId = new URL(page.url()).searchParams.get("case");
      const fresh = await (
        await request.get(`/api/investigations/${freshId}`)
      ).json();
      expect(fresh.answers).toEqual({});
      expect(fresh.log).toBeNull();
      expect(fresh.recovery).toBeNull();
      expect(fresh.pending_outcome).toBeNull();
      expect(fresh.calibration_attempts).toBe(0);
      expect(
        await (await request.get(`/api/investigations/${id}`)).json(),
      ).toEqual(saved);
    }
  }
  await testInfo.attach("rehearsal-results", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
});

test("M3 reset failure retains case and concurrent clicks create one fresh case", async ({
  page,
  request,
}) => {
  await start(page);
  await discovery(page);
  const oldUrl = page.url();
  const id = new URL(oldUrl).searchParams.get("case");
  const before = await (await request.get(`/api/investigations/${id}`)).json();
  await page.route("**/api/demo/reset", (route) => route.abort());
  await page.getByRole("button", { name: "Restart demo" }).click();
  await expect(page.getByRole("alert")).toContainText("service is unavailable");
  await expect(page).toHaveURL(oldUrl);
  await expect(
    page.getByRole("heading", { name: "Ranked causes", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/demo/reset");
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/demo/reset", async (route) => {
    calls++;
    await gate;
    await route.continue();
  });
  const reset = page.getByRole("button", { name: "Restart demo" });
  await reset.click();
  await expect(reset).toBeDisabled();
  await reset.dispatchEvent("click");
  release();
  await expect(page).not.toHaveURL(oldUrl);
  expect(calls).toBe(1);
  expect(await (await request.get(`/api/investigations/${id}`)).json()).toEqual(
    before,
  );
});
