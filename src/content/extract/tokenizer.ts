export interface WordSeg { text: string; start: number; end: number; }
export interface SentSeg { text: string; start: number; end: number; }

interface RawSeg { segment: string; index: number; isWordLike?: boolean; }
function segmenter(granularity: 'word' | 'sentence', locale: string) {
  // Loose cast: Intl.Segmenter typings vary by TS lib version; runtime is supported in Chrome/Node 18+.
  return new (Intl as any).Segmenter(locale, { granularity }) as { segment(s: string): Iterable<RawSeg> };
}

export function segmentWords(text: string, locale = 'en'): WordSeg[] {
  const out: WordSeg[] = [];
  for (const s of segmenter('word', locale).segment(text)) {
    if (s.isWordLike) out.push({ text: s.segment, start: s.index, end: s.index + s.segment.length });
  }
  return out;
}
export function segmentSentences(text: string, locale = 'en'): SentSeg[] {
  const out: SentSeg[] = [];
  for (const s of segmenter('sentence', locale).segment(text)) {
    if (s.segment.trim().length) out.push({ text: s.segment, start: s.index, end: s.index + s.segment.length });
  }
  return out;
}
