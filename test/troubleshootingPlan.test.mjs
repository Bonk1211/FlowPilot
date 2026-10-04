import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  handoffEmailBody,
  handoffEmailFile,
  observationApplicability,
} from "../apps/web/src/incidents/handoffDocument.ts";
import {
  buildTroubleshootingMap,
  investigationFlowchart,
  troubleshootingHandoff,
  troubleshootingSvg,
} from "../apps/web/src/incidents/troubleshootingPlan.ts";

function incident() {
  return {
    id: "INC-map",
    revision: 4,
    symptom: 'Low coverage <script>alert("x")</script>',
    configuration: "S932",
    mode: "replay",
    evidence: [{ id: "trace", status: "collected" }],
    observations: [],
    investigation: {
      nodes: Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        prompt: `Question ${i}`,
        status: "answered",
        choices: [],
      })),
      answers: Array.from({ length: 6 }, (_, i) => ({
        id: `a${i}`,
        node_id: `q${i}`,
        status: "confirmed",
        confirmed_value: `Response ${i}`,
        notes: "",
        recorded_at: "2026-10-03",
      })),
    },
    assessment: {
      hypotheses: [
        {
          id: "a",
          rank: 1,
          title: "Delivery",
          status: "possible",
          mechanism: "Supply variation",
          component_ids: ["bottle", "pickup"],
        },
        {
          id: "b",
          rank: 2,
          title: "Restriction",
          status: "possible",
          mechanism: "Path restriction",
          component_ids: ["pickup", "nozzle"],
        },
      ],
      next_step: { id: "check-a" },
      sources: [],
      unresolved: ["No confirmed cause"],
      checks: ["a", "b"].map((id) => ({
        id: `check-${id}`,
        title: `Compare ${id}`,
        hypothesis_id: id,
        eligible: true,
        purpose: "Distinguish two possibilities",
        method: "Review records",
        measured_response: "Coverage",
        source_refs: ["source"],
        prerequisites: ["Matched records"],
        stopping_conditions: ["Incomparable records"],
        blocked_reason: "No equipment method supplied",
        expected_outcomes: [
          { value: "supported", interpretation: "Raises candidate for review" },
          { value: "inconclusive", interpretation: "Keep possibilities open" },
        ],
        mini_experiment: {
          factor: "Condition",
          baseline: "Known-good",
          comparison: "Suspect",
          held_constant: ["Recipe"],
          repeat_plan: "Second independent matched pair",
        },
      })),
    },
  };
}

test("map folds responses left and right, converges shared components and separates outcomes", () => {
  const value = incident();
  const map = buildTroubleshootingMap(value);
  const card = (id) => map.cards.find((card) => card.id === id);
  assert.equal(map.cards[0].id, "investigation-start");
  assert.deepEqual(
    map.links
      .filter((link) => link.from === "investigation-start")
      .map((link) => link.to),
    ["branch-hardware", "branch-software"],
  );
  assert.equal(card("branch-hardware").y, card("branch-software").y);
  assert.ok(card("branch-hardware").y < card("a0").y);
  assert.ok(card("a0").x < card("a1").x);
  assert.ok(card("a3").x > card("a4").x);
  assert.ok(card("shared-area").body[0].includes("pickup"));
  assert.ok(!card("shared-area").body[0].includes("nozzle"));
  assert.equal(map.links.filter((link) => link.to === "shared-area").length, 2);
  assert.ok(card("unknown-check-a").x < card("test-check-a").x);
  assert.ok(card("supports-check-a").x > card("test-check-a").x);
  assert.ok(
    map.links.some(
      (link) => link.from === "comparison-gate" && link.to === "handoff",
    ),
  );
  for (const [index, a] of map.cards.entries())
    for (const b of map.cards.slice(index + 1)) {
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
        `${a.id} overlaps ${b.id}`,
      );
    }
});

test("corrected answers, invalid evidence and physical results cannot appear as current test results", () => {
  const value = incident();
  value.investigation.answers[0].observation_id = "old";
  value.investigation.answers.push({
    ...value.investigation.answers[0],
    id: "new-answer",
    supersedes_id: "a0",
    observation_id: "new",
  });
  value.investigation.nodes[1].status = "superseded";
  value.observations = [
    {
      id: "old",
      check_id: "check-a",
      result: "supported",
      synthetic: true,
      evidence_ids: ["trace"],
    },
    {
      id: "physical",
      check_id: "check-b",
      result: "supported",
      synthetic: false,
      evidence_ids: ["trace"],
    },
  ];
  let map = buildTroubleshootingMap(value);
  assert.ok(!map.cards.some((card) => card.id === "a0" || card.id === "a1"));
  assert.ok(
    map.cards
      .filter((card) => card.tone === "test")
      .every((card) => card.label.includes("not run")),
  );
  value.observations.push({
    id: "valid",
    check_id: "check-a",
    result: "contradicted",
    synthetic: true,
    evidence_ids: ["trace"],
  });
  map = buildTroubleshootingMap(value);
  assert.ok(
    map.cards
      .find((card) => card.id === "test-check-a")
      .label.includes("recorded: contradicted"),
  );
  value.evidence.push({
    id: "new-trace",
    status: "collected",
    supersedes_id: "trace",
  });
  assert.ok(
    buildTroubleshootingMap(value)
      .cards.find((card) => card.id === "test-check-a")
      .label.includes("not run"),
  );
});

