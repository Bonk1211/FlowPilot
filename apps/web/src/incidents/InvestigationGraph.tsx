import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowsIn,
  ArrowsOut,
  Check,
  Crosshair,
  ChatCircle,
  CaretRight,
  ListNumbers,
  Palette,
  SidebarSimple,
  X,
} from "@phosphor-icons/react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  useNodesInitialized,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
  type FitViewOptions,
} from "@xyflow/react";
import type {
  Incident,
  InvestigationNode,
  InvestigationAnswer,
} from "@flowpilot/contracts";
import type { IncidentCommand } from "./api";
import { CausalReasoning } from "./CausalReasoning";
import { InvestigationConversation } from "./InvestigationConversation";
import { LiveTimeline } from "./LiveTimeline";
import type { InvestigationProgressMode } from "./InvestigationProgress";
import "@xyflow/react/dist/style.css";
import "./InvestigationGraph.css";

type Draft = { choice: string; text: string; notes: string; id: string };
const stages = {
  start: { label: "Start", height: 64 },
  evidence: { label: "Evidence", height: 128 },
  decision: { label: "Decision", height: 200 },
  check: { label: "Check", height: 116 },
  clarify: { label: "Clarify", height: 132 },
  review: { label: "Review", height: 108 },
};
type Stage = keyof typeof stages;
type QuestionType = NonNullable<InvestigationNode["question_type"]>;
const questionTypes: Record<
  QuestionType,
  { label: string; description: string }
> = {
  what: { label: "What", description: "Defect, symptom or observed condition" },
  where: { label: "Where", description: "Location of the problem" },
  when: { label: "When", description: "Onset, frequency or sequence" },
  which: {
    label: "Who / Which",
    description: "Person, tool, product or component",
  },
  why_impact: { label: "Why · impact", description: "Why the problem matters" },
  how_detected: {
    label: "How · detected",
    description: "Detection method or signal",
  },
  how_many: {
    label: "How many / much",
    description: "Quantity, magnitude or affected extent",
  },
  why_cause: {
    label: "5 Whys · cause",
    description: "Cause behind an established mechanism",
  },
  verification: {
    label: "Hypothesis test",
    description: "Test an explanation or evidence quality",
  },
  unclassified: {
    label: "Unclassified",
    description: "Question purpose is not established",
  },
};

function questionTypeFor(node: InvestigationNode) {
  return node.kind === "question" || node.kind === "check"
    ? (node.question_type ?? "unclassified")
    : undefined;
}

function questionStyle(type?: string): CSSProperties | undefined {
  return type
    ? ({ "--question-color": `var(--question-${type})` } as CSSProperties)
    : undefined;
}

function panelWidthWithin(width: number, available: number) {
  return Math.max(320, Math.min(width, 720, available * 0.6));
}

type ChartNode = Node<
  {
    stage: Stage;
    title: string;
    prompt: string;
    status: string;
    answer?: string;
    inspected?: boolean;
    spotlight?: boolean;
    processing?: boolean;
    questionType?: QuestionType;
    onInspect?: () => void;
  },
  "stage"
>;
const questionTitles: Record<string, string> = {
  frequency: "How does the defect develop?",
  material: "Which material is recorded?",
  coverage: "What coverage do the images show?",
  recent_changes: "What changed recently?",
  location: "Where is the defect located?",
  pressure_trend: "Is the recorded pressure stable?",
  mass_trend: "Is the recorded mass falling?",
  material_condition: "Has the material condition changed?",
  timing: "Do the sample times align?",
  comparability: "Are the records comparable?",
  idle_history: "Was there an idle interval?",
};

function stageFor(node: InvestigationNode): Stage {
  if (node.kind === "review" || node.kind === "escalate") return "review";
  if (node.clarification_for) return "clarify";
  if (node.kind === "check") return "check";
  return ["material", "coverage", "location", "recent_changes"].includes(
    node.target_fact,
  )
    ? "evidence"
    : "decision";
}

function StageShape({ stage }: { stage: Stage }) {
  const height = stages[stage].height;
  return (
    <svg viewBox={`0 0 280 ${height}`} aria-hidden="true" focusable="false">
      {stage === "decision" ? (
        <polygon points="140,2 278,100 140,198 2,100" />
      ) : stage === "evidence" ? (
        <polygon points="28,2 278,2 252,126 2,126" />
      ) : stage === "clarify" ? (
        <polygon points="28,2 252,2 278,66 252,130 28,130 2,66" />
      ) : (
        <rect
          x="2"
          y="2"
          width="276"
          height={height - 4}
          rx={stage === "check" ? 5 : height / 2}
        />
      )}
    </svg>
  );
}

