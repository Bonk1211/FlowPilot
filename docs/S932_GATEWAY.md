# S932 export gateway and mock demonstration

The gateway reads a normalized JSONL export and preserves incident originals. It does not connect to an S932, control equipment, inspect proprietary log formats, send email, or call a model. A separate incident worker can analyze the saved evidence under the configured external-data policy.

## Run the bundled mock first

No machine, SMTP account, site credential, or export-root configuration is required:

```sh
uv run alembic -c apps/api/alembic.ini upgrade head
uv run python -m flowpilot.incidents.gateway --mock --once
```

The command prints a JSON result containing the saved incident ID. Open `/incidents/<ID>` in the application. Running the same command again returns the same incident and does not attach duplicate evidence.

The mock gateway also queues independent analysis and handoff jobs for the saved evidence. Run `npm run dev:mock` against the same database to let its background workers consume those jobs. The gateway itself does not call a model; mock startup disables external providers, so diagnosis and drafting use the declared offline fallbacks.

The bundled [events.jsonl](../fixtures/s932-gateway/events.jsonl) contains six explicitly synthetic records: known-good image, material-change note, first-known-bad image, quality trigger, mass/pressure log and unavailable PM record. Its two image originals reuse the repository's illustrative vision fixtures. The mass and pressure values are demonstration data, not measurements or approved settings.

`--mock` always defaults to `fixtures/s932-gateway`, forces the resulting incident to `synthetic` mode and refuses any evidence marked `synthetic: false`. It does not bypass access rules for a live deployment. Expected-source placeholders are also labelled synthetic in this mode.

## Normalized export contract

An approved exporter writes one complete JSON object per line to `events.jsonl`. Every line ends with a newline. The gateway deliberately does not guess how a manufacturer's native export should be parsed.

An evidence envelope contains:

```json
{
  "schema_version": "1.0",
  "event_id": "unique-export-event-001",
  "kind": "evidence",
  "tool_id": "S932-MOCK-01",
  "configuration": "S932 / DJ-2200 / BFS",
  "exported_at": "2026-09-30T09:01:05+08:00",
  "evidence": {
    "id": "unique-evidence-001",
    "kind": "log",
    "role": "machine_log",
    "label": "Synthetic mass trend",
    "source_ref": "mock-export:machine_log",
    "tool_id": "S932-MOCK-01",
    "configuration": "S932 / DJ-2200 / BFS",
    "event_time": "2026-09-30T09:00:48+08:00",
    "event_timezone": "Asia/Kuala_Lumpur",
    "time_uncertain": true,
    "clock_offset_seconds": 17,
    "synthetic": true,
    "status": "collected",
    "provenance": "Synthetic example only",
    "values": {"mass_trend": "falling", "units": {"mass": "mg"}}
  }
}
```

For an image or other original file, include an optional `artifact` object containing `relative_path`, lowercase hexadecimal `sha256`, and `media_type`. The referenced file must be a regular file under the approved export root. The gateway archives the exact bytes through the existing artifact store and links the archived artifact to the evidence. Without an artifact, it archives the original normalized JSON line itself.

Evidence must explicitly match the envelope's tool and configuration. Lot, tray and unit identifiers remain unknown when absent; the gateway does not manufacture associations. Input evidence IDs must be unique for distinct records. A correction or a source that becomes available later needs a new event ID and evidence ID, retaining the same `source_ref` and role. This lets a collected source supersede a pending, unavailable or failed record without destroying the original.

A trigger contains `kind: "trigger"`, the same identity/configuration/export-time fields, `symptom`, and `trigger_origin: "alarm" | "image_quality" | "manual"`. It can declare `lot_id` and `expected_sources`, each with `kind`, `role`, `label` and `source_ref`. The gateway first saves an incident with pending placeholders and a partial handoff, then attaches available records.

Use `last_good` and `first_bad` only when the exporter has a basis for those classifications. The gateway selects the latest explicitly labelled good record before the trigger and the earliest explicitly labelled bad record within the window. It preserves the selected records' lot/tray/unit identities. This is a recorded boundary, not proof that intermediate units were inspected or that the full affected extent is known.

## Timing, recovery and failures

- The durable buffer and file checkpoint live in SQLite, so stopping and restarting the process preserves the collection window and incident association.
- Pre/post windows use the exporter timestamp, which must include a UTC offset. Raw equipment event timestamps, timezone and optional clock correction remain separate. A correction never rewrites the original timestamp.
- Matching requires the same tool and exact configuration. Known conflicting lots are excluded; images with unknown lot scope are not assigned to a trigger with a known lot. Unmatched evidence remains in the buffer until retention expires.
- Every expected source starts pending. Explicit unavailable or failed source records are retained. A source that has not arrived when the post window ends becomes unavailable. A later matching export can supersede that record.
- Complete malformed lines are recorded as failures and checkpointed. A trailing partial line waits for its terminating newline. Reusing a stable event ID with changed content stops ingestion; publish a new event ID for a correction.
- A file that is replaced or truncated is read again through stable event IDs. Repeated triggers and evidence do not create another incident or attachment.
- Missing originals, path escape, symlink traversal or hash mismatch produce a failed source. They do not become normal readings. Publish a new corrected export record to retry that source.
- Originals are read through directory-relative file descriptors with symlink following disabled. Nonregular files are rejected. The export root is never written.
- Buffered bytes expire after the larger of one hour or the combined configured pre/post window, measured from gateway receipt. Originals already attached to an incident follow artifact retention separately.

The current local adapter reads exports up to 64 MB and normalized lines up to 64 KB. Artifact sizes follow `FLOWPILOT_INCIDENT_ARTIFACT_LIMIT_BYTES`. Rotate export files and use stable IDs; this implementation is intended for one gateway process per export root.

## Future site configuration

This is optional until an equipment owner provides an approved export path and mapping. A live run requires both configured access mode and an explicit export root:

```text
FLOWPILOT_INCIDENT_AUTH_MODE=configured
FLOWPILOT_INCIDENT_GATEWAY_ROOT=/approved/read-only/export/path
FLOWPILOT_INCIDENT_GATEWAY_PRE_SECONDS=300
FLOWPILOT_INCIDENT_GATEWAY_POST_SECONDS=60
```

The OS account should have read-only access to that path. `--watch --interval 5` polls it with bounded waits; interval values must be between 1 and 60 seconds. The live command omits `--mock`.

Live incidents preserve each evidence item's actual synthetic flag. Merely importing a file does not grant an external model permission to receive it: the default `synthetic_only` data policy still applies. No live S932 connectivity or production diagnostic accuracy has been validated by the mock tests.

## Verification

```sh
uv run pytest apps/api/tests/test_incident_gateway.py
```

The tests cover the bundled mock, original-byte hashes, replay idempotence, restart between pre-event buffering and trigger, progressive post-event collection, missing PM records, clock uncertainty, wrong tool/configuration/lot, partial and malformed JSONL, source rotation, path/symlink escapes, hash mismatch, live-mode gates and buffer retention.
