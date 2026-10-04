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
  Flask,
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
  BaseEdge,
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
  type EdgeProps,
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
import { TroubleshootingMap } from "./TroubleshootingMap";
import { ExperimentPreview } from "./ExperimentPreview";
import type { InvestigationProgressMode } from "./InvestigationProgress";
import { investigationLayout } from "./investigationLayout";
import { responseNodeId, responseStatement } from "./investigationResponses";
import {
  suggestInvestigationExperiment,
  type InvestigationExperiment,
} from "./investigationExperiment";
import "@xyflow/react/dist/style.css";
import "./InvestigationGraph.css";

type Draft = { choice: string; text: string; notes: string; id: string };
const stages = {
  start: { label: "Start", height: 64 },
  branch: { label: "Investigation branch", height: 116 },
  evidence: { label: "Evidence", height: 128 },
  decision: { label: "Decision", height: 200 },
  check: { label: "Check", height: 116 },
  experiment: { label: "Mini experiment", height: 184 },
  statement: { label: "Response", height: 124 },
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
    inspected?: boolean;
    spotlight?: boolean;
    processing?: boolean;
    questionType?: QuestionType;
    onInspect?: () => void;
  },
  "stage"
>;
const questionTitles: Record<string, string> = {
  recipe_change: "Did the recipe or parameters change?",
  controller_events: "Do controller logs show errors?",
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
          rx={
            ["check", "statement", "experiment"].includes(stage)
              ? 5
              : height / 2
          }
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
            ? data.stage === "review"
              ? "Review step"
              : "Spotlight · answer here"
            : start
              ? "Incident opened"
              : data.status === "active"
                ? "Current step"
                : data.status === "deferred"
                  ? "Set aside"
                  : data.stage === "statement"
                    ? responseStatus(data.status)
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
        aria-label={`${data.questionType ? `${questionTypes[data.questionType].label} · ` : ""}${stages[data.stage].label} · ${data.stage === "statement" ? responseStatus(data.status) : data.status === "deferred" ? "Set aside" : data.status}: ${data.prompt}`}
        aria-pressed={start ? undefined : data.inspected}
        title={data.prompt}
        onClick={data.onInspect}
        disabled={start || (data.stage === "branch" && !data.onInspect)}
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
          {data.stage === "experiment" && <small>Preview experiment →</small>}
        </span>
      </button>
      {data.stage !== "review" && data.stage !== "experiment" && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          style={{ top: height + 28, bottom: "auto" }}
        />
      )}
      <span className="flowchart-node-answer" />
    </div>
  );
}
const nodeTypes = { stage: StageNode };
type RelationshipEdge = Edge<{ junctionY: number }, "relationship">;

