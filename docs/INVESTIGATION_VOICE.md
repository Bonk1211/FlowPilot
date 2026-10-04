# Investigation conversation and voice input

The investigation graph has a conversation bar with typed input, voice dictation,
conversation history, and a Hands-free switch. Hands-free reads new replies aloud;
typed conversations and manual dictation keep text-only replies. The
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

Hands-free text-to-speech uses the browser's
[Speech Synthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/speak).
It starts as soon as a conversation reply is saved, without an additional server
request or API key. Voice availability and quality depend on the browser and
operating system; some system voices use a remote speech service. Replies remain
visible if speech synthesis is unavailable or playback fails.

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
- While voice is active, a compact card shows the live transcript, a small
  microphone waveform, elapsed time, and a **Stop** control. Its send arrow submits
  the current dictated text. Conversation history also reveals evidence links.
- **Hands-free** starts continuous listening. A speech pause sends a committed
  transcript automatically; partial transcripts are displayed without being saved.
  Clear answers are recorded immediately and advance to the next node, without a
  second confirmation. Unclear answers still get a clarification question.
- Hands-free keeps a single Listening / Thinking / Speaking status above the
  transcript and reply. History and evidence stay tucked away until requested.
- New agent replies play aloud only while Hands-free is active. The card shows
  **Speaking** and pauses microphone capture during playback to prevent feedback,
  then resumes **Listening** automatically. Wait for Listening before responding;
  **Talk now** interrupts the reply and immediately returns the microphone to you.
  **Replay** reads the last reply again without sending another message. Spoken
  words are highlighted when the browser provides speech boundary events; other
  browsers keep the complete reply visible. **Stop** remains available
  during speech. Switching Hands-free off cancels playback and returns to manual
  dictation. Previous replies are only replayed when requested.
- Describe an observation, ask why a question matters, or discuss another
  possibility. Gemini sees the spotlight, eligible questions, recent conversation,
  and current assessment, then identifies the question(s) being answered.
- For typed input and manual dictation, the agent repeats interpreted answers
  with their question. Say **confirm** or
  press Confirm answer to record them; say **cancel** to discard the proposal.
  Multiple clearly answered questions can be confirmed together; Hands-free
  records them together automatically.
- A confirmed answer to another eligible branch selects that branch and uses the
  existing graph validation and assessment flow. Unclear, conflicting, unsupported,
  or stale mappings ask for clarification and do not establish facts.
- **Stop** releases the microphone and cancels playback. Hidden pages, navigation,
  and read-only investigations also close the voice session. Voice errors preserve
  available text and allow typed input; playback errors resume listening.

Without Gemini, routing accepts exact saved option phrases for the spotlighted
question, or an explicit fact name and option: `It is intermittent`,
`material flux`, `switch to material`. Other wording receives a clarification.
Natural conversation and discussion require Gemini. Corrections to already
answered nodes use the existing Correct this answer control and retained history.

Conversation turns are persisted in the incident with the original transcript,
input mode, Hands-free setting, author, routing, provider metadata, and recording
outcome. Revision checks reject stale writes; turn IDs make retries idempotent.
Reloading the workspace retains the conversation and recorded answers.

## Verification

`apps/api/tests/test_incident_conversation.py` covers Hands-free auto-recording,
manual confirmation, alternative nodes, ambiguity, multiple answers, invalid model
output, stale proposals,
idempotent retries, token authentication, provider errors, and policy enforcement.
`test/e2e/incident-conversation.spec.ts` covers answer cards, keyboard selection,
sidebar separation, desktop/mobile layout, persisted chat, committed speech,
automatic node progression, spoken replies and manual confirmation, microphone
muting during playback, mode isolation, playback failures, microphone session
cleanup, and typed fallback, plus compact session status, interruption, replay,
word highlighting, keyboard controls, mobile layout, and reduced motion. Provider
streams, tokens, and speech playback are simulated in regression tests;
live audio quality, accent recognition, and factory noise require an on-site trial.
