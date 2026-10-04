import type { ExperimentPrediction } from "@flowpilot/contracts";
import { signatureWords } from "./mechanismCopy";
import "./SignatureSpark.css";

function path(
  values: number[],
  width: number,
  height: number,
  [low, high]: [number, number],
) {
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y =
        ((high - Math.min(high, Math.max(low, value))) / (high - low || 1)) *
        height;
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * The shape an experiment's model predicts, drawn against its control
 * condition. It is the visual name of an experiment wherever it appears.
 */
export function SignatureSpark({
  prediction,
  size = "small",
}: {
  prediction: Pick<
    ExperimentPrediction,
    "relative_mass" | "control_relative_mass" | "signature" | "tested_severity"
  >;
  size?: "small" | "large";
}) {
  const width = size === "small" ? 56 : 240;
  const height = size === "small" ? 20 : 72;
  // The small glyph is scaled to its own range so the shape reads at a glance;
  // the large chart keeps a fixed scale so experiments compare honestly.
  const all = [
    ...prediction.relative_mass,
    ...prediction.control_relative_mass,
  ];
  const range: [number, number] =
    size === "small" ? [Math.min(...all), Math.max(...all)] : [0.4, 1.05];
  return (
    <svg
      className="signature-spark"
      data-size={size}
      viewBox={`-2 -2 ${width + 4} ${height + 4}`}
      width={width + 4}
      height={height + 4}
      style={{ width: width + 4, height: height + 4 }}
      // The small glyph sits beside text that already names the shape.
      aria-hidden={size === "small" || undefined}
      role={size === "small" ? undefined : "img"}
      aria-label={
        size === "small"
          ? undefined
          : `Predicted shape: ${signatureWords[prediction.signature]} at severity ${prediction.tested_severity.toFixed(2)}, against the control condition.`
      }
    >
      {size === "large" && (
        <line
          className="signature-spark-axis"
          x1={0}
          x2={width}
          y1={height}
          y2={height}
        />
      )}
      <path
        className="signature-spark-control"
        d={path(prediction.control_relative_mass, width, height, range)}
      />
      <path
        className="signature-spark-line"
        d={path(prediction.relative_mass, width, height, range)}
      />
    </svg>
  );
}
