import type {
  DiagnosticAssessment,
  Incident,
  IncidentExperiment,
} from "@flowpilot/contracts";

import {
  escapeMarkup,
  experimentStatus,
  assessmentCover,
  assessmentRecords,
  comparisonDiagram,
  observationApplicability,
} from "./handoffDocument.ts";
export { escapeMarkup } from "./handoffDocument.ts";

type Check = DiagnosticAssessment["checks"][number];
type Tone = "response" | "hypothesis" | "scope" | "test" | "review";
export type MapCard = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  title: string;
  body: string[];
  tone: Tone;
};
type MapLink = {
  from: string;
  to: string;
  path: string;
  label?: string;
  x?: number;
  y?: number;
};
export type MapPage = {
  title: string;
  top: number;
  height: number;
  check?: Check;
};
export type TroubleshootingMap = {
  cards: MapCard[];
  links: MapLink[];
  pages: MapPage[];
  width: number;
  height: number;
  checks: Check[];
};

const width = 1160;
const columns = [40, 430, 820];
const cardWidth = 300;
const colors: Record<Tone, [string, string]> = {
  response: ["#edf8f4", "#236653"],
  hypothesis: ["#f4f1fb", "#68539b"],
  scope: ["#edf4fa", "#335d83"],
  test: ["#ffffff", "#236653"],
  review: ["#fff7e9", "#8b641e"],
};

export function wrapMapText(text: string, limit = 36): string[] {
  const lines: string[] = [];
  let line = "";
  // Split long identifiers as well as prose, without dropping any characters.
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line);
      line = "";
    }
    let rest = word;
    while (rest.length > limit) {
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    line = line ? `${line} ${rest}` : rest;
  }
  if (line) lines.push(line);
  return lines;
}

export function currentMapAnswers(incident: Incident) {
  const graph = incident.investigation;
  const replaced = new Set(
    graph?.answers?.map((answer) => answer.supersedes_id),
  );
  return (graph?.answers ?? []).flatMap((answer) => {
    const node = graph?.nodes?.find(
      (node) => node.id === answer.node_id && node.status !== "superseded",
    );
    return node && !replaced.has(answer.id) ? [{ node, answer }] : [];
  });
}

function resultFor(incident: Incident, check: Check) {
  const answers = currentMapAnswers(incident);
  const currentIds = new Set(answers.map(({ answer }) => answer.id));
  const excluded = new Set(
    (incident.investigation?.answers ?? [])
      .filter((answer) => !currentIds.has(answer.id))
      .map((answer) => answer.observation_id),
  );
  const replaced = new Set(
    (incident.observations ?? []).map((item) => item.supersedes_id),
  );
  const replacedEvidence = new Set(
    (incident.evidence ?? []).map((item) => item.supersedes_id),
  );
  const evidence = new Set(
    (incident.evidence ?? [])
      .filter(
        (item) => !replacedEvidence.has(item.id) && item.status === "collected",
      )
      .map((item) => item.id),
  );
  return [...(incident.observations ?? [])]
    .reverse()
    .find(
      (item) =>
        item.check_id === check.id &&
        !excluded.has(item.id) &&
        !replaced.has(item.id) &&
        item.synthetic &&
        check.eligible &&
        (item.evidence_ids ?? []).every((id) => evidence.has(id)) &&
        ["supported", "contradicted", "inconclusive"].includes(item.result),
    );
}

