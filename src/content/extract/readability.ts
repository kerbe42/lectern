import { Readability } from '@mozilla/readability';

export interface Readable { title: string; contentHtml: string; }

export function extractReadable(doc: Document): Readable | null {
  try {
    const clone = doc.cloneNode(true) as Document;
    // Readability removes <button> elements, which drops inline content such as glossary
    // terms (<button class="glossary-term">LLM</button>). Demote buttons to spans first so
    // their text survives into the article. Block-level chrome is still removed by
    // Readability's own nav/link-density heuristics.
    clone.querySelectorAll('button').forEach(b => {
      const span = clone.createElement('span');
      span.innerHTML = b.innerHTML;
      b.replaceWith(span);
    });
    const art = new Readability(clone).parse();
    if (art?.content && art.textContent && art.textContent.trim().length > 40) {
      return { title: art.title || doc.title, contentHtml: art.content };
    }
  } catch { /* fall through */ }
  return null;
}

function rendered(el: HTMLElement): boolean {
  if (typeof (el as any).checkVisibility === 'function') return (el as any).checkVisibility();
  const view = el.ownerDocument.defaultView; // fallback for engines without checkVisibility (jsdom)
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (view?.getComputedStyle(cur).display === 'none') return false;
  }
  return true;
}

/** Length of the text actually on screen: hidden subtrees count for nothing. */
function shownTextLength(el: HTMLElement): number {
  if (!rendered(el)) return 0;
  const t: string = (el as any).innerText ?? el.textContent ?? ''; // innerText follows CSS; jsdom lacks it
  return t.trim().length;
}

/**
 * The element to read in place. Prefers the article/main element with the most visible text.
 * Visibility matters: some pages keep a hidden copy of their content (pre-rendered for search
 * engines), and reading that finds nothing on screen.
 */
export function findContentRoot(doc: Document): HTMLElement {
  let best: HTMLElement | null = null;
  let bestLen = 200;
  doc.querySelectorAll<HTMLElement>('article, main, [role="main"]').forEach(el => {
    const len = shownTextLength(el);
    if (len > bestLen) { best = el; bestLen = len; }
  });
  if (best) return best;
  let fallback: HTMLElement = doc.body, fallbackLen = 0;
  doc.querySelectorAll<HTMLElement>('article, main, section, div').forEach(el => {
    if (el.querySelectorAll('p').length < 3) return;
    const len = shownTextLength(el);
    if (len > fallbackLen) { fallbackLen = len; fallback = el; }
  });
  return fallback;
}
