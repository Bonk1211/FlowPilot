import { useState } from "react";
import type {
  KnowledgeContent,
  KnowledgeEntry,
  KnowledgeCommand,
} from "@flowpilot/contracts";
import { changeKnowledge, prepareKnowledge } from "../api";
import { candidateValue, humanize, knowledgeState } from "../presentation";

export function KnowledgeReview({
  entry,
  initialVersion,
  onChanged,
}: {
  entry: KnowledgeEntry;
  initialVersion?: number;
  onChanged: (entry: KnowledgeEntry) => void;
}) {
  const latest = entry.versions[entry.versions.length - 1];
  const [versionNumber, setVersionNumber] = useState(
    initialVersion ?? latest.version,
  );
  const version =
    entry.versions.find((v) => v.version === versionNumber) ?? latest;
  const [tab, setTab] = useState<"experience" | "evidence" | "history">(
    "experience",
  );
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<KnowledgeContent>(latest.content);
  const [actor, setActor] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = version.version === latest.version;
  async function save(action: KnowledgeCommand["action"]) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await changeKnowledge(entry.id, {
        revision: entry.revision,
        action,
        actor,
        reason,
        confirmed: true,
        ...(action === "revise" ? { content } : {}),
      });
      onChanged(next);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save the review.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="knowledge-review" aria-label="Experience review">
      <div className="knowledge-heading">
        <span className={`knowledge-state ${entry.status}`}>
          {current ? knowledgeState(entry.status) : "Superseded version"}
        </span>
        <span className="mono">v{version.version}</span>
      </div>
      <h2>{version.content.title}</h2>
      <p className="review-problem">{version.source.problem}</p>
      <label className="version-select">
        Knowledge version
        <select
          value={version.version}
          onChange={(event) => {
            setVersionNumber(Number(event.target.value));
            setEditing(false);
          }}
        >
          {[...entry.versions].reverse().map((v) => (
            <option key={v.version} value={v.version}>
              Version {v.version} · {v.actor}
            </option>
          ))}
        </select>
      </label>
      <div
        className="knowledge-tabs"
        role="group"
        aria-label="Experience detail views"
      >
        {(["experience", "evidence", "history"] as const).map((item) => (
          <button
            key={item}
            className="graph-list-button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {humanize(item)}
          </button>
        ))}
      </div>
      {tab === "experience" && (
        <>
          <dl className="knowledge-facts">
            <div>
              <dt>Inspection finding</dt>
              <dd>{humanize(version.content.finding)}</dd>
            </div>
            <div>
              <dt>Recorded action</dt>
              <dd>{humanize(version.source.action ?? "none")}</dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{humanize(version.content.outcome)}</dd>
            </div>
            <div>
              <dt>Suggested check focus</dt>
              <dd>{humanize(version.content.check_focus)}</dd>
            </div>
          </dl>
          <h3>Experience to reuse</h3>
          <p>{version.content.lesson}</p>
          <details>
            <summary>Conditions and possible causes</summary>
            <dl className="knowledge-facts">
              {Object.entries(version.source.conditions).map(([key, value]) => (
                <div key={key}>
                  <dt>{humanize(key)}</dt>
                  <dd>{humanize(value)}</dd>
                </div>
              ))}
            </dl>
            <p>
              Original hypotheses:{" "}
              {version.source.possible_causes.join("; ") || "Not recorded"}.
            </p>
            <p>
              Material batch, recipe and physical equipment instance remain
              unknown.
            </p>
          </details>
          {current && (
            <p className="generation-note">
              {entry.generation?.mode === "live"
                ? `Prepared with Gemini · ${entry.generation?.model}`
                : entry.generation?.mode === "pending"
                  ? "Gemini is preparing an evidence-linked draft…"
                  : entry.generation?.mode === "manual"
                    ? "Technician-edited draft"
                    : "Evidence template · Gemini unavailable or disabled"}
              {entry.generation?.reason && (
                <span>{entry.generation?.reason}</span>
              )}
            </p>
          )}
        </>
      )}
      {tab === "evidence" && (
        <>
          <div className="knowledge-photos">
            <figure>
              <img
                src={version.source.image_url}
                alt="Source case before action"
              />
              <figcaption>Before action</figcaption>
            </figure>
            {version.source.verification_image_url && (
              <figure>
                <img
                  src={version.source.verification_image_url}
                  alt="Source case verification"
                />
                <figcaption>Verification</figcaption>
              </figure>
            )}
          </div>
          <p>
            {version.source.simulated
              ? "Simulated source data"
              : "Recorded source data"}{" "}
            · Source revision {version.source.revision}
          </p>
          <p>
            Log:{" "}
            {version.source.log_digest
              ? "Attached; original events are retained in the source investigation."
              : "No log attached."}
          </p>
          <ul className="knowledge-evidence">
            {version.source.evidence.map((item) => (
              <li key={item.id}>
                <strong>{humanize(item.key)}</strong>
                <p>{candidateValue(item)}</p>
                <span>
                  {humanize(item.verification_state)}
                  {version.content.supporting_evidence_ids.includes(item.id)
                    ? " · Cited in this experience"
                    : ""}
                </span>
                <details>
                  <summary>Source</summary>
                  <p>
                    {item.id} · {item.source_ref}
                  </p>
                  <time>{item.timestamp}</time>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
      {tab === "history" && (
        <ol className="knowledge-history">
          {[...entry.events].reverse().map((event) => (
            <li key={event.revision}>
              <strong>
                {knowledgeState(event.state)} · version {event.version}
              </strong>
              <p>{event.reason}</p>
              <span>
                {event.actor} · {new Date(event.timestamp).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
      <a
        className="knowledge-source-link"
        href={`/?case=${entry.source_case_id}`}
      >
        Open source investigation →
      </a>
      {current && (
        <form
          className="knowledge-review-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(editing ? "revise" : "publish");
          }}
        >
          <h3>
            {editing
              ? "Correct this experience"
              : entry.status === "draft"
                ? "Review before AI reuse"
                : "Manage this experience"}
          </h3>
          {!editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(true)}
            >
              Edit as new version
            </button>
          )}
          {editing && (
            <>
              <label>
                Experience title
                <input
                  required
                  maxLength={160}
                  value={content.title}
                  onChange={(event) =>
                    setContent({ ...content, title: event.target.value })
                  }
                />
              </label>
              <label>
                Reusable lesson
                <textarea
                  required
                  maxLength={1200}
                  rows={5}
                  value={content.lesson}
                  onChange={(event) =>
                    setContent({ ...content, lesson: event.target.value })
                  }
                />
              </label>
              <label>
                Inspection interpretation
                <select
                  value={content.finding}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      finding: event.target
                        .value as KnowledgeContent["finding"],
                      ...(event.target.value === "uncertain"
                        ? { outcome: "unresolved" as const }
                        : {}),
                    })
                  }
                >
                  <option value={latest.source.actual_finding}>
                    {humanize(latest.source.actual_finding)}
                  </option>
                  <option value="uncertain">
                    Uncertain / retract interpretation
                  </option>
                </select>
              </label>
              <label>
                Outcome interpretation
                <select
                  value={content.outcome}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      outcome: event.target
                        .value as KnowledgeContent["outcome"],
                    })
                  }
                >
                  <option value="unresolved">Unresolved</option>
                  {latest.source.actual_outcome !== "unresolved" && (
                    <option value={latest.source.actual_outcome}>
                      {humanize(latest.source.actual_outcome)}
                    </option>
                  )}
                </select>
              </label>
              <label>
                Check focus
                <select
                  value={content.check_focus}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      check_focus: event.target
                        .value as KnowledgeContent["check_focus"],
                    })
                  }
                >
                  <option value="nozzle_inspection">Nozzle inspection</option>
                  <option value="air_supply_review">
                    Air-cap and supply review
                  </option>
                  <option value="material_review">
                    Material and idle-purge review
                  </option>
                </select>
              </label>
              <details>
                <summary>Supporting evidence</summary>
                {latest.source.evidence.map((item) => (
                  <label className="knowledge-check" key={item.id}>
                    <input
                      type="checkbox"
                      checked={content.supporting_evidence_ids.includes(
                        item.id,
                      )}
                      onChange={(event) =>
                        setContent({
                          ...content,
                          supporting_evidence_ids: event.target.checked
                            ? [...content.supporting_evidence_ids, item.id]
                            : content.supporting_evidence_ids.filter(
                                (id) => id !== item.id,
                              ),
                        })
                      }
                    />
                    <span>
                      {humanize(item.key)}: {candidateValue(item)}
                    </span>
                  </label>
                ))}
              </details>
              <p>
                Saving a correction withdraws the current version from AI reuse
                until the new version is reviewed.
              </p>
            </>
          )}
          <label>
            Reviewer name
            <input
              required
              maxLength={100}
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Review / correction reason
            <textarea
              required
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="knowledge-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I reviewed the source evidence and confirm this change.</span>
          </label>
          {error && (
            <p role="alert" className="knowledge-warning">
              {error} Reload this experience if another change was saved.
            </p>
          )}
          <div className="review-actions">
            {(editing || entry.status === "draft") && (
              <button
                className="primary"
                type="submit"
                disabled={
                  busy ||
                  !confirmed ||
                  !actor.trim() ||
                  !reason.trim() ||
                  (!editing && entry.generation?.mode === "pending")
                }
              >
                {busy
                  ? "Saving…"
                  : editing
                    ? "Save corrected draft"
                    : "Confirm & publish"}
              </button>
            )}
            {!editing && entry.status === "published" && (
              <button
                className="secondary"
                type="button"
                disabled={busy || !confirmed || !actor.trim() || !reason.trim()}
                onClick={() => void save("dispute")}
              >
                Mark disputed
              </button>
            )}
            {!editing && entry.status !== "archived" && (
              <button
                className="secondary"
                type="button"
                disabled={busy || !confirmed || !actor.trim() || !reason.trim()}
                onClick={() => void save("archive")}
              >
                Archive
              </button>
            )}
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel edit
              </button>
            )}
          </div>
          {entry.generation?.mode === "pending" && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await prepareKnowledge(entry.id, latest.source.revision);
                  onChanged(entry);
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Preparation failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry interrupted preparation
            </button>
          )}
        </form>
      )}
    </section>
  );
}
