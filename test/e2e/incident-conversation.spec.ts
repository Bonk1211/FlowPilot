import { expect, test, type Page } from "@playwright/test";
import type { Incident, IncidentJob } from "@flowpilot/contracts";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

async function openInvestigation(page: Page, collectEvidence = false) {
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  if (collectEvidence) {
    await page.getByRole("link", { name: "Evidence", exact: true }).click();
    await page.getByRole("button", { name: "Collect next evidence" }).click();
    await page
      .getByRole("link", { name: "Investigation", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute(
    "title",
    new RegExp(
      collectEvidence ? "Compare recorded delivery evidence" : "progressive",
    ),
  );
  return graph;
}

test("answer cards sit above chat, support keyboard selection and keep explanations in the sidebar", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const graph = await openInvestigation(page);
  const conversation = graph.locator(".investigation-conversation");
  const cards = conversation.getByRole("group", { name: "Choose your answer" });
  const panel = graph.getByRole("complementary", {
    name: "Question explanation",
  });
  await expect(panel).toBeHidden();
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  await expect(cards).toBeVisible();
  await expect(conversation.locator(".conversation-spotlight")).toHaveCount(0);
  await expect(
    conversation.getByText("Choose your answer", { exact: true }),
  ).toHaveCSS("clip-path", "inset(50%)");
  await expect(
    conversation.getByText("Click once to select, again to confirm.", {
      exact: true,
    }),
  ).toHaveCSS("clip-path", "inset(50%)");
  const spotlight = graph.locator(".investigation-spotlight-circle");
  await expect
    .poll(() =>
      spotlight.evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("investigation-spotlight-circle");
  expect(
    await spotlight.evaluate(
      (element) => getComputedStyle(element).borderRadius,
    ),
  ).toBe("50%");
  await expect(
    conversation.getByText("Add a note", { exact: true }),
  ).toHaveCount(0);
  await expect(
    conversation.getByRole("button", { name: "Save answer & continue" }),
  ).toHaveCount(0);
  await expect(panel.locator("form, select, textarea")).toHaveCount(0);
  await expect(panel.getByRole("heading").first()).toContainText("progressive");
  await expect(conversation.locator("select")).toHaveCount(0);
  const input = conversation.getByLabel("Talk through what you're seeing");
  await input.fill("I am checking the machine now");
  const radios = cards.getByRole("radio");
  await radios.first().focus();
  await page.keyboard.press("Space");
  await expect(radios.first()).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  const intermittent = cards.locator('input[value="intermittent"]');
  await intermittent.check();
  const highlighted = intermittent.locator("+ span");
  await expect(cards.locator(".investigation-answer-tick")).toHaveCount(1);
  await expect(highlighted).toHaveCSS("background-image", /linear-gradient/);
  const cardBounds = (await cards.boundingBox())!;
  const composerBounds = (await conversation
    .locator(".conversation-composer")
    .boundingBox())!;
  expect(cardBounds.y + cardBounds.height).toBeLessThan(composerBounds.y);
  await graph.getByRole("button", { name: "Close explanation panel" }).click();
  await expect(cards).toBeVisible();
  await expect(intermittent).toBeChecked();
  await expect(input).toHaveValue("I am checking the machine now");
  await graph.getByRole("button", { name: "Show explanation panel" }).click();
  await graph.screenshot({
    path: testInfo.outputPath("answer-cards-desktop.png"),
  });
  await page.setViewportSize({ width: 375, height: 844 });
  await graph.getByRole("button", { name: "Close explanation panel" }).click();
  expect(
    await conversation.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await conversation.screenshot({
    path: testInfo.outputPath("answer-cards-mobile.png"),
  });
  await expect(
    conversation.getByRole("button", { name: "Start voice input" }),
  ).toBeInViewport();
  await expect(
    conversation.getByRole("button", { name: "Send message" }),
  ).toBeInViewport();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      spotlight.evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("none");
  await intermittent.focus();
  await page.keyboard.press("Enter");
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", new RegExp("pressure"));
  await expect(input).toHaveValue("I am checking the machine now");
});

test("recorded check outcomes and free-text answers use the same cards above chat", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const graph = await openInvestigation(page, true);
  const conversation = graph.locator(".investigation-conversation");
  const outcomes = conversation.getByRole("group", {
    name: "Recorded replay outcome",
  });
  await expect(
    outcomes.getByRole("radio", {
      name: "Supports this explanation",
      exact: true,
    }),
  ).toBeVisible();
  await outcomes
    .getByRole("radio", { name: "Supports this explanation", exact: true })
    .check();
  await expect
    .poll(async () => {
      const node = await graph
        .locator(".flowchart-node.is-spotlight button")
        .boundingBox();
      const chat = await conversation.boundingBox();
      return (
        !!node &&
        !!chat &&
        node.y + node.height / 2 + (node.width * 280) / 240 / 2 <= chat.y - 10
      );
    })
    .toBe(true);
  await graph.screenshot({
    path: testInfo.outputPath("check-answer-cards-desktop.png"),
  });
  await expect(
    outcomes.getByRole("radio", {
      name: "Conflicts with this explanation",
      exact: true,
    }),
  ).toBeVisible();
  await outcomes
    .getByRole("radio", { name: "Describe in my own words" })
    .check();
  await outcomes.locator(".investigation-answer-tick").click();
  await expect(
    conversation.getByLabel("Answer in your own words"),
  ).toBeFocused();
  await expect(outcomes).toBeVisible();
  await conversation
    .getByLabel("Answer in your own words")
    .fill("The delivery changed while the coverage fell");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/actions") &&
      response.request().postDataJSON()?.action === "answer_investigation",
  );
  await outcomes.locator(".investigation-answer-tick").click();
  const incident = (await (await saved).json()) as Incident;
  expect(incident.investigation?.answers?.at(-1)?.text).toBe(
    "The delivery changed while the coverage fell",
  );
});

test("one click selects, the tick confirms, and double-click saves exactly once", async ({
  page,
}) => {
  const graph = await openInvestigation(page);
  const conversation = graph.locator(".investigation-conversation");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/actions") &&
      request.postDataJSON()?.action === "answer_investigation"
    ) {
      requests.push(request.postDataJSON().choice);
    }
  });
  const progressive = conversation.locator('input[value="progressive"] + span');
  await progressive.click();
  await expect(progressive.locator(".investigation-answer-tick")).toBeVisible();
  expect(requests).toEqual([]);
  const intermittent = conversation.locator(
    'input[value="intermittent"] + span',
  );
  await intermittent.click();
  await expect(progressive.locator(".investigation-answer-tick")).toHaveCount(
    0,
  );
  await expect(
    intermittent.locator(".investigation-answer-tick"),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await intermittent.locator(".investigation-answer-tick").click();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", new RegExp("pressure"));
  expect(requests).toEqual(["intermittent"]);
  await conversation.locator('input[value="unstable"] + span').dblclick();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).not.toHaveAttribute("title", new RegExp("pressure records"));
  expect(requests).toEqual(["intermittent", "unstable"]);
});

