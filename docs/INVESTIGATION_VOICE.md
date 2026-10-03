# Investigation conversation and voice input

The investigation graph has a conversation bar with typed input, voice dictation,
conversation history, and a Hands-free switch. Replies remain text only. The
spotlight marks the question being discussed; technicians can select another node
or describe another possibility without first navigating the graph.
The graph marks that question with one animated circular outline that slides
between questions and follows graph panning and zooming. Reduced-motion settings
keep the circle static and change its position immediately. The chatbox contains choices and input without
repeating the question or showing extra question headings.

## Configure

Add these settings to the ignored root `.env`, then restart the API using
`npm run dev`:

```dotenv
ELEVENLABS_API_KEY=your-server-key
FLOWPILOT_INCIDENT_VOICE_ENABLED=true
GEMINI_API_KEY=your-reasoning-key
FLOWPILOT_REASONING_ENABLED=true
```

The existing `FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY` also applies. For real
technician speech and live incidents, set it to `permitted` under the site's data
policy. The default `synthetic_only` permits voice only in replay investigations.
`disabled` blocks voice and external reasoning. `npm run dev:mock` disables Gemini;
leave voice disabled when running an entirely offline demonstration.

The API key stays on the server. The authenticated, edit-permission-protected
`POST /api/incidents/{id}/voice-token` endpoint obtains an ElevenLabs single-use
token with a `no-store` response. The browser uses that token with
[ElevenLabs Scribe realtime](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming)
and voice activity detection. Browser microphone permission and HTTPS (or
localhost) are required. The app stores transcript text, not raw microphone audio;
audio is streamed to ElevenLabs and its provider retention settings apply.

## Use

- Answer choices appear as selectable cards above the chat field. Click once to
  select a choice and show its tick on the right. Click the selected choice or
  tick again to confirm it. Keyboard arrows select; Space or Enter confirms the
  selected choice. **Describe in my own words** allows a free-text answer; enter
  the answer before confirming its tick. Add observations and notes in the chat
  field below. Selecting another graph node updates these controls.
- The right sidebar explains the selected question, its answer meanings, and
  supporting evidence. Closing or resizing it preserves the answer draft. During
  voice recording, the recording card replaces the typed composer and choices.
- **Voice** opens the recording card for dictation. Send directly, or stop to
  review the text in the editable chat field.
- While voice is active, a dark recording card shows the live transcript,
  elapsed listening time, a speech animation, links to existing incident evidence,
  and a **Tap to stop** control. Its send arrow submits the current dictated text.
- **Hands-free** starts continuous listening. A speech pause sends a committed
  transcript automatically; partial transcripts are displayed without being saved.
- Describe an observation, ask why a question matters, or discuss another
  possibility. Gemini sees the spotlight, eligible questions, recent conversation,
  and current assessment, then identifies the question(s) being answered.
- The agent repeats interpreted answers with their question. Say **confirm** or
  press Confirm answer to record them; say **cancel** to discard the proposal.
  Multiple clearly answered questions can be confirmed together.
- A confirmed answer to another eligible branch selects that branch and uses the
  existing graph validation and assessment flow. Unclear, conflicting, unsupported,
  or stale mappings ask for clarification and do not establish facts.
- **Stop** releases the microphone. Hidden pages and navigation also close the
  voice session. Voice errors preserve available text and allow typed input.

Without Gemini, routing accepts exact saved option phrases for the spotlighted
question, or an explicit fact name and option: `It is intermittent`,
`material flux`, `switch to material`. Other wording receives a clarification.
Natural conversation and discussion require Gemini. Corrections to already
answered nodes use the existing Correct this answer control and retained history.

Conversation turns are persisted in the incident with the original transcript,
input mode, author, routing, provider metadata, and confirmation outcome. Revision
checks reject stale writes; turn IDs make retries idempotent. Reloading the
workspace retains the conversation and recorded answers.

## Verification

`apps/api/tests/test_incident_conversation.py` covers confirmation, alternative
nodes, ambiguity, multiple answers, invalid model output, stale proposals,
idempotent retries, token authentication, provider errors, and policy enforcement.
`test/e2e/incident-conversation.spec.ts` covers answer cards, keyboard selection,
sidebar separation, desktop/mobile layout, persisted
chat, committed speech, spoken confirmation, microphone session cleanup, and
typed fallback. Provider streams and tokens are simulated in regression tests;
live audio quality, accent recognition, and factory noise require an on-site trial.
