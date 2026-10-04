import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Flask } from "@phosphor-icons/react";
import { StoryScene } from "./StoryScene";
import "./landing.css";

const chapters = [
  {
    id: "overview",
    label: "Dispense",
    eyebrow: "01 / THE PROCESS",
    title: (
      <>
        Every story starts
        <br />
        on the <em>line.</em>
      </>
    ),
    text: "The machine dispenses. The coating changes. Your investigation begins with what happened.",
    before: "One symptom. Several possible causes.",
    after: "Start with the evidence.",
  },
  {
    id: "difference",
    label: "Timeline",
    eyebrow: "02 / CONNECT THE EVIDENCE",
    title: (
      <>
        Scattered records.
        <br />
        <em>One clear timeline.</em>
      </>
    ),
    text: "Bring images, machine logs and operator notes into a shared sequence. See what changed—and what is still missing.",
    before: "Conventional: piece together separate files.",
    after: "FlowPilot: follow one connected story.",
  },
  {
    id: "approach",
    label: "Plan",
    eyebrow: "03 / FIND THE NEXT CHECK",
    title: (
      <>
        A reason for
        <br />
        <em>the next check.</em>
      </>
    ),
    text: "Turn the timeline into possible explanations. Build a plan of checks that helps separate one cause from another.",
    before: "Conventional: start with a familiar check.",
    after: "FlowPilot: see the reason for the next check.",
  },
  {
    id: "demo",
    label: "Report",
    eyebrow: "04 / CARRY THE STORY FORWARD",
    title: (
      <>
        One investigation.
        <br />
        <em>Ready to hand over.</em>
      </>
    ),
    text: "Bring the timeline, reasoning and next checks into a report your engineer can follow. The context stays with the work.",
    before: "Conventional: reconstruct the story again.",
    after: "FlowPilot: a handoff built as you investigate.",
  },
];

function preloadWorkspace() {
  void import("./incidents/IncidentWorkspace").catch(() => {
    // Navigation can retry if speculative loading fails.
  });
}

