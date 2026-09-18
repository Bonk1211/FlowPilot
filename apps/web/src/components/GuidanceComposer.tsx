import { ArrowUp, Info, Sparkle } from "@phosphor-icons/react";
import type { CaseExplanation } from "@flowpilot/contracts";
import { useState } from "react";

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
    <section className="guidance-region" aria-labelledby="guidance-title">
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
                        <a key={id} href={`#${id}`}>
                          {id}
                        </a>
                      ))}
                    </p>
                  )}
                  <small>Guidance only — this did not change the case.</small>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <form className="guidance-composer" onSubmit={submit}>
        <div className="composer-heading">
          <div>
            <p className="eyebrow">Explain and guide</p>
            <h2 id="guidance-title">Ask about this case</h2>
          </div>
          <p id="guidance-help">
            <Info aria-hidden="true" />
            Questions cannot record evidence or authorize service.
          </p>
        </div>
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
        <label className="composer-input">
          <span className="sr-only">Question about the current case</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-describedby="guidance-help"
            placeholder="Ask why a cause is ranked, what is unknown, or what to check next…"
            maxLength={1000}
            rows={2}
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
        {busy && <p role="status">Preparing grounded guidance…</p>}
      </form>
    </section>
  );
}