test("export is self-contained, escapes supplied text, retains controls, sources and revision", () => {
  const value = incident();
  const map = buildTroubleshootingMap(value);
  const svg = troubleshootingSvg(map);
  const html = troubleshootingHandoff(value, map);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(html.includes("INC-map · r4"));
  assert.ok(html.includes("Second independent matched pair"));
  assert.ok(html.includes("Source references:"));
  assert.ok(html.includes("Hold constant"));
  assert.ok(html.includes("<li>Recipe</li>"));
  assert.ok(!html.includes('src="http'));
  assert.equal(
    (html.match(/class="portrait-flow"/g) ?? []).length,
    map.pages.length,
  );
  for (const card of map.cards)
    assert.ok(html.includes(`id="flow-${card.id}"`));
  for (const link of map.links)
    assert.ok(html.includes(`href="#flow-${link.to}"`));
  assert.ok(html.includes("Evidence informs this hypothesis"));
  assert.ok(html.includes("A/B comparison design · suggested procedure"));
});

test("legacy snapshots and unavailable checks remain readable without invented tests", () => {
  const value = incident();
  value.investigation = {};
  value.observations = undefined;
  value.assessment.checks.forEach((check) => {
    delete check.mini_experiment;
    check.eligible = false;
  });
  const map = buildTroubleshootingMap(value);
  assert.equal(map.checks.length, 0);
  assert.ok(map.cards.some((card) => card.id === "handoff"));
});

test("compact report flow follows the summary, retains every node and edge, and paginates long histories", () => {
  const value = incident();
  const map = buildTroubleshootingMap(value);
  const html = troubleshootingHandoff(value, map);
  assert.ok(
    html.indexOf('class="report-cover"') <
      html.indexOf('class="investigation-overview"'),
  );
  assert.ok(
    html.indexOf('class="investigation-overview"') <
      html.indexOf("<h1>Current assessment</h1>"),
  );
  for (const [id, kind] of [
    ["investigation-start", "terminal"],
    ["handoff", "terminal"],
    ["comparison-gate", "decision"],
    ["a0", "input"],
    ["test-check-a", "procedure"],
    ["hypothesis-a", "process"],
  ])
    assert.ok(
      html.includes(`data-overview-card="${id}" data-node-kind="${kind}"`),
    );
  assert.ok(html.includes('aria-label="Flowchart symbols"'));
  assert.ok(html.includes("Yes / comparable"));
  assert.ok(html.includes("No / unclear"));
  value.investigation.nodes = Array.from({ length: 60 }, (_, i) => ({
    id: `long-${i}`,
    prompt: `Recorded question ${i}`,
    why: "Establish the conditions before selecting a comparison",
    status: "pending",
    choices: [],
  }));
  const longMap = buildTroubleshootingMap(value);
  const chart = investigationFlowchart(longMap);
  for (const card of longMap.cards) {
    assert.equal(chart.split(`data-overview-card="${card.id}"`).length - 1, 1);
    assert.ok(chart.includes(`href="#flow-${card.id}"`));
  }
  for (const link of longMap.links)
    assert.ok(
      chart.includes(
        `data-overview-from="${link.from}" data-overview-to="${link.to}"`,
      ),
    );
  assert.ok(chart.includes('data-flow-sheet="2"'));
  assert.ok(chart.includes("Cross-chart connectors:"));
  for (const match of chart.matchAll(/viewBox="0 [\d.]+ 704 ([\d.]+)"/g))
    assert.ok(
      Number(match[1]) <= 832,
      "Each sheet fits the A4 print area at readable type size",
    );
});

