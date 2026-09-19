# FlowPilot presentation logs

These are **synthetic** logs written for the two photo demo cases. They follow the screenshot's timestamped, headerless event format. They are not exports from NSW equipment. The `Flux Weight Results` and `Fluid Pressure Results` events are FlowPilot demo extensions; their measurements and tolerances are illustrative, not equipment specifications.

| Photo in `../vision/` | Log | Photo Board | Weight sequence | Expected path |
| --- | --- | --- | --- | --- |
| `incomplete-coverage.png` | `synthetic-incomplete-coverage.log` | 103 | 20 → 18 → 16 mg | Fluid-path restriction is a candidate; inspect the nozzle, confirm an obstruction, record the correction, verify using `normal.png` plus equipment checks. |
| `coarse-deposits.png` | `synthetic-coarse-deposits.log` | 203 | 20.0 → 20.1 → 19.9 mg | Weight remains in range despite blobs; inspect the nozzle, confirm no obstruction, hand off for atomization / air-supply review. |

Both logs contain three complete Board runs on 2026-09-19. The first covers Boards 101–103, the second 201–203. The last Board in each file corresponds to its photo. The weight reference is 19–21 mg, target 20 mg. Pressure readings are 1.50 / 1.49 / 1.50 bar at a 1.50 bar setpoint. Run `PASS` describes machine-run completion; it does **not** describe coating quality or override the measured weight.

## Presentation steps

1. Upload the matching photo and select **Analyze photo**.
2. Select **Continue to context**. Upload its matching `.log` file under **Machine log**.
3. Check the selected **Board shown in the photo** and confirm the log matches the inspection.
4. Select **Incomplete coverage** for Board 103 or **Blobs or line-end droplets** for Board 203.
5. In the weight and pressure questions, select **Use log evidence**. For material/idle-purge and collision/setup questions, select **Not recorded**, unless deliberately testing those alternatives. Notes are optional and start empty.
6. Select **Generate diagnosis**, review the evidence, then continue with the existing 3D inspection.

A log is optional. Without one, report actual observations or select **Not recorded**. Returning to the photo preserves the context draft. Replacing/reanalyzing the photo requires confirming the retained log again. Changing/removing a log or selecting another Board invalidates adopted log answers. No diagnosis is inferred from a filename or fixture identity.

## Extension syntax

```text
2026-09-19,09:02:08.000,Fluid Pressure Results,Board #103,Recipe = FLUX-A,Setpoint = 1.500 bar,Actual = 1.500
2026-09-19,09:02:10.000,Flux Weight Results,Board #103,Recipe = FLUX-A,Measured = 16.000 mg,Target = 20.000,Lower Limit = 19.000,Upper Limit = 21.000
```

The trailing target and limits use the same unit as `Measured`. Raw fields, source line numbers, Board IDs, recipe and timestamps are retained. Timestamp continuation lines are handled as in the original parser. No timezone is embedded in the files; the UI retains local time and reports that limitation without inventing a UTC offset.

The server evaluates only the selected Board and up to two preceding complete runs. The selected window must have unambiguous Board IDs and one measurement per Board per measurement type. It does not pull subsequent records into an earlier Board's assessment.

- **Falling weight:** three comparable `mg` measurements, unchanged recipe/target/limits, strictly decreasing and at least a 10% first-to-last decline. Otherwise no falling trend is asserted; an all-in-range window supports the demo's no-significant-fall answer.
- **Weight in range:** the selected Board's valid measurement is compared with its recorded lower/upper limits. Missing/inconsistent window measurements suppress suggestions.
- **Pressure stable in the window:** three `bar` readings at the same recipe/setpoint, each within ±5% of that setpoint. This is a local sampling rule, not proof of continuous stability. Other patterns remain for technician assessment.
- Out-of-order timestamps, insufficient measurements, mismatched units or changing conditions do not produce the affected automatic suggestions.

These rules supply optional, explicitly confirmed answers. Disagreement with an observation requires a reason and a source choice; only the selected answer contributes to ranking. Both the raw log and original conflict record remain available. Rejecting a source measurement later invalidates its dependent answer. A nozzle obstruction still requires a confirmed inspection.
