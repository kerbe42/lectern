// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { collectDomText } from '../src/content/extract/domtext';
import { buildTokenMap } from '../src/content/extract/token-map';
import { OverlayHighlighter } from '../src/content/highlight/overlay-highlighter';

beforeAll(() => {
  // jsdom doesn't implement layout; stub the scroll helper used during highlight.
  (Element.prototype as any).scrollIntoView = () => {};
});

describe('overlay highlighting round-trip (jsdom)', () => {
  it('wraps each token in a span that matches the token map and the original text', () => {
    document.body.innerHTML = '<div id="c"><p>Cats run fast.</p><p>Dogs nap now.</p></div>';
    const container = document.getElementById('c')!;
    const collected = collectDomText(container);
    const map = buildTokenMap(collected.text);

    expect(map.tokens.map(t => t.text)).toEqual(['Cats', 'run', 'fast', 'Dogs', 'nap', 'now']);

    const hl = new OverlayHighlighter(container, map, collected);
    const spans = container.querySelectorAll('.lec-w');
    expect(spans.length).toBe(6);

    // Every wrapped span's text equals its token's text (offset → DOM mapping is correct).
    for (const t of map.tokens) {
      const span = container.querySelector(`.lec-w[data-ti="${t.index}"]`)!;
      expect(span.textContent).toBe(t.text);
    }

    // Wrapping preserves the visible text.
    expect(container.textContent).toBe('Cats run fast.Dogs nap now.');

    // highlightWord activates the right span; highlightSentence spans its tokens.
    hl.highlightWord(3);
    expect(container.querySelector('.lec-w[data-ti="3"]')!.classList.contains('lec-w-active')).toBe(true);
    hl.highlightSentence(map.tokens[3].sentenceId);
    expect(container.querySelector('.lec-w[data-ti="4"]')!.classList.contains('lec-sent-active')).toBe(true);
  });
});