test("the same spotlight circle slides between questions and follows the graph viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const graph = await openInvestigation(page);
  const ring = graph.locator(".investigation-spotlight-circle");
  const original = await ring.elementHandle();
  await ring.evaluate((element) => {
    element.addEventListener("transitionrun", (event) => {
      if ((event as TransitionEvent).propertyName === "transform")
        element.setAttribute(
          "data-slide-start",
          getComputedStyle(element).transform,
        );
    });
    element.addEventListener("transitionend", (event) => {
      if ((event as TransitionEvent).propertyName === "transform")
        element.setAttribute(
          "data-slide-end",
          getComputedStyle(element).transform,
        );
    });
  });
  await graph.locator('input[value="intermittent"] + span').dblclick();
  await expect(ring).toHaveAttribute("data-slide-end", /matrix/);
  expect(await ring.getAttribute("data-slide-start")).not.toBe(
    await ring.getAttribute("data-slide-end"),
  );
  expect(
    await original!.evaluate(
      (element) =>
        element === document.querySelector(".investigation-spotlight-circle"),
    ),
  ).toBe(true);
  const nextId = await ring.getAttribute("data-node-id");
  await ring.evaluate((element) => element.removeAttribute("data-slide-end"));
  await graph.locator(".flowchart-node.is-proposed button").first().click();
  await expect(ring).not.toHaveAttribute("data-node-id", nextId!);
  await expect(ring).toHaveAttribute("data-slide-end", /matrix/);
  await expect(ring).toHaveCount(1);
  await expect
    .poll(async () => {
      const circle = (await ring.boundingBox())!;
      const question = (await graph
        .locator(".flowchart-node.is-spotlight button")
        .boundingBox())!;
      return (
        Math.abs(
          circle.x + circle.width / 2 - question.x - question.width / 2,
        ) < 1 &&
        Math.abs(
          circle.y + circle.height / 2 - question.y - question.height / 2,
        ) < 1
      );
    })
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ring).toHaveCSS("transition-duration", "0s");
  await graph.getByRole("button", { name: "Focus current question" }).click();
  await expect(ring).toHaveAttribute("data-node-id", nextId!);
});

