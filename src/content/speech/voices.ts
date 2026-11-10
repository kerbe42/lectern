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

type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'voiceURI'>;

// Well-regarded adult voices, best first, used to break ties between natural voices
// (otherwise alphabetical order would put a child's voice first in some lists).
const PREFERRED = ['ava', 'andrew', 'emma', 'brian', 'aria', 'jenny', 'guy', 'clara', 'liam',
  'sonia', 'ryan', 'libby', 'natasha', 'william', 'michelle', 'christopher', 'eric', 'steffan'];
const CHILD = ['ana', 'maisie']; // child voices: fine to pick by hand, not as the default

/** 3 = natural/neural online voice, 2 = other online voice, 1 = built-in device voice (often robotic). */
export function voiceQuality(v: VoiceLike): number {
  if (/\b(natural|neural)\b/i.test(v.name)) return 3;
  if (!v.localService) return 2;
  return 1;
}

/** "Microsoft AvaMultilingual Online (Natural) - English (United States)" -> "ava". */
function firstName(v: VoiceLike): string {
  const m = v.name.match(/^(?:Microsoft|Google|Apple)?\s*([A-Za-z]+?)(?:Multilingual)?(?:\s|$)/);
  return (m?.[1] ?? v.name).toLowerCase();
}

/**
 * Best voice first: the page's language, then natural-sounding voices over robotic ones, then
 * the user's own region, then well-regarded voices. Natural online voices may not report word
 * timing; the engine then estimates the pace, so highlighting keeps going either way.
 */
export function rankVoices<V extends VoiceLike>(voices: V[], lang = navigator.language, region = navigator.language): V[] {
  const base = lang.slice(0, 2).toLowerCase();
  const userLang = region.toLowerCase();
  const score = (v: V) => {
    const vl = v.lang.toLowerCase().replace('_', '-');
    const name = firstName(v);
    const pref = PREFERRED.indexOf(name);
    return [
      vl.startsWith(base) ? 1 : 0,
      voiceQuality(v),
      CHILD.includes(name) ? 0 : 1,
      vl === userLang ? 1 : 0,
      pref === -1 ? 0 : PREFERRED.length - pref,
    ];
  };
  return [...voices].sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return a.name.localeCompare(b.name);
  });
}

/** The saved voice if it still exists, otherwise the best voice for `lang`. */
export function pickVoice<V extends VoiceLike>(voices: V[], uri: string | null, lang = navigator.language): V | null {
  if (uri) { const m = voices.find(v => v.voiceURI === uri); if (m) return m; }
  return rankVoices(voices, lang)[0] ?? null;
}
