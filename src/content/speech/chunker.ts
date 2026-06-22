import { TokenMap, Chunk } from '../../shared/types';

export function chunkBySentence(map: TokenMap, maxChars = 200): Chunk[] {
  const s = map.sentences;
  if (s.length === 0) {
    const text = map.spokenText;
    return text.trim()
      ? [{ text, startOffset: 0, firstToken: 0, lastToken: Math.max(0, map.tokens.length - 1) }]
      : [];
  }
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < s.length) {
    const start = s[i];
    let j = i;
    while (j + 1 < s.length && s[j + 1].end - start.start <= maxChars) j++;
    const end = s[j];
    chunks.push({
      text: map.spokenText.slice(start.start, end.end),
      startOffset: start.start,
      firstToken: start.firstToken,
      lastToken: end.lastToken,
    });
    i = j + 1;
  }
  return chunks;
}
