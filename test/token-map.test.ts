import { describe, it, expect } from 'vitest';
import { buildTokenMap, tokenAtOffset, findTokenByPhrase } from '../src/content/extract/token-map';

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

describe('findTokenByPhrase (carry position across maps)', () => {
  // Simulates the two maps: in-place has leading nav cruft; overlay is clean.
  const overlay = buildTokenMap('Dogs nap now in the warm sun.');
  const inplace = buildTokenMap('Home Menu Search Dogs nap now in the warm sun.');
  it('relocates the same words at a different index', () => {
    const at = 1; // "nap" in overlay
    const phrase = overlay.tokens.slice(at, at + 4).map(t => t.text); // [nap, now, in, the]
    const target = findTokenByPhrase(inplace, phrase);
    expect(inplace.tokens[target].text).toBe('nap');
    expect(target).toBe(4); // after Home/Menu/Search/Dogs
  });
  it('is case-insensitive and returns -1 when absent', () => {
    expect(findTokenByPhrase(overlay, ['DOGS', 'nap'])).toBe(0);
    expect(findTokenByPhrase(overlay, ['velociraptor'])).toBe(-1);
  });
});