export function LandingPage() {
  const viewport = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    document.title = "FlowPilot · Follow the evidence";
    const root = viewport.current!;
    const page = shell.current!;
    const panels = [...page.querySelectorAll<HTMLElement>(".story-panel")];
    const meter = page.querySelector<HTMLElement>(".story-progress-fill")!;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let target = 0;
    let frame = 0;
    let previousTime = 0;
    let current = -1;
    const readScroll = () => {
      target = Math.max(
        0,
        Math.min(
          1,
          root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight),
        ),
      );
      if (!frame) {
        previousTime = performance.now();
        frame = requestAnimationFrame(update);
      }
    };
    function update(now: number) {
      const dt = Math.max(0, Math.min(64, now - previousTime));
      previousTime = now;
      progress.current = media.matches
        ? target
        : progress.current +
          (target - progress.current) * (1 - Math.exp(-dt / 100));
      if (Math.abs(target - progress.current) < 0.00005)
        progress.current = target;
      const position = progress.current * 3;
      const next = Math.min(3, Math.round(position));
      if (next !== current) {
        current = next;
        setActive(next);
      }
      panels.forEach((panel, i) => {
        const distance = Math.abs(position - i);
        const opacity = media.matches
          ? Number(i === next)
          : Math.max(0, Math.min(1, (0.6 - distance) / 0.28));
        panel.style.opacity = String(opacity);
        panel.style.transform = media.matches
          ? "none"
          : `translateY(${(i - position) * 36}px)`;
        panel.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        panel.inert = i !== next;
      });
      meter.style.transform = `scaleX(${progress.current})`;
      page.dataset.progress = progress.current.toFixed(4);
      frame = progress.current !== target ? requestAnimationFrame(update) : 0;
    }
    const fromHash = () => {
      const index = chapters.findIndex(
        (chapter) => `#${chapter.id}` === location.hash,
      );
      if (index >= 0)
        root.scrollTo({
          top: ((root.scrollHeight - root.clientHeight) * index) / 3,
          behavior: "instant",
        });
      readScroll();
    };
    const preference = () => {
      setReduced(media.matches);
      readScroll();
    };
    root.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("hashchange", fromHash);
    media.addEventListener("change", preference);
    const observer = new ResizeObserver(readScroll);
    observer.observe(root);
    fromHash();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("scroll", readScroll);
      window.removeEventListener("hashchange", fromHash);
      media.removeEventListener("change", preference);
    };
  }, []);

  function goTo(event: MouseEvent<HTMLAnchorElement>, index: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const root = viewport.current!;
    history.pushState(null, "", `#${chapters[index].id}`);
    root.scrollTo({
      top: ((root.scrollHeight - root.clientHeight) * index) / 3,
      behavior: reduced ? "instant" : "smooth",
    });
  }

  return (
    <div
      ref={shell}
      className="story-page"
      data-chapter={active}
      data-progress="0"
    >
      <a
        className="skip-link"
        href="#story-copy"
        onClick={() => viewport.current?.focus()}
      >
        Skip to story
      </a>
      <main
        ref={viewport}
        className="story-scroll"
        tabIndex={0}
        aria-label="FlowPilot scroll-driven story"
      >
        <div className="story-track">
          <div className="story-stage">
            <StoryScene progress={progress} reduced={reduced} />
            <header className="story-header">
              <a
                className="wordmark"
                href="#overview"
                onClick={(event) => goTo(event, 0)}
                aria-label="FlowPilot home"
              >
                <Flask aria-hidden="true" />
                FlowPilot
                <span />
              </a>
              <nav aria-label="Story chapters">
                {chapters.map((chapter, i) => (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    onClick={(event) => goTo(event, i)}
                    aria-current={i === active ? "step" : undefined}
                  >
                    {chapter.label}
                  </a>
                ))}
              </nav>
              <a
                className="story-button story-header-cta"
                href="/incidents"
                onPointerEnter={preloadWorkspace}
                onFocus={preloadWorkspace}
              >
                Open workspace <ArrowRight aria-hidden="true" />
              </a>
            </header>
            <div className="story-copy" id="story-copy">
              {chapters.map((chapter, i) => (
                <section
                  className="story-panel"
                  key={chapter.id}
                  aria-label={chapter.label}
                  aria-hidden={active !== i}
                >
                  <p className="story-eyebrow">
                    <span />
                    {chapter.eyebrow}
                  </p>
                  {i === 0 ? (
                    <h1>{chapter.title}</h1>
                  ) : (
                    <h2>{chapter.title}</h2>
                  )}
                  <p className="story-description">{chapter.text}</p>
                  <div className="story-comparison">
                    <p>{chapter.before}</p>
                    <p>
                      <span />
                      {chapter.after}
                    </p>
                  </div>
                  {i === 0 ? (
                    <a
                      className="story-text-link"
                      href="#difference"
                      onClick={(event) => goTo(event, 1)}
                    >
                      Scroll to unfold the story{" "}
                      <ArrowDown aria-hidden="true" />
                    </a>
                  ) : i === 3 ? (
                    <a
                      className="story-button"
                      href="/incidents"
                      onPointerEnter={preloadWorkspace}
                      onFocus={preloadWorkspace}
                    >
                      Explore the real workspace{" "}
                      <ArrowRight aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="story-microcopy">
                      {i === 1
                        ? "Images · Machine records · Operator notes"
                        : "Evidence → Possible causes → Proposed checks"}
                    </span>
                  )}
                </section>
              ))}
            </div>
            <div className="story-scene-label" aria-hidden="true">
              <span className="story-scene-dot" />
              {
                [
                  "S932 / DISPENSING SYSTEM",
                  "SOURCE EVENTS / TIMELINE",
                  "RESPONSE FLOW / INVESTIGATION PLAN",
                  "ENGINEER HANDOFF / DRAFT REPORT",
                ][active]
              }
              <span>Illustrative story</span>
            </div>
            <footer className="story-footer">
              <span className="story-count">
                <strong>0{active + 1}</strong> / 04
              </span>
              <p>
                {reduced
                  ? "Reduced motion · use the chapters to explore"
                  : "Scroll to move through the story"}
              </p>
              <a
                href={`#${chapters[active === 3 ? 0 : active + 1].id}`}
                onClick={(event) => goTo(event, active === 3 ? 0 : active + 1)}
                aria-label={active === 3 ? "Back to start" : "Next chapter"}
              >
                {active === 3 ? <ArrowUp /> : <ArrowDown />}
              </a>
              <div className="story-progress" aria-hidden="true">
                <span className="story-progress-fill" />
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
