import type { RecoveryChecks } from "@flowpilot/contracts";
import golden from "../../../../fixtures/v2/golden-scenario.json";

export function RecoveryForm({
  value,
  onChange,
  photoMode = false,
}: {
  value: RecoveryChecks;
  onChange: (v: RecoveryChecks) => void;
  photoMode?: boolean;
}) {
  return (
    <fieldset className="recovery-checks">
      <legend>
        {photoMode ? "Equipment recovery checks" : "Simulated recovery checks"}
      </legend>
      <p>
        Check lanes A and B. Each first carrier requires all units accepted:
        full, centered coverage without dry regions, blobs, staggering, line-end
        droplets or overspray. Completion does not release a production lot.
      </p>
      <details className="recovery-demo-shortcut">
        <summary>Demo shortcut</summary>
        <p>
          Fill the form with simulated passing results. This does not run a
          machine test; review and confirm the observations yourself.
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...golden.recovery_checks,
              confirmed: false,
            } as RecoveryChecks)
          }
        >
          Use simulated passing check results
        </button>
      </details>
      <div className="recovery-check-grid">
        {(
          [
            ["prompted_setup", "Prompted Setup"],
            ["calibration", "Auto Flux Weight Calibration"],
            ["weight_within_limits", "Flux weight within referenced limits"],
            [
              "pressure_within_limits",
              "Fluid pressure within referenced limits",
            ],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            >
              <option value="unknown">Not confirmed</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
        ))}
        <label>
          Limits reference
          <input
            value={value.limits_reference}
            maxLength={200}
            onChange={(e) =>
              onChange({ ...value, limits_reference: e.target.value })
            }
          />
        </label>
        {(value.first_carriers ?? []).map((lane, i) => (
          <label key={lane.lane}>
            Lane {lane.lane}: all units on first carrier accepted
            <select
              value={lane.all_units_accepted}
              onChange={(e) =>
                onChange({
                  ...value,
                  first_carriers: value.first_carriers!.map((item, j) =>
                    j === i
                      ? {
                          ...item,
                          all_units_accepted: e.target.value as
                            "pass" | "fail" | "unknown",
                        }
                      : item,
                  ),
                })
              }
            >
              <option value="unknown">Not confirmed</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
        ))}
        <label>
          Subsequent trays required by recovery procedure
          <select
            value={value.subsequent_required}
            onChange={(e) =>
              onChange({
                ...value,
                subsequent_required: e.target.value as "yes" | "no" | "unknown",
              })
            }
          >
            <option value="unknown">Unknown</option>
            <option value="yes">Yes — at least five</option>
            <option value="no">No — explicitly not required</option>
          </select>
        </label>
        {value.subsequent_required === "yes" && (
          <label>
            Accepted subsequent trays
            <input
              type="number"
              min={0}
              max={100}
              value={value.subsequent_trays_accepted}
              onChange={(e) =>
                onChange({
                  ...value,
                  subsequent_trays_accepted: Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </div>
      <label className="prototype-checkbox">
        <input
          type="checkbox"
          checked={value.confirmed}
          onChange={(e) => onChange({ ...value, confirmed: e.target.checked })}
        />
        {photoMode
          ? "I confirm these recovery observations."
          : "I confirm these simulated recovery observations."}
      </label>
    </fieldset>
  );
}
