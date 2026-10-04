import type {
  DiagnosticAssessment,
  Incident,
  IncidentExperiment,
} from "@flowpilot/contracts";

export const escapeMarkup = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

const esc = (value: unknown) => escapeMarkup(String(value ?? "Not recorded"));
const list = (values: unknown[] = []) =>
  values.length
    ? `<ul>${values.map((value) => `<li>${esc(value)}</li>`).join("")}</ul>`
    : "<p>None recorded.</p>";
const table = (headings: string[], rows: unknown[][]) =>
  `<div class="table-scroll"><table><thead><tr>${headings.map((heading) => `<th>${esc(heading)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${headings.length}">None recorded.</td></tr>`}</tbody></table></div>`;
const section = (title: string, body: string) =>
  `<section class="report-section"><h1>${esc(title)}</h1>${body}</section>`;
const connector = (label: string) =>
  `<div class="diagram-connector"><span>${esc(label)}</span><b aria-hidden="true">↓</b></div>`;
const diagramNode = (label: string, content: string, tone = "") =>
  `<div class="diagram-node ${tone}"><h3>${esc(label)}</h3>${content}</div>`;

export function comparisonDiagram(
  check: DiagnosticAssessment["checks"][number],
) {
  const plan = check.mini_experiment;
  if (!plan) return "";
  return `<figure class="assessment-diagram comparison-diagram"><figcaption>A/B comparison design · suggested procedure</figcaption>
    <div class="diagram-columns">${diagramNode("A · Baseline", `<p>${esc(plan.baseline)}</p>`)}${diagramNode("B · Comparison", `<p>${esc(plan.comparison)}</p>`)}</div>
    ${connector(`Vary: ${plan.factor}`)}
    ${diagramNode("Hold constant", list(plan.held_constant))}
    ${connector("Compare matched records")}
    ${diagramNode("Measure", `<p>${esc(check.measured_response)}</p>`, "diagram-emphasis")}
    ${connector("Interpret the result")}
    <div class="diagram-columns diagram-outcomes">${check.expected_outcomes.map((outcome) => diagramNode(outcome.value, `<p>${esc(outcome.interpretation)}</p>`)).join("")}</div>
    <p class="source-note">Suggested comparison; execution status is recorded separately below.</p>
  </figure>`;
}

function experimentDiagram(plan: IncidentExperiment) {
  const results = plan.results ?? [];
  const values = results
    .map((result) => result.contrast_from_baseline)
    .filter(Number.isFinite);
  const limit = Math.max(...values.map(Math.abs), 0) || 1;
  const format = (value: number) =>
    `${value > 0 ? "+" : ""}${value.toFixed(6)}`;
  return `<figure class="assessment-diagram experiment-design"><figcaption>Experiment design · simulated conditions</figcaption>
    <div class="diagram-columns">${diagramNode("Vary", list(plan.proposal.factors.map((factor) => `${factor.name}: ${factor.levels.join(" / ")}`)))}${diagramNode("Baseline controls", list(Object.entries(plan.proposal.controls ?? {}).map(([key, value]) => `${key}: ${value}`)))}</div>
    ${connector(`${plan.proposal.repetitions} repetitions · ${plan.matrix.length} planned runs`)}
    ${diagramNode("Measured response", `<p>${esc(plan.proposal.response)}</p>`, "diagram-emphasis")}
    <p class="source-note">${esc(plan.proposal.expected_discrimination)}</p>
  </figure>
  <figure class="experiment-chart" data-experiment-chart="${esc(plan.id)}"><figcaption>Recorded run contrasts · ${esc(plan.proposal.response)}</figcaption>
    <p class="source-note">Difference from each mechanism’s baseline. Shared symmetric scale within this experiment; direction does not establish a cause. ${esc(experimentStatus(plan))}.</p>
    ${values.length ? `<div class="contrast-axis"><span>Run / mechanism</span><div><span>${format(-limit)}</span><span>0</span><span>${format(limit)}</span></div><span>Contrast</span></div>` : ""}
    ${plan.matrix
      .map((condition) => {
        const result = results.find(
          (row) => row.condition.index === condition.index,
        );
        const value = result?.contrast_from_baseline;
        const recorded = typeof value === "number" && Number.isFinite(value);
        const width = recorded ? (Math.abs(value) / limit) * 50 : 0;
        return `<div class="contrast-row" data-run="${condition.index}"${recorded ? ` data-contrast="${value}"` : ""}><span><b>Run ${condition.index}${condition.baseline ? " · baseline" : ""}</b><small>${esc(condition.hypothesis_id)}</small></span>${recorded ? `<div class="contrast-track" aria-hidden="true"><i class="contrast-bar ${value < 0 ? "negative" : "positive"}" style="left:${value < 0 ? 50 - width : 50}%;width:${width}%"></i>${value === 0 ? '<i class="contrast-zero"></i>' : ""}</div><strong>${format(value)}</strong>` : `<div class="contrast-unrun">${result ? "Value unavailable" : "Not run"}</div><strong>—</strong>`}</div>`;
      })
      .join("")}
    ${connector("Recorded outcome")}
    ${diagramNode(plan.analysis?.outcome ?? "No analysis recorded", `<p>${esc(plan.analysis?.summary ?? "No result is implied.")}</p>`, "diagram-emphasis")}
  </figure>`;
}

export function experimentStatus(plan: IncidentExperiment) {
  const count = plan.results?.length ?? 0;
  return `${plan.status} · ${count}/${plan.matrix.length} runs recorded${count === 0 ? " · not run" : count < plan.matrix.length ? " · partial results" : ""}${plan.source_current === false ? " · stale source" : ""}`;
}

export function observationApplicability(incident: Incident, id: string) {
  const item = incident.observations?.find((entry) => entry.id === id);
  if (!item) return "Not recorded";
  if (incident.observations?.some((entry) => entry.supersedes_id === id))
    return "Historical · corrected";
  const answers = incident.investigation?.answers ?? [];
  const excluded = answers.some(
    (answer) =>
      answer.observation_id === id &&
      (answers.some((entry) => entry.supersedes_id === answer.id) ||
        !incident.investigation?.nodes?.some(
          (node) => node.id === answer.node_id && node.status !== "superseded",
        )),
  );
  if (excluded) return "Historical · response branch superseded";
  const evidence = new Set(
    (incident.evidence ?? [])
      .filter(
        (entry) =>
          entry.status === "collected" &&
          !incident.evidence?.some((newer) => newer.supersedes_id === entry.id),
      )
      .map((entry) => entry.id),
  );
  return (item.evidence_ids ?? []).every((key) => evidence.has(key))
    ? "Current recorded observation"
    : "Historical · linked evidence unavailable or superseded";
}

export function handoffEmailBody(
  incident: Incident,
  experiments: IncidentExperiment[],
) {
  return [
    incident.handoff.body,
    "",
    "--- Report supplement: recorded work ---",
    `Report: ${incident.id}-r${incident.revision}-handoff.html (attached to the email draft).`,
    `Saved message: version ${incident.handoff.version}, source revision ${incident.handoff.source_revision}.`,
    ...(incident.handoff.source_revision !== incident.revision
      ? [
          "Review required: this saved message predates the current incident revision.",
        ]
      : []),
    `Recorded checks: ${(incident.observations ?? []).length}. Saved synthetic simulations: ${(incident.simulations ?? []).length}.`,
    ...(experiments.length
      ? experiments.map(
          (plan) =>
            `${plan.id} / ${plan.proposal.check_id}: ${experimentStatus(plan)}. ${plan.analysis?.summary ?? "No result analysis recorded."}`,
        )
      : ["No experiment plans or completed experiment runs recorded."]),
    "Mock experiment results are simulated; they do not confirm an equipment cause.",
    `Next response requested: ${incident.assessment?.next_step.title ?? "Review the incident and missing evidence"}. ${incident.assessment?.next_step.reason ?? ""}`,
    `Current owner: ${incident.owner ?? "Unassigned"}. Waiting for: ${incident.waiting_for ?? "Not specified"}.`,
    "Please review the attached assessment flow, results and open items, then confirm the next owner and follow-up action.",
  ].join("\n");
}

function assessmentDetails(assessment: DiagnosticAssessment) {
  return `<p>${esc(assessment.summary)}</p><p class="source-note">Assessment method: ${esc(assessment.provider)} · ${esc(assessment.version)}. ${esc(assessment.provider_status)}</p>${assessment.hypotheses
    .map(
      (
        hypothesis,
      ) => `<figure class="hypothesis-card assessment-diagram"><figcaption>${esc(hypothesis.rank)}. ${esc(hypothesis.title)} · ${esc(hypothesis.status)}</figcaption>
    <div class="diagram-columns evidence-columns">${diagramNode("Supporting evidence", list(hypothesis.supporting_evidence?.map((item) => `${item.evidence_id}: ${item.explanation}`)), "evidence-support")}${diagramNode("Conflicting evidence", list(hypothesis.conflicting_evidence?.map((item) => `${item.evidence_id}: ${item.explanation}`)), "evidence-conflict")}${diagramNode("Missing evidence", list(hypothesis.missing_evidence), "evidence-missing")}</div>
    ${connector("Evidence informs this hypothesis")}
    ${diagramNode(hypothesis.title, `<p>${esc(hypothesis.explanation)}</p><p><b>Mechanism:</b> ${esc(hypothesis.mechanism)}</p>`, "diagram-emphasis")}
    ${connector("Distinguish from alternatives")}
    ${diagramNode("How to test", `<p>${esc(hypothesis.how_to_test)}</p>`)}
    <p class="source-note">Sources: ${esc(hypothesis.source_refs?.join(", "))}</p></figure>`,
    )
    .join(
      "",
    )}<div class="report-next"><h2>Next step</h2><p><b>${esc(assessment.next_step.title)}</b> · ${esc(assessment.next_step.reason)}</p></div><h2>Open items</h2>${list(assessment.unresolved)}${list(assessment.warnings)}${assessment.explanation?.result ? `<h2>Model explanation · requires review</h2><p>${esc(assessment.explanation.result.text)}</p>${list(assessment.explanation.result.uncertainties)}` : ""}`;
}

export function assessmentCover(
  incident: Incident,
  experiments: IncidentExperiment[],
) {
  const recorded = incident.updated_at ?? incident.created_at;
  const date = recorded ? new Date(recorded) : null;
  const issued =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleString("en-GB", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        }) + " UTC"
      : "Not recorded";
  const metadata = [
    ["Incident reference", incident.id],
    ["Evidence revision", String(incident.revision)],
    ["Equipment", incident.tool_id],
    ["Configuration", incident.configuration],
    ["Assessment owner", incident.owner ?? "Unassigned"],
    ["Last updated", issued],
  ];
  return `<section class="report-cover">
    <header class="report-brand"><strong>FLOWPILOT</strong><span>ENGINEERING ASSESSMENT</span></header>
    <p class="document-type">${esc(incident.mode)} investigation · ${esc(incident.status?.replaceAll("_", " ") ?? "Open")}</p>
    <h1>Technical assessment report</h1><p class="report-subtitle">${esc(incident.symptom)}</p>
    <dl class="report-metadata">${metadata.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    <div class="report-summary"><h2>Assessment summary</h2><p>${esc(incident.assessment?.summary ?? "Assessment pending. Available evidence has not established a cause.")}</p></div>
    <h2>Current conclusion</h2><p>${incident.closure ? `<strong>${esc(incident.closure.outcome)}.</strong> ${esc(incident.closure.conclusion ?? "No cause confirmed.")} ${esc(incident.closure.notes)}` : "Investigation open; no final conclusion."}</p>
    ${incident.closure ? `<p class="source-note">Reviewed by ${esc(incident.closure.reviewer)} · ${esc(incident.closure.closed_at)}</p>` : ""}
    <div class="report-next"><h2>Recommended next step</h2><p><strong>${esc(incident.assessment?.next_step.title ?? "Review missing evidence")}</strong></p><p>${esc(incident.assessment?.next_step.reason ?? "Complete the assessment before drawing a conclusion.")}</p></div>
    <div class="report-metrics"><div><strong>${(incident.observations ?? []).length}</strong><span>Recorded checks</span></div><div><strong>${experiments.filter((plan) => plan.status === "completed").length}</strong><span>Completed mock experiments</span></div><div><strong>${experiments.filter((plan) => !plan.results?.length).length}</strong><span>Plans not yet run</span></div></div>
    <p class="scope-note">Assessment scope: ${esc(incident.configuration)} · ${esc(incident.mode)}. Equipment disposition: ${esc(incident.disposition?.replaceAll("_", " ") ?? "not assessed")}. Synthetic results do not establish a physical equipment cause or authorize production release.</p>
  </section>`;
}

