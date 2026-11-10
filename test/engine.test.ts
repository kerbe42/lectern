import { describe, it, expect, beforeAll } from 'vitest';
import { buildTokenMap } from '../src/content/extract/token-map';
import { chunkBySentence } from '../src/content/speech/chunker';
import { SpeechEngine } from '../src/content/speech/engine';

// Minimal fakes for the Web Speech API so the engine can run under Node.
class FakeUtterance {
  text: string; voice: any = null; rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onboundary: ((e: any) => void) | null = null;
  constructor(text: string) { this.text = text; }
}
// Drives speech synchronously: onstart, then a word boundary per whitespace token, then onend.
class FakeSynth {
  speak(u: any) {
    u.onstart && u.onstart();
    const re = /\S+/g; let m: RegExpExecArray | null;
    while ((m = re.exec(u.text)) !== null) {
      u.onboundary && u.onboundary({ name: 'word', charIndex: m.index, charLength: m[0].length });
    }
    u.onend && u.onend();
  }
  cancel() {} pause() {} resume() {}
}

beforeAll(() => { (globalThis as any).SpeechSynthesisUtterance = FakeUtterance; });

function run(text: string, maxChars: number, fromToken?: number) {
  const words: number[] = [];
  let ended = false;
  const map = buildTokenMap(text);
  const engine = new SpeechEngine(new FakeSynth() as any, {
    onWord: ti => words.push(ti),
    onSentence: () => {},
    onState: () => {},
    onEnd: () => { ended = true; },
  });
  engine.load(map, chunkBySentence(map, maxChars), null, 1);
  engine.play(fromToken);
  return { words, ended, map };
}

describe('SpeechEngine boundary → token mapping', () => {
  it('emits every word in order across a single chunk', () => {
    const { words, ended } = run('Cats run fast. Dogs nap now.', 100);
    expect(words).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ended).toBe(true);
  });

  it('keeps token indices correct across multiple chunks (baseOffset math)', () => {
    const { words, ended } = run('Cats run fast. Dogs nap now.', 15); // forces two chunks
    expect(words).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ended).toBe(true);
  });

  it('respects a mid-article start token (text slicing)', () => {
    const { words } = run('Cats run fast. Dogs nap now.', 100, 3);
    expect(words[0]).toBe(3);
    expect(words).toEqual([3, 4, 5]);
  });
});

describe('SpeechEngine highlight never jumps backwards', () => {
  // Speaks words with a sentence boundary in between (as some voices do), and lets the test
  // decide when the word boundaries arrive.
  function harness() {
    const words: number[] = [];
    const utts: any[] = [];
    const synth = { speak: (u: any) => utts.push(u), cancel() {}, pause() {}, resume() {} };
    const map = buildTokenMap('One two three four five.');
    const engine = new SpeechEngine(synth as any, {
      onWord: ti => words.push(ti), onSentence: () => {}, onState: () => {}, onEnd: () => {},
    });
    engine.load(map, chunkBySentence(map), { localService: false } as any, 1);
    engine.play();
    return { words, utts };
  }
  it('ignores sentence boundaries that point back at the first word', () => {
    const { words, utts } = harness();
    const u = utts[0];
    u.onstart();
    u.onboundary({ name: 'word', charIndex: 0 });
    u.onboundary({ name: 'word', charIndex: 4 });
    u.onboundary({ name: 'sentence', charIndex: 0 }); // must not move the highlight back
    u.onboundary({ name: 'word', charIndex: 8 });
    expect(words).toEqual([0, 1, 2]);
  });
  it('stops guessing once real word timing arrives late', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      const { words, utts } = harness();
      const u = utts[0];
      u.onstart();
      vi.advanceTimersByTime(1300);                  // no timing yet: guessing starts
      vi.advanceTimersByTime(200);
      const guessed = words.length;
      u.onboundary({ name: 'word', charIndex: 4 });  // real timing arrives
      const after = words.length;
      vi.advanceTimersByTime(5000);                  // guessed timers must not fire any more
      expect(words.length).toBe(after);
      expect(after).toBe(guessed + 1);
    } finally { vi.useRealTimers(); }
  });
});