export function buildTroubleshootingMap(
  incident: Incident,
  experiments: IncidentExperiment[] = [],
): TroubleshootingMap {
  const cards: MapCard[] = [];
  const links: MapLink[] = [];
  const pages: MapPage[] = [];
  const assessment = incident.assessment;
  const hypotheses = assessment?.hypotheses ?? [];
  const checks = (assessment?.checks ?? [])
    .filter((check) => check.eligible)
    .sort((a, b) => {
      // Show the useful unperformed check first; retain recorded checks and their results.
      const score = (check: Check) =>
        resultFor(incident, check)
          ? 100
          : check.id === assessment?.next_step.id
            ? -1
            : (hypotheses.find((h) => h.id === check.hypothesis_id)?.rank ??
              99);
      return score(a) - score(b);
    });
  function card(
    id: string,
    column: number,
    y: number,
    label: string,
    title: string,
    body: string[],
    tone: Tone,
  ) {
    const height =
      64 +
      wrapMapText(title, 29).length * 22 +
      body.reduce((sum, text) => sum + wrapMapText(text).length * 19 + 9, 0);
    const value = {
      id,
      x: columns[column],
      y,
      width: cardWidth,
      height,
      label,
      title,
      body,
      tone,
    };
    cards.push(value);
    return value;
  }
  function down(from: MapCard, to: MapCard, label?: string) {
    const sx = from.x + cardWidth / 2;
    const tx = to.x + cardWidth / 2;
    const sy = from.y + from.height;
    const junction = to.y - 38;
    links.push({
      from: from.id,
      to: to.id,
      path: `M ${sx} ${sy} V ${junction} H ${tx} V ${to.y}`,
      label,
      x: tx,
      y: junction - 9,
    });
  }
  function across(from: MapCard, to: MapCard, label?: string) {
    const right = to.x > from.x;
    const sx = from.x + (right ? cardWidth : 0);
    const tx = to.x + (right ? 0 : cardWidth);
    const sy = from.y + from.height / 2;
    const ty = to.y + to.height / 2;
    const mid = (sx + tx) / 2;
    links.push({
      from: from.id,
      to: to.id,
      path: `M ${sx} ${sy} H ${mid} V ${ty} H ${tx}`,
      label,
      x: mid,
      y: Math.min(sy, ty) - 12,
    });
  }
  let y = 50;
  const answers = currentMapAnswers(incident);
  const start = card(
    "investigation-start",
    1,
    y,
    "START INVESTIGATION",
    incident.symptom,
    [
      "Start with two possibilities: hardware and software. Narrow each with evidence.",
    ],
    "scope",
  );
  y += start.height + 100;
  const branchCards = ["hardware", "software"].map((branch, index) => {
    const responses = answers.filter(
      ({ node }) => (node.branch ?? "hardware") === branch,
    );
    const item = card(
      `branch-${branch}`,
      index * 2,
      y,
      "OPEN POSSIBILITY",
      branch === "hardware" ? "Hardware" : "Software",
      [
        branch === "hardware"
          ? "Physical components, fluid delivery, restrictions and material conditions."
          : "Recipe and parameter changes, controller errors and sequence interruptions.",
        `${responses.length} current responses. Confirmed observations guide this branch; they do not confirm a cause.`,
      ],
      "hypothesis",
    );
    down(start, item);
    return item;
  });
  y = Math.max(...branchCards.map((item) => item.y + item.height)) + 100;
  let previous: MapCard = card(
    "branch-evidence",
    1,
    y,
    "NARROW WITH EVIDENCE",
    "Compare both possibilities",
    [
      "Use the recorded responses, matched samples and timing below. Keep either branch open when evidence is missing or inconclusive.",
    ],
    "scope",
  );
  for (const branch of branchCards) down(branch, previous);
  pages.push({
    title: "Start with hardware and software",
    top: 34,
    height: previous.y + previous.height - 18,
  });
  y += previous.height + 100;
  // Alternate reading direction by row, keeping response history compact for handoff.
  for (let row = 0; row * 3 < answers.length; row++) {
    const rowCards = answers
      .slice(row * 3, row * 3 + 3)
      .map(({ node, answer }, index) => {
        const column = row % 2 === 0 ? index : 2 - index;
        const item = card(
          answer.id,
          column,
          y,
          `Q${row * 3 + index + 1} · ${node.branch ?? "hardware"} · ${answer.status}`,
          node.prompt,
          [
            answer.status === "confirmed"
              ? (node.choices?.find(
                  (choice) =>
                    choice.value === (answer.confirmed_value ?? answer.choice),
                )?.label ??
                answer.confirmed_value ??
                answer.text)
              : answer.status === "unknown"
                ? "The requested information remains unknown."
                : "Response awaiting clarification or confirmation.",
            ...(answer.text ? [`Original: ${answer.text.slice(0, 180)}`] : []),
            ...(answer.notes ? [`Notes: ${answer.notes.slice(0, 180)}`] : []),
          ],
          "response",
        );
        if (previous) {
          if (previous.y === y) across(previous, item);
          else down(previous, item);
        }
        previous = item;
        return item;
      });
    const bottom = Math.max(...rowCards.map((item) => item.y + item.height));
    pages.push({
      title: `Recorded responses · ${row * 3 + 1}–${row * 3 + rowCards.length}`,
      top: y - 16,
      height: bottom - y + 32,
    });
    y = bottom + 100;
  }
  const work = [
    ...(incident.investigation?.answers ?? [])
      .filter(
        (answer) => !answers.some((current) => current.answer.id === answer.id),
      )
      .map((answer) => ({
        id: `historical-${answer.id}`,
        label: "Historical response · superseded",
        title:
          incident.investigation?.nodes?.find(
            (node) => node.id === answer.node_id,
          )?.prompt ?? answer.node_id,
        body: [
          answer.text ||
            answer.confirmed_value ||
            answer.choice ||
            "No response text",
          `Record: ${answer.id}`,
          "Retained for history; excluded from current assessment inputs.",
        ],
      })),
    ...(incident.investigation?.nodes ?? [])
      .filter(
        (node) =>
          !(incident.investigation?.answers ?? []).some(
            (answer) => answer.node_id === node.id,
          ),
      )
      .map((node) => ({
        id: `question-${node.id}`,
        label: `${node.branch ?? "hardware"} · unanswered · ${node.status}`,
        title: node.prompt,
        body: [
          node.blocked_reason ?? node.why,
          `Parent response: ${node.parent_answer_id ?? "Root question"}`,
        ],
      })),
    ...(incident.assessment_history ?? []).map((snapshot) => ({
      id: `assessment-${snapshot.incident_revision}`,
      label: `Assessment · r${snapshot.incident_revision}`,
      title: snapshot.assessment.summary,
      body: [
        `Recorded: ${snapshot.created_at}`,
        `Next: ${snapshot.assessment.next_step.title}`,
      ],
    })),
    ...(incident.observations ?? []).map((item) => ({
      id: `observation-${item.id}`,
      label: item.synthetic
        ? "Recorded check · simulated"
        : "Reported observation",
      title: `${item.check_id}: ${item.result}`,
      body: [
        `Record: ${item.id}`,
        observationApplicability(incident, item.id),
        `Evidence: ${item.evidence_ids?.join(", ") || "None linked"}`,
        "See the checks register for corrections and current applicability.",
      ],
    })),
    ...(incident.simulations ?? []).map((run) => ({
      id: `simulation-${run.id}`,
      label: "Saved synthetic simulation",
      title: run.scenario,
      body: [
        run.id,
        `Source revision ${run.source_revision}`,
        "Model output only; no physical test performed.",
      ],
    })),
    ...experiments.map((plan) => ({
      id: `experiment-${plan.id}`,
      label: `Mock experiment · ${plan.status}`,
      title: plan.proposal.check_id,
      body: [
        plan.id,
        experimentStatus(plan),
        `Response: ${plan.proposal.response}`,
        plan.analysis?.summary ?? "No result analysis recorded.",
      ],
    })),
  ];
  for (let row = 0; row * 3 < work.length; row++) {
    const top = y - 16;
    const rowCards = work.slice(row * 3, row * 3 + 3).map((entry, index) => {
      const item = card(
        entry.id,
        row % 2 ? 2 - index : index,
        y,
        entry.label,
        entry.title.length > 160
          ? `${entry.title.slice(0, 157)}…`
          : entry.title,
        entry.body.map((text) =>
          text.length > 200 ? `${text.slice(0, 197)}…` : text,
        ),
        "response",
      );
      if (previous) {
        if (previous.y === y) across(previous, item);
        else down(previous, item);
      }
      previous = item;
      return item;
    });
    y = Math.max(...rowCards.map((item) => item.y + item.height)) + 100;
    pages.push({
      title: "Assessment response flow · questions, checks and experiments",
      top,
      height: y - 84 - top,
    });
  }
  const scopeTop = y - 16;
  const summary = card(
    "observed",
    1,
    y,
    "01 · DEFINE THE PROBLEM",
    incident.symptom,
    [
      answers.length
        ? `${answers.length} current responses recorded. Interpretations awaiting confirmation remain open.`
        : "No responses recorded yet. Gather the symptom, location and timing before choosing a comparison.",
    ],
    "scope",
  );
  if (previous) down(previous, summary);
  y += summary.height + 100;
  const candidates = hypotheses.map((hypothesis, index) => {
    const item = card(
      `hypothesis-${hypothesis.id}`,
      index % 3,
      y,
      `P${index + 1} · ${hypothesis.status}`,
      hypothesis.title,
      [hypothesis.mechanism],
      "hypothesis",
    );
    down(summary, item);
    return item;
  });
  y = Math.max(y, ...candidates.map((item) => item.y + item.height)) + 100;
  pages.push({
    title: "Problem and competing fault explanations",
    top: scopeTop,
    height: y - 84 - scopeTop,
  });
  const sharedTop = y - 16;
  const components = [
    ...new Set(hypotheses.flatMap((hypothesis) => hypothesis.component_ids)),
  ].filter(
    (id) =>
      hypotheses.filter((hypothesis) => hypothesis.component_ids.includes(id))
        .length > 1,
  );
  const shared = card(
    "shared-area",
    1,
    y,
    "02 · CONVERGE ON AN AREA",
    components.length
      ? "Shared investigation area"
      : "Compare the remaining explanations",
    [
      components.length
        ? components.map((id) => id.replaceAll("_", " ")).join(" · ")
        : "No shared component is established by the current assessment.",
      "Shared components suggest where to compare evidence. They do not establish a common root cause.",
    ],
    "scope",
  );
  for (const candidate of candidates) down(candidate, shared);
  if (!candidates.length) down(summary, shared);
  const gate = card(
    "comparison-gate",
    1,
    shared.y + shared.height + 90,
    "03 · BEFORE COMPARING",
    "Are A and B comparable?",
    [
      "Match tool, recipe, timing and measurement method. Vary one recorded condition. If those records are missing or confounded, take the inconclusive route to H1.",
    ],
    "review",
  );
  down(shared, gate);
  pages.push({
    title: "Shared investigation area and comparison conditions",
    top: sharedTop,
    height: gate.y + gate.height - sharedTop + 16,
  });
  y = gate.y + gate.height + 100;
  let previousTest = gate;
  const reviewRoutes: MapCard[] = [gate];
  checks.forEach((check, index) => {
    const top = y - 16;
    const plan = check.mini_experiment;
    const result = resultFor(incident, check);
    const test = card(
      `test-${check.id}`,
      1,
      y,
      `T${index + 1} · ${result ? `recorded: ${result.result}` : "suggested / not run"}`,
      check.title,
      plan
        ? [
            `Vary: ${plan.factor}`,
            `A: ${plan.baseline}`,
            `B: ${plan.comparison}`,
            `Hold: ${plan.held_constant.join("; ")}`,
            `Measure: ${check.measured_response}`,
          ]
        : [
            "A/B plan not saved at this revision. Reanalyze to prepare the comparison.",
            check.purpose,
            `Method: ${check.method}`,
            `Measure: ${check.measured_response}`,
          ],
      "test",
    );
    down(
      previousTest,
      test,
      index ? "Conflicts → next comparison" : "Comparable records → compare",
    );
    const supported = check.expected_outcomes.find(
      (item) => item.value === "supported",
    );
    const uncertain = check.expected_outcomes.find(
      (item) => item.value === "inconclusive",
    );
    const positive = card(
      `supports-${check.id}`,
      2,
      y,
      "IF THE SIGNAL IS PRESENT",
      hypotheses.find((h) => h.id === check.hypothesis_id)?.title ??
        check.hypothesis_id,
      [
        supported?.interpretation ?? "Supports this explanation for review.",
        "Continue to H1 with the matched records and remaining alternatives.",
      ],
      "hypothesis",
    );
    const unclear = card(
      `unknown-${check.id}`,
      0,
      y,
      "IF THE RESULT IS UNCLEAR",
      "Keep the possibilities open",
      [
        uncertain?.interpretation ?? "No discriminating result is established.",
        "Missing / conflicting records → H1. State the evidence needed before another comparison.",
      ],
      "review",
    );
    across(test, positive, "Supports");
    across(test, unclear, "Unclear");
    reviewRoutes.push(positive, unclear);
    const bottom = Math.max(
      ...[test, positive, unclear].map((item) => item.y + item.height),
    );
    pages.push({
      title: `T${index + 1} · ${check.title}`,
      top,
      height: bottom - top + 16,
      check,
    });
    y = bottom + 110;
    previousTest = test;
  });
  const handoff = card(
    "handoff",
    1,
    y,
    "H1 · ENGINEER HANDOFF",
    "What is narrowed down — and what remains?",
    [
      incident.closure
        ? `Recorded closure: ${incident.closure.outcome}. ${incident.closure.notes}`
        : "Review the supported area, competing faults, test results and unresolved evidence.",
      "Attach the A/B records, controlled conditions and next owner. Suggested tests remain unperformed until a result is recorded.",
    ],
    "review",
  );
  down(
    previousTest,
    handoff,
    checks.length
      ? "Still unresolved / checks exhausted"
      : "Review missing evidence",
  );
  // Two outside rails merge alternative outcomes without crossing test cards.
  for (const route of reviewRoutes) {
    const left = route.x < handoff.x;
    const outerX = left ? 14 : width - 14;
    const startX = route.x + (left ? 0 : cardWidth);
    const endX = handoff.x + (left ? 0 : cardWidth);
    const middleY = handoff.y + handoff.height / 2;
    links.push({
      from: route.id,
      to: handoff.id,
      path: `M ${startX} ${route.y + route.height / 2} H ${outerX} V ${middleY} H ${endX}`,
    });
  }
  pages.push({
    title: "H1 · Review and handoff",
    top: y - 16,
    height: handoff.height + 32,
  });
  return {
    cards,
    links,
    pages,
    checks,
    width,
    height: y + handoff.height + 40,
  };
}

