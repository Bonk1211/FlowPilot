// Scribe's microphone sends mono, little-endian PCM16 through connection.send.
export function pcmAudioLevel(audioBase64: string): number {
  const bytes = atob(audioBase64);
  const count = Math.floor(bytes.length / 2);
  if (!count) return 0;
  let energy = 0;
  for (let i = 0; i < count; i++) {
    const unsigned =
      bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
    const sample = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
    energy += sample * sample;
  }
  const decibels =
    20 * Math.log10(Math.max(Math.sqrt(energy / count), 0.000001));
  return Math.max(0, Math.min(1, (decibels + 60) / 48));
}

export function voiceCommand(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^\w]+/g, " ")
    .trim();
  if (
    /^(?:stop (?:listening|recording|voice(?: input)?)|pause (?:listening|recording|voice))$/.test(
      words,
    )
  )
    return "stop";
  if (
    /^(?:send|send (?:my |the )?(?:message|answer)|submit(?: (?:my |the )?answer)?)$/.test(
      words,
    )
  )
    return "send";
  if (
    /^(?:confirm(?: (?:my |the )?answer)?|yes(?: (?:that s right|confirm))?|that s right|correct|cancel(?: (?:my |the )?answer)?|correct me|no|discard|that s wrong)$/.test(
      words,
    )
  )
    return "answer";
  return null;
}
