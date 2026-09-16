# Industry event-log ingestion profile

**Status:** MVP adapter contract based on the two photographed samples supplied on 16 September 2026. The original machine file should be used to verify spelling, line wrapping, encoding, and timezone before production use.

## What the sample tells us

The file is a headerless, append-oriented event log. It looks like CSV, but it is not a rectangular CSV table: only the first two commas are structural.

```text
YYYY-MM-DD,HH:mm:ss.SSS,<free-form event payload containing more commas>
```

Observed event families are:

- board run start and finish, with an explicit board number and run status;
- timer-between-boards start, stop, duration, and instruction results;
- fiducial search start/finish, positions, and scores;
- local frame correction and frame location relative to base;
- height-sense start/finish and a result expressed relative to the workpiece.

The screenshots also reveal several ingestion hazards:

- long events may appear wrapped; a physical continuation line may not repeat the timestamp;
- timestamps have millisecond precision but no timezone;
- at least one event is displayed after a later timestamp, so source order and event time are not interchangeable;
- several instruction records repeat the same runtime with overlapping conditions (`<= 120`, `> 60`, `> 120`);
- event payloads contain commas, colons, parentheses, units, ellipses, and inconsistent whitespace;
- run markers contain board IDs, but most measurement events do not, so attaching every nearby measurement to the latest board would be an unsupported inference;
- `Status: PASS` has an unknown scope. It must remain a machine-run status and must not be presented as proof that dispensing quality passed.

## Module seam

The format-specific adapter exposes one interface:

```js
parseIndustryEventLog(text, { sourceName, timezoneOffset }) => IngestionResult
```

It returns data and performs no database writes. This lets the upload flow show the preview and warnings before the user commits provisional evidence.

`IngestionResult` contains:

- lossless normalized events with raw text and source-line references;
- typed fields for recognized event families;
- board run summaries correlated only through explicit board IDs;
- direct, provisional evidence candidates;
- structured warnings and import statistics;
- a source digest for file-level identity and stable event IDs.

The reference implementation is in `src/ingestion/industryEventLog.mjs`. It deliberately keeps unknown events instead of dropping them. `fixtures/demo-industry-machine.log` is a manually reconstructed, simulated demo input; its companion metadata records the provenance and limitations that the UI must display.

The FastAPI runtime uses the Python port at
`apps/api/src/flowpilot/ingestion/industry_event_log.py`. Full-output parity tests
compare it with the JavaScript reference. Both retain the same camelCase ingestion
contract; investigation contracts use the separate PRD snake_case vocabulary.
`POST /api/logs/preview` exposes the adapter without database writes. See
[Development](DEVELOPMENT.md) for setup and contract-generation commands.

## Ingestion stages

1. **Fingerprint:** hash the original bytes/text and retain the filename.
2. **Envelope parse:** split each timestamped line at the first two commas only.
3. **Continuation recovery:** append a non-timestamped physical line to the preceding event and emit a warning.
4. **Classification:** apply deterministic patterns for the known event families; retain unmatched payloads as `unknown`.
5. **Normalization:** parse numbers and units only when the pattern is recognized. Missing values remain absent, never zero.
6. **Correlation:** pair `Run Started` and `Run Finished` only by explicit board ID. Do not guess board ownership for fiducial, frame, height, or timer events.
7. **Evidence projection:** emit direct facts as provisional evidence with the raw line as provenance.
8. **Preview and commit:** show time range, timezone state, recognized/unknown counts, incomplete runs, out-of-order events, and evidence candidates before case attachment.

## Safe evidence from this format

| Event | Safe normalized fact | Important limitation |
|---|---|---|
| `Run Finished` | Machine run status by board ID | `PASS` is not product-quality verification |
| Timer stopped | Time between boards in seconds and conveyor ID | Prefer logged duration; keep timestamp delta only as a separate derived check |
| Fiducial found | Fiducial ID, position, unit, score | No acceptance limit is shown in the sample |
| Frame location | X/Y/rotation with original units | Do not reinterpret axes or tolerances |
| Height sense result | Z and sampled X/Y with coordinate context | The exact equipment coordinate convention is not documented |
| Instruction result | Metric, operator, threshold, runtime | Repeated/overlapping conditions are rules, not distinct sensor readings |

The sample does **not** provide pressure setpoint, actual pressure, valve-open time, material temperature, recipe ID, dot diameter, or a direct obstruction signal. Those values must remain missing. This log can contribute timing/alignment/height context, but on its own it cannot prove the nozzle-restriction hypothesis.

## Preview warnings

The MVP should make these warning types visible:

- timezone missing;
- continuation line recovered;
- unknown event retained;
- timestamp out of source order;
- run start or finish missing within the uploaded slice;
- repeated run start for the same board;
- no diagnostically relevant fields for the current hypothesis.

Unknown events are a compatibility metric, not an import failure. The preview should show both recognized-event coverage and evidence coverage; a file can parse successfully while contributing little evidence to the active diagnosis.

## Production follow-ups

Before using this adapter beyond the demo:

- obtain the original log rather than a screenshot and test its actual encoding and line endings;
- confirm the site timezone and daylight-saving behavior;
- confirm whether visual wrapping in the editor represents real newline characters;
- ask the equipment owner what `Run Finished ... PASS`, fiducial score, height coordinates, and instruction predicates mean;
- establish thresholds only from an approved machine/process specification;
- support incremental tail ingestion with a persisted byte offset and partial-line buffer;
- deduplicate retries using the source digest plus source position;
- monitor unknown-event rate so a vendor software update cannot silently reduce extraction coverage.
