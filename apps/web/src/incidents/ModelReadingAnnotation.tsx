import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { placeLabel, type LabelPosition } from "../scene/labelLayout";
import type { ReadingTarget } from "../scene/shots";
import type { ScreenAnchor } from "../scene/stage";
import "./ModelReadingAnnotation.css";

export type ReadingAnnotationHandle = {
  place: (anchor: ScreenAnchor | null) => void;
};

/** A form on a mesh's annotation. Camera frames update only its position and leader. */
export function ModelReadingAnnotation({
  ref,
  target,
  index,
  total,
  schematic,
  onGo,
  onFocus,
  children,
}: {
  ref: Ref<ReadingAnnotationHandle>;
  target: ReadingTarget;
  index: number;
  total: number;
  schematic: boolean;
  onGo: (index: number) => void;
  onFocus: () => void;
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const line = useRef<SVGLineElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const locationHint = useRef<HTMLParagraphElement>(null);
  const anchor = useRef<ScreenAnchor | null>(null);
  const position = useRef<LabelPosition | undefined>(undefined);

  function place(next: ScreenAnchor | null) {
    anchor.current = next;
    const root = layer.current;
    const box = card.current;
    if (!root || !box) return;
    const width = root.clientWidth;
    const height = root.clientHeight;
    const mobile = width < 700;
    const bounds = {
      left: mobile ? 12 : 84,
      right: width - 12,
      top: mobile ? 152 : 96,
      bottom: height - 16,
    };
    const size = { width: box.offsetWidth, height: box.offsetHeight };
    const origin = root.getBoundingClientRect();
    const occupied = mobile
      ? []
      : [
          ...root.parentElement!.querySelectorAll(
            ".guided-topbar, .guided-console, .guided-auxiliary, .assembly-camera-tools",
          ),
        ].map((panel) => {
          const rect = panel.getBoundingClientRect();
          return {
            left: rect.left - origin.left,
            right: rect.right - origin.left,
            top: rect.top - origin.top,
            bottom: rect.bottom - origin.top,
          };
        });
    const placed =
      next?.visible && !mobile
        ? placeLabel(next, size, bounds, occupied, position.current)
        : undefined;
    const x =
      placed?.x ??
      Math.max(
        bounds.left + size.width / 2,
        Math.min(bounds.right - size.width / 2, width / 2),
      );
    const y =
      placed?.y ??
      (mobile
        ? bounds.bottom - size.height / 2
        : (bounds.top + bounds.bottom) / 2);
    position.current = next
      ? { x, y, anchorX: next.x, anchorY: next.y }
      : undefined;
    box.style.transform = `translate(${x - size.width / 2}px, ${y - size.height / 2}px)`;
    root.dataset.located = String(!!next?.visible);
    if (locationHint.current)
      locationHint.current.hidden = !!next?.visible || schematic;
    if (next?.visible && line.current && dot.current) {
      line.current.setAttribute("x1", String(next.x));
      line.current.setAttribute("y1", String(next.y));
      line.current.setAttribute(
        "x2",
        String(
          Math.max(x - size.width / 2, Math.min(x + size.width / 2, next.x)),
        ),
      );
      line.current.setAttribute(
        "y2",
        String(
          Math.max(y - size.height / 2, Math.min(y + size.height / 2, next.y)),
        ),
      );
      dot.current.setAttribute("cx", String(next.x));
      dot.current.setAttribute("cy", String(next.y));
    }
  }
  useImperativeHandle(ref, () => ({ place }));
  useLayoutEffect(() => {
    position.current = undefined;
    anchor.current = null;
    if (card.current) card.current.open = true;
    if (body.current) body.current.scrollTop = 0;
    const refresh = () => {
      if (!schematic) {
        place(anchor.current);
        return;
      }
      const root = layer.current!;
      const part = target.part === "bfs_lid" ? "bfs_bottle" : target.part;
      const symbol = root.parentElement?.querySelector(
        `[data-node-id="${part}"]`,
      );
      if (!symbol) {
        place(null);
        return;
      }
      const rect = symbol.getBoundingClientRect();
      const origin = root.getBoundingClientRect();
      place({
        x: rect.left + rect.width / 2 - origin.left,
        y: rect.top + rect.height / 2 - origin.top,
        visible: true,
      });
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(layer.current!);
    observer.observe(card.current!);
    refresh();
    return () => observer.disconnect();
    // The form stays mounted as the step, camera or display mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.mesh, index, schematic]);

  return (
    <div
      ref={layer}
      className="model-reading-annotation"
      data-part-id={target.part}
      data-anchor-mesh={target.mesh}
      data-schematic={schematic}
    >
      <svg className="model-reading-leader" aria-hidden="true">
        <line ref={line} />
        <circle ref={dot} r="7" />
      </svg>
      <details
        ref={card}
        open
        className="model-reading-card"
        aria-label={`Record at ${target.text}`}
        onFocusCapture={onFocus}
      >
        <summary>
          <span className="eyebrow">
            Step {index + 1} of {total} · Record here
          </span>
          <strong>{target.text}</strong>
        </summary>
        <div ref={body} className="model-reading-body">
          <p ref={locationHint} className="incident-caption" hidden>
            Location outside the view. Use the camera controls to bring this
            part into view.
          </p>
          {children}
        </div>
        <footer className="model-reading-navigation">
          <button
            type="button"
            className="secondary"
            aria-label="Previous step"
            disabled={index === 0}
            onClick={() => onGo(index - 1)}
          >
            <ArrowLeft aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            className="primary"
            aria-label="Next step"
            disabled={index === total - 1}
            onClick={() => onGo(index + 1)}
          >
            Next step <ArrowRight aria-hidden="true" />
          </button>
        </footer>
      </details>
    </div>
  );
}
