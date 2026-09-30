import { useEffect, useState } from "react";
import type {
  IncidentSourceDocument,
  SourceConflict,
} from "@flowpilot/contracts";
import { incidentFetch } from "./api";
import { useIncidentAccess } from "./AccessPanel";

const base = "/api/incident-knowledge";

export function KnowledgeRegistry({
  configuration,
}: {
  configuration: string;
}) {
  const access = useIncidentAccess();
  const [opened, setOpened] = useState(false);
  const [documents, setDocuments] = useState<IncidentSourceDocument[]>([]);
  const [conflicts, setConflicts] = useState<SourceConflict[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoReview, setDemoReview] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const canEdit = access.permissions.includes("edit");
  const canReview =
    access.mode === "demo"
      ? demoReview
      : access.permissions.includes("publish_knowledge");

  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController();
    Promise.all(
      [base, `${base}/conflicts`].map(async (path) => {
        const response = await incidentFetch(path, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "Source registry could not be loaded. Retry when connected.",
          );
        return response.json();
      }),
    )
      .then(([sources, disagreements]) => {
        setDocuments(sources as IncidentSourceDocument[]);
        setConflicts(disagreements as SourceConflict[]);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Sources unavailable.",
          );
      });
    return () => controller.abort();
  }, [opened, reload]);

  async function save(path: string, payload: unknown, review = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await incidentFetch(base + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(review && demoReview ? { "X-Incident-Role": "engineer" } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          typeof value.detail === "string"
            ? value.detail
            : "Review the required document fields and try again.",
        );
      setNotice(
        "Registry saved. Analyze the incident again to include the current source review.",
      );
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Source change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      className="incident-card"
      aria-label="Controlled source registry"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>Controlled sources & review</summary>
      <p className="incident-muted">
        Exact passages keep their document revision, configuration and review
        history. Published conversation summaries remain contextual references.
        Conflicts block operational use.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={busy}
        onClick={() => {
          setError("");
          setReload((value) => value + 1);
        }}
      >
        Reload source registry
      </button>
      {access.mode === "demo" && (
        <label>
          <input
            type="checkbox"
            checked={demoReview}
            onChange={(event) => setDemoReview(event.target.checked)}
          />{" "}
          Use demonstration knowledge-owner role (no site authority)
        </label>
      )}
      <label>
        Search source text
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!documents.length && (
        <p>
          No controlled originals have been registered. The seeded secondary
          excerpts remain available in the investigation.
        </p>
      )}
      {documents
        .filter((doc) =>
          JSON.stringify(doc.content)
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((doc) => {
          const applicable = doc.content.configurations.some(
            (value) =>
              value.trim().replace(/\s+/g, " ").toLowerCase() ===
              configuration.trim().replace(/\s+/g, " ").toLowerCase(),
          );
          const disputed = conflicts.some(
            (item) =>
              item.status === "unresolved" && item.source_ids.includes(doc.id),
          );
          return (
            <article key={doc.id} className="incident-event-detail">
              <h3>{doc.content.title}</h3>
              <p>
                {doc.content.document_id} · revision{" "}
                {doc.content.document_revision} · {doc.status} ·{" "}
                {doc.content.authority.replaceAll("_", " ")}
              </p>
              <p>
                {applicable
                  ? "Configuration matches"
                  : "Configuration does not match this incident"}
                {disputed ? " · Unresolved source conflict" : ""}
              </p>
              <p className="mono">{doc.id}</p>
              <details>
                <summary>
                  Exact passages, original reference & review history
                </summary>
                <p>{doc.content.original_ref}</p>
                <p className="mono">
                  Original SHA-256:{" "}
                  {doc.content.original_sha256 ?? "Not supplied"}
                </p>
                {doc.content.passages.map((passage) => (
                  <div key={passage.id}>
                    <strong>
                      Section {passage.section}
                      {passage.page ? ` · page ${passage.page}` : ""}
                    </strong>
                    <blockquote style={{ whiteSpace: "pre-wrap" }}>
                      {passage.text}
                    </blockquote>
                  </div>
                ))}
                {doc.reviews?.map((review) => (
                  <p key={review.version}>
                    Review {review.version}: {review.decision} by {review.actor}{" "}
                    — {review.notes}
                  </p>
                ))}
              </details>
              {canReview && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void save(
                      `/${doc.id}/reviews`,
                      {
                        revision: doc.revision,
                        decision: data.get("decision"),
                        notes: data.get("notes"),
                      },
                      true,
                    );
                  }}
                >
                  <label>
                    Source decision
                    <select name="decision">
                      <option value="publish">
                        Publish this reviewed revision
                      </option>
                      <option value="withdraw">Withdraw this revision</option>
                    </select>
                  </label>
                  <label>
                    Review notes
                    <textarea name="notes" required maxLength={3000} />
                  </label>
                  <button disabled={busy}>Record source review</button>
                </form>
              )}
            </article>
          );
        })}
      {canEdit && (
        <details>
          <summary>Register a document revision</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save("", {
                document_id: data.get("document_id"),
                document_revision: data.get("revision"),
                title: data.get("title"),
                configurations: String(data.get("configurations"))
                  .split("\n")
                  .map((value) => value.trim())
                  .filter(Boolean),
                authority: data.get("authority"),
                original_ref: data.get("original_ref"),
                original_sha256: data.get("hash") || null,
                passages: [
                  {
                    id: "passage-1",
                    section: data.get("section"),
                    text: data.get("passage"),
                  },
                ],
              });
            }}
          >
            <label>
              Document ID
              <input name="document_id" required maxLength={150} />
            </label>
            <label>
              Document revision
              <input name="revision" required maxLength={100} />
            </label>
            <label>
              Title
              <input name="title" required maxLength={200} />
            </label>
            <label>
              Applicable configurations (one per line)
              <textarea
                name="configurations"
                defaultValue={configuration}
                required
              />
            </label>
            <label>
              Source authority
              <select name="authority" defaultValue="secondary_summary">
                <option value="secondary_summary">Secondary summary</option>
                <option value="example">Example</option>
                <option value="controlled_procedure">
                  Controlled procedure
                </option>
              </select>
            </label>
            <label>
              Original document reference
              <input name="original_ref" required maxLength={1000} />
            </label>
            <label>
              Original file SHA-256 (required to approve a controlled procedure)
              <input name="hash" pattern="[a-fA-F0-9]{64}" maxLength={64} />
            </label>
            <label>
              Page or section
              <input name="section" required maxLength={150} />
            </label>
            <label>
              Exact source passage
              <textarea name="passage" required maxLength={20000} rows={6} />
            </label>
            <p>
              Registering preserves this version; publication requires a
              separate review.
            </p>
            <button disabled={busy}>Register source revision</button>
          </form>
        </details>
      )}
      <h3>Source conflicts</h3>
      {!conflicts.length && (
        <p>
          No conflicts have been recorded. This does not establish agreement
          between sources.
        </p>
      )}
      {conflicts.map((item) => (
        <article key={item.id}>
          <p>
            {item.status}: {item.description}
          </p>
          <p className="mono">{item.source_ids.join(", ")}</p>
          {item.reviews?.map((review) => (
            <p key={review.version}>
              {review.decision} by {review.actor}: {review.notes}
            </p>
          ))}
          {canReview && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void save(
                  `/conflicts/${item.id}/reviews`,
                  {
                    revision: item.revision,
                    decision:
                      item.status === "unresolved" ? "resolve" : "reopen",
                    notes: data.get("notes"),
                  },
                  true,
                );
              }}
            >
              <label>
                Conflict review notes
                <textarea name="notes" required maxLength={3000} />
              </label>
              <button disabled={busy}>
                {item.status === "unresolved"
                  ? "Resolve conflict"
                  : "Reopen conflict"}
              </button>
            </form>
          )}
        </article>
      ))}
      {canEdit && documents.length >= 2 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void save("/conflicts", {
              source_ids: data.getAll("sources"),
              description: data.get("description"),
            });
          }}
        >
          <label>
            Conflicting source revisions (select at least two)
            <select name="sources" multiple required>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.content.document_id} / {doc.content.document_revision}
                </option>
              ))}
            </select>
          </label>
          <label>
            Describe the disagreement
            <textarea name="description" required maxLength={3000} />
          </label>
          <button disabled={busy}>Record source conflict</button>
        </form>
      )}
    </details>
  );
}
