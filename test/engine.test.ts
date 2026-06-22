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
