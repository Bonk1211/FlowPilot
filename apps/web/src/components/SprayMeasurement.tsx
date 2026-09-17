import { sampleNames } from "../fluxModel";
import type { Case } from "@flowpilot/contracts";

export function SprayMeasurement({
  value,
  title,
}: {
  value: Case["measurement"];
  title: string;
}) {
  if (!("coverage_pct" in value))
    return (
      <figure className="prototype-image">
        <figcaption>{title} · Archived epoxy measurement</figcaption>
        <svg
          viewBox={`0 0 ${value.width} ${value.height}`}
          role="img"
          aria-label="Archived epoxy dot measurements"
        >
          {value.dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={dot.diameter_px / 2}
              fill="#526e78"
            />
          ))}
        </svg>
        <p>
          Original mean diameter: {value.mean_diameter_px} px. Original result:{" "}
          {value.passed ? "Pass" : "Fail"}.
        </p>
      </figure>
    );
  const bounds = [
    value.target_bounds ?? [60, 40, 300, 120],
    value.keep_out_bounds ?? [40, 20, 320, 140],
  ];
  return (
    <figure className="prototype-image">
      <figcaption>{title} · Measured synthetic raster</figcaption>
      <svg
        viewBox={`0 0 ${value.width} ${value.height}`}
        role="img"
        aria-label={`${sampleNames[value.sample_id]}: ${value.coverage_pct}% coverage`}
      >
        <image
          href={value.image_url}
          width={value.width}
          height={value.height}
        />
        {bounds.map(([x, y, right, bottom], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={right - x}
            height={bottom - y}
            fill="none"
            stroke={i ? "#b32636" : "#175b70"}
            strokeWidth="2"
            strokeDasharray={i ? "6 4" : undefined}
          />
        ))}
      </svg>
      <p>
        Solid box: target bump area. Dashed box: permitted boundary. Dark
        regions: synthetic coarse deposits.
      </p>
      <dl className="prototype-metrics">
        <div>
          <dt>Target coverage</dt>
          <dd>{value.coverage_pct}%</dd>
        </div>
        <div>
          <dt>Uncovered area</dt>
          <dd>{value.uncovered_area_px} px²</dd>
        </div>
        <div>
          <dt>Pattern displacement</dt>
          <dd>{value.displacement_px} px</dd>
        </div>
        <div>
          <dt>Outside boundary</dt>
          <dd>{value.outside_keep_out_px} px²</dd>
        </div>
        <div>
          <dt>Coarse deposits</dt>
          <dd>{value.coarse_area_px} px²</dd>
        </div>
      </dl>
      <p>
        {value.passed
          ? "Synthetic visual criteria passed."
          : "Pattern requires review."}
      </p>
      <small>
        Idealized mask measurements, not production vision. Pixels do not
        measure flux weight or thickness. Demo visual acceptance requires full
        coverage, displacement ≤1 px, and no coarse deposits or material outside
        the boundary.
      </small>
    </figure>
  );
}
