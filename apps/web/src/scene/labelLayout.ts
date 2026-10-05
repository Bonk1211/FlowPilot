type Point = { x: number; y: number };
export type LabelBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export type LabelPosition = Point & { anchorX: number; anchorY: number };

/** Follow the part without changing sides; move only as far as a collision requires. */
export function placeLabel(
  anchor: Point,
  size: { width: number; height: number },
  bounds: LabelBounds,
  occupied: LabelBounds[],
  previous?: LabelPosition,
): LabelPosition | undefined {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const minimumX = bounds.left + halfWidth;
  const maximumX = bounds.right - halfWidth;
  const minimumY = bounds.top + halfHeight;
  const maximumY = bounds.bottom - halfHeight;
  if (minimumX > maximumX || minimumY > maximumY) return;
  const clampX = (x: number) => Math.max(minimumX, Math.min(maximumX, x));
  const clampY = (y: number) => Math.max(minimumY, Math.min(maximumY, y));
  const offset = halfWidth + 32;
  const preferred = {
    x: clampX(
      previous
        ? previous.x + anchor.x - previous.anchorX
        : anchor.x +
            (anchor.x < (bounds.left + bounds.right) / 2 ? -offset : offset),
    ),
    y: clampY(
      previous ? previous.y + anchor.y - previous.anchorY : anchor.y - 24,
    ),
  };
  const fits = (x: number, y: number) =>
    // Keep the leader's anchor outside its own text box.
    Math.hypot(
      Math.max(0, Math.abs(x - anchor.x) - halfWidth),
      Math.max(0, Math.abs(y - anchor.y) - halfHeight),
    ) >= 16 &&
    occupied.every(
      (rect) =>
        x + halfWidth + 4 <= rect.left ||
        x - halfWidth >= rect.right + 4 ||
        y + halfHeight + 4 <= rect.top ||
        y - halfHeight >= rect.bottom + 4,
    );
  const position = (x: number, y: number) => ({
    x,
    y,
    anchorX: anchor.x,
    anchorY: anchor.y,
  });
  if (fits(preferred.x, preferred.y)) return position(preferred.x, preferred.y);

  // Try both sides and above/below the part, plus the edges of blocking panels.
  const xs = [
    preferred.x,
    anchor.x - offset,
    anchor.x + offset,
    anchor.x,
    minimumX,
    maximumX,
    ...occupied.flatMap((rect) => [
      rect.left - halfWidth - 4,
      rect.right + halfWidth + 4,
    ]),
  ].map(clampX);
  const ys = [
    preferred.y,
    anchor.y - halfHeight - 24,
    anchor.y + halfHeight + 24,
    minimumY,
    maximumY,
    ...occupied.flatMap((rect) => [
      rect.top - halfHeight - 4,
      rect.bottom + halfHeight + 4,
    ]),
  ].map(clampY);
  let best: LabelPosition | undefined;
  let distance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const movement = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (movement < distance && fits(x, y)) {
        best = position(x, y);
        distance = movement;
      }
    }
  }
  return best;
}