export function troubleshootingSvg(map: TroubleshootingMap, page?: MapPage) {
  const top = page?.top ?? 0;
  const height = page?.height ?? map.height;
  const arrowId = `map-arrow-${top}`;
  const visibleCards = map.cards.filter(
    (card) => card.y >= top && card.y < top + height,
  );
  const visibleIds = new Set(visibleCards.map((card) => card.id));
  const visibleLinks = map.links.filter(
    (link) => visibleIds.has(link.from) || visibleIds.has(link.to),
  );
  const esc = escapeMarkup;
  const text = (
    lines: string[],
    x: number,
    y: number,
    size: number,
    bold = false,
    color = "#233343",
    lineHeight = 19,
  ) =>
    `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${bold ? 600 : 400}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join("\n")}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${height}" viewBox="0 ${top} ${map.width} ${height}" role="img" aria-label="Troubleshooting response flow and mini DOE" font-family="Arial, sans-serif">
    <title>Troubleshooting response flow and mini DOE</title><desc>Start with hardware and software possibilities, then narrow with recorded evidence. Recorded answers lead to competing fault explanations, a shared investigation area, and suggested A/B comparisons. Supports branches right; inconclusive branches left to H1; conflicting results continue to the next comparison. Full test instructions follow the chart.</desc>
    <defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#74838c"/></marker></defs>
    <rect x="0" y="${top}" width="${map.width}" height="${height}" fill="#fff"/>
    ${visibleLinks.map((link) => `<path d="${link.path}" fill="none" stroke="#74838c" stroke-width="1.5" marker-end="url(#${arrowId})"/>`).join("")}
    ${visibleCards
      .map((card) => {
        const [fill, stroke] = colors[card.tone];
        const title = wrapMapText(card.title, 29);
        let cursor = card.y + 56 + title.length * 22;
        return `<g data-card-id="${esc(card.id)}"><rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        ${text([card.label.toUpperCase()], card.x + 18, card.y + 26, 11, true, stroke)}
        ${text(title, card.x + 18, card.y + 53, 16, true, "#182c37", 22)}
        ${card.body
          .map((paragraph) => {
            const lines = wrapMapText(paragraph);
            const result = text(lines, card.x + 18, cursor, 13);
            cursor += lines.length * 19 + 9;
            return result;
          })
          .join("")}</g>`;
      })
      .join("")}
    ${visibleLinks
      .filter((link) => link.label && link.y! >= top && link.y! < top + height)
      .map(
        (link) =>
          `<g><rect x="${link.x! - link.label!.length * 3.1 - 6}" y="${link.y! - 13}" width="${link.label!.length * 6.2 + 12}" height="19" rx="4" fill="#fff"/><text x="${link.x}" y="${link.y}" text-anchor="middle" font-size="11" fill="#445661">${esc(link.label!)}</text></g>`,
      )
      .join("")}
  </svg>`;
}

