import { Archive, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { CaseListItem } from "@flowpilot/contracts";
import { useMemo, useState } from "react";

const phases = ["Report", "Diagnose", "Inspect", "Correct", "Verify"];

export function CaseNavigator({
  cases,
  activeId,
  phase,
  status,
}: {
  cases: CaseListItem[];
  activeId?: string;
  phase: string;
  status?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return cases;
    return cases.filter(
      (item) =>
        item.id.toLocaleLowerCase().includes(term) ||
        item.title.toLocaleLowerCase().includes(term),
    );
  }, [cases, query]);
  const current = phase === "Summary" ? phases.length : phases.indexOf(phase);

  return (
    <aside className="case-navigator" aria-label="Case navigator">
      <div className="case-nav-heading">
        <p className="eyebrow">Case workspace</p>
        <h2>Investigations</h2>
      </div>
      <a className="case-new primary" href="/">
        <Plus aria-hidden="true" />
        New case
      </a>
      {activeId && (
        <nav className="case-phase-nav" aria-label="Current case progress">
          <p className="case-nav-label">Current progress</p>
          {status && <p className="nav-status">{status}</p>}
          <ol>
            {phases.map((item, index) => (
              <li
                key={item}
                className={index < current ? "complete" : undefined}
                aria-current={item === phase ? "step" : undefined}
              >
                <span className="phase-dot" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <details className="saved-cases-disclosure">
        <summary>
          Saved investigations <span>{cases.length}</span>
        </summary>
        <label className="case-search">
          <span>Search cases</span>
          <span className="case-search-control">
            <MagnifyingGlass aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID or report"
            />
          </span>
        </label>
        <div className="case-list-heading">
          <span>Recent cases</span>
          <span className="mono">{visible.length}</span>
        </div>
        <nav aria-label="Recent cases">
          <ul className="case-list">
            {visible.map((item) => (
              <li key={item.id}>
                <a
                  href={`/?case=${encodeURIComponent(item.id)}`}
                  aria-current={item.id === activeId ? "page" : undefined}
                >
                  <span className="case-list-title">{item.title}</span>
                  <span className="case-list-meta">
                    <span>
                      {item.id === activeId ? (status ?? phase) : item.phase}
                    </span>
                    <time dateTime={item.updated_at}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(item.updated_at))}
                    </time>
                  </span>
                  <span className="case-list-id mono">
                    {item.read_only && <Archive aria-hidden="true" />}
                    {item.id}
                  </span>
                </a>
              </li>
            ))}
            {!visible.length && (
              <li className="case-list-empty">No matching saved cases.</li>
            )}
          </ul>
        </nav>
      </details>
      <p className="case-nav-note">
        Simulated investigations. FlowPilot does not control equipment or
        release production.
      </p>
    </aside>
  );
}
