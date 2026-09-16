import { useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  ListBullets,
  Warning,
  Info,
} from "@phosphor-icons/react";
import type { DemoScenario, IngestionResult } from "@flowpilot/contracts";
import { candidateValue, displayTimestamp, humanize } from "../presentation";
import { ProvisionalStatus } from "./Status";
import { SourceLimitations } from "./ReportOverview";

const wideQuery = window.matchMedia("(min-width: 768px)");
const subscribeWidth = (notify: () => void) => {
  wideQuery.addEventListener("change", notify);
  return () => wideQuery.removeEventListener("change", notify);
};

export function EvidencePreview({
  result,
  metadata,
  onOpenViewer,
}: {
  result: IngestionResult;
  metadata: DemoScenario["log_metadata"];
  onOpenViewer: (target: string, sourceRef?: string) => void;
}) {
  const wide = useSyncExternalStore(subscribeWidth, () => wideQuery.matches);
  return (
    <section className="evidence-preview" aria-labelledby="preview-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / Machine context</p>
          <h2 id="preview-title">Log preview</h2>
        </div>
        <button
          id="open-events"
          className="primary"
          onClick={() => onOpenViewer("open-events")}
        >
          <ListBullets aria-hidden="true" />
          View raw events
        </button>
      </div>
      <p className="preview-source mono">{result.sourceName}</p>
      <dl className="preview-stats">
        <div>
          <dt>Recognized / total events</dt>
          <dd>
            {result.stats.recognizedEventCount}
            <span> / {result.stats.eventCount}</span>
          </dd>
        </div>
        <div>
          <dt>Evidence candidates</dt>
          <dd>{result.evidenceCandidates.length}</dd>
        </div>
        <div>
          <dt>Parser warnings</dt>
          <dd>{result.warnings.length}</dd>
        </div>
      </dl>
      <p className="recognition-summary" role="status">
        {result.stats.recognizedEventCount} of {result.stats.eventCount} events
        recognized. {result.stats.unknownEventCount} unknown events retained.
      </p>
      <div className="evidence-ledger">
        <h3>Evidence candidates</h3>
        <p className="ledger-description">
          Direct observations from the log. All remain provisional.
        </p>
        {result.evidenceCandidates.length === 0 ? (
          <p className="empty-note">
            No supported evidence candidates.{" "}
            {result.events.length
              ? "Review the retained events for context."
              : "No events were found in this log."}
          </p>
        ) : (
          <div className="ledger-rows">
            {result.evidenceCandidates.map((candidate, index) => (
              <article
                className="evidence-row"
                key={`${candidate.sourceRef}-${index}`}
                aria-label={humanize(candidate.key)}
              >
                <div className="evidence-observation">
                  <h4>{humanize(candidate.key)}</h4>
                  <p className="measurement mono">
                    {candidateValue(candidate)}
                  </p>
                  <ProvisionalStatus />
                </div>
                <details className="evidence-provenance" open={wide}>
                  <summary>Source & time</summary>
                  <div>
                    <button
                      id={`source-${index}`}
                      className="source-link mono"
                      onClick={() =>
                        onOpenViewer(`source-${index}`, candidate.sourceRef)
                      }
                    >
                      {candidate.sourceRef}
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                    <time
                      className="mono"
                      dateTime={candidate.timestamp ?? undefined}
                    >
                      {displayTimestamp(candidate.timestamp)}
                    </time>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
      <section className="source-review" aria-labelledby="review-title">
        <h3 id="review-title">
          <Warning aria-hidden="true" />
          Review before using this source
        </h3>
        <p>
          Machine PASS is a run status, not proof of dispensing quality.
          Pressure, temperature, dot diameter, and obstruction evidence remain
          missing.
        </p>
        <details open className="parser-warnings">
          <summary>Parser warnings ({result.warnings.length})</summary>
          {result.warnings.length ? (
            <ul>
              {result.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>
                  <span className="mono">Line {warning.line}</span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No parser warnings.</p>
          )}
        </details>
        <SourceLimitations metadata={metadata} />
      </section>
      <p className="preview-note">
        <Info aria-hidden="true" />
        Preview only. Events and evidence are not saved to a case.
      </p>
    </section>
  );
}
