import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChatCircle,
  ArrowUp,
  File,
  Image as ImageIcon,
  Microphone,
  PaperPlaneTilt,
  Stop,
} from "@phosphor-icons/react";
import type {
  ConversationRequest,
  Incident,
  InvestigationNode,
} from "@flowpilot/contracts";
import {
  converseWithInvestigation,
  getInvestigationVoiceToken,
  loadIncident,
} from "./api";
import "./InvestigationConversation.css";

type Utterance = Omit<ConversationRequest, "revision">;

export function InvestigationConversation({
  incident,
  spotlight,
  answerControls,
  disabled,
  onUpdated,
  onSpotlight,
  onSelectEvidence,
}: {
  incident: Incident;
  spotlight?: InvestigationNode;
  answerControls?: ReactNode;
  disabled: boolean;
  onUpdated: (incident: Incident) => void;
  onSpotlight: (id: string) => void;
  onSelectEvidence: (id: string) => void;
}) {
  const draftKey = `flowpilot.conversation-draft.${incident.id}`;
  const [draft, setDraft] = useState(() => {
    try {
      return sessionStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  const [partial, setPartial] = useState("");
  const [voiceState, setVoiceState] = useState<
    "off" | "connecting" | "listening"
  >("off");
  const [handsFree, setHandsFree] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const connection = useRef<{ close: () => void } | null>(null);
  const session = useRef(0);
  const queue = useRef<Utterance[]>([]);
  const processing = useRef(false);
  const failed = useRef<Utterance | null>(null);
  const current = useRef({
    incident,
    spotlight,
    disabled,
    onUpdated,
    onSpotlight,
  });
  const speechSpotlight = useRef<string | null>(null);
  const interim = useRef("");
  const mode = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const connectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, draft);
    } catch {
      /* The current page still preserves the draft. */
    }
  }, [draftKey, draft]);
  useEffect(() => {
    const element = container.current;
    const graph = element?.closest<HTMLElement>(".investigation-graph");
    if (!element || !graph) return;
    const resize = new ResizeObserver(() => {
      graph.style.setProperty(
        "--conversation-height",
        `${element.offsetHeight}px`,
      );
    });
    resize.observe(element);
    return () => {
      resize.disconnect();
      graph.style.removeProperty("--conversation-height");
    };
  }, []);

  useEffect(() => {
    current.current = { incident, spotlight, disabled, onUpdated, onSpotlight };
  });
  useEffect(() => {
    if (disabled) connection.current?.close();
  }, [disabled]);

  function stop() {
    session.current += 1;
    if (connectTimeout.current) clearTimeout(connectTimeout.current);
    connection.current?.close();
    connection.current = null;
    setVoiceState("off");
    const text = interim.current;
    interim.current = "";
    if (text.trim()) setDraft((saved) => `${saved} ${text}`.trim());
    setPartial("");
    speechSpotlight.current = null;
  }

  useEffect(() => {
    function release() {
      if (connectTimeout.current) clearTimeout(connectTimeout.current);
      session.current += 1;
      connection.current?.close();
      connection.current = null;
      setVoiceState("off");
      const text = interim.current;
      interim.current = "";
      if (text.trim()) setDraft((saved) => `${saved} ${text}`.trim());
      setPartial("");
    }
    function hide() {
      if (document.hidden) {
        release();
      }
    }
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", release);
    return () => {
      release();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", release);
    };
  }, []);

  useEffect(() => {
    history.current?.scrollTo({ top: history.current.scrollHeight });
  }, [incident.conversation?.length, historyOpen]);
  useEffect(() => {
    if (voiceState !== "listening") return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [voiceState]);

  async function drain() {
    if (processing.current) return;
    processing.current = true;
    setSending(true);
    setError("");
    try {
      while (queue.current.length) {
        const utterance = queue.current[0];
        if (current.current.disabled)
          throw new Error(
            "Wait for the current change, then retry your message.",
          );
        let updated: Incident;
        try {
          updated = await converseWithInvestigation(
            current.current.incident.id,
            {
              ...utterance,
              revision: current.current.incident.revision,
            },
          );
        } catch {
          // Reload once for concurrent background revisions or a lost successful response.
          const fresh = await loadIncident(current.current.incident.id);
          current.current.incident = fresh;
          current.current.onUpdated(fresh);
          updated = await converseWithInvestigation(fresh.id, {
            ...utterance,
            revision: fresh.revision,
          });
        }
        current.current.incident = updated;
        current.current.onUpdated(updated);
        const last = updated.conversation?.at(-1);
        const target =
          last?.status === "recorded"
            ? updated.investigation?.active_node_id
            : last?.node_ids?.[0];
        if (target) current.current.onSpotlight(target);
        queue.current.shift();
        failed.current = null;
      }
    } catch (cause) {
      failed.current = queue.current[0] ?? null;
      const unsent = queue.current.map((item) => item.text).join(" ");
      queue.current = [];
      setDraft((saved) => `${unsent} ${saved}`.trim());
      setError(
        cause instanceof Error
          ? cause.message
          : "Message could not be saved. Retry your preserved text.",
      );
      stop();
    } finally {
      processing.current = false;
      setSending(false);
    }
  }

  function enqueue(
    text: string,
    inputMode: "text" | "voice",
    nodeId?: string | null,
  ) {
    if (!text.trim()) return;
    if (text.length > 2000) {
      setDraft(text);
      setError(
        "Please split this message into parts of 2,000 characters or fewer.",
      );
      stop();
      return;
    }
    queue.current.push(
      failed.current?.text === text
        ? failed.current
        : {
            turn_id: `TURN-${crypto.randomUUID()}`,
            text,
            input_mode: inputMode,
            spotlight_node_id: nodeId ?? current.current.spotlight?.id ?? null,
          },
    );
    void drain();
  }

  async function start(automatic: boolean) {
    stop();
    mode.current = automatic;
    setHandsFree(automatic);
    setVoiceTranscript("");
    setElapsed(0);
    setError("");
    setVoiceState("connecting");
    const id = session.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone access requires HTTPS or localhost and a supported browser. You can continue typing.",
        );
      const [{ token }, { Scribe, RealtimeEvents, CommitStrategy }] =
        await Promise.all([
          getInvestigationVoiceToken(incident.id),
          import("@elevenlabs/client"),
        ]);
      if (session.current !== id) return;
      if (current.current.disabled)
        throw new Error(
          "This investigation is currently read-only. Continue when editing is available.",
        );
      const live = Scribe.connect({
        token,
        modelId: "scribe_v2_realtime",
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: 1.5,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      connection.current = live;
      connectTimeout.current = setTimeout(() => {
        if (session.current !== id) return;
        setError(
          "Voice connection timed out. Check microphone permission and retry.",
        );
        stop();
      }, 15000);
      live.on(RealtimeEvents.SESSION_STARTED, () => {
        if (connectTimeout.current) clearTimeout(connectTimeout.current);
        if (session.current === id) {
          startedAt.current = Date.now();
          setVoiceState("listening");
        }
      });
      live.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => {
        if (session.current !== id) return;
        speechSpotlight.current ??= current.current.spotlight?.id ?? null;
        interim.current = text;
        setPartial(text);
      });
      live.on(RealtimeEvents.COMMITTED_TRANSCRIPT, ({ text }) => {
        if (session.current !== id || !text.trim()) return;
        setPartial("");
        interim.current = "";
        setVoiceTranscript(text);
        const target = speechSpotlight.current;
        speechSpotlight.current = null;
        if (mode.current) enqueue(text, "voice", target);
        else setDraft((saved) => `${saved} ${text}`.trim());
      });
      live.on(RealtimeEvents.ERROR, () => {
        if (session.current !== id) return;
        setError(
          "Voice stopped. Check microphone permission and ElevenLabs access, then retry. Your text is preserved.",
        );
        stop();
      });
      live.on(RealtimeEvents.CLOSE, () => {
        if (session.current !== id) return;
        setError("Voice connection ended. Start voice again to reconnect.");
        stop();
      });
    } catch (cause) {
      if (session.current !== id) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Voice could not start. You can continue typing.",
      );
      stop();
    }
  }

  const turns = incident.conversation ?? [];
  const latest = turns.at(-1);
  const listening = voiceState !== "off";
  const voiceText = handsFree
    ? partial || voiceTranscript
    : [draft, partial].filter(Boolean).join(" ");
  const evidence = (incident.evidence ?? [])
    .filter((item) => item.status === "collected")
    .slice(0, 3);
  return (
    <div
      ref={container}
      className={`investigation-conversation${listening ? " is-voice" : ""}`}
      aria-label="Troubleshooting conversation"
    >
      {listening && (
        <div className="voice-message-heading">
          <strong>Voice message</strong>
          <span className="voice-message-time">
            <span aria-hidden="true" className="voice-listening-dot" />
            {voiceState === "connecting" ? "Connecting" : "Listening"}
            <span aria-hidden="true">·</span>
            <time
              role="timer"
              aria-live="off"
              aria-label={`${elapsed} seconds recording`}
            >
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </time>
          </span>
        </div>
      )}
      {latest && (
        <div className="conversation-reply" role="status">
          <strong>Troubleshooting agent</strong>
          <p>{latest.reply}</p>
          {latest.status === "pending" && (
            <div className="conversation-confirm">
              <button
                type="button"
                disabled={disabled || sending}
                onClick={() => enqueue("confirm", "text")}
              >
                Confirm answer
              </button>
              <button
                type="button"
                disabled={disabled || sending}
                onClick={() => enqueue("cancel", "text")}
              >
                Correct me
              </button>
            </div>
          )}
        </div>
      )}
      {historyOpen && (
        <div
          className="conversation-history"
          ref={history}
          role="log"
          aria-label="Conversation history"
        >
          {turns.map((turn) => (
            <div key={turn.id}>
              <p>
                <strong>You · {turn.input_mode}</strong>
                <br />
                {turn.text}
              </p>
              <p>
                <strong>Agent</strong>
                <br />
                {turn.reply}
              </p>
              {!!turn.node_ids?.length && (
                <div className="conversation-node-links">
                  {turn.node_ids?.map((id) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => onSpotlight(id)}
                    >
                      View question
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!listening && answerControls}
      {listening ? (
        <div className="voice-message-body">
          <p
            className="voice-message-transcript"
            aria-live="polite"
            aria-atomic="true"
          >
            {voiceText ||
              (voiceState === "connecting"
                ? "Getting your microphone ready…"
                : "Tell me what you're seeing on the machine…")}
          </p>
          <div
            className={`voice-waveform${partial ? " is-speaking" : ""}`}
            aria-hidden="true"
          >
            {[
              24, 29, 23, 30, 38, 26, 31, 27, 40, 28, 34, 25, 39, 32, 28, 26,
              33, 24, 15, 27, 40, 28, 26, 38, 24, 30, 25, 32,
            ].map((height, index) => (
              <span
                key={index}
                style={{ height, animationDelay: `${index * -0.13}s` }}
              />
            ))}
          </div>
          <div className="voice-message-tray">
            {!!evidence.length && (
              <div
                className="voice-evidence-chips"
                aria-label="Investigation evidence"
              >
                {evidence.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    title={item.label}
                    aria-label={`Inspect ${item.label}`}
                    onClick={() => onSelectEvidence(item.id)}
                  >
                    {item.kind === "image" ? (
                      <ImageIcon aria-hidden="true" />
                    ) : (
                      <File aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="voice-message-controls">
              <button
                type="button"
                className="voice-stop"
                aria-label="Stop voice input"
                onClick={stop}
              >
                <span>
                  <Stop aria-hidden="true" />
                </span>
                Tap to stop
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={handsFree}
                className="voice-hands-free"
                disabled={disabled}
                onClick={() => {
                  mode.current = !handsFree;
                  setHandsFree(!handsFree);
                }}
              >
                <span>Hands-free</span>
              </button>
              <button
                type="button"
                className="voice-send"
                aria-label="Send voice message"
                disabled={
                  disabled ||
                  sending ||
                  ![draft, partial].some((text) => text.trim())
                }
                onClick={() => {
                  const text = [draft, interim.current]
                    .filter(Boolean)
                    .join(" ");
                  interim.current = "";
                  stop();
                  setDraft("");
                  enqueue(text, "voice");
                }}
              >
                <ArrowUp aria-hidden="true" />
              </button>
            </div>
          </div>
          <button
            type="button"
            className="voice-history-toggle"
            aria-label="Conversation history"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <ChatCircle aria-hidden="true" /> Conversation
          </button>
        </div>
      ) : (
        <form
          className="conversation-composer"
          onSubmit={(event) => {
            event.preventDefault();
            enqueue(draft, "text");
            setDraft("");
          }}
        >
          <label htmlFor={`conversation-${incident.id}`}>
            Talk through what you're seeing
          </label>
          <textarea
            id={`conversation-${incident.id}`}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            placeholder="Answer this question, ask why, or explore another possibility…"
            disabled={disabled}
          />
          <div className="conversation-actions">
            <button
              type="button"
              aria-label="Conversation history"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <ChatCircle aria-hidden="true" />
              <span>Conversation</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={handsFree}
              disabled={disabled}
              onClick={() => {
                if (handsFree) {
                  stop();
                  setHandsFree(false);
                } else void start(true);
              }}
            >
              Hands-free
            </button>
            <button
              type="button"
              aria-label="Start voice input"
              disabled={disabled}
              onClick={() => void start(handsFree)}
            >
              <Microphone aria-hidden="true" />
              <span>Voice</span>
            </button>
            <button
              type="submit"
              className="conversation-send"
              aria-label="Send message"
              disabled={disabled || sending || !draft.trim()}
            >
              <PaperPlaneTilt aria-hidden="true" />
              <span>Send</span>
            </button>
          </div>
        </form>
      )}
      <p className="conversation-status" role="status">
        {sending
          ? "Agent is listening to your observation…"
          : voiceState === "connecting"
            ? "Connecting to ElevenLabs…"
            : voiceState === "listening"
              ? handsFree
                ? "Listening · pauses send automatically · say confirm or cancel"
                : "Dictating · review your text, then send"
              : handsFree
                ? "Hands-free paused · press Voice to resume"
                : "Type or dictate · answers can follow any eligible question"}
      </p>
      {error && (
        <p className="conversation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
