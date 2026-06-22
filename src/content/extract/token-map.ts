import { TokenMap, Token, Sentence } from '../../shared/types';
import { segmentWords, segmentSentences } from './tokenizer';

export function buildTokenMap(spokenText: string, locale = 'en'): TokenMap {
  const sents = segmentSentences(spokenText, locale);
  const sentences: Sentence[] = sents.map((s, i) => ({
    id: i, start: s.start, end: s.end, firstToken: -1, lastToken: -1,
  }));
  const tokens: Token[] = [];
  let si = 0;
  for (const w of segmentWords(spokenText, locale)) {
    while (si < sentences.length - 1 && w.start >= sentences[si].end) si++;
    const sentenceId = sentences.length ? sentences[si].id : 0;
    const index = tokens.length;
    tokens.push({ index, text: w.text, charIndex: w.start, charEnd: w.end, sentenceId });
    const sen = sentences[sentenceId];
    if (sen) { if (sen.firstToken === -1) sen.firstToken = index; sen.lastToken = index; }
  }
  // Drop sentences with no tokens so navigation never lands on an empty one, then compact ids.
  const kept = sentences.filter(s => s.firstToken !== -1);
  const remap = new Map<number, number>();
  kept.forEach((s, i) => remap.set(s.id, i));
  const compacted: Sentence[] = kept.map((s, i) => ({ ...s, id: i }));
  for (const t of tokens) t.sentenceId = remap.get(t.sentenceId) ?? 0;
  return { spokenText, tokens, sentences: compacted };
}

export function tokenAtOffset(map: TokenMap, offset: number): number {
  const t = map.tokens;
  if (t.length === 0) return -1;
  let lo = 0, hi = t.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid].charIndex <= offset) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/**
 * Find where `phrase` (a run of word texts) starts in `map`, case-insensitively.
 * Used to carry the reading position across the overlay/in-place token maps, which
 * index differently. Returns the token index of the match, or -1 if not found.
 */
export function findTokenByPhrase(map: TokenMap, phrase: string[]): number {
  if (phrase.length === 0) return -1;
  const t = map.tokens;
  const lower = phrase.map(p => p.toLowerCase());
  for (let i = 0; i < t.length; i++) {
    if (t[i].text.toLowerCase() !== lower[0]) continue;
    let ok = true;
    for (let k = 1; k < lower.length && i + k < t.length; k++) {
      if (t[i + k].text.toLowerCase() !== lower[k]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}