function RelationshipConnector({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  id,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps<RelationshipEdge>) {
  const junctionY = data?.junctionY ?? (sourceY + targetY) / 2;
  return (
    <BaseEdge
      id={id}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      path={`M ${sourceX} ${sourceY} V ${junctionY} H ${targetX} V ${targetY}`}
      labelX={targetX}
      labelY={(junctionY + targetY) / 2}
    />
  );
}
const edgeTypes = { relationship: RelationshipConnector };

function responseStatus(status: string) {
  return status === "confirmed"
    ? "Recorded response"
    : status === "unknown"
      ? "Information unknown"
      : status === "clarified"
        ? "Clarified response"
        : status === "superseded"
          ? "Earlier response"
          : status === "clarification"
            ? "Needs clarification"
            : "Awaiting confirmation";
}

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
    // Frame this question's family rather than unrelated branches at the same depth.
    const connections = getEdges();
    const parent = connections.find((edge) => edge.target === focusId)?.source;
    const startingBranches = parent?.startsWith("branch-");
    const family = new Set(
      connections
        .filter((edge) => edge.source === parent)
        .map((edge) => edge.target),
    );
    const neighbors = getNodes().filter((item) =>
      startingBranches
        ? item.id === "flow-start" ||
          item.data.stage === "branch" ||
          connections.some(
            (edge) =>
              edge.target === item.id && edge.source.startsWith("branch-"),
          )
        : narrow
          ? item.id === focusId
          : item.id === focusId ||
            (item.data.status !== "deferred" &&
              (family.has(item.id) || item.id === parent)),
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
  onOpenExperiment,
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
  onOpenExperiment: (experiment: InvestigationExperiment) => void;
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
  const [previewExperiment, setPreviewExperiment] =
    useState<InvestigationExperiment | null>(null);
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
  const clarifiedAnswers = new Set(
    visibleNodes
      .filter(
        (node) =>
          node.status === "answered" &&
          node.clarification_for &&
          ["confirmed", "unknown"].includes(
            currentAnswer(node.id)?.status ?? "",
          ),
      )
      .map((node) => node.clarification_for),
  );
  const deferredIds = new Set(
    graph.expansions
      .filter((expansion) => !expansion.superseded)
      .flatMap((expansion) =>
        visibleNodes
          .filter(
            (node) =>
              expansion.child_ids.includes(node.id) &&
              (node.status === "proposed" || node.status === "blocked") &&
              visibleNodes.some(
                (sibling) =>
                  expansion.child_ids.includes(sibling.id) &&
                  sibling.status === "answered" &&
                  (sibling.branch ?? "hardware") ===
                    (node.branch ?? "hardware"),
              ),
          )
          .map((node) => node.id),
      ),
  );
  const detail =
    visibleNodes.find((node) => node.id === detailId) ??
    visibleNodes.find((node) => node.id === currentId) ??
    visibleNodes[visibleNodes.length - 1];
  const hypotheses = incident.assessment?.hypotheses ?? [];
  const experiment = suggestInvestigationExperiment(incident);
  const experimentId = experiment
    ? `experiment-${experiment.answer.id}-${experiment.check.id}`
    : null;
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
    if (deferredIds.has(node.id))
      return (
        <p className="investigation-node-hint">
          Set aside · the flow continues from the recorded answer.
        </p>
      );
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
        {experiment && node.id === currentId && (
          <button
            type="button"
            className="investigation-experiment-link"
            disabled={!!activity}
            onClick={() => setPreviewExperiment(experiment)}
          >
            <Flask aria-hidden="true" />
            Preview mini experiment
          </button>
        )}
      </div>
    );
  }

  function content(node: InvestigationNode, interactive = true) {
    const status = deferredIds.has(node.id) ? "deferred" : node.status;
    const answer = currentAnswer(node.id);
    const draft = drafts[node.id];
    const questionType = questionTypeFor(node);
    const check =
      node.kind === "check"
        ? incident.assessment?.checks.find(
            (check) => check.id === node.target_fact,
          )
        : undefined;
    const experiment = check?.mini_experiment;
    return (
      <article
        className={`investigation-node is-${status} nodrag nopan nowheel`}
        data-question-type={questionType}
        style={
          status === "deferred"
            ? ({ "--question-color": "var(--slate-300)" } as CSSProperties)
            : questionStyle(questionType)
        }
        aria-label={`${status === "deferred" ? "Set aside" : status}: ${node.prompt}`}
      >
        <div className="investigation-node-meta">
          <span className={`investigation-stage-mark stage-${stageFor(node)}`}>
            <StageShape stage={stageFor(node)} />
            {node.kind === "check"
              ? "Synthetic check"
              : stages[stageFor(node)].label}
          </span>
          <span>
            {node.branch === "software" ? "Software" : "Hardware"} ·{" "}
            {status === "active"
              ? "Current step"
              : status === "deferred"
                ? "Set aside"
                : status}
          </span>
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
        {experiment && (
          <details className="investigation-mini-experiment" open>
            <summary>Mini DOE · suggested comparison</summary>
            <p>
              <strong>Compare:</strong> {experiment.factor}
            </p>
            <p>
              <strong>A · Baseline:</strong> {experiment.baseline}
            </p>
            <p>
              <strong>B · Comparison:</strong> {experiment.comparison}
            </p>
            <p>
              <strong>Hold constant:</strong>{" "}
              {experiment.held_constant.join("; ")}
            </p>
            <p>
              <strong>Measure:</strong> {check?.measured_response}
            </p>
            <p>
              <strong>Repeat / uncertainty:</strong> {experiment.repeat_plan}
            </p>
          </details>
        )}
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
              {responseStatement(node, answer, clarifiedAnswers.has(answer.id))}
            </p>
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

  const responses = graph.answers.flatMap((answer) => {
    const node = visibleNodes.find((item) => item.id === answer.node_id);
    if (!node || (!earlierPaths && superseded.has(answer.id))) return [];
    return [
      {
        id: responseNodeId(answer.id),
        node,
        answer,
        status:
          superseded.has(answer.id) || node.status === "superseded"
            ? "superseded"
            : clarifiedAnswers.has(answer.id) &&
                ["pending", "clarification"].includes(answer.status)
              ? "clarified"
              : answer.status,
        text: responseStatement(node, answer, clarifiedAnswers.has(answer.id)),
      },
    ];
  });
  const responseIds = new Set(responses.map((response) => response.id));
  const chartParent = (node: InvestigationNode) =>
    node.parent_answer_id &&
    responseIds.has(responseNodeId(node.parent_answer_id))
      ? responseNodeId(node.parent_answer_id)
      : (node.parent_id ?? `branch-${node.branch ?? "hardware"}`);
  const branches = ["hardware", "software"] as const;
  const positions = investigationLayout(
    [
      {
        id: "flow-start",
        status: "start",
        height: (stages.start.height * 240) / 280 + 56,
      },
      ...branches.map((branch) => ({
        id: `branch-${branch}`,
        parent_id: "flow-start",
        status: "open",
        height: (stages.branch.height * 240) / 280 + 56,
        gapAfter: 72,
      })),
      ...(experiment && experimentId
        ? [
            {
              id: experimentId,
              parent_id: responseNodeId(experiment.answer.id),
              status: "suggested",
              height: (stages.experiment.height * 240) / 280 + 56,
              gapAfter: 72,
            },
          ]
        : []),
      ...visibleNodes.map((node) => ({
        ...node,
        parent_id: chartParent(node),
        height: (stages[stageFor(node)].height * 240) / 280 + 56,
        gapAfter: 72,
      })),
      ...responses.map((response) => ({
        id: response.id,
        parent_id: response.node.id,
        status: response.status,
        height: (stages.statement.height * 240) / 280 + 56,
        gapAfter: 72,
      })),
    ],
    currentId,
    new Set([
      ...(experimentId ? [experimentId] : []),
      ...graph.expansions
        .filter((expansion) => !expansion.superseded)
        .map((expansion) => expansion.recommended_id),
    ]),
  );
  const questionNodes: ChartNode[] = visibleNodes.map((node) => {
    const { x, y } = positions.get(node.id)!;
    const stage = stageFor(node);
    const title = questionTitles[node.target_fact] ?? node.prompt;
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
        status: deferredIds.has(node.id) ? "deferred" : node.status,
        inspected: node.id === detail?.id,
        spotlight:
          !deferredIds.has(node.id) && node.id === (detailId ?? currentId),
        processing:
          !deferredIds.has(node.id) &&
          !!activity &&
          node.id === (detailId ?? currentId),
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
  const responseNodes: ChartNode[] = responses.map((response) => {
    const { x, y } = positions.get(response.id)!;
    return {
      id: response.id,
      type: "stage",
      position: { x, y },
      width: 240,
      height: (stages.statement.height * 240) / 280 + 56,
      measured: dimensions[response.id],
      data: {
        stage: "statement",
        title: response.text,
        prompt: response.text,
        status: response.status,
        onInspect: () => inspect(response.node),
      },
      draggable: false,
      selectable: true,
      focusable: false,
      ariaLabel: `${responseStatus(response.status)}: ${response.text}`,
    };
  });
  const branchNodes: ChartNode[] = branches.map((branch) => {
    const first =
      visibleNodes.find(
        (node) =>
          (node.branch ?? "hardware") === branch && node.status === "active",
      ) ??
      visibleNodes.find(
        (node) =>
          (node.branch ?? "hardware") === branch && node.status === "proposed",
      ) ??
      visibleNodes.find((node) => (node.branch ?? "hardware") === branch);
    return {
      id: `branch-${branch}`,
      type: "stage",
      position: positions.get(`branch-${branch}`)!,
      width: 240,
      height: (stages.branch.height * 240) / 280 + 56,
      measured: dimensions[`branch-${branch}`],
      data: {
        stage: "branch",
        title: branch === "hardware" ? "Hardware" : "Software",
        prompt:
          branch === "hardware"
            ? "Hardware: physical components, delivery and material conditions"
            : "Software: recipes, parameters and controller events",
        status: "open possibility",
        onInspect: questionNodes.find((node) => node.id === first?.id)?.data
          .onInspect,
      },
      draggable: false,
      selectable: true,
      focusable: false,
    };
  });
  const nodes = [...branchNodes, ...questionNodes, ...responseNodes];
  if (experiment && experimentId)
    nodes.push({
      id: experimentId,
      type: "stage",
      position: positions.get(experimentId)!,
      width: 240,
      height: (stages.experiment.height * 240) / 280 + 56,
      measured: dimensions[experimentId],
      data: {
        stage: "experiment",
        title: `Explore ${hypotheses.find((item) => item.id === experiment.check.hypothesis_id)?.title.toLowerCase() ?? "possible causes"}`,
        prompt: `Preview mini experiment: ${experiment.check.title}`,
        status: "suggested",
        onInspect: () => setPreviewExperiment(experiment),
      },
      draggable: false,
      selectable: true,
      focusable: false,
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
  function connect(
    target: string,
    source: string,
    followed: boolean,
    deferred: boolean,
    label?: string,
    active = false,
  ): RelationshipEdge {
    if (!positions.has(source)) source = "flow-start";
    const parent = positions.get(source)!;
    const primary = positions.get(target)!.x === parent.x;
    const color = deferred
      ? "var(--slate-300)"
      : primary || followed
        ? "var(--text-secondary)"
        : "var(--slate-500)";
    return {
      id: `edge-${target}`,
      source,
      target,
      label: deferred
        ? undefined
        : !primary && !followed
          ? "Alternative"
          : label,
      type: "relationship",
      data: { junctionY: parent.junctionY },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
      className: deferred
        ? "flowchart-edge-deferred"
        : active
          ? "flowchart-edge-current"
          : "",
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
  }
  const edges: RelationshipEdge[] = [
    ...branches.map((branch) => ({
      ...connect(`branch-${branch}`, "flow-start", false, false),
      label: "Possible cause",
    })),
    ...(experiment && experimentId
      ? [
          {
            ...connect(
              experimentId,
              responseNodeId(experiment.answer.id),
              false,
              false,
            ),
            label: "Compare possibilities",
          },
        ]
      : []),
    ...visibleNodes.map((node) =>
      connect(
        node.id,
        chartParent(node),
        node.id === currentId || node.status === "answered",
        deferredIds.has(node.id),
        node.clarification_for
          ? "Clarify response"
          : node.parent_answer_id
            ? node.kind === "review" || node.kind === "escalate"
              ? "Review"
              : "Continue"
            : undefined,
        node.status === "active",
      ),
    ),
    ...responses.map((response) =>
      connect(
        response.id,
        response.node.id,
        response.status !== "superseded",
        response.status === "superseded",
        response.answer.status === "confirmed"
          ? (
              response.answer.confirmed_value ?? response.answer.choice
            )?.replaceAll("_", " ")
          : response.answer.status === "unknown"
            ? "Unknown"
            : "Saved",
      ),
    ),
  ];
  // Alternative connectors share the trunk; draw the followed path over them.
  edges.sort(
    (a, b) =>
      Number(a.style?.strokeDasharray === undefined) -
      Number(b.style?.strokeDasharray === undefined),
  );
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
      {previewExperiment && (
        <ExperimentPreview
          incident={incident}
          experiment={previewExperiment}
          onCancel={() => setPreviewExperiment(null)}
          onReady={(updated, prepared) => {
            setPreviewExperiment(null);
            onUpdated(updated);
            onOpenExperiment(prepared);
          }}
        />
      )}
      <div className="investigation-graph-heading">
        <div>
          <p className="eyebrow">Response flow</p>
          <h2>Investigation path</h2>
        </div>
        <div className="investigation-view-actions">
          <TroubleshootingMap incident={incident} />
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
        {(
          [
            "review",
            "evidence",
            "decision",
            "statement",
            "check",
            "experiment",
            "clarify",
          ] as const
        ).map((stage) => (
          <span key={stage} className={`stage-${stage}`}>
            <StageShape stage={stage} />
            {stage === "review" ? "Start / review" : stages[stage].label}
          </span>
        ))}
      </div>
      <InvestigationConversation
        incident={incident}
        spotlight={visibleNodes.find(
          (node) => node.id === (detailId ?? currentId),
        )}
        answerControls={
          !textView && detail ? (
            <>
              <nav
                className="investigation-branch-navigation"
                aria-label="Investigation branches"
              >
                {branchNodes.map((branch) => (
                  <button
                    type="button"
                    key={branch.id}
                    aria-pressed={
                      branch.id === `branch-${detail.branch ?? "hardware"}`
                    }
                    disabled={!branch.data.onInspect}
                    onClick={() => {
                      branch.data.onInspect?.();
                      setPanelOpen(false);
                    }}
                  >
                    {branch.data.title}
                  </button>
                ))}
              </nav>
              {responseControls(detail)}
            </>
          ) : null
        }
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
                {responses
                  .filter((response) => response.node.id === node.id)
                  .map((response) => (
                    <article
                      key={response.id}
                      className={`investigation-statement is-${response.status}`}
                      aria-label={responseStatus(response.status)}
                    >
                      <span>{responseStatus(response.status)}</span>
                      <p>{response.text}</p>
                      <button type="button" onClick={() => inspect(node)}>
                        Inspect saved response
                      </button>
                    </article>
                  ))}
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
                edgeTypes={edgeTypes}
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