test("chat routes another node and preserves the confirmed conversation on reload", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const graph = await openInvestigation(page);
  const input = graph.getByLabel("Talk through what you're seeing");
  await input.fill("It is intermittent");
  await graph.getByRole("button", { name: "Send message" }).click();
  await expect(graph.locator(".conversation-reply")).toContainText("confirm");
  await graph.getByRole("button", { name: "Confirm answer" }).click();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", new RegExp("pressure"));
  await input.fill("material flux");
  await graph.getByRole("button", { name: "Send message" }).click();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", new RegExp("material"));
  await expect(graph.locator(".flowchart-node.is-spotlight")).toHaveCount(1);
  const confirmation = page.waitForResponse(
    (response) =>
      response.url().endsWith("/conversation") &&
      response.request().method() === "POST",
  );
  await graph.getByRole("button", { name: "Confirm answer" }).click();
  const incident = (await (await confirmation).json()) as Incident;
  expect(incident.investigation?.answers?.at(-1)?.confirmed_value).toBe("flux");
  await graph.getByRole("button", { name: "Conversation history" }).click();
  await expect(graph.getByRole("log")).toContainText("material flux");
  await expect
    .poll(async () => {
      const question = await graph
        .locator(".flowchart-node.is-spotlight")
        .boundingBox();
      const composer = await graph
        .locator(".investigation-conversation")
        .boundingBox();
      return (
        !!question && !!composer && question.y + question.height <= composer.y
      );
    })
    .toBe(true);
  await graph.screenshot({
    path: testInfo.outputPath("conversation-desktop.png"),
  });
  await page.reload();
  await graph.getByRole("button", { name: "Conversation history" }).click();
  await expect(graph.getByRole("log")).toContainText("material flux");
  await page.setViewportSize({ width: 375, height: 844 });
  await graph.getByRole("button", { name: "Conversation history" }).click();
  const composer = graph.locator(".investigation-conversation");
  await expect(composer).toBeVisible();
  expect(
    await composer.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await graph.screenshot({
    path: testInfo.outputPath("conversation-mobile.png"),
  });
});