test("complete handoff preserves edits, distinguishes performed and unrun experiments, and attaches the escaped report to a Unicode email draft", () => {
  const value = incident();
  value.handoff = {
    subject: "工程师交接 — ".repeat(15),
    body: "Human edit: 保留样品 <script>alert('bad')</script>",
    version: 2,
    source_revision: 3,
    human_edited: true,
  };
  const condition = {
    index: 1,
    hypothesis_id: "a",
    repetition: 0,
    baseline: true,
    parameters: { severity: 0.5, delivery_ratio: 1, material_ratio: 1 },
  };
  const plan = {
    id: "DOE-completed",
    status: "completed",
    revision: 3,
    plan_revision: 1,
    source_incident_revision: 2,
    source_current: false,
    proposal: {
      check_id: "check-a",
      response: "relative_mass",
      factors: [{ name: "severity", levels: [0.2, 0.5] }],
      controls: condition.parameters,
      repetitions: 1,
    },
    matrix: [condition],
    results: [{ condition, response_mean: 0.8, contrast_from_baseline: -0.2 }],
    analysis: {
      outcome: "inconclusive",
      summary: "No cause confirmed.",
      effects: [],
      limitations: ["Synthetic only"],
    },
    source_passage: {},
    history: [],
    prerequisites: [],
    stopping_conditions: [],
  };
  const experiments = [
    plan,
    {
      ...plan,
      id: "DOE-unrun",
      status: "approved",
      results: [],
      analysis: null,
      source_current: true,
    },
    {
      ...plan,
      id: "DOE-partial",
      status: "withdrawn",
      matrix: [condition, { ...condition, index: 2 }],
    },
  ];
  value.investigation.answers.push({
    ...value.investigation.answers[0],
    id: "replacement",
    supersedes_id: "a0",
    text: "Corrected response",
    confirmed_value: "New value",
  });
  value.observations = [
    {
      id: "old-observation",
      notes: "Original replay result",
      recorded_at: "2026-10-04",
      evidence_ids: ["trace"],
      result: "supported",
      check_id: "check-a",
      synthetic: true,
    },
    {
      id: "new-observation",
      notes: "Corrected replay result",
      recorded_at: "2026-10-04",
      supersedes_id: "old-observation",
      evidence_ids: ["trace"],
      result: "inconclusive",
      check_id: "check-a",
      synthetic: true,
    },
  ];
  assert.match(
    observationApplicability(value, "old-observation"),
    /Historical · corrected/,
  );
  const map = buildTroubleshootingMap(value, experiments);
  assert.match(
    map.cards
      .find((card) => card.id === "experiment-DOE-completed")
      .body.join(" "),
    /1\/1 runs recorded · stale source/,
  );
  assert.match(
    map.cards.find((card) => card.id === "experiment-DOE-unrun").body.join(" "),
    /not run/,
  );
  assert.match(
    map.cards
      .find((card) => card.id === "experiment-DOE-partial")
      .body.join(" "),
    /partial results/,
  );
  const html = troubleshootingHandoff(value, map, experiments);
  assert.ok(
    html.includes(
      'data-overview-card="experiment-DOE-completed" data-node-kind="document"',
    ),
  );
  for (const expected of [
    "Technical assessment report",
    "Complete assessment response record",
    "Historical / superseded",
    "0.800000",
    "-0.200000",
    "stale source",
    "Current recorded observation",
    "Historical · corrected",
  ])
    assert.ok(html.includes(expected), expected);
  assert.ok(!html.includes("<script>"));
  for (const excluded of [
    "Drafted email",
    "Human edit:",
    "Communication status",
    "Application audit",
    "Investigation conversation",
  ])
    assert.ok(!html.includes(excluded), excluded);
  const charts = [
    ...html.matchAll(/<figure class="experiment-chart"[^>]*>(.*?)<\/figure>/gs),
  ].map((match) => match[1]);
  assert.equal(charts.length, 3);
  assert.match(charts[0], /data-contrast="-0.2"/);
  assert.match(
    charts[0],
    /class="contrast-bar negative" style="left:0%;width:50%"/,
  );
  assert.match(charts[1], /class="contrast-unrun">Not run/);
  assert.ok(!charts[1].includes('class="contrast-bar'));
  assert.match(charts[2], /partial results/);
  assert.match(charts[2], /data-run="2"><span>/);
  const positivePlan = {
    ...plan,
    results: [{ condition, response_mean: 1.2, contrast_from_baseline: 0.2 }],
  };
  const positiveHtml = troubleshootingHandoff(value, map, [positivePlan]);
  assert.match(
    positiveHtml,
    /class="contrast-bar positive" style="left:50%;width:50%"/,
  );
  assert.ok(positiveHtml.includes("+0.200000"));
  positivePlan.results[0].contrast_from_baseline = 0;
  assert.ok(
    troubleshootingHandoff(value, map, [positivePlan]).includes(
      'class="contrast-zero"',
    ),
  );
  const eml = handoffEmailFile(value, experiments, html);
  const parsed = spawnSync(
    "python3",
    [
      "-c",
      "import sys,json,email.policy; from email.parser import BytesParser; m=BytesParser(policy=email.policy.default).parsebytes(sys.stdin.buffer.read()); print(json.dumps({'subject':str(m['Subject']),'draft':m['X-Unsent'],'to':m['To'],'body':m.get_body(('plain',)).get_content(),'html':next(m.iter_attachments()).get_content(),'filename':next(m.iter_attachments()).get_filename()}))",
    ],
    { input: eml, encoding: "utf8" },
  );
  assert.equal(parsed.status, 0, parsed.stderr);
  const mail = JSON.parse(parsed.stdout);
  assert.equal(mail.subject, value.handoff.subject);
  assert.equal(mail.draft, "1");
  assert.equal(mail.to, null);
  assert.equal(mail.body, handoffEmailBody(value, experiments));
  assert.ok(mail.body.includes(value.handoff.body));
  assert.ok(mail.body.includes("predates"));
  assert.equal(mail.html, html);
  assert.equal(mail.filename, "INC-map-r4-handoff.html");
});
