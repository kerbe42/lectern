import { describe, it, expect } from 'vitest';
import { buildTokenMap } from '../src/content/extract/token-map';
import { chunkBySentence } from '../src/content/speech/chunker';

describe('chunkBySentence', () => {
  it('packs whole sentences under the char cap', () => {
    const map = buildTokenMap('Aa bb. Cc dd. Ee ff.');
    const chunks = chunkBySentence(map, 14);
    for (const c of chunks) {
      expect(map.spokenText.slice(c.startOffset, c.startOffset + c.text.length)).toBe(c.text);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].firstToken).toBe(0);
  });
  it('keeps an overlong single sentence as its own chunk', () => {
    const map = buildTokenMap('Word word word word word word word word.');
    const chunks = chunkBySentence(map, 10);
    expect(chunks.length).toBe(1);
  });
  it('chunk text always equals the spokenText slice at startOffset', () => {
    const map = buildTokenMap('Alpha beta gamma. Delta epsilon zeta. Eta theta iota kappa.');
    for (const c of chunkBySentence(map, 25)) {
      expect(c.text).toBe(map.spokenText.slice(c.startOffset, c.startOffset + c.text.length));
    }
  });
});
