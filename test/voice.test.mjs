import assert from "node:assert/strict";
import test from "node:test";
import {
  pcmAudioLevel,
  voiceCommand,
} from "../apps/web/src/incidents/voice.ts";

test("microphone levels rise with PCM loudness and handle signed samples and silence", () => {
  function audio(sample) {
    const bytes = Buffer.alloc(128);
    for (let i = 0; i < bytes.length; i += 2) bytes.writeInt16LE(sample, i);
    return bytes.toString("base64");
  }
  assert.equal(pcmAudioLevel(""), 0);
  assert.equal(pcmAudioLevel(audio(0)), 0);
  assert.ok(pcmAudioLevel(audio(100)) < pcmAudioLevel(audio(1000)));
  assert.ok(pcmAudioLevel(audio(1000)) < pcmAudioLevel(audio(10000)));
  assert.equal(pcmAudioLevel(audio(-1000)), pcmAudioLevel(audio(1000)));
  assert.equal(pcmAudioLevel(audio(-32768)), 1);
});

test("voice commands require a complete phrase so observations and negations stay intact", () => {
  assert.equal(voiceCommand("Confirm my answer!"), "answer");
  assert.equal(voiceCommand("Yes, that's right."), "answer");
  assert.equal(voiceCommand("Correct me."), "answer");
  assert.equal(voiceCommand("Send my message."), "send");
  assert.equal(voiceCommand("Stop listening."), "stop");
  for (const text of [
    "Don't confirm",
    "That is not correct",
    "No pressure",
    "Stop valve is closed",
    "Send pressure readings to the engineer",
  ])
    assert.equal(voiceCommand(text), null);
});
