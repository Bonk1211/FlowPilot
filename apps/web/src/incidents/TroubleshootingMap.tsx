import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, Flask, Minus, Plus, X } from "@phosphor-icons/react";
import type { Incident } from "@flowpilot/contracts";
import {
  buildTroubleshootingMap,
  troubleshootingHandoff,
  troubleshootingSvg,
} from "./troubleshootingPlan";
import "./TroubleshootingMap.css";

function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TroubleshootingMap({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const map = useMemo(() => buildTroubleshootingMap(incident), [incident]);
  const svg = useMemo(() => troubleshootingSvg(map), [map]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  if (!incident.assessment) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        title="Response flow & mini DOE"
        aria-label="Response flow & mini DOE"
        onClick={() => setOpen(true)}
      >
        <Flask aria-hidden="true" />
        <span>Flow & mini DOE</span>
      </button>
      <dialog
        ref={dialog}
        className="troubleshooting-dialog"
        aria-labelledby={`map-title-${incident.id}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.stopPropagation();
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        {open && (
          <>
            <header className="troubleshooting-heading">
              <div>
                <p className="eyebrow">Troubleshooting / handoff</p>
                <h2 id={`map-title-${incident.id}`}>
                  Responses → possible causes → mini DOE
                </h2>
                <p>
                  {incident.id} · Revision {incident.revision} · {incident.mode}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close troubleshooting map"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="troubleshooting-toolbar">
              <div className="troubleshooting-zoom" aria-label="Chart zoom">
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={zoom <= 0.4}
                  onClick={() => setZoom(Math.max(0.4, zoom - 0.15))}
                >
                  <Minus aria-hidden="true" />
                </button>
                <output aria-live="polite">{Math.round(zoom * 100)}%</output>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={zoom >= 1.6}
                  onClick={() => setZoom(Math.min(1.6, zoom + 0.15))}
                >
                  <Plus aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom(
                      Math.max(
                        0.4,
                        Math.min(
                          1,
                          ((viewport.current?.clientWidth ?? 1000) - 40) /
                            map.width,
                        ),
                      ),
                    )
                  }
                >
                  Fit width
                </button>
                <button type="button" onClick={() => setZoom(1)}>
                  Readable size
                </button>
              </div>
              <div className="troubleshooting-downloads">
                <button
                  type="button"
                  onClick={() => {
                    download(
                      svg,
                      "image/svg+xml;charset=utf-8",
                      `${incident.id}-r${incident.revision}-flow.svg`,
                    );
                    setNotice("Vector chart downloaded.");
                  }}
                >
                  <DownloadSimple aria-hidden="true" />
                  Export SVG
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    download(
                      troubleshootingHandoff(incident, map),
                      "text/html;charset=utf-8",
                      `${incident.id}-r${incident.revision}-handoff.html`,
                    );
                    setNotice(
                      "Handoff downloaded. Open the HTML file to print or save as PDF.",
                    );
                  }}
                >
                  <DownloadSimple aria-hidden="true" />
                  Export handoff
                </button>
              </div>
            </div>
            <div className="troubleshooting-caption">
              <p>
                Follow the arrows. Possible faults converge on a shared area;
                each comparison branches left or right by outcome. H1 collects
                the handoff.
              </p>
              <p>
                Mini DOE: one recorded factor at a time, matched A/B conditions,
                and a repeat check. These are suggested comparisons, not
                completed equipment tests.
              </p>
              {notice && <p role="status">{notice}</p>}
            </div>
            <div
              ref={viewport}
              className="troubleshooting-viewport"
              tabIndex={0}
              role="region"
              aria-label="Scrollable troubleshooting flowchart"
            >
              <div
                className="troubleshooting-svg"
                style={{ width: map.width * zoom, height: map.height * zoom }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
            <details className="troubleshooting-text">
              <summary>
                Read the flow and full test instructions as text
              </summary>
              <ol>
                {map.cards.map((card) => (
                  <li key={card.id}>
                    <p>
                      <strong>
                        {card.label} · {card.title}
                      </strong>
                    </p>
                    {card.body.map((text, index) => (
                      <p key={index}>{text}</p>
                    ))}
                  </li>
                ))}
              </ol>
              {map.checks.map((check) => (
                <section key={check.id}>
                  <h3>{check.title}</h3>
                  <p>{check.mini_experiment?.repeat_plan}</p>
                  <p>Prerequisites: {check.prerequisites.join("; ")}</p>
                  <p>Stop: {check.stopping_conditions.join("; ")}</p>
                  <p>Sources: {check.source_refs.join(", ")}</p>
                </section>
              ))}
            </details>
          </>
        )}
      </dialog>
    </>
  );
}