test("hands-free sends only committed speech, accepts spoken confirmation and closes the microphone session", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  // Feed the SDK's real microphone/worklet path with a controllable audio signal.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const context = new AudioContext();
        const tone = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0;
        const output = context.createMediaStreamDestination();
        tone.connect(gain).connect(output);
        tone.start();
        await context.resume();
        Object.assign(window, {
          setMicrophoneVolume: (value: number) => {
            gain.gain.value = value;
          },
          microphoneTrack: output.stream.getAudioTracks()[0],
        });
        return output.stream;
      },
    });
  });
  await page.route("**/voice-token", (route) =>
    route.fulfill({ json: { token: "test-single-use" } }),
  );
  let emit: ((text: string, kind?: string) => void) | undefined;
  let closed = false;
  await page.routeWebSocket("wss://api.elevenlabs.io/**", (socket) => {
    socket.send(
      JSON.stringify({
        message_type: "session_started",
        session_id: "test-session",
        config: {},
      }),
    );
    emit = (text, kind = "committed_transcript") =>
      socket.send(JSON.stringify({ message_type: kind, text }));
    socket.onClose(() => {
      closed = true;
    });
  });
  const graph = await openInvestigation(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/conversation"))
      requests.push(request.postDataJSON().text);
  });
  await graph.getByRole("switch", { name: "Hands-free" }).click();
  await expect(graph.locator(".conversation-status")).toContainText(
    "Listening · pauses",
  );
  emit!("It is intermittent", "partial_transcript");
  await expect(graph.locator(".voice-message-transcript")).toContainText(
    "intermittent",
  );
  const voice = graph.locator(".investigation-conversation.is-voice");
  await expect(voice.getByText("Voice message", { exact: true })).toBeVisible();
  await expect(voice.locator(".voice-waveform > span")).toHaveCount(28);
  await expect(voice).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const averageScale = () =>
    voice
      .locator(".voice-waveform > span")
      .evaluateAll(
        (bars) =>
          bars.reduce(
            (sum, bar) =>
              sum + new DOMMatrix(getComputedStyle(bar).transform).m22,
            0,
          ) / bars.length,
      );
  await expect.poll(averageScale).toBeLessThan(0.16);
  await page.evaluate(() =>
    (
      window as unknown as { setMicrophoneVolume: (value: number) => void }
    ).setMicrophoneVolume(0.7),
  );
  await expect.poll(averageScale).toBeGreaterThan(0.6);
  await page.evaluate(() =>
    (
      window as unknown as { setMicrophoneVolume: (value: number) => void }
    ).setMicrophoneVolume(0.003),
  );
  await expect.poll(averageScale).toBeGreaterThan(0.18);
  await expect.poll(averageScale).toBeLessThan(0.35);
  await page.evaluate(() =>
    (
      window as unknown as { setMicrophoneVolume: (value: number) => void }
    ).setMicrophoneVolume(0),
  );
  await expect.poll(averageScale).toBeLessThan(0.16);
  await expect(voice.locator("time")).not.toHaveText("0:00");
  await expect(
    voice.getByRole("button", { name: "Stop voice input" }),
  ).toContainText("Tap to stop");
  await voice.screenshot({
    path: testInfo.outputPath("voice-card-desktop.png"),
  });
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await voice.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(
    voice.getByRole("button", { name: "Stop voice input" }),
  ).toBeInViewport();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(voice.locator(".voice-waveform > span").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await voice.screenshot({
    path: testInfo.outputPath("voice-card-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  expect(requests).toHaveLength(0);
  emit!("It is intermittent");
  await expect(graph.locator(".conversation-reply")).toContainText(
    "Say ‘confirm’",
  );
  emit!("Confirm my answer.");
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", new RegExp("pressure"));
  expect(requests).toEqual(["It is intermittent", "Confirm my answer."]);
  emit!("Stop listening.");
  await expect.poll(() => closed).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { microphoneTrack: MediaStreamTrack })
            .microphoneTrack.readyState,
      ),
    )
    .toBe("ended");
  await expect(graph.locator(".conversation-status")).toContainText("paused");
});

test("voice card sends the live dictated text and keeps its voice provenance", async ({
  page,
}) => {
  await page.route("**/voice-token", (route) =>
    route.fulfill({ json: { token: "test-single-use" } }),
  );
  let emit: ((text: string) => void) | undefined;
  await page.routeWebSocket("wss://api.elevenlabs.io/**", (socket) => {
    socket.send(
      JSON.stringify({
        message_type: "session_started",
        session_id: "dictation",
        config: {},
      }),
    );
    emit = (text) =>
      socket.send(JSON.stringify({ message_type: "partial_transcript", text }));
  });
  const graph = await openInvestigation(page);
  await graph.getByRole("button", { name: "Start voice input" }).click();
  await expect(graph.locator(".voice-message-time")).toContainText("Listening");
  emit!("sudden");
  await expect(graph.locator(".voice-message-transcript")).toHaveText("sudden");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/conversation") &&
      response.request().method() === "POST",
  );
  await graph.getByRole("button", { name: "Send voice message" }).click();
  const incident = (await (await saved).json()) as Incident;
  expect(incident.conversation?.at(-1)?.text).toBe("sudden");
  expect(incident.conversation?.at(-1)?.input_mode).toBe("voice");
  await expect(graph.locator(".investigation-conversation")).not.toHaveClass(
    /is-voice/,
  );
  await expect(graph.getByLabel("Talk through what you're seeing")).toHaveValue(
    "",
  );
});