const flowSymbolLabels = {
  terminal: "Start / handoff",
  decision: "Decision",
  process: "Action / assessment",
  input: "Question / response",
  document: "Saved record",
  procedure: "Test / procedure",
};

function flowSymbol(card: MapCard): keyof typeof flowSymbolLabels {
  if (card.id === "investigation-start" || card.id === "handoff")
    return "terminal";
  if (card.id === "comparison-gate") return "decision";
  if (card.id.startsWith("question-") || /^Q\d/.test(card.label))
    return "input";
  if (card.tone === "response") return "document";
  if (card.tone === "test") return "procedure";
  return "process";
}

function flowShape(
  kind: keyof typeof flowSymbolLabels,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "white",
  stroke = "#415563",
) {
  const attributes = `data-node-shape="${kind}" fill="${fill}" stroke="${stroke}" stroke-width="1"`;
  const slant = Math.min(14, width / 6);
  if (kind === "decision")
    return `<polygon ${attributes} points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}"/>`;
  if (kind === "input")
    return `<polygon ${attributes} points="${x + slant},${y} ${x + width},${y} ${x + width - slant},${y + height} ${x},${y + height}"/>`;
  if (kind === "document") {
    const wave = Math.min(6, height / 6);
    return `<path ${attributes} d="M ${x} ${y} H ${x + width} V ${y + height - wave} Q ${x + width * 0.75} ${y + height - wave * 2} ${x + width / 2} ${y + height - wave} T ${x} ${y + height - wave} Z"/>`;
  }
  return `<rect ${attributes} x="${x}" y="${y}" width="${width}" height="${height}" rx="${kind === "terminal" ? height / 2 : 0}"/>${kind === "procedure" ? `<path d="M ${x + slant} ${y} V ${y + height} M ${x + width - slant} ${y} V ${y + height}" stroke="${stroke}" fill="none"/>` : ""}`;
}

