import { describe, it, expect } from 'vitest';
import { buildTokenMap, tokenAtOffset } from '../src/content/extract/token-map';

describe('buildTokenMap', () => {
  const map = buildTokenMap('Cats run. Dogs nap.');
  it('produces word tokens with offsets', () => {
    expect(map.tokens.map(t => t.text)).toEqual(['Cats', 'run', 'Dogs', 'nap']);
    expect(map.tokens[0].charIndex).toBe(0);
    expect(map.tokens[2].charIndex).toBe(10);
  });
  it('assigns sentence ids and token ranges', () => {
    expect(map.sentences.length).toBe(2);
    expect(map.tokens[1].sentenceId).toBe(0);
    expect(map.tokens[2].sentenceId).toBe(1);
    expect(map.sentences[0].firstToken).toBe(0);
    expect(map.sentences[0].lastToken).toBe(1);
    expect(map.sentences[1].firstToken).toBe(2);
  });
});

describe('tokenAtOffset', () => {
  const map = buildTokenMap('Cats run. Dogs nap.');
  it('finds the token containing/preceding an offset', () => {
    expect(tokenAtOffset(map, 0)).toBe(0);
    expect(tokenAtOffset(map, 5)).toBe(1);   // inside "run"
    expect(tokenAtOffset(map, 11)).toBe(2);  // inside "Dogs"
    expect(tokenAtOffset(map, 999)).toBe(3); // clamps to last
  });
});
