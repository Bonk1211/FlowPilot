import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { Case } from "@flowpilot/contracts";

async function act(page: Page, click: () => Promise<void>): Promise<Case> {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/actions") && r.request().method() === "POST",
    { timeout: 45000 },
  );
  await click();
  const received = await response;
  expect(received.ok()).toBeTruthy();
  return received.json();
}

for (const outcome of ["Obstruction found", "No obstruction found"]) {
  test(`live browser and persisted ${outcome.toLowerCase()}`, async ({
    page,
    request,
  }, testInfo) => {
    await page.goto("/");
    await page
      .getByLabel("Operator report")
      .fill("Synthetic live acceptance: consistently undersized epoxy dots.");
    await page
      .getByRole("button", { name: "Start investigation", exact: true })
      .click();
    await expect(page).toHaveURL(/\?case=CASE-/);
    const id = new URL(page.url()).searchParams.get("case")!;
    for (const name of [
      "Continuous",
      "Yes",
      "No known change",
      "Not recorded",
      "Not recorded",
    ]) {
      await act(page, () =>
        page.getByRole("button", { name, exact: true }).click(),
      );
    }
    const initial = await act(page, () =>
      page.getByRole("button", { name: "Diagnose case", exact: true }).click(),
    );
    expect(
      initial.reasoning?.mode,
      initial.reasoning?.fallback_reason ?? "missing reasoning",
    ).toBe("live");
    expect(
      initial.reasoning?.critic?.assessment.missing_evidence.length,
    ).toBeGreaterThan(0);
    await expect(
      page.getByRole("heading", {
        name: "Live specialist and critic findings",
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Live specialist and critic findings",
      }),
    ).toBeVisible();
    expect(
      await (await request.get(`/api/investigations/${id}`)).json(),
    ).toEqual(initial);
    await page
      .getByRole("button", { name: "Start illustrative inspection" })
      .click();
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await act(page, () =>
      page.getByRole("button", { name: outcome, exact: true }).click(),
    );
    await page
      .getByLabel("I confirm this simulated inspection observation.")
      .check();
    const confirmed = await act(page, () =>
      page
        .getByRole("button", { name: "Confirm observation", exact: true })
        .click(),
    );
    expect(
      confirmed.reasoning?.mode,
      confirmed.reasoning?.fallback_reason ?? "missing reasoning",
    ).toBe("live");
    expect(
      confirmed.reasoning?.critic?.assessment.missing_evidence.length,
    ).toBeGreaterThan(0);
    expect(confirmed.investigation.state).toBe(
      outcome === "Obstruction found" ? "cause_confirmed" : "diagnosing",
    );
    expect(confirmed.recommendation?.id ?? null).toBe(
      outcome === "Obstruction found" ? null : "material",
    );
    await page.reload();
    expect(
      await (await request.get(`/api/investigations/${id}`)).json(),
    ).toEqual(confirmed);
    let finalCase = confirmed;
    if (outcome === "Obstruction found") {
      await page
        .getByLabel("I confirm the simulated corrective action is complete.")
        .check();
      await act(page, () =>
        page.getByRole("button", { name: "Record action complete" }).click(),
      );
      await act(page, () =>
        page
          .getByRole("button", { name: "Measure verification sample" })
          .click(),
      );
      await page
        .getByLabel("I confirm this simulated case is ready to resolve.")
        .check();
      finalCase = await act(page, () =>
        page.getByRole("button", { name: "Resolve case", exact: true }).click(),
      );
      expect(finalCase.investigation.state).toBe("resolved");
      expect(finalCase.verification?.passed).toBe(true);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: "From observed defect to verified recovery",
        }),
      ).toBeVisible();
      expect(
        await (await request.get(`/api/investigations/${id}`)).json(),
      ).toEqual(finalCase);
    }
    const evidencePath = testInfo.outputPath("persisted-live-case.json");
    await writeFile(
      evidencePath,
      JSON.stringify({ initial, confirmed, finalCase }, null, 2),
    );
    await testInfo.attach("persisted-live-case", {
      path: evidencePath,
      contentType: "application/json",
    });
    await page.screenshot({
      path: testInfo.outputPath("confirmed-case.png"),
      fullPage: true,
    });
  });
}
