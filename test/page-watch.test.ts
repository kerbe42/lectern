// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PageWatcher } from '../src/content/page-watch';

const text = () => document.getElementById('main')?.textContent ?? '';
/** Let the MutationObserver deliver, then pass the settle time. */
async function settle() { await Promise.resolve(); await vi.advanceTimersByTimeAsync(500); }

describe('PageWatcher', () => {
  let changes: boolean[]; let w: PageWatcher;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="main"><p>First page.</p></main><div id="ui"></div>';
    history.replaceState(null, '', '/one');
    changes = [];
    w = new PageWatcher(document, {
      readableText: text, onChange: c => changes.push(c.urlChanged), ignore: document.getElementById('ui')!,
    });
    w.mark(text()); w.start();
  });
  afterEach(() => { w.stop(); vi.useRealTimers(); });

  it('reports text that shows up after the scan', async () => {
    document.getElementById('main')!.insertAdjacentHTML('beforeend', '<p>Loaded later.</p>');
    await settle();
    expect(changes).toEqual([false]);
  });

  it('reports the content being swapped for another page (single-page site)', async () => {
    history.pushState(null, '', '/two');
    document.getElementById('main')!.remove();
    document.body.insertAdjacentHTML('afterbegin', '<main id="main"><p>Second page.</p></main>');
    await settle();
    expect(changes).toEqual([true]);
  });

  it('notices a new address even when the DOM is quiet', async () => {
    history.pushState(null, '', '/three');
    await vi.advanceTimersByTimeAsync(2000);
    expect(changes).toEqual([true]);
  });

  it('stays quiet when the readable text did not change', async () => {
    document.body.insertAdjacentHTML('beforeend', '<aside>An advert rotated.</aside>');
    await settle();
    expect(changes).toEqual([]);
  });

  it('ignores changes inside our own UI', async () => {
    const readable = vi.fn(text);
    w.stop();
    w = new PageWatcher(document, { readableText: readable, onChange: () => {}, ignore: document.getElementById('ui')! });
    w.mark(text()); w.start();
    document.getElementById('ui')!.textContent = 'Tap a word to start reading';
    await settle();
    expect(readable).not.toHaveBeenCalled();
  });

  it('waits for the page to settle and reports a burst of changes once', async () => {
    const main = document.getElementById('main')!;
    for (let i = 0; i < 5; i++) {
      main.insertAdjacentHTML('beforeend', `<p>Part ${i}.</p>`);
      await Promise.resolve(); await vi.advanceTimersByTimeAsync(100);
    }
    await settle();
    expect(changes).toEqual([false]);
  });

  it('stops reporting after stop()', async () => {
    w.stop();
    document.getElementById('main')!.insertAdjacentHTML('beforeend', '<p>More.</p>');
    await settle(); await vi.advanceTimersByTimeAsync(3000);
    expect(changes).toEqual([]);
  });
});