test("voice commands send dictation, wait through analysis, cancel and confirm without clicking", async ({
  page,
}) => {
  await page.route("**/voice-token", (route) =>
    route.fulfill({ json: { token: "test-single-use" } }),
  );
  let emit: ((text: string) => void) | undefined;
  let closed = false;
  await page.routeWebSocket("wss://api.elevenlabs.io/**", (socket) => {
    socket.send(
      JSON.stringify({
        message_type: "session_started",
        session_id: "voice-commands",
        config: {},
      }),
    );
    emit = (text) =>
      socket.send(
        JSON.stringify({ message_type: "committed_transcript", text }),
      );
    socket.onClose(() => {
      closed = true;
    });
  });
  let job: IncidentJob | null = null;
  let jobPolls = 0;
  await page.route("**/api/incident-jobs/status", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route("**/api/incidents/*/jobs", (route) => {
    if (job) jobPolls++;
    return route.fulfill({ json: job ? [job] : [] });
  });
  const requests: string[] = [];
  await page.route("**/conversation", async (route) => {
    requests.push(route.request().postDataJSON().text);
    const response = await route.fetch();
    const updated: Incident = await response.json();
    if (requests.length === 1) {
      job = {
        id: "voice-analysis-job",
        incident_id: updated.id,
        input_fingerprint: "voice-test",
        source_revision: updated.revision,
        kind: "analysis",
        state: "running",
        attempts: 1,
        max_attempts: 3,
        created_at: "2026-10-03T00:00:00+00:00",
        updated_at: "2026-10-03T00:00:00+00:00",
        lease_until: null,
        worker_token: null,
        error: null,
      };
    }
    await route.fulfill({ response });
  });
  const graph = await openInvestigation(page);
  await graph.getByRole("button", { name: "Start voice input" }).click();
  await expect(graph.locator(".voice-message-time")).toContainText("Listening");
  emit!("intermittent");
  await expect(graph.locator(".voice-message-transcript")).toHaveText(
    "intermittent",
  );
  expect(requests).toHaveLength(0);
  emit!("Send my message.");
  await expect(
    graph.locator('.investigation-progress[data-mode="updating"]'),
  ).toBeVisible();
  emit!("Cancel my answer.");
  await expect.poll(() => jobPolls).toBeGreaterThan(1);
  expect(requests).toEqual(["intermittent"]);
  expect(closed).toBe(false);
  await expect(graph.locator(".voice-message-time")).toContainText("Listening");
  job = null;
  await expect(graph.locator(".conversation-reply")).toContainText("Discarded");
  emit!("sudden");
  await expect(graph.locator(".voice-message-transcript")).toHaveText("sudden");
  emit!("Send message.");
  await expect(graph.locator(".conversation-reply")).toContainText(
    "Say ‘confirm’",
  );
  const confirmed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/conversation") &&
      response.request().method() === "POST",
  );
  emit!("Yes, confirm.");
  const recorded: Incident = await (await confirmed).json();
  expect(recorded.conversation?.at(-1)?.status).toBe("recorded");
  expect(recorded.investigation?.answers.at(-1)?.confirmed_value).toBe(
    "sudden",
  );
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", /material/);
  expect(requests).toEqual([
    "intermittent",
    "Cancel my answer.",
    "sudden",
    "Yes, confirm.",
  ]);
  expect(closed).toBe(false);
  emit!("Stop listening.");
  await expect.poll(() => closed).toBe(true);
  await expect(graph.getByLabel("Talk through what you're seeing")).toHaveValue(
    "",
  );
});

test("voice setup failures retain typed input and allow text troubleshooting", async ({
  page,
}) => {
  await page.route("**/voice-token", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Voice is not configured." },
    }),
  );
  const graph = await openInvestigation(page);
  const input = graph.getByLabel("Talk through what you're seeing");
  await input.fill("sudden");
  await graph.getByRole("button", { name: "Start voice input" }).click();
  await expect(graph.getByRole("alert")).toContainText(
    "Voice is not configured",
  );
  await expect(input).toHaveValue("sudden");
  await graph.getByRole("button", { name: "Send message" }).click();
  await expect(
    graph.getByRole("button", { name: "Confirm answer" }),
  ).toBeVisible();
});