function StageNode({ data }: NodeProps<ChartNode>) {
  const height = (stages[data.stage].height * 240) / 280;
  const start = data.stage === "start";
  return (
    <div
      className={`flowchart-node stage-${data.stage} is-${data.status}${data.inspected ? " is-inspected" : ""}${data.spotlight ? " is-spotlight" : ""}${data.processing ? " is-processing" : ""}`}
      data-spotlight={data.spotlight || undefined}
      data-question-type={data.questionType}
      style={questionStyle(data.questionType)}
    >
      <span className="flowchart-node-status">
        {data.processing
          ? "Agent working…"
          : data.spotlight
          ? "Spotlight · answer here"
          : start
            ? "Incident opened"
            : data.status === "active"
              ? "Current step"
              : data.status}
      </span>
      {!start && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          style={{ top: 28 }}
        />
      )}
      <button
        type="button"
        className="flowchart-shape nodrag nopan"
        style={{ height }}
        aria-label={`${data.questionType ? `${questionTypes[data.questionType].label} · ` : ""}${stages[data.stage].label} · ${data.status}: ${data.prompt}`}
        aria-pressed={start ? undefined : data.inspected}
        title={data.prompt}
        onClick={data.onInspect}
        disabled={start}
      >
        <StageShape stage={data.stage} />
        <span className="flowchart-shape-text">
          {!start && (
            <span>
              {data.questionType
                ? questionTypes[data.questionType].label
                : stages[data.stage].label}
            </span>
          )}
          <strong>{data.title}</strong>
        </span>
      </button>
      {data.stage !== "review" && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          style={{ top: height + 28, bottom: "auto" }}
        />
      )}
      <span className="flowchart-node-answer" title={data.answer}>
        {data.answer ? `Recorded: ${data.answer}` : ""}
      </span>
    </div>
  );
}
const nodeTypes = { stage: StageNode };
function GraphControls({
  current,
  selected,
  panelOpen,
  panelWidth,
  expanded,
  onFocus,
}: {
  current: string | null;
  selected: string | null;
  panelOpen: boolean;
  panelWidth: number;
  expanded: boolean;
  onFocus: () => void;
}) {
  const { fitView, getNodes, getEdges } = useReactFlow<ChartNode>();
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const lastFocused = useRef<string | null>(null);
  const lastPanelWidth = useRef(panelWidth);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [conversationHeight, setConversationHeight] = useState(280);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 850px)").matches,
  );
  useEffect(() => {
    const graph = controlsRef.current?.closest<HTMLElement>(
      ".investigation-graph",
    );
    const conversation = graph?.querySelector(".investigation-conversation");
    if (!conversation) return;
    const observer = new ResizeObserver(() => {
      const height = conversation.getBoundingClientRect().height;
      setConversationHeight(height);
      graph?.style.setProperty("--conversation-height", `${height}px`);
    });
    observer.observe(conversation);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const screen = matchMedia("(max-width: 850px)");
    const update = () => setReduced(media.matches);
    const resize = () => setNarrow(screen.matches);
    media.addEventListener("change", update);
    screen.addEventListener("change", resize);
    return () => {
      media.removeEventListener("change", update);
      screen.removeEventListener("change", resize);
    };
  }, []);
  const focusId = selected ?? current;
  const visiblePanelWidth = panelWidthWithin(panelWidth, width);
  const frame = `${focusId}:${panelOpen}:${visiblePanelWidth}:${expanded}:${narrow}:${width}:${height}:${conversationHeight}`;
  // Fit within the unobscured canvas, including the floating navigation and panel.
  const padding = useMemo<FitViewOptions["padding"]>(
    () => ({
      top: narrow ? "190px" : "170px",
      right: !narrow && panelOpen ? `${visiblePanelWidth + 40}px` : "32px",
      bottom: `${conversationHeight + (narrow && panelOpen ? Math.min(height * 0.3, 200) + 100 : 100)}px`,
      left: expanded ? (narrow ? "72px" : "112px") : "32px",
    }),
    [
      expanded,
      narrow,
      panelOpen,
      visiblePanelWidth,
      conversationHeight,
      height,
    ],
  );
  useEffect(() => {
    if (!initialized || !focusId || lastFocused.current === frame) return;
    const node = getNodes().find((item) => item.id === focusId);
    if (!node) return;
    // Keep the new question and its sibling choices together as the path grows.
    const parent = getEdges().find((edge) => edge.target === focusId)?.source;
    const neighbors = getNodes().filter((item) =>
      narrow
        ? item.id === focusId
        : item.position.y === node.position.y || item.id === parent,
    );
    void fitView({
      nodes: neighbors,
      padding,
      minZoom: 0.2,
      maxZoom: 1,
      duration:
        reduced || !lastFocused.current || lastPanelWidth.current !== panelWidth
          ? 0
          : 420,
    });
    lastPanelWidth.current = panelWidth;
    lastFocused.current = frame;
  }, [
    focusId,
    frame,
    initialized,
    fitView,
    getNodes,
    getEdges,
    reduced,
    narrow,
    padding,
    panelWidth,
  ]);
  return (
    <div ref={controlsRef} className="investigation-graph-controls">
      <button
        type="button"
        aria-label="Fit chart"
        title="Fit chart"
        disabled={!initialized}
        onClick={() => {
          lastFocused.current = frame;
          void fitView({
            padding,
            maxZoom: 1,
            duration: reduced ? 0 : 320,
          });
        }}
      >
        <ArrowsOut aria-hidden="true" />
        <span>Fit chart</span>
      </button>
      <button
        type="button"
        aria-label="Focus current question"
        title="Focus current question"
        disabled={!current || !initialized}
        onClick={() => {
          lastFocused.current = frame;
          onFocus();
          void fitView({
            nodes: current ? [{ id: current }] : [],
            padding,
            maxZoom: 1,
            duration: reduced ? 0 : 320,
          });
        }}
      >
        <Crosshair aria-hidden="true" />
        <span>Focus current question</span>
      </button>
      <span>Follow the arrows · select a shape to inspect it</span>
    </div>
  );
}

