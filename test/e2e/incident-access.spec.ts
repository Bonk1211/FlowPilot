import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const TOKEN = "browser-test-token-with-at-least-thirty-two-characters";

async function configuredAccess(page: Page, permissions: string[]) {
  const protectedRequests: string[] = [];
  await page.route("**/api/incident-access", async (route) => {
    const authenticated =
      route.request().headers().authorization === `Bearer ${TOKEN}`;
    await route.fulfill({
      json: {
        mode: "configured",
        subject: authenticated ? "engineer@example.test" : null,
        authenticated,
        permissions: authenticated ? permissions : [],
      },
    });
  });
  await page.route("**/api/incidents{,/**}", async (route) => {
    const authenticated =
      route.request().headers().authorization === `Bearer ${TOKEN}`;
    protectedRequests.push(route.request().url());
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        json: { detail: "Incident authentication required." },
      });
      return;
    }
    await route.continue();
  });
  return protectedRequests;
}

async function signIn(page: Page) {
  await page.getByLabel("Workspace access token").fill(TOKEN);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("configured access gates loading, preserves the tab session, and signs out", async ({
  page,
  request,
}) => {
  const replay = await request.post("/api/incidents/replay", {
    data: { trigger_id: `auth-viewer-${Date.now()}` },
  });
  expect(replay.ok()).toBeTruthy();
  const incident = await replay.json();
  const requests = await configuredAccess(page, ["view"]);
  await page.goto(`/incidents/${incident.id}`);
  await expect(
    page.getByRole("heading", { name: "Sign in to investigate" }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByLabel("Workspace access token").fill("wrong-token");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("token was not accepted");
  await signIn(page);
  await expect(
    page.getByText("Signed in as engineer@example.test"),
  ).toBeVisible();
  await expect(page.getByLabel("Workspace access token")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Evidence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Collect next evidence" }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Knowledge", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save review and close" }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Use the engineer role for this local demonstration"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Demo conclusion & record knowledge",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(requests.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => localStorage.getItem("flowpilot.incident-token")),
  ).toBeNull();
  await page.reload();
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await expect(
    page.getByText("Signed in as engineer@example.test"),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export report", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(
    new RegExp(`${incident.id}-r[0-9]+-handoff.html`),
  );
  expect(requests.some((path) => path.endsWith("/experiments"))).toBeTruthy();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to investigate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("flowpilot.incident-token"),
    ),
  ).toBeNull();
});

test("configured review uses the authenticated subject and separates closure from publication", async ({
  page,
}) => {
  await configuredAccess(page, ["view", "edit", "close"]);
  await page.goto("/incidents");
  await signIn(page);
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Knowledge", exact: true })
    .click();
  await expect(page.getByLabel("Reviewer name")).toHaveValue(
    "engineer@example.test",
  );
  await expect(page.getByLabel("Reviewer name")).toHaveAttribute(
    "readonly",
    "",
  );
  await page
    .getByLabel("Findings and unresolved questions")
    .fill("Evidence is incomplete; engineering retains the open questions.");
  await expect(
    page.getByRole("button", { name: "Save review and close" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save review and close" }).click();
  await expect(
    page.getByText("Inconclusive — questions remain", { exact: true }),
  ).toBeVisible();
  await page.getByText("Review experience for reuse", { exact: true }).click();
  await page
    .getByLabel("Review reason")
    .fill("This account can close, but cannot publish lessons.");
  await expect(
    page.getByRole("button", { name: "Publish reviewed experience" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Publishing or withdrawing experience requires the publish knowledge permission.",
    ),
  ).toBeVisible();
});

test("authenticated source upload preserves bytes, links evidence and survives correction", async ({
  page,
}) => {
  const requests = await configuredAccess(page, ["view", "edit"]);
  await page.goto("/incidents");
  await signIn(page);
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Evidence", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: /Source files/ })
    .click();
  await page.getByText("Upload a source file", { exact: true }).click();
  const bytes = Buffer.from(
    "Original material note\r\nBatch identity pending\r\n",
  );
  await page.getByLabel("Original file", { exact: true }).setInputFiles({
    name: "material-note.txt",
    mimeType: "text/plain",
    buffer: bytes,
  });
  await page
    .getByRole("combobox", { name: "Evidence origin", exact: true })
    .selectOption("simulated");
  await page
    .getByRole("textbox", { name: "Evidence label", exact: true })
    .fill("Uploaded material note");
  await page
    .getByLabel("Context note", { exact: true })
    .fill("Illustrative record; source conditions unknown.");
  await page
    .getByRole("button", { name: "Preserve and link source", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Original preserved and linked" }),
  ).toBeVisible();
  const files = page.locator(".incident-artifact-list");
  await expect(
    files.getByText("material-note.txt", { exact: true }),
  ).toBeVisible();
  await files
    .getByText("Integrity, provenance and retention", { exact: true })
    .click();
  await expect(
    files.getByText(createHash("sha256").update(bytes).digest("hex"), {
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await files
    .getByRole("button", { name: "Download original", exact: true })
    .click();
  expect(await readFile((await (await download).path())!)).toEqual(bytes);
  expect(
    requests.some((path) => path.includes("/artifacts/ART-")),
  ).toBeTruthy();
  await page
    .locator("summary")
    .filter({ hasText: /Source files/ })
    .click();
  await page
    .locator(".incident-event")
    .filter({ hasText: "Uploaded material note" })
    .click();
  await page.getByText("Correct this evidence", { exact: true }).click();
  const correction = page.locator(".incident-correction");
  await correction
    .getByLabel("Evidence label", { exact: true })
    .fill("Corrected material note context");
  await correction
    .getByLabel("Reason for correction", { exact: true })
    .fill("Clarify the record label without changing original bytes.");
  await correction
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    page
      .locator(".incident-event")
      .filter({ hasText: "Corrected material note context" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".incident-event")
      .filter({ hasText: "Corrected material note context" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /Source files/ })
    .click();
  await expect(page.locator(".incident-artifact-list > li")).toHaveCount(1);
});
