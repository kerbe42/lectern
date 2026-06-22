export function loadVoices(synth: SpeechSynthesis, timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const have = synth.getVoices();
    if (have.length) return resolve(have);
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(synth.getVoices()); };
    synth.addEventListener('voiceschanged', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

/** Local voices first (they reliably fire boundary events), then by language match. */
export function rankVoices(voices: SpeechSynthesisVoice[], lang = navigator.language): SpeechSynthesisVoice[] {
  const base = lang.slice(0, 2).toLowerCase();
  return [...voices].sort((a, b) => {
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    const am = a.lang.toLowerCase().startsWith(base), bm = b.lang.toLowerCase().startsWith(base);
    if (am !== bm) return am ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function pickVoice(voices: SpeechSynthesisVoice[], uri: string | null): SpeechSynthesisVoice | null {
  if (uri) { const m = voices.find(v => v.voiceURI === uri); if (m) return m; }
  return rankVoices(voices)[0] ?? null;
}