export function InvestigationGraph({
  incident,
  expanded,
  onExpandedChange,
  onAction,
  busy,
  readOnly,
  selectedHypothesisId,
  onSelectHypothesis,
  onSelectEvidence,
  onOpenTimeline,
  onUpdated,
  progressMode,
  progressError,
}: {
  incident: Incident;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAction: (command: IncidentCommand) => Promise<void>;
  busy: boolean;
  readOnly: boolean;
  selectedHypothesisId: string | null;
  onSelectHypothesis: (id: string) => void;
  onSelectEvidence: (id: string) => void;
  onOpenTimeline: () => void;
  onUpdated: (incident: Incident) => void;
  progressMode: InvestigationProgressMode | null;
  progressError: string;
}) {
  const graph = {
    ...incident.investigation,
    nodes: incident.investigation?.nodes ?? [],
    answers: incident.investigation?.answers ?? [],
    expansions: incident.investigation?.expansions ?? [],
  };
  const storageKey = `flowpilot.graph-drafts.${incident.id}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const [textView, setTextView] = useState(false);
  const [whyHowOpen, setWhyHowOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(368);
  const panelRef = useRef<HTMLElement>(null);
  const panelDrag = useRef<{ x: number; width: number } | null>(null);
  const [earlierPaths, setEarlierPaths] = useState(false);
  const [explain, setExplain] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conversing, setConversing] = useState(false);
  const [notice, setNotice] = useState("");
  const [dimensions, setDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const sourcesRef = useRef<HTMLDetailsElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const expandToggle = useRef<HTMLButtonElement>(null);
  const disabled = busy || saving || !!progressMode;
  const activity = conversing
    ? "conversation"
    : (progressMode ?? (saving ? "updating" : null));
  const superseded = new Set(
    graph.answers.map((answer) => answer.supersedes_id),
  );
  const currentAnswer = (id: string) =>
    [...graph.answers]
      .reverse()
      .find((answer) => answer.node_id === id && !superseded.has(answer.id));
  const latest = [...graph.expansions]
    .reverse()
    .find((expansion) => !expansion.superseded);
  const visibleNodes = graph.nodes.filter(
    (node) => earlierPaths || node.status !== "superseded",
  );
  const currentId = graph.active_node_id ?? latest?.recommended_id ?? null;
  const detail =
    visibleNodes.find((node) => node.id === detailId) ??
    visibleNodes.find((node) => node.id === currentId) ??
    visibleNodes[visibleNodes.length - 1];
  const hypotheses = incident.assessment?.hypotheses ?? [];
  const hypothesis =
    hypotheses.find((item) => item.id === selectedHypothesisId) ??
    hypotheses[0];
  const showReasoning = whyHowOpen && !!hypothesis;

  function resizePanel(width: number) {
    const available = panelRef.current?.parentElement?.clientWidth;
    if (available) setPanelWidth(panelWidthWithin(width, available));
  }

  useEffect(() => {
    const resize = () => {
      if (!matchMedia("(max-width: 850px)").matches) {
        const available = panelRef.current?.parentElement?.clientWidth;
        if (available)
          setPanelWidth((width) => panelWidthWithin(width, available));
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [expanded, textView, panelOpen]);

  function inspect(node: InvestigationNode, showSources = false) {
    setWhyHowOpen(false);
    setDetailId(node.id);
    setPanelOpen(true);
    if (node.hypothesis_ids?.[0]) onSelectHypothesis(node.hypothesis_ids[0]);
    if (showSources) {
      requestAnimationFrame(() => {
        const sources = sourcesRef.current;
        if (!sources) return;
        sources.open = true;
        sources.querySelector("summary")?.focus({ preventScroll: true });
        sources.scrollIntoView({
          block: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      });
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const next = {
        ...current,
        [id]: {
          ...(current[id] ?? {
            choice: "",
            text: "",
            notes: "",
            id: `ANS-${crypto.randomUUID()}`,
          }),
          ...patch,
        },
      };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Activity also preserves page drafts. */
      }
      return next;
    });
  }
  async function submit(command: IncidentCommand) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onAction(command);
      setEditing(null);
      setDetailId(null);
      setNotice(
        command.action === "answer_investigation"
          ? "Answer saved. Follow-up preparation uses this recorded answer."
          : "Investigation updated.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Your answer is preserved here.",
      );
    } finally {
      setSaving(false);
    }
  }

  function responseControls(node: InvestigationNode) {
    const answer = currentAnswer(node.id);
    const draft = drafts[node.id];
    const editable = node.status === "active" || editing === node.id;
    const terminal = ["review", "escalate"].includes(node.kind);
    if (
      !editable &&
      node.status !== "proposed" &&
      node.status !== "answered" &&
      answer?.status !== "pending"
    )
      return null;
    return (
      <div
        className={`investigation-response is-${node.status}`}
        key={node.id}
        aria-label={`Respond to ${node.prompt}`}
      >
        {answer?.status === "pending" && answer.proposed && (
          <button
            disabled={disabled}
            onClick={() =>
              void submit({
                action: "confirm_investigation",
                answer_id: answer.id,
                value: answer!.proposed!.value,
              })
            }
          >
            Confirm interpretation
          </button>
        )}
        {answer && node.status === "answered" && editing !== node.id && (
          <button
            disabled={disabled}
            onClick={() => {
              setEditing(node.id);
              updateDraft(node.id, {
                choice: answer.choice ?? "__text",
                text: answer.text,
                notes: answer.notes,
                id: `ANS-${crypto.randomUUID()}`,
              });
            }}
          >
            Correct this answer
          </button>
        )}
        {editable && !terminal && (
          <form
            aria-label={`Answer ${node.prompt}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled || !draft?.choice) return;
              void submit({
                action: "answer_investigation",
                answer_id: draft.id,
                node_id: node.id,
                choice: draft.choice === "__text" ? null : draft.choice,
                text: draft.choice === "__text" ? draft.text : "",
                notes: draft.notes,
                ...(editing === node.id && answer
                  ? { supersedes_id: answer.id }
                  : {}),
              });
            }}
          >
            <fieldset
              className="investigation-answer-cards"
              disabled={disabled}
            >
              <legend className="sr-only">
                {node.kind === "check"
                  ? "Recorded replay outcome"
                  : "Choose your answer"}
              </legend>
              <p className="sr-only" id={`answer-hint-${node.id}`}>
                Click once to select, again to confirm.
              </p>
              <div className="investigation-answer-options">
                {[
                  ...(node.choices ?? []),
                  { value: "__text", label: "Describe in my own words" },
                ].map((choice) => (
                  <label
                    className="investigation-answer-card"
                    key={choice.value}
                  >
                    <input
                      type="radio"
                      name={`answer-${node.id}`}
                      value={choice.value}
                      checked={draft?.choice === choice.value}
                      required
                      aria-describedby={`answer-hint-${node.id}`}
                      title={
                        draft?.choice === choice.value
                          ? `Click again to confirm ${choice.label}`
                          : choice.label
                      }
                      onChange={() =>
                        updateDraft(node.id, { choice: choice.value })
                      }
                      onClick={(event) => {
                        if (draft?.choice === choice.value)
                          event.currentTarget.form?.requestSubmit();
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          draft?.choice === choice.value
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <span>
                      {choice.label}
                      {draft?.choice === choice.value && (
                        <Check
                          className="investigation-answer-tick"
                          weight="bold"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {draft?.choice === "__text" && (
              <label>
                Answer in your own words
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={draft.text}
                  onChange={(event) =>
                    updateDraft(node.id, { text: event.target.value })
                  }
                />
              </label>
            )}
            {editing === node.id && (
              <button type="button" onClick={() => setEditing(null)}>
                Cancel correction
              </button>
            )}
          </form>
        )}
        {node.status === "proposed" && (
          <button
            disabled={disabled}
            onClick={() =>
              void submit({ action: "select_investigation", node_id: node.id })
            }
          >
            {terminal ? "Choose review" : "Follow this branch"}
          </button>
        )}
        <button
          className="investigation-node-detail"
          type="button"
          onClick={() => inspect(node, true)}
        >
          Evidence & why this question
        </button>
      </div>
    );
  }

  function content(node: InvestigationNode, interactive = true) {
    const answer = currentAnswer(node.id);
    const draft = drafts[node.id];
    const questionType = questionTypeFor(node);
    return (
      <article
        className={`investigation-node is-${node.status} nodrag nopan nowheel`}
        data-question-type={questionType}
        style={questionStyle(questionType)}
        aria-label={`${node.status}: ${node.prompt}`}
      >
        <div className="investigation-node-meta">
          <span className={`investigation-stage-mark stage-${stageFor(node)}`}>
            <StageShape stage={stageFor(node)} />
            {node.kind === "check"
              ? "Synthetic check"
              : stages[stageFor(node)].label}
          </span>
          <span>{node.status === "active" ? "Current step" : node.status}</span>
        </div>
        {questionType && (
          <p className="question-purpose">
            <span aria-hidden="true" />
            {questionTypes[questionType].label} ·{" "}
            {questionTypes[questionType].description}
          </p>
        )}
        <h3>{node.prompt}</h3>
        {explain && <p>{node.why}</p>}
        {explain &&
          draft?.choice &&
          node.choices?.find((choice) => choice.value === draft.choice)
            ?.interpretation !== node.why && (
            <p className="investigation-node-hint">
              {
                node.choices?.find((choice) => choice.value === draft.choice)
                  ?.interpretation
              }
            </p>
          )}
        {node.blocked_reason && <p>{node.blocked_reason}</p>}
        {answer && (
          <div className="investigation-node-answer">
            <strong>Recorded answer · {answer.status}</strong>
            <p>
              {answer.text || answer.choice || "Unknown"}
              {answer.notes ? ` — ${answer.notes}` : ""}
            </p>
            {answer.confirmed_value && (
              <p>
                Confirmed meaning: {answer.confirmed_value.replaceAll("_", " ")}
              </p>
            )}
            {answer.proposed &&
              !answer.confirmed_value &&
              node.status !== "superseded" && (
                <>
                  <p>
                    Proposed meaning:{" "}
                    {answer.proposed.value.replaceAll("_", " ")}. Confirm only
                    if this matches your observation.
                  </p>
                  {(answer.proposed.ambiguities ?? []).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </>
              )}
          </div>
        )}
        {interactive && responseControls(node)}
      </article>
    );
  }

  const positions = new Map<string, { x: number; y: number }>();
  const occupied = new Map<number, Set<number>>();
  const siblings = new Map<string, number>();
  const nodes: ChartNode[] = visibleNodes.map((node) => {
    const parent = node.parent_id ? positions.get(node.parent_id) : undefined;
    const family = node.parent_id ?? "start";
    const index = siblings.get(family) ?? 0;
    siblings.set(family, index + 1);
    const y = parent ? parent.y + 300 : 140;
    let x =
      (parent?.x ?? 0) + Math.ceil(index / 2) * 280 * (index % 2 ? -1 : 1);
    const row = occupied.get(y) ?? new Set<number>();
    while (row.has(x)) x += 280;
    row.add(x);
    occupied.set(y, row);
    positions.set(node.id, { x, y });
    const stage = stageFor(node);
    const title = questionTitles[node.target_fact] ?? node.prompt;
    const answer = currentAnswer(node.id);
    const recorded = answer?.confirmed_value ?? answer?.choice ?? answer?.text;
    return {
      id: node.id,
      type: "stage",
      position: { x, y },
      width: 240,
      height: (stages[stage].height * 240) / 280 + 56,
      measured: dimensions[node.id],
      data: {
        stage,
        title: `${node.clarification_for ? "Clarify: " : ""}${title.length > 90 ? `${title.slice(0, 87)}…` : title}`,
        prompt: node.prompt,
        status: node.status,
        answer: recorded?.replaceAll("_", " "),
        inspected: node.id === detail?.id,
        spotlight: node.id === (detailId ?? currentId),
        processing: !!activity && node.id === (detailId ?? currentId),
        questionType: questionTypeFor(node),
        onInspect: () => inspect(node),
      },
      draggable: false,
      // Native buttons inside each shape handle pointer and keyboard selection.
      selectable: true,
      focusable: false,
      ariaLabel: `${node.status}: ${node.prompt}`,
    };
  });
  nodes.unshift({
    id: "flow-start",
    type: "stage",
    position: { x: 0, y: 0 },
    width: 240,
    height: (stages.start.height * 240) / 280 + 56,
    measured: dimensions["flow-start"],
    data: {
      stage: "start",
      title: "Start",
      prompt: "Start investigation",
      status: "start",
    },
    draggable: false,
    selectable: false,
    focusable: false,
  });
  const spotlightNode = nodes.find((node) => node.data.spotlight);
  const edges: Edge[] = visibleNodes.map((node) => {
    const answer = graph.answers.find(
      (item) => item.id === node.parent_answer_id,
    );
    const value = answer?.confirmed_value ?? answer?.choice;
    const followed = node.id === currentId || node.status === "answered";
    const questionType = questionTypeFor(node);
    const color = questionType
      ? `var(--question-${questionType})`
      : "var(--slate-500)";
    return {
      id: `edge-${node.id}`,
      source: node.parent_id ?? "flow-start",
      target: node.id,
      label: node.clarification_for
        ? "Needs clarification"
        : value
          ? value.replaceAll("_", " ")
          : undefined,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
      className: node.status === "active" ? "flowchart-edge-current" : "",
      style: {
        stroke: color,
        strokeWidth: followed ? 2.5 : 1.5,
        strokeDasharray: followed ? undefined : "5 5",
      },
      labelStyle: {
        fill: "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 600,
      },
      labelBgStyle: { fill: "var(--surface-document)" },
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 4,
      selectable: false,
      focusable: false,
    };
  });
  const waiting = graph.answers.some(
    (answer: InvestigationAnswer) =>
      answer.status === "pending" &&
      !answer.proposed &&
      !superseded.has(answer.id) &&
      graph.nodes.some(
        (node) => node.id === answer.node_id && node.status !== "superseded",
      ),
  );
  if (!graph.nodes.length) return null;
  const reasoningPanel = hypothesis && (
    <div className="investigation-reasoning-panel">
      <label htmlFor="reasoning-hypothesis">Explanation to trace</label>
      <select
        id="reasoning-hypothesis"
        value={hypothesis.id}
        onChange={(event) => onSelectHypothesis(event.target.value)}
      >
        {hypotheses.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <p className="why-how-hypothesis-status">
        Explanation status: {hypothesis.status}
      </p>
      <CausalReasoning
        key={hypothesis.id}
        hypothesis={hypothesis}
        onSelectEvidence={onSelectEvidence}
      />
    </div>
  );
  const supportingDetails = (
    <div className="investigation-supporting-details">
      {!!incident.conversation?.at(-1)?.sources?.length && (
        <section
          className="investigation-detail-section"
          aria-label="Conversation references"
          tabIndex={-1}
        >
          <h4>Conversation references</h4>
          {incident.conversation.at(-1)!.sources!.map((source) => (
            <details key={source.id} className="investigation-detail-source">
              <summary>
                <span>{source.section}</span>
                <small>{source.approval_status.replaceAll("_", " ")}</small>
              </summary>
              <p>
                {source.title} · {source.revision}
              </p>
              <blockquote>{source.passage}</blockquote>
              <p>
                <strong>Limitations:</strong> {source.limitation}
              </p>
            </details>
          ))}
        </section>
      )}
      {detail && (
        <details
          ref={sourcesRef}
          className="investigation-graph-context"
          key={detail.id}
          open={explain}
        >
          <summary>Question details</summary>
          <div className="investigation-question-detail">
            {questionTypeFor(detail) && (
              <span className="investigation-detail-category">
                {questionTypes[questionTypeFor(detail)!].label}
              </span>
            )}
            {textView && (
              <p>
                <strong>{detail.prompt}</strong>
              </p>
            )}
            <section className="investigation-detail-section">
              <h4>Why this matters</h4>
              <p>{detail.why}</p>
              {detail.blocked_reason && (
                <p className="investigation-detail-blocked">
                  {detail.blocked_reason}
                </p>
              )}
            </section>
            {!!detail.choices?.length && (
              <section className="investigation-detail-section">
                <h4>Answer meanings</h4>
                <ul className="investigation-choice-meanings">
                  {[
                    ...new Set(
                      detail.choices.map((choice) => choice.interpretation),
                    ),
                  ].map((interpretation) => (
                    <li key={interpretation}>
                      <strong>
                        {(detail.choices ?? [])
                          .filter(
                            (choice) =>
                              choice.interpretation === interpretation,
                          )
                          .map((choice) => choice.label)
                          .join(" / ")}
                      </strong>
                      {interpretation &&
                        !detail.why.endsWith(interpretation) && (
                          <p>{interpretation}</p>
                        )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!detail.evidence_ids?.length && (
              <section className="investigation-detail-section">
                <h4>Evidence</h4>
                <div className="investigation-detail-evidence">
                  {detail.evidence_ids.map((id) => {
                    const evidence = incident.evidence?.find(
                      (item) => item.id === id,
                    );
                    return (
                      <button
                        type="button"
                        key={id}
                        title={evidence?.label}
                        aria-label={`Inspect ${evidence?.label ?? id}`}
                        onClick={() => onSelectEvidence(id)}
                      >
                        {evidence?.role === "last_good"
                          ? "Inspect last good"
                          : evidence?.role === "first_bad"
                            ? "Inspect first bad"
                            : `Inspect ${evidence?.label ?? id}`}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {!!detail.source_refs?.length && (
              <section className="investigation-detail-section">
                <h4>Sources · {detail.source_refs.length}</h4>
                <div className="investigation-detail-sources">
                  {(detail.source_refs ?? []).map((id) => {
                    const source = [
                      ...(incident.assessment?.sources ?? []),
                      ...(incident.assessment_history ?? []).flatMap(
                        (snapshot) => snapshot.assessment.sources,
                      ),
                    ].find(
                      (item) =>
                        item.id === id &&
                        `${item.revision}; ${item.approval_status}` ===
                          detail.source_versions?.[id],
                    );
                    return (
                      <details key={id} className="investigation-detail-source">
                        <summary>
                          <span>{source?.title ?? id}</span>
                          <small>
                            {(
                              source?.approval_status ??
                              detail.source_versions?.[id]?.split("; ")[1] ??
                              "Status unavailable"
                            ).replaceAll("_", " ")}
                          </small>
                        </summary>
                        <p className="investigation-detail-meta">
                          {detail.source_versions?.[id] ??
                            "Source version unavailable"}
                        </p>
                        {source && (
                          <>
                            <blockquote>{source.passage}</blockquote>
                            <p>
                              <strong>Limitations:</strong> {source.limitation}
                            </p>
                          </>
                        )}
                      </details>
                    );
                  })}
                </div>
              </section>
            )}
            <details className="investigation-detail-metadata">
              <summary>Question metadata</summary>
              <p>Incident revision {detail.source_revision}</p>
              <p>
                {detail.classification?.provider === "jev"
                  ? "Classified by Jev."
                  : "Category from the saved question definition."}
                {detail.classification?.status === "fallback" &&
                  ` ${detail.classification.reason}`}
              </p>
            </details>
          </div>
        </details>
      )}
      {latest && (
        <details>
          <summary>How this step was chosen</summary>
          <p>
            {latest.generation.provider} · {latest.generation.status}
            {latest.generation.model ? ` · ${latest.generation.model}` : ""}
          </p>
          <p>
            {latest.generation.fallback_reason ??
              "Candidate questions passed local validation. Their source support still requires review."}
          </p>
          {latest.decision && (
            <>
              <p>{latest.decision.reason}</p>
              <p>{latest.decision.limitation}</p>
              {latest.decision.response && (
                <dl aria-label="Next-step choice probabilities">
                  {Object.entries(
                    latest.decision.response.answers.next_step.probabilities,
                  ).map(([id, probability]) => (
                    <div key={id}>
                      <dt>{id}</dt>
                      <dd>
                        {(probability * 100).toFixed(1)}% next-step choice
                        probability
                      </dd>
                    </div>
                  ))}
                  <dt>
                    Provider confidence (separate from routing probability)
                  </dt>
                  <dd>
                    {latest.decision.response.answers.next_step.confidence}
                  </dd>
                </dl>
              )}
            </>
          )}
          <button
            disabled={disabled}
            onClick={() => void submit({ action: "retry_investigation" })}
          >
            Retry follow-up preparation
          </button>
        </details>
      )}
      <details>
        <summary>Original answer history · {graph.answers.length}</summary>
        <ol>
          {graph.answers.map((answer) => (
            <li key={answer.id}>
              <strong>
                {answer.choice ?? "Free text"} · {answer.status}
              </strong>
              <p>
                {answer.text} {answer.notes}
              </p>
              <p>
                {answer.recorded_at}
                {answer.supersedes_id
                  ? ` · corrects ${answer.supersedes_id}`
                  : ""}
              </p>
              {answer.readiness?.response && (
                <p>
                  Answer-readiness choice probabilities:{" "}
                  {Object.entries(
                    answer.readiness.response.answers.answer_readiness
                      .probabilities,
                  )
                    .map(
                      ([id, probability]) =>
                        `${id} ${(probability * 100).toFixed(1)}%`,
                    )
                    .join("; ")}
                  . Provider confidence:{" "}
                  {
                    answer.readiness.response.answers.answer_readiness
                      .confidence
                  }
                  . {answer.readiness.limitation}
                </p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
  const options = (
    <div className="investigation-graph-options">
      <label>
        <input
          type="checkbox"
          checked={explain}
          onChange={(event) => setExplain(event.target.checked)}
        />
        Explain each question
      </label>
      {graph.nodes.some((node) => node.status === "superseded") && (
        <label>
          <input
            type="checkbox"
            checked={earlierPaths}
            onChange={(event) => setEarlierPaths(event.target.checked)}
          />
          Earlier paths
        </label>
      )}
    </div>
  );
  const saveStatus = (
    <>
      {error && <p role="alert">{error}</p>}
      <p className="investigation-save-status" role="status" aria-live="polite">
        {activity
          ? "Agent working…"
          : waiting
            ? "Answer saved. Follow-up preparation is pending."
            : notice ||
              `${graph.answers.length} answers recorded · ${graph.active_node_id ? "one active step" : "review or confirmation"}`}
      </p>
    </>
  );

  return (
    <section
      className={`incident-card investigation-graph${textView ? "" : " is-chart has-live-timeline"}${expanded ? " is-expanded" : ""}${panelOpen ? " has-answer-panel" : ""}`}
      style={{ "--answer-panel-width": `${panelWidth}px` } as CSSProperties}
      aria-label="Adaptive investigation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          onExpandedChange(false);
          expandToggle.current?.focus();
        }
      }}
    >
      <div className="investigation-graph-heading">
        <div>
          <p className="eyebrow">Question by question</p>
          <h2>Investigation path</h2>
        </div>
        <div className="investigation-view-actions">
          {hypothesis && (
            <button
              type="button"
              className="why-how-toggle"
              aria-pressed={showReasoning}
              onClick={() => {
                setWhyHowOpen(!showReasoning);
                setPanelOpen(true);
              }}
            >
              5 Whys
            </button>
          )}
          <details className="investigation-color-key">
            <summary aria-label="Question color key" title="Question color key">
              <Palette aria-hidden="true" />
              <span>Question colors</span>
            </summary>
            <div
              className="investigation-color-popover"
              aria-label="Question categories"
            >
              <p>
                <strong>5W2H defines the problem.</strong>
                <br />5 Whys explores causes after the physical mechanism is
                supported.
              </p>
              {Object.entries(questionTypes).map(([type, category]) => (
                <div
                  key={type}
                  className="question-color-item"
                  style={questionStyle(type)}
                >
                  <span aria-hidden="true" />
                  <div>
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </div>
                </div>
              ))}
              <p>
                Color shows the question's purpose. Shape shows the stage. The
                status label marks the current or answered step.
              </p>
            </div>
          </details>
          {!textView && (
            <button
              ref={panelToggle}
              type="button"
              aria-label={`${panelOpen ? "Hide" : "Show"} ${showReasoning ? "reasoning" : "explanation"} panel`}
              title={`${panelOpen ? "Hide" : "Show"} ${showReasoning ? "reasoning" : "explanation"} panel`}
              aria-expanded={panelOpen}
              aria-controls="investigation-answer-panel"
              onClick={() => setPanelOpen(!panelOpen)}
            >
              <SidebarSimple aria-hidden="true" />
              <span>{showReasoning ? "Reasoning" : "Explanation"}</span>
            </button>
          )}
          <button
            type="button"
            aria-label={textView ? "Show chart" : "Ordered text view"}
            title={textView ? "Show chart" : "Ordered text view"}
            aria-pressed={textView}
            onClick={() => {
              setTextView(!textView);
              onExpandedChange(textView);
            }}
          >
            <ListNumbers aria-hidden="true" />
            <span>{textView ? "Show chart" : "Ordered text view"}</span>
          </button>
          {!textView && (incident.assessment || expanded) && (
            <button
              ref={expandToggle}
              type="button"
              aria-label={expanded ? "Exit full screen" : "Full screen"}
              title={expanded ? "Exit full screen" : "Full screen"}
              aria-pressed={expanded}
              onClick={() => onExpandedChange(!expanded)}
            >
              {expanded ? (
                <ArrowsIn aria-hidden="true" />
              ) : (
                <ArrowsOut aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
      <div
        className="investigation-shape-legend"
        aria-label="Flowchart shape key"
      >
        {(["review", "evidence", "decision", "check", "clarify"] as const).map(
          (stage) => (
            <span key={stage} className={`stage-${stage}`}>
              <StageShape stage={stage} />
              {stage === "review" ? "Start / review" : stages[stage].label}
            </span>
          ),
        )}
      </div>
      <InvestigationConversation
        incident={incident}
        spotlight={visibleNodes.find(
          (node) => node.id === (detailId ?? currentId),
        )}
        answerControls={!textView && detail ? responseControls(detail) : null}
        disabled={disabled}
        readOnly={readOnly}
        progressMode={activity}
        progressError={error || progressError}
        onUpdated={onUpdated}
        onSendingChange={setConversing}
        onShowSources={() => {
          setPanelOpen(true);
          setWhyHowOpen(false);
          requestAnimationFrame(() => {
            const references = panelRef.current?.querySelector<HTMLElement>(
              '[aria-label="Conversation references"]',
            );
            references?.focus();
          });
        }}
        onSelectEvidence={onSelectEvidence}
        onSpotlight={(id) => {
          setDetailId(id);
          setWhyHowOpen(false);
          const node = graph.nodes.find((item) => item.id === id);
          if (node?.hypothesis_ids?.[0])
            onSelectHypothesis(node.hypothesis_ids[0]);
        }}
      />
      {textView ? (
        <>
          {options}
          {saveStatus}
          {showReasoning && reasoningPanel}
          <ol
            className="investigation-ordered"
            aria-label="Investigation in recorded order"
          >
            {visibleNodes.map((node) => (
              <li key={node.id}>
                <p>
                  Step{" "}
                  {graph.nodes.findIndex((item) => item.id === node.id) + 1}
                  {node.parent_id
                    ? ` · follows step ${graph.nodes.findIndex((parent) => parent.id === node.parent_id) + 1}`
                    : " · start"}
                </p>
                {content(node)}
              </li>
            ))}
          </ol>
          {supportingDetails}
        </>
      ) : (
        <ReactFlowProvider>
          <GraphControls
            current={currentId}
            selected={detailId}
            panelOpen={panelOpen}
            panelWidth={panelWidth}
            expanded={expanded}
            onFocus={() => {
              setDetailId(null);
              setWhyHowOpen(false);
            }}
          />
          <div className="investigation-chart-layout">
            <div
              className="investigation-canvas"
              aria-busy={!!activity}
              aria-label="Investigation chart"
            >
              <ReactFlow<ChartNode>
                nodes={nodes}
                edges={edges}
                onNodesChange={(changes) => {
                  // Keep React Flow's DOM measurements across controlled graph updates.
                  // Positions and investigation state still come from the saved path.
                  setDimensions((current) => {
                    let next = current;
                    for (const change of changes) {
                      if (change.type !== "dimensions" || !change.dimensions)
                        continue;
                      const previous = current[change.id];
                      if (
                        previous?.width === change.dimensions.width &&
                        previous?.height === change.dimensions.height
                      )
                        continue;
                      if (next === current) next = { ...current };
                      next[change.id] = change.dimensions;
                    }
                    return next;
                  });
                }}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ maxZoom: 1, padding: 0.1 }}
                minZoom={0.2}
                maxZoom={1.5}
                nodesDraggable={false}
                nodesConnectable={false}
                deleteKeyCode={null}
                zoomOnScroll={false}
                zoomActivationKeyCode={["Meta", "Control"]}
                preventScrolling={false}
              >
                {spotlightNode && (
                  <ViewportPortal>
                    <div
                      className="investigation-spotlight-circle"
                      data-node-id={spotlightNode.id}
                      aria-hidden="true"
                      style={{
                        transform: `translate(${spotlightNode.position.x + 120}px, ${spotlightNode.position.y + 28 + (stages[spotlightNode.data.stage].height * 240) / 280 / 2}px)`,
                      }}
                    />
                  </ViewportPortal>
                )}
                <Background gap={24} size={1} color="var(--slate-200)" />
                <Controls showInteractive={false} showFitView={false} />
              </ReactFlow>
            </div>
            <LiveTimeline
              incident={incident}
              syncing={!!activity}
              onOpen={(id) => (id ? onSelectEvidence(id) : onOpenTimeline())}
            />
            {detail && (
              <aside
                ref={panelRef}
                id="investigation-answer-panel"
                className={`investigation-answer-panel${showReasoning ? " is-reasoning" : ""}`}
                aria-label={
                  showReasoning
                    ? "5 Whys causal analysis"
                    : "Question explanation"
                }
                hidden={!panelOpen}
              >
                <div
                  className="investigation-panel-resize"
                  role="separator"
                  tabIndex={0}
                  aria-label="Resize side panel"
                  aria-orientation="vertical"
                  aria-controls="investigation-answer-panel"
                  aria-valuemin={320}
                  aria-valuemax={720}
                  aria-valuenow={Math.round(panelWidth)}
                  aria-valuetext={`${Math.round(panelWidth)} pixels wide`}
                  title="Drag to resize · use left and right arrow keys"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.focus();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    panelDrag.current = {
                      x: event.clientX,
                      width: panelRef.current!.getBoundingClientRect().width,
                    };
                  }}
                  onPointerMove={(event) => {
                    if (!panelDrag.current) return;
                    resizePanel(
                      panelDrag.current.width +
                        panelDrag.current.x -
                        event.clientX,
                    );
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    panelDrag.current = null;
                  }}
                  onLostPointerCapture={() => {
                    panelDrag.current = null;
                  }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 40 : 20;
                    const widths: Record<string, number> = {
                      ArrowLeft: panelWidth + step,
                      ArrowRight: panelWidth - step,
                      Home: 320,
                      End: 720,
                    };
                    if (event.key in widths) {
                      event.preventDefault();
                      resizePanel(widths[event.key]);
                    }
                  }}
                />
                <div className="investigation-panel-heading">
                  <span>
                    {showReasoning
                      ? "5 Whys · causal analysis"
                      : detail.id === currentId
                        ? "Question explanation"
                        : "Selected step explanation"}
                  </span>
                  <div>
                    {showReasoning ? (
                      <button
                        type="button"
                        onClick={() => setWhyHowOpen(false)}
                      >
                        Back to question
                      </button>
                    ) : (
                      detail.id !== currentId &&
                      currentId && (
                        <button type="button" onClick={() => setDetailId(null)}>
                          Back to current
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      aria-label={
                        showReasoning
                          ? "Close reasoning panel"
                          : "Close explanation panel"
                      }
                      onClick={() => {
                        setPanelOpen(false);
                        panelToggle.current?.focus();
                      }}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  className="investigation-panel-scroll"
                  key={showReasoning ? "reasoning" : detail.id}
                >
                  {showReasoning ? (
                    reasoningPanel
                  ) : (
                    <>
                      {content(detail, false)}
                      {saveStatus}
                      {options}
                      {supportingDetails}
                    </>
                  )}
                </div>
              </aside>
            )}
            {!panelOpen && (
              <div className="investigation-explanation-dock">
                <button
                  type="button"
                  className="investigation-explanation-bubble"
                  aria-label={
                    showReasoning
                      ? "Expand reasoning bubble"
                      : "Expand explanation bubble"
                  }
                  aria-expanded={false}
                  aria-controls="investigation-answer-panel"
                  onClick={() => setPanelOpen(true)}
                >
                  <ChatCircle aria-hidden="true" />
                  <span>
                    {showReasoning ? "5 Whys reasoning" : "Why this question?"}
                  </span>
                  <CaretRight aria-hidden="true" />
                </button>
                {!activity && waiting && saveStatus}
              </div>
            )}
          </div>
        </ReactFlowProvider>
      )}
    </section>
  );
}
