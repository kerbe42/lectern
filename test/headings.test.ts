// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { collectDomText } from '../src/content/extract/domtext';
import { findContentRoot } from '../src/content/extract/readability';
import { buildTokenMap } from '../src/content/extract/token-map';
import { chunkBySentence } from '../src/content/speech/chunker';
import { SpeechEngine, HEADING_PAUSE_MS } from '../src/content/speech/engine';

function collect(html: string) {
  document.body.innerHTML = `<div id="c">${html}</div>`;
  return collectDomText(document.getElementById('c')!);
}

describe('headings and paragraph breaks', () => {
  it('ends a heading as its own sentence instead of running into the next paragraph', () => {
    const c = collect('<h2>Learning Objectives</h2><p>By the end you will know a lot.</p>');
    expect(c.text).toBe('Learning Objectives.\nBy the end you will know a lot.');
    expect(c.headings).toEqual([[0, 'Learning Objectives'.length]]);
  });
  it("doesn't double up punctuation, and breaks between list items", () => {
    const c = collect('<h3>Why?</h3><ul><li>First item</li><li>Second item</li></ul>');
    expect(c.text).toBe('Why?\nFirst item.\nSecond item');
  });
  it('keeps inline elements in the same sentence', () => {
    expect(collect('<p>The <a href="#">quick</a> <b>fox</b> ran.</p>').text).toBe('The quick fox ran.');
  });
  it('covers a heading split over several inline nodes', () => {
    const c = collect('<h2>Task <span>1:</span> Introduction</h2><p>Body.</p>');
    const [s, e] = c.headings[0];
    expect(c.text.slice(s, e)).toBe('Task 1: Introduction');
  });
  it('skips text under a hidden ancestor (collapsed sections)', () => {
    const c = collect('<p>Shown.</p><div style="display:none"><section><p>Collapsed task text.</p></section></div>');
    expect(c.text).toBe('Shown.');
  });
  it('marks heading sentences and keeps them in their own chunks', () => {
    const c = collect('<h2>Task 1: Introduction</h2><p>One. Two.</p><h2>Task 2: More</h2><p>Three.</p>');
    const map = buildTokenMap(c.text, 'en', c.headings);
    expect(map.sentences.filter(s => s.heading).map(s => c.text.slice(s.start, s.end).trim()))
      .toEqual(['Task 1: Introduction.', 'Task 2: More.']);
    const chunks = chunkBySentence(map, 200);
    expect(chunks.map(ch => [ch.text.trim(), !!ch.heading])).toEqual([
      ['Task 1: Introduction.', true], ['One. Two.', false], ['Task 2: More.', true], ['Three.', false],
    ]);
  });
});

describe('findContentRoot', () => {
  it('ignores a hidden pre-rendered copy of the content and picks the visible main', () => {
    const para = '<p>' + 'Visible words here. '.repeat(20) + '</p>';
    document.body.innerHTML =
      `<section style="display:none"><article><h2>Task 1</h2>${para}</article></section>` +
      `<main id="main-content"><h1>Room</h1>${para}${para}</main>`;
    expect(findContentRoot(document).id).toBe('main-content');
  });
});

describe('heading pauses', () => {
  afterEach(() => { vi.useRealTimers(); });
  // Records utterances; the test ends each one by hand, as a real voice would later.
  class Utt { text: string; onstart: any; onend: any; onerror: any; onboundary: any; voice: any; rate = 1; constructor(t: string) { this.text = t; } }
  function setup() {
    vi.useFakeTimers();
    (globalThis as any).SpeechSynthesisUtterance = Utt;
    const spoken: Utt[] = [];
    const synth = { speak: (u: Utt) => spoken.push(u), cancel() {}, pause: vi.fn(), resume: vi.fn() };
    const c = collect('<h2>Heading</h2><p>Body text.</p>');
    const map = buildTokenMap(c.text, 'en', c.headings);
    const engine = new SpeechEngine(synth as any, { onWord() {}, onSentence() {}, onState() {}, onEnd() {} });
    engine.load(map, chunkBySentence(map), null, 1);
    engine.play();
    return { spoken, synth, engine };
  }
  it('waits after a heading before speaking the next paragraph', () => {
    const { spoken } = setup();
    expect(spoken.map(u => u.text.trim())).toEqual(['Heading.']);
    spoken[0].onend();
    expect(spoken.length).toBe(1);                 // silence first
    vi.advanceTimersByTime(HEADING_PAUSE_MS);
    expect(spoken.map(u => u.text.trim())).toEqual(['Heading.', 'Body text.']);
  });
  it('pausing during that silence holds the next paragraph until resume', () => {
    const { spoken, engine, synth } = setup();
    spoken[0].onend();
    engine.pause();
    vi.advanceTimersByTime(HEADING_PAUSE_MS * 3);
    expect(spoken.length).toBe(1);
    expect(engine.getState()).toBe('paused');
    engine.resume();
    expect(spoken.map(u => u.text.trim())).toEqual(['Heading.', 'Body text.']);
    expect(synth.resume).not.toHaveBeenCalled();   // nothing was mid-utterance to resume
  });
});
