import { describe, it, expect } from 'vitest';
import { segmentWords, segmentSentences } from '../src/content/extract/tokenizer';

describe('segmentWords', () => {
  it('returns word-like tokens with offsets', () => {
    const w = segmentWords('Hello, world!');
    expect(w.map(x => x.text)).toEqual(['Hello', 'world']);
    expect(w[0]).toEqual({ text: 'Hello', start: 0, end: 5 });
    expect(w[1].start).toBe(7);
  });
  it('skips pure punctuation/whitespace', () => {
    expect(segmentWords('  ... ').length).toBe(0);
  });
});

describe('segmentSentences', () => {
  it('splits on sentence boundaries', () => {
    const s = segmentSentences('One. Two! Three?');
    expect(s.length).toBe(3);
    expect(s[0].start).toBe(0);
    expect(s[1].text.trim()).toBe('Two!');
  });
});
