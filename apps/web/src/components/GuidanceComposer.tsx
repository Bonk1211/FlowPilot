import { ArrowUp, Info, Sparkle, X } from "@phosphor-icons/react";
import type { CaseExplanation } from "@flowpilot/contracts";
import { useEffect, useRef, useState } from "react";

export type GuidanceExchange = {
  id: string;
  question: string;
  response: CaseExplanation;
};

export function GuidanceComposer({
  exchanges,
  busy,
  onAsk,
}: {
  exchanges: GuidanceExchange[];
  busy: boolean;
  onAsk: (question: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && messages.current)
      messages.current.scrollTop = messages.current.scrollHeight;
  }, [open, exchanges, busy]);
  function close() {
    setOpen(false);
    launcher.current?.focus();
  }
  const [question, setQuestion] = useState("");
  const suggestions = [
    "Why is this the leading cause?",
    "What should I check next?",
    "What evidence is still missing?",
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setQuestion("");
    await onAsk(text);
  }

  return (
    <div className="guidance-widget">
      <button
        ref={launcher}
        type="button"
        className="guidance-toggle chat-launcher"
        aria-label={open ? "Close FlowPilot chat" : "Open FlowPilot chat"}
        aria-expanded={open}
        aria-controls="flowpilot-chat"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <X aria-hidden="true" />
        ) : (
          <>
            <Sparkle aria-hidden="true" />
            <span>AI</span>
          </>
        )}
      </button>
      <section
        id="flowpilot-chat"
        className="guidance-region chat-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="chat-panel-title"
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
        }}
      >
        <header className="chat-panel-header">
          <span className="chat-brand-icon">
            <Sparkle aria-hidden="true" />
          </span>
          <div>
            <h2 id="chat-panel-title">FlowPilot assistant</h2>
            <p>Help with this investigation</p>
          </div>
          <button
            type="button"
            className="chat-close"
            aria-label="Minimize chat"
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="chat-message-area" ref={messages}>
          {exchanges.length === 0 && (
            <div className="chat-welcome">
              <Sparkle aria-hidden="true" />
              <h3>What would you like to understand?</h3>
              <p>
                Ask about the likely cause, missing evidence, or your next
                check.
              </p>
            </div>
          )}
          {exchanges.length > 0 && (
            <div className="guidance-exchanges" aria-live="polite">
              {exchanges.map((exchange) => (
                <article className="guidance-exchange" key={exchange.id}>
                  <p className="guidance-question">
                    <span>Technician</span>
                    {exchange.question}
                  </p>
                  <div className="guidance-answer">
                    <span className="guidance-avatar" aria-hidden="true">
                      <Sparkle />
                    </span>
                    <div>
                      <p className="eyebrow">FlowPilot guidance</p>
                      <p>{exchange.response.answer}</p>
                      {!!exchange.response.evidence_ids.length && (
                        <p className="guidance-citations">
                          Evidence:{" "}
                          {exchange.response.evidence_ids.map((id) => (
                            <a
                              key={id}
                              href={`#${id}`}
                              onClick={(event) => {
                                const target = document.getElementById(id);
                                if (!target) return;
                                event.preventDefault();
                                let parent = target.parentElement;
                                while (parent) {
                                  if (parent instanceof HTMLDetailsElement)
                                    parent.open = true;
                                  parent = parent.parentElement;
                                }
                                setOpen(false);
                                target.focus({ preventScroll: true });
                                target.scrollIntoView({ block: "center" });
                              }}
                            >
                              {id}
                            </a>
                          ))}
                        </p>
                      )}
                      <small>
                        Guidance only — this did not change the case.
                      </small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {busy && (
            <p className="chat-loading" role="status">
              Preparing grounded guidance…
            </p>
          )}
        </div>
        <form className="guidance-composer" onSubmit={submit}>
          <div className="composer-heading">
            <div>
              <h2 id="guidance-title" className="sr-only">
                Ask FlowPilot
              </h2>
            </div>
            <p id="guidance-help">
              <Info aria-hidden="true" />
              Guidance only — structured controls change the case.
            </p>
          </div>
          <details className="suggested-questions">
            <summary>Suggested questions</summary>
            <div className="suggested-prompts" aria-label="Suggested questions">
              {suggestions.map((item) => (
                <button
                  type="button"
                  className="prompt-chip"
                  key={item}
                  onClick={() => setQuestion(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </details>
          <label className="composer-input">
            <span className="sr-only">Question about the current case</span>
            <textarea
              ref={input}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              aria-describedby="guidance-help"
              placeholder="Ask why a cause is ranked, what is unknown, or what to check next…"
              maxLength={1000}
              rows={1}
            />
            <button
              className="composer-send"
              type="submit"
              disabled={busy || question.trim().length < 2}
              aria-label={busy ? "Requesting guidance" : "Ask FlowPilot"}
            >
              <ArrowUp aria-hidden="true" />
            </button>
          </label>
        </form>
      </section>
    </div>
  );
}
