import type { DiagnosticAssessment, Incident } from "@flowpilot/contracts";

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
  let previous: MapCard | undefined;
  const answers = currentMapAnswers(incident);
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
          `Q${row * 3 + index + 1} · ${answer.status}`,
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

export const escapeMarkup = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

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
    `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${bold ? 600 : 400}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${esc(line)}</tspan>`).join("")}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${height}" viewBox="0 ${top} ${map.width} ${height}" role="img" aria-label="Troubleshooting response flow and mini DOE" font-family="Arial, sans-serif">
    <title>Troubleshooting response flow and mini DOE</title><desc>Recorded answers lead to competing fault explanations, a shared investigation area, and suggested A/B comparisons. Supports branches right; inconclusive branches left to H1; conflicting results continue to the next comparison. Full test instructions follow the chart.</desc>
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

export function troubleshootingHandoff(
  incident: Incident,
  map: TroubleshootingMap,
) {
  const esc = escapeMarkup;
  const pages = map.pages
    .map((page, index) => {
      const plan = page.check?.mini_experiment;
      const result = page.check ? resultFor(incident, page.check) : undefined;
      const conflicts = page.check?.expected_outcomes.find(
        (outcome) => outcome.value === "contradicted",
      );
      return `<section><header><span>FLOWPILOT / TROUBLESHOOTING HANDOFF</span><span>${esc(incident.id)} · r${incident.revision} · Flow sheet ${index + 1}/${map.pages.length}</span></header><h1>${esc(page.title)}</h1>${troubleshootingSvg(map, page)}
      ${page.check ? `<p><b>If the result conflicts:</b> ${esc(conflicts?.interpretation ?? "Weakens this explanation; keep the alternatives open.")} Continue to the next comparison, or H1 if the checks are exhausted.</p><p><b>Repeat / uncertainty:</b> ${esc(plan?.repeat_plan ?? "Record missing or non-comparable evidence as inconclusive.")}</p>${result ? `<p><b>Recorded replay result:</b> ${esc(result.id)} · ${esc(result.result)} · ${esc(result.recorded_at)}. ${esc(result.notes)} Evidence: ${esc((result.evidence_ids ?? []).join(", ") || "none linked")}.</p>` : ""}<p><b>Prerequisites:</b> ${esc(page.check.prerequisites.join("; "))}</p><p><b>Stop:</b> ${esc(page.check.stopping_conditions.join("; "))}</p><p><b>Source references:</b> ${esc(page.check.source_refs.join(", "))}. ${esc(page.check.blocked_reason)}</p>` : ""}
      <footer>${esc(incident.configuration)} · ${esc(incident.mode)} · Suggested comparisons; no result implied. Side routes continue to H1. ${index < map.pages.length - 1 ? "Continue on the next page." : "End of flow."}</footer></section>`;
    })
    .join("");
  const answers = currentMapAnswers(incident)
    .map(
      ({ node, answer }) =>
        `<tr><td>${esc(node.prompt)}</td><td>${esc(answer.confirmed_value ?? answer.choice ?? answer.text)}<br/>${esc(answer.notes)}</td><td>${esc(answer.status)}<br/>${esc(answer.recorded_at)}</td></tr>`,
    )
    .join("");
  const sources = (incident.assessment?.sources ?? [])
    .map(
      (source) =>
        `<li>${esc(source.id)} — ${esc(source.title)} · ${esc(source.revision)} · ${esc(source.approval_status)}. ${esc(source.limitation)}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(incident.id)} — Troubleshooting handoff</title><style>
    *{box-sizing:border-box}body{margin:0;background:#e9edef;color:#182c37;font:14px/1.5 Arial,sans-serif}section{max-width:1240px;margin:24px auto;padding:32px;background:white;break-after:page}header{display:flex;justify-content:space-between;gap:24px;font-size:12px;color:#49606c;border-bottom:1px solid #c5d1d8;padding-bottom:12px}h1{font-size:23px;margin:20px 0}svg{display:block;width:100%;height:auto}p,li{overflow-wrap:anywhere}footer{border-top:1px solid #c5d1d8;padding-top:12px;margin-top:20px;font-size:12px}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border:1px solid #c5d1d8;vertical-align:top}tr{break-inside:avoid}.toolbar{padding:16px;text-align:center}button{font:inherit;padding:10px 18px;cursor:pointer}@page{size:A3 landscape;margin:12mm}@media print{body{background:white}.toolbar{display:none}section{margin:0;padding:0;max-width:none}section:last-child{break-after:auto}header,footer{break-inside:avoid}svg{max-height:210mm}}
    </style><div class="toolbar"><button onclick="window.print()">Print / save as PDF</button> · Landscape handoff · ${esc(incident.id)} · revision ${incident.revision}</div>${pages}
    <section><h1>Recorded responses and provenance</h1><p>${esc(incident.symptom)}</p><table><thead><tr><th>Question</th><th>Saved response / notes</th><th>Status / time</th></tr></thead><tbody>${answers || '<tr><td colspan="3">No responses recorded.</td></tr>'}</tbody></table><h2>Open items</h2><ul>${(incident.assessment?.unresolved ?? []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h2>Source versions</h2><ul>${sources}</ul></section></html>`;
}
