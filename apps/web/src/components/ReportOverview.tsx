import { FileText, ArrowBendDownRight, Info } from "@phosphor-icons/react";
import type { DemoScenario } from "@flowpilot/contracts";
import { ProvisionalStatus } from "./Status";
import { displayTimestamp } from "../presentation";

export function SourceLimitations({
  metadata,
}: {
  metadata: DemoScenario["log_metadata"];
}) {
  return (
    <details className="source-limitations">
      <summary>Source limitations</summary>
      <ul>
        {metadata.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

export function ReportContext({
  scenario,
  compact,
}: {
  scenario: DemoScenario;
  compact: boolean;
}) {
  const { investigation } = scenario;
  const report = investigation.evidence?.find(
    (item) => item.key === "operator_report",
  );
  return (
    <aside
      className={`report-context ${compact ? "context-compact" : ""}`}
      aria-labelledby="report-title"
    >
      <p className="eyebrow">01 / Operator observation</p>
      <h2 id="report-title">{investigation.title}</h2>
      <p className="operator-statement">
        {String(report?.value ?? "No operator report available.")}
      </p>
      <ProvisionalStatus />
      <dl className="report-metadata">
        <div>
          <dt>Process</dt>
          <dd>{investigation.process}</dd>
        </div>
        <div>
          <dt>Reported</dt>
          <dd className="mono">
            {displayTimestamp(investigation.reported_at)}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd className="mono">{report?.source_ref ?? "Not provided"}</dd>
        </div>
      </dl>
      <p className="context-footnote">
        <Info aria-hidden="true" />
        An observation starts the investigation. It does not confirm a cause.
      </p>
    </aside>
  );
}

export function SourceOverview({ scenario }: { scenario: DemoScenario }) {
  return (
    <section className="source-overview" aria-labelledby="source-title">
      <div className="section-heading">
        <p className="eyebrow">02 / Machine context</p>
        <FileText className="section-icon" aria-hidden="true" />
      </div>
      <h2 id="source-title">Read the record behind the report.</h2>
      <p className="source-intro">
        Timing, alignment, and height events can add context to the reported
        defect. Review what the log actually contains before using it as
        evidence.
      </p>
      <div className="source-file">
        <FileText aria-hidden="true" />
        <div>
          <h3 className="mono">{scenario.sample_log.sourceName}</h3>
          <p>
            Industry event log <span aria-hidden="true">·</span> Simulated
            sample
          </p>
        </div>
        <span className="file-type mono">LOG</span>
      </div>
      <dl className="source-metadata">
        <div>
          <dt>Origin</dt>
          <dd>{scenario.log_metadata.source}</dd>
        </div>
        <div>
          <dt>Timezone assumption</dt>
          <dd className="mono">
            {scenario.sample_log.timezoneOffset ?? "Not provided"}
          </dd>
        </div>
      </dl>
      <SourceLimitations metadata={scenario.log_metadata} />
      <div className="preview-explanation">
        <ArrowBendDownRight aria-hidden="true" />
        <div>
          <h3>Ready for a first look</h3>
          <p>
            Preview the sample to see recognized events, evidence candidates,
            and parser warnings. No events are attached to a case.
          </p>
        </div>
      </div>
    </section>
  );
}