export function assessmentRecords(
  incident: Incident,
  experiments: IncidentExperiment[],
) {
  const replacedAnswers = new Set(
    incident.investigation?.answers?.map((answer) => answer.supersedes_id),
  );
  const replacedEvidence = new Set(
    incident.evidence?.map((item) => item.supersedes_id),
  );
  const responses = (incident.investigation?.nodes ?? [])
    .map((node) => {
      const answers =
        incident.investigation?.answers?.filter(
          (answer) => answer.node_id === node.id,
        ) ?? [];
      return `<article class="response-record"><div class="diagram-node diagram-emphasis"><h2>${esc(node.prompt)}</h2><p class="source-note">${esc(node.id)} · ${esc(node.status)} · parent question ${esc(node.parent_id ?? "root")} · parent answer ${esc(node.parent_answer_id ?? "none")}</p><p>${esc(node.why)}</p></div>${answers.map((answer) => `${connector("Recorded response → interpretation")}<div class="response-answer"><div class="diagram-columns">${diagramNode("Original response / notes", `<p>${esc(answer.text || answer.choice || "No response text")}</p><p>${esc(answer.notes)}</p>`)}${diagramNode("Interpretation / confirmation", `<p>${esc(answer.confirmed_value ?? answer.proposed?.value ?? "No confirmed interpretation")}</p><p><b>${replacedAnswers.has(answer.id) || node.status === "superseded" ? "Historical / superseded · " : ""}${esc(answer.status)}</b></p>`)}</div><p class="source-note">${esc(answer.id)} · r${answer.recorded_revision} · ${esc(answer.author ?? "Author not recorded")} · ${esc(answer.recorded_at)} · Observation: ${esc(answer.observation_id ?? "none")}</p></div>`).join("")}${!answers.length ? `${connector("Awaiting response")}${diagramNode("Unanswered", `<p>${esc(node.blocked_reason ?? "No response recorded.")}</p>`)}` : ""}</article>`;
    })
    .join("");
  return (
    section(
      "Current assessment",
      incident.assessment
        ? assessmentDetails(incident.assessment)
        : "<p>Assessment pending; no cause confirmed.</p>",
    ) +
    section(
      "Checks and observations",
      table(
        ["Check / record", "Result / notes", "Evidence / provenance"],
        (incident.observations ?? []).map((item) => [
          `${item.check_id}\n${item.id}`,
          `${item.result}\n${observationApplicability(incident, item.id)}\n${item.notes}`,
          `${item.synthetic ? "Simulated" : "Reported observation"}\n${item.evidence_ids?.join(", ") || "No linked evidence"}\n${item.author ?? "Author not recorded"} · ${item.recorded_at}\n${item.supersedes_id ? `Corrects ${item.supersedes_id}` : ""}`,
        ]),
      ) +
        "<p>Corrections and withdrawn answer branches are retained below in the complete response record; historical observations must not be treated as current evidence.</p>",
    ) +
    (experiments.length
      ? experiments
          .map((plan) =>
            section(
              `Experiment ${plan.id}`,
              `<p><b>Simulated · ${esc(experimentStatus(plan))}</b></p><p class="source-note">Check: ${esc(plan.proposal.check_id)} · plan revision ${plan.plan_revision} · record revision ${plan.revision} · source incident revision ${plan.source_incident_revision}.</p>${experimentDiagram(plan)}<div class="experiment-record"><h2>Run measurements</h2>${table(
                [
                  "Run / repeat",
                  "Mechanism / baseline",
                  "Severity / delivery / material",
                  "Mean response",
                  "Baseline contrast",
                ],
                plan.matrix.map((condition) => {
                  const result = plan.results?.find(
                    (row) => row.condition.index === condition.index,
                  );
                  return [
                    `${condition.index} / ${condition.repetition}`,
                    `${condition.hypothesis_id}${condition.baseline ? " / baseline" : ""}`,
                    `${condition.parameters.severity} / ${condition.parameters.delivery_ratio} / ${condition.parameters.material_ratio}`,
                    result ? result.response_mean.toFixed(6) : "Not run",
                    result
                      ? result.contrast_from_baseline.toFixed(6)
                      : "Not run",
                  ];
                }),
              )}${
                plan.analysis
                  ? table(
                      [
                        "Mechanism / factor",
                        "Low mean",
                        "High mean",
                        "Main effect",
                      ],
                      plan.analysis.effects.map((effect) => [
                        `${effect.hypothesis_id} / ${effect.factor}`,
                        effect.low_mean.toFixed(6),
                        effect.high_mean.toFixed(6),
                        effect.main_effect.toFixed(6),
                      ]),
                    ) + list(plan.analysis.limitations)
                  : ""
              }<h2>Execution history</h2>${plan.history.length ? `<ol class="execution-timeline">${plan.history.map((event) => `<li><b>${esc(event.action)}</b><span>${esc(event.detail)}</span><small>${esc(event.actor)} · ${esc(event.timestamp)}</small></li>`).join("")}</ol>` : "<p>No execution events recorded.</p>"}<h2>Prerequisites / stopping conditions</h2>${list([...plan.prerequisites, ...plan.stopping_conditions])}<p class="source-note">Approved by ${esc(plan.approved_by ?? "Not approved")} at ${esc(plan.approved_at)}. Source fingerprint: ${esc(plan.source_fingerprint)}.</p><p class="source-note">Model: ${esc(plan.model_version)} · fixture: ${esc(plan.fixture_version)} · source: ${esc(plan.source_passage.document_id)} / ${esc(plan.source_passage.revision)} / ${esc(plan.source_passage.section)}.</p></div>`,
            ),
          )
          .join("")
      : section(
          "Experiments",
          "<p>No experiment plans or completed experiment runs recorded.</p>",
        )) +
    (incident.simulations ?? [])
      .map((run) =>
        section(
          `Saved synthetic simulation ${run.id}`,
          `<p>${esc(run.scenario)} · source revision ${run.source_revision} · ${esc(run.created_at)}. A simulation is not a physical experiment.</p><p>Model ${esc(run.model_version)} · fixture ${esc(run.fixture_version)} · evidence ${esc(run.evidence_ids.join(", "))}.</p><p>Parameters: ${esc(JSON.stringify(run.parameters))}. Units: ${esc(JSON.stringify(run.units))}.</p>${table(
            [
              "Position",
              "Fixture relative mass",
              "Learned relative mass",
              "Fixture coverage",
              "Learned coverage",
            ],
            run.points.map((point) => [
              point.position,
              point.relative_mass,
              point.learned_relative_mass,
              point.coverage_fraction,
              point.learned_coverage_fraction,
            ]),
          )}${list([...run.assumptions, ...run.validity_limits])}`,
        ),
      )
      .join("") +
    (responses
      ? section("Complete assessment response record", responses)
      : "") +
    section(
      "Evidence register",
      table(
        ["Evidence / state", "Source / timing", "Values / corrections"],
        (incident.evidence ?? []).map((item) => [
          `${item.id}: ${item.label}\n${item.status}${replacedEvidence.has(item.id) ? " · superseded" : ""}\n${item.synthetic ? "Synthetic" : "Reported evidence"}`,
          `${item.source_ref}\nEvent: ${item.event_time ?? "Unknown"} / ${item.event_timezone ?? "Unknown timezone"}\nIngested: ${item.ingested_at}\nTiming uncertain: ${item.time_uncertain}\nClock correction: ${item.clock_offset_seconds ?? "Unknown"}`,
          `${JSON.stringify(item.values)}\n${item.correction_reason ?? ""}\nOriginal: ${item.artifact_id ?? "Not archived"}\nSHA-256: ${item.raw_integrity_ref ?? item.integrity_ref}`,
        ]),
      ),
    ) +
    ((incident.assessment_history ?? []).length > 1
      ? section(
          "Assessment revision history",
          table(
            ["Revision / time", "Assessment", "Next step"],
            (incident.assessment_history ?? []).map((snapshot) => [
              `r${snapshot.incident_revision} · ${snapshot.created_at}`,
              `${snapshot.assessment.summary}\n${snapshot.assessment.hypotheses.map((hypothesis) => `${hypothesis.title}: ${hypothesis.status}`).join("\n")}`,
              `${snapshot.assessment.next_step.title}\n${snapshot.assessment.next_step.reason}`,
            ]),
          ),
        )
      : "")
  );
}

function base64(value: string) {
  return btoa(
    Array.from(new TextEncoder().encode(value), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
}

export function handoffEmailFile(
  incident: Incident,
  experiments: IncidentExperiment[],
  html: string,
) {
  const boundary = `flowpilot-${incident.id}-${incident.revision}`;
  // RFC 2047 encoded words stay within 75 characters, including non-ASCII subjects.
  const subject = Array.from(incident.handoff.subject.replace(/[\r\n]/g, " "))
    .reduce<string[]>((chunks, char) => {
      if (
        !chunks.length ||
        new TextEncoder().encode(chunks[chunks.length - 1] + char).length > 42
      )
        chunks.push(char);
      else chunks[chunks.length - 1] += char;
      return chunks;
    }, [])
    .map((chunk) => `=?UTF-8?B?${base64(chunk)}?=`)
    .join("\r\n ");
  const encoded = (value: string) =>
    base64(value)
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  return [
    `Subject: ${subject}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encoded(handoffEmailBody(incident, experiments)),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${incident.id}-r${incident.revision}-handoff.html"`,
    "",
    encoded(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