export function investigationFlowchart(map: TroubleshootingMap) {
  const esc = escapeMarkup;
  const short = (value: string, length = 33) =>
    value.length > length ? `${value.slice(0, length - 1)}…` : value;
  const positions = new Map<string, MapCard & { ref: string; sheet: number }>();
  const sheets: { top: number; height: number }[] = [];
  let y = 16;
  let top = 0;
  // Keep the graph's branch columns and reading order, but replace paragraphs
  // with short labels. Full wording remains in the numbered detail cards.
  for (const originalY of [...new Set(map.cards.map((card) => card.y))].sort(
    (a, b) => a - b,
  )) {
    const row = map.cards
      .filter((card) => card.y === originalY)
      .map((card) => {
        const kind = flowSymbol(card);
        const status = card.id.startsWith("experiment-")
          ? card.body[1]
          : card.id.startsWith("observation-")
            ? card.body[1]
            : /^Q\d/.test(card.label)
              ? card.body[0]
              : "";
        const body = status
          ? wrapMapText(status, kind === "input" ? 30 : 34)
          : [];
        return {
          ...card,
          ref: `F${map.cards.indexOf(card) + 1}`,
          x: 26 + columns.indexOf(card.x) * 232,
          width: 188,
          height:
            kind === "decision"
              ? 80
              : (kind === "document" ? 44 : 38) + body.length * 12,
          body,
          sheet: sheets.length,
        };
      });
    const height = Math.max(...row.map((card) => card.height));
    if (y - top + height > 790 && y > top + 16) {
      sheets.push({ top, height: y - top });
      top = y;
      y += 16;
    }
    for (const card of row)
      positions.set(card.id, { ...card, y, sheet: sheets.length });
    y += height + 16;
  }
  sheets.push({ top, height: y - top });
  const point = (id: string) => positions.get(id)!;
  const side = (card: ReturnType<typeof point>, right: boolean) =>
    card.x +
    (right ? card.width : 0) +
    (flowSymbol(card) === "input" ? (right ? -7 : 7) : 0);
  const path = (
    from: ReturnType<typeof point>,
    to: ReturnType<typeof point>,
  ) => {
    const sx = from.x + from.width / 2;
    const tx = to.x + to.width / 2;
    if (from.y === to.y) {
      const right = to.x > from.x;
      const start = side(from, right);
      const end = side(to, !right);
      return `M ${start} ${from.y + from.height / 2} H ${(start + end) / 2} V ${to.y + to.height / 2} H ${end}`;
    }
    if (to.id === "handoff" && to.y - from.y > from.height + 44) {
      const left = from.x < to.x;
      const rail = left ? 10 : 694;
      return `M ${from.x + (left ? 0 : from.width)} ${from.y + from.height / 2} H ${rail} V ${to.y + to.height / 2} H ${to.x + (left ? 0 : to.width)}`;
    }
    const middle = to.y - 8;
    return `M ${sx} ${from.y + from.height - (flowSymbol(from) === "document" ? 6 : 0)} V ${middle} H ${tx} V ${to.y}`;
  };
  return sheets
    .map((sheet, index) => {
      const marker = `overview-arrow-${index}`;
      const crossSheet = map.links.filter((link) => {
        const from = point(link.from);
        const to = point(link.to);
        return (
          from.sheet !== to.sheet &&
          (from.sheet === index || to.sheet === index)
        );
      });
      return `<section class="investigation-overview" data-flow-sheet="${index + 1}"><header><span>FLOWPILOT / INVESTIGATION MAP</span><span>Chart ${index + 1} of ${sheets.length}</span></header><h1>${index ? "Investigation flowchart · continued" : "Full investigation flowchart"}</h1>
      <p class="overview-key">Follow the arrows from the symptom to review. Short labels use F references to the full flow records. Recorded work and suggested tests retain their status.</p>
      <ul class="flow-symbol-legend" aria-label="Flowchart symbols">${Object.entries(
        flowSymbolLabels,
      )
        .map(
          ([kind, label]) =>
            `<li><svg viewBox="0 0 34 20" aria-hidden="true">${flowShape(kind as keyof typeof flowSymbolLabels, 1, 1, 32, 18)}</svg><span>${label}</span></li>`,
        )
        .join("")}</ul>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${sheet.top} 704 ${sheet.height}" role="img" aria-label="Full investigation flowchart, chart ${index + 1} of ${sheets.length}" font-family="Arial, sans-serif">
      <title>Full investigation flowchart · chart ${index + 1}</title><desc>All investigation nodes and branches, including responses, historical records, recorded checks, experiments, competing hypotheses, suggested comparisons and review. Cross-page routes use matching F references.</desc>
      <defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#61717e"/></marker></defs>
      ${map.links
        .filter(
          (link) =>
            point(link.from).sheet <= index && point(link.to).sheet >= index,
        )
        .map(
          (link) =>
            `<path data-overview-from="${esc(link.from)}" data-overview-to="${esc(link.to)}" d="${path(point(link.from), point(link.to))}" fill="none" stroke="#61717e" stroke-width="1.1" marker-end="url(#${marker})"><title>${esc(`${point(link.from).ref} → ${point(link.to).ref}: ${link.label ?? "Continue"}`)}</title></path>`,
        )
        .join("")}
      ${map.links
        .filter(
          (link) =>
            (link.label ||
              (link.from === "comparison-gate" && link.to === "handoff")) &&
            point(link.from).sheet === index &&
            point(link.to).sheet === index,
        )
        .map((link) => {
          const from = point(link.from);
          const to = point(link.to);
          const gateExit = from.id === "comparison-gate" && to.id === "handoff";
          const across = from.y === to.y;
          const x = gateExit
            ? (from.x + from.width + 694) / 2
            : across
              ? (from.x + to.x + from.width) / 2
              : to.x + to.width / 2 + 45;
          const y = gateExit
            ? from.y + from.height / 2 - 5
            : across
              ? Math.min(from.y + from.height / 2, to.y + to.height / 2) - 5
              : to.y - 4;
          const label = gateExit
            ? "No / unclear"
            : link.label!.startsWith("Comparable")
              ? "Yes / comparable"
              : link.label!.startsWith("Conflicts")
                ? "Conflicts"
                : link.label!.startsWith("Still")
                  ? "Review"
                  : short(link.label!, 12);
          return `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#415563" stroke="white" stroke-width="3" paint-order="stroke">${esc(label)}</text>`;
        })
        .join("")}
      ${[...positions.values()]
        .filter((card) => card.sheet === index)
        .map((card) => {
          const [fill, stroke] = colors[card.tone];
          const kind = flowSymbol(card);
          const inset = ["input", "terminal", "procedure"].includes(kind)
            ? 20
            : 8;
          const center = card.x + card.width / 2;
          const label = card.label
            .replace("IF THE SIGNAL IS PRESENT", "IF SUPPORTED")
            .replace("IF THE RESULT IS UNCLEAR", "IF INCONCLUSIVE")
            .replace("suggested / not run", "not run")
            .replace("recorded: ", "");
          return `<a href="#flow-${esc(card.id)}"><g data-overview-card="${esc(card.id)}" data-node-kind="${kind}"><title>${esc(`${flowSymbolLabels[kind]}: ${card.ref} · ${card.label}: ${card.title}. ${card.body.join(" ")}`)}</title>${flowShape(kind, card.x, card.y, card.width, card.height, fill, stroke)}
          ${
            kind === "decision"
              ? `<text x="${center}" y="${card.y + 30}" text-anchor="middle" font-size="10" font-weight="bold" fill="${stroke}">${card.ref} · Decision</text><text x="${center}" y="${card.y + 44}" text-anchor="middle" font-size="11" font-weight="bold" fill="#203341">Are A and B</text><text x="${center}" y="${card.y + 58}" text-anchor="middle" font-size="11" font-weight="bold" fill="#203341">comparable?</text>`
              : `<text x="${card.x + inset}" y="${card.y + 13}" font-size="10" font-weight="bold" fill="${stroke}">${esc(short(`${card.ref} · ${label}`, inset === 8 ? 33 : 28))}</text>
          <text x="${card.x + inset}" y="${card.y + 29}" font-size="11" font-weight="bold" fill="#203341">${esc(short(card.id === "handoff" ? "Findings & next steps" : card.title, inset === 8 ? 28 : 24))}</text>
          ${card.body.map((line, i) => `<text x="${card.x + inset}" y="${card.y + 43 + i * 12}" font-size="10" fill="#203341">${esc(line)}</text>`).join("")}`
          }
        </g></a>`;
        })
        .join("")}
      </svg><p class="overview-key">${crossSheet.length ? `Cross-chart connectors: ${crossSheet.map((link) => `${point(link.from).ref} (chart ${point(link.from).sheet + 1}) → ${point(link.to).ref} (chart ${point(link.to).sheet + 1})`).join("; ")}.` : "All nodes and branches shown. Simulated results do not establish a physical cause."}</p></section>`;
    })
    .join("");
}

function portraitFlow(map: TroubleshootingMap, page: MapPage) {
  const esc = escapeMarkup;
  const cards = map.cards.filter(
    (card) => card.y >= page.top && card.y < page.top + page.height,
  );
  return `<div class="portrait-flow" aria-label="Assessment response flowchart">${cards
    .map((card) => {
      const [fill, stroke] = colors[card.tone];
      const routes = map.links.filter((link) => link.from === card.id);
      // The A/B diagram already contains the test conditions and interpretations.
      const body = page.check?.mini_experiment
        ? card.id === `test-${page.check.id}`
          ? []
          : card.body.slice(1)
        : card.body;
      return `<article class="flow-card" id="flow-${esc(card.id)}" data-card-id="${esc(card.id)}" style="--flow-fill:${fill};--flow-stroke:${stroke}">
      <p class="flow-label">F${map.cards.indexOf(card) + 1} · ${esc(card.label)}</p>
      <h2>${esc(card.title)}</h2>${body.map((text) => `<p>${esc(text)}</p>`).join("")}
      ${
        routes.length
          ? `<ul class="flow-routes">${routes
              .map((link) => {
                const target = map.cards.find((item) => item.id === link.to)!;
                return `<li><a href="#flow-${esc(target.id)}"><b>${esc(link.label ?? (routes.length > 1 ? "Branch" : "Continue"))} → F${map.cards.indexOf(target) + 1}</b> · ${esc(target.label)}</a></li>`;
              })
              .join("")}</ul>`
          : ""
      }
    </article>`;
    })
    .join("")}</div>`;
}

export function troubleshootingHandoff(
  incident: Incident,
  map: TroubleshootingMap,
  experiments: IncidentExperiment[] = [],
) {
  const esc = escapeMarkup;
  const pages = map.pages
    .map((page, index) => {
      const plan = page.check?.mini_experiment;
      const result = page.check ? resultFor(incident, page.check) : undefined;
      const conflicts = page.check?.expected_outcomes.find(
        (outcome) => outcome.value === "contradicted",
      );
      return `<section class="flow-section"><header><span>FLOWPILOT / ASSESSMENT RESPONSE FLOW</span><span>${esc(incident.id)} · r${incident.revision} · Flow section ${index + 1}/${map.pages.length}</span></header><h1>${esc(page.title)}</h1>${page.check ? comparisonDiagram(page.check) : ""}${portraitFlow(map, page)}
      ${page.check ? `<p><b>If the result conflicts:</b> ${esc(conflicts?.interpretation ?? "Weakens this explanation; keep the alternatives open.")} Continue to the next comparison, or H1 if the checks are exhausted.</p><p><b>Repeat / uncertainty:</b> ${esc(plan?.repeat_plan ?? "Record missing or non-comparable evidence as inconclusive.")}</p>${result ? `<p><b>Recorded replay result:</b> ${esc(result.id)} · ${esc(result.result)} · ${esc(result.recorded_at)}. ${esc(result.notes)} Evidence: ${esc((result.evidence_ids ?? []).join(", ") || "none linked")}.</p>` : ""}<p><b>Prerequisites:</b> ${esc(page.check.prerequisites.join("; "))}</p><p><b>Stop:</b> ${esc(page.check.stopping_conditions.join("; "))}</p><p><b>Source references:</b> ${esc(page.check.source_refs.join(", "))}. ${esc(page.check.blocked_reason)}</p>` : ""}
      <footer>${esc(incident.configuration)} · ${esc(incident.mode)} · Recorded work and suggested comparisons are labelled separately. Synthetic results do not confirm an equipment cause. Review branches continue to H1. ${index < map.pages.length - 1 ? "Continue on the next page." : "End of flow."}</footer></section>`;
    })
    .join("");
  const sources = (incident.assessment?.sources ?? [])
    .map(
      (source) =>
        `<li>${esc(source.id)} — ${esc(source.title)} · ${esc(source.revision)} · ${esc(source.approval_status)}. ${esc(source.limitation)}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(incident.id)} — Technical assessment report</title><style>
    *{box-sizing:border-box}
    body{margin:0;background:#e8edf1;color:#203341;font:10pt/1.5 Arial,sans-serif;counter-reset:report-section}
    section{width:min(210mm,calc(100% - 24px));margin:20px auto;padding:12mm;background:white;box-shadow:0 2px 12px #20334112}
    .report-cover{aspect-ratio:210/297;border-top:4px solid #245b64}
    header{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:8pt;color:#526573;border-bottom:1px solid #cbd5dc;padding-bottom:10px}
    .report-brand{align-items:center;letter-spacing:1px}.report-brand strong{font-size:13pt;letter-spacing:2px;color:#245b64}
    h1{font-size:18pt;line-height:1.25;margin:18px 0;color:#152e3e}h2{font-size:12pt;line-height:1.35;margin:20px 0 8px}h3{font-size:10pt;margin:14px 0 6px}
    .report-cover h1{font-size:27pt;letter-spacing:-.7px;margin:10px 0}.document-type{margin-top:24px;font-size:8pt;letter-spacing:1.2px;text-transform:uppercase;color:#526573}.report-subtitle{font-size:13pt;line-height:1.45;color:#415563;margin:0 0 24px}
    .report-metadata{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;padding:18px 0;margin:0;border-top:1px solid #cbd5dc;border-bottom:1px solid #cbd5dc}.report-metadata dt{font-size:8pt;text-transform:uppercase;letter-spacing:.6px;color:#526573}.report-metadata dd{margin:4px 0 0;font-weight:bold}
    .report-summary{margin:22px 0}.report-next{margin-top:20px;padding:2px 16px 12px;background:#f2f7f7;border-left:3px solid #245b64}.report-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.report-metrics div{padding:12px 0;border-top:2px solid #cbd5dc}.report-metrics strong{display:block;font-size:20pt;line-height:1.3;color:#245b64}.report-metrics span{font-size:8pt;color:#526573}
    .scope-note,.source-note,.section-intro{font-size:8.5pt;color:#526573}.scope-note{padding-top:12px;border-top:1px solid #cbd5dc}
    section:not(.report-cover)>h1{padding-bottom:12px;border-bottom:2px solid #245b64}section:not(.report-cover)>h1::before{counter-increment:report-section;content:counter(report-section,decimal-leading-zero) " / ";font-size:11pt;color:#526573}
    p,li,td,th,header,h1,h2,h3,dd{overflow-wrap:anywhere}p{margin:10px 0}ul{padding-left:19px}li+li{margin-top:4px}
    figure{margin:20px 0}figcaption{font-size:12pt;font-weight:bold;line-height:1.35;margin-bottom:14px;color:#152e3e;break-after:avoid}
    .assessment-diagram{padding:16px;border:1px solid #d4dfe5;border-radius:5px;background:#fafcfd}.hypothesis-card{margin:24px 0}.hypothesis-card ul{margin:6px 0}.diagram-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.evidence-columns,.diagram-outcomes{grid-template-columns:repeat(3,minmax(0,1fr))}.diagram-node{border:1px solid #aebfc9;border-radius:4px;padding:10px 12px;background:white;break-inside:avoid}.diagram-node h2,.diagram-node h3{margin:0 0 6px}.diagram-node h3{font-size:9pt;color:#284554}.diagram-node p,.diagram-node ul{font-size:9pt;margin:6px 0}.diagram-node p:last-child{margin-bottom:0}.diagram-node ul{padding-left:14px}.diagram-emphasis{background:#edf5f5;border:1.5px solid #245b64}.evidence-support{border-top:3px solid #245b64}.evidence-conflict{border-top:3px solid #946039}.evidence-missing{border-top:3px dashed #61717e}.diagram-connector{display:flex;flex-direction:column;align-items:center;gap:1px;text-align:center;color:#415563;font-size:8pt;padding:7px 0;break-inside:avoid;break-after:avoid}.diagram-connector b{font-size:20px;line-height:1;color:#245b64}.diagram-connector span{max-width:95%}
    .experiment-record{font-size:9pt}.experiment-record h2{margin-top:16px}.experiment-record .source-note{font-size:8pt}.experiment-chart figcaption{margin-bottom:6px}.contrast-axis,.contrast-row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,2fr) 70px;align-items:center;gap:10px;font-size:8pt}.contrast-axis{color:#526573;margin-top:16px;padding-bottom:8px;border-bottom:1px solid #cbd5dc}.contrast-axis>div{display:flex;justify-content:space-between;gap:4px;font-variant-numeric:tabular-nums}.contrast-row{padding:9px 0;border-bottom:1px solid #e4eaee;break-inside:avoid}.contrast-row small{display:block;color:#526573}.contrast-row>strong{text-align:right;font-size:8pt;font-variant-numeric:tabular-nums}.contrast-track{position:relative;height:22px;background:linear-gradient(90deg,#f4f7f8 49.75%,#61717e 49.75%,#61717e 50.25%,#f4f7f8 50.25%)}.contrast-bar{position:absolute;top:4px;height:14px;background:#245b64}.contrast-bar.negative{background:#946039}.contrast-zero{position:absolute;left:calc(50% - 3px);top:8px;width:6px;height:6px;background:#245b64;border-radius:50%}.contrast-unrun{border:1px dashed #aebfc9;text-align:center;padding:3px;color:#526573}
    .execution-timeline{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));list-style:none;padding:0;margin:22px 0 16px;break-inside:avoid}.execution-timeline li{position:relative;border-top:2px solid #aebfc9;padding:12px 12px 0 0;margin:0;break-inside:avoid}.execution-timeline li::before{content:"";position:absolute;left:0;top:-6px;width:10px;height:10px;background:#245b64;border:2px solid white;border-radius:50%}.execution-timeline b,.execution-timeline span,.execution-timeline small{display:block}.execution-timeline b{text-transform:capitalize;color:#245b64}.execution-timeline small{font-size:8pt;color:#526573}.response-record{margin:24px 0}.response-answer{break-inside:avoid}.response-record h2{font-size:11pt}
    footer{border-top:1px solid #cbd5dc;padding-top:10px;margin-top:20px;font-size:8pt;color:#526573}
    table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9pt;margin:16px 0}th{background:#edf2f5;font-size:8pt;color:#284554;font-weight:bold}tbody tr:nth-child(even){background:#f8fafb}
    td,th{padding:8px;text-align:left;border:1px solid #d4dfe5;vertical-align:top}td{white-space:pre-wrap}thead{display:table-header-group}tr{break-inside:avoid}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.table-scroll{overflow-x:auto}
    .flow-card{margin:0 0 16px;padding:14px 16px;border:1px solid #cbd5dc;border-left:3px solid var(--flow-stroke);border-radius:4px;background:var(--flow-fill);break-inside:avoid}.flow-card h2{margin:6px 0 10px}.flow-card p{margin:8px 0}.flow-card .flow-label{margin:0;color:var(--flow-stroke);font-size:8pt;font-weight:bold;text-transform:uppercase}
    .flow-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;list-style:none;margin:14px 0 0;padding:14px 0 0;border-top:1px solid #aebfc9}.flow-routes li{position:relative;margin:0;padding:10px;border:1px solid #aebfc9;border-radius:3px;background:white;font-size:8pt}.flow-routes li::before{content:"↓";position:absolute;left:50%;top:-17px;background:var(--flow-fill);color:#415563;line-height:16px}.flow-routes a{color:inherit;text-decoration:none}.flow-routes b{display:block}.flow-routes a:hover{text-decoration:underline}
    .toolbar{padding:16px;text-align:center;font-size:9pt;color:#415563}button{font:inherit;padding:10px 18px;cursor:pointer;border:1px solid #aebfc9;background:white;border-radius:4px}
    .investigation-overview>h1{font-size:17pt;margin:12px 0 8px;padding-bottom:8px}.investigation-overview>svg{display:block;width:100%;height:auto;overflow:hidden}.overview-key{font-size:8pt;line-height:1.35;margin:8px 0}.investigation-overview header{padding-bottom:6px}.flow-symbol-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 12px;list-style:none;padding:6px 0;margin:8px 0;border-top:1px solid #d4dfe5;border-bottom:1px solid #d4dfe5;font-size:8pt;break-inside:avoid}.flow-symbol-legend li{display:flex;align-items:center;gap:7px;margin:0}.flow-symbol-legend svg{width:30px;height:18px;flex-shrink:0;overflow:visible}
    @page{size:A4 portrait;margin:12mm 12mm 16mm;@bottom-left{content:"FLOWPILOT / TECHNICAL ASSESSMENT";font:7pt Arial;color:#526573}@bottom-right{content:"Page " counter(page);font:8pt Arial;color:#526573}}
    @media screen and (max-width:600px){section{width:calc(100% - 16px);margin:12px auto;padding:20px}.report-cover h1{font-size:23pt}.report-metadata{gap:12px}.report-metrics{gap:8px}.diagram-columns{grid-template-columns:1fr}.assessment-diagram{padding:12px}.contrast-axis,.contrast-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 62px;gap:5px}.contrast-axis>div{font-size:6pt}}
    @media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar{display:none}section{width:auto;aspect-ratio:auto;margin:0;padding:0;border:0;box-shadow:none;break-before:page}.report-cover{break-before:auto}header,footer,.report-next,.report-metrics{break-inside:avoid}h1,h2,h3{break-after:avoid}.table-scroll{overflow:visible}pre{break-inside:auto}.hypothesis-card,.comparison-diagram,.experiment-design{break-inside:avoid}}
    </style><div class="toolbar"><button onclick="window.print()">Print / save as PDF</button> · A4 portrait · 210 × 297 mm · ${esc(incident.id)} · revision ${incident.revision}</div>${assessmentCover(incident, experiments)}${investigationFlowchart(map)}${assessmentRecords(incident, experiments)}${pages}
    <section class="report-section"><h1>Reference sources</h1><p class="section-intro">Document versions and applicability used in the assessment.</p><ul>${sources || "<li>No source references recorded.</li>"}</ul></section></html>`;
}
