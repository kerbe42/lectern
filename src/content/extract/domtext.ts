export interface NodeSpan { node: Text; globalStart: number; length: number; }
export interface CollectedText {
  text: string;
  spans: NodeSpan[];
  /** [start, end) offsets in `text` of heading text (h1–h6 / role=heading), for pacing. */
  headings: Array<[number, number]>;
}

// Tags whose text is never readable prose: scripts/styles, embedded media, and form controls.
// Deliberately NOT skipped, because their text is real content the reader wants:
//   BUTTON  — inline glossary terms (<button class="glossary-term">LLM</button>)
//   CODE/PRE — example prompts, payloads, commands (the substance of technical articles)
//   FIGURE  — figure captions
const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','SVG','CANVAS','AUDIO','VIDEO','SELECT','TEXTAREA']);

/** True if the element or any ancestor up to (not including) root is a skipped tag. */
function inSkippedSubtree(el: Element, root: Node): boolean {
  let cur: Element | null = el;
  while (cur && cur !== root) {
    if (SKIP.has(cur.tagName)) return true;
    cur = cur.parentElement;
  }
  return false;
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
// End of a sentence already (optionally followed by closing quotes/brackets).
const ENDS_SENTENCE = /[.!?…:;]["'”’)\]]*$/;

/** A block box that clips its content (overflow other than visible) and has no height or width. */
function clipsToNothing(el: Element, view: Window | null): boolean {
  const cs = view?.getComputedStyle(el);
  if (!cs || cs.display.startsWith('inline') || cs.display === 'contents') return false;
  if (cs.overflowX === 'visible' && cs.overflowY === 'visible') return false;
  const r = el.getBoundingClientRect();
  return r.height < 1 || r.width < 1;
}

/** Is the element actually rendered? Hidden ancestors, visibility:hidden, content-visibility. */
function makeIsShown(view: Window | null) {
  const cache = new Map<Element, boolean>();
  const shown = (el: Element): boolean => {
    const hit = cache.get(el);
    if (hit !== undefined) return hit;
    let ok: boolean;
    if (typeof (el as any).checkVisibility === 'function') {
      // Both option spellings: older Chromium used checkVisibilityCSS, newer visibilityProperty.
      ok = (el as any).checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
      // Collapsed accordions often keep their content "visible" inside a zero-height box that
      // clips it (overflow hidden), so check for that too, up the tree.
      if (ok && clipsToNothing(el, view)) ok = false;
      else if (ok && el.parentElement) ok = shown(el.parentElement);
    } else {
      // Fallback (jsdom/older engines): display:none anywhere up the tree, or visibility:hidden here.
      const cs = view?.getComputedStyle(el);
      ok = !(cs && (cs.display === 'none' || cs.visibility === 'hidden'));
      if (ok && el.parentElement) ok = shown(el.parentElement);
    }
    cache.set(el, ok);
    return ok;
  };
  return shown;
}

export function collectDomText(root: Node, within?: Range): CollectedText {
  const doc = (root.ownerDocument ?? (root as Document));
  const view = doc.defaultView;
  const isShown = makeIsShown(view);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n as Text;
      if (!t.data || !t.data.trim()) return NodeFilter.FILTER_REJECT;
      const el = t.parentElement;
      if (!el || inSkippedSubtree(el, root)) return NodeFilter.FILTER_REJECT;
      if (within && !within.intersectsNode(t)) return NodeFilter.FILTER_REJECT;
      if (!isShown(el)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Nearest block-level ancestor (paragraph, list item, heading, cell...) and nearest heading.
  const blockCache = new Map<Element, Element>();
  const blockOf = (el: Element): Element => {
    const hit = blockCache.get(el);
    if (hit) return hit;
    let cur: Element = el;
    while (cur !== root && cur.parentElement) {
      const d = view?.getComputedStyle(cur).display ?? '';
      if (d && d !== 'contents' && !d.startsWith('inline')) break;
      if (cur.parentElement === root) { cur = cur.parentElement; break; }
      cur = cur.parentElement;
    }
    blockCache.set(el, cur);
    return cur;
  };
  const headingOf = (el: Element): Element | null => {
    for (let cur: Element | null = el; cur && cur !== root; cur = cur.parentElement) {
      if (HEADING_TAGS.has(cur.tagName) || cur.getAttribute('role') === 'heading') return cur;
    }
    return null;
  };

  const spans: NodeSpan[] = [];
  const headings: Array<[number, number]> = [];
  let text = '';
  let prevBlock: Element | null = null;
  let prevHeading: Element | null = null;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const el = t.parentElement!;
    const block = blockOf(el);
    const heading = headingOf(el);
    if (text.length && block !== prevBlock) {
      // A new paragraph, list item or heading: end the previous one as a sentence so the
      // voice pauses there instead of running a heading straight into the next paragraph.
      // These separator characters belong to no DOM node, so they're never highlighted.
      if (!ENDS_SENTENCE.test(text.trimEnd())) text += '.';
      text += '\n';
    } else if (text.length && !/\s$/.test(text) && !/^\s/.test(t.data)) {
      text += ' ';
    }
    if (heading) {
      const last = headings[headings.length - 1];
      if (heading === prevHeading && last) last[1] = text.length + t.data.length;
      else headings.push([text.length, text.length + t.data.length]);
    }
    spans.push({ node: t, globalStart: text.length, length: t.data.length });
    text += t.data;
    prevBlock = block;
    prevHeading = heading;
  }
  return { text, spans, headings };
}

export interface DomLocator { node: Text; start: number; end: number; }

/** First text node + local offsets covering gStart (end clipped to that node). */
export function locatorFor(spans: NodeSpan[], gStart: number, gEnd: number): DomLocator | null {
  let lo = 0, hi = spans.length - 1, idx = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1, s = spans[m];
    if (gStart < s.globalStart) hi = m - 1;
    else if (gStart >= s.globalStart + s.length) lo = m + 1;
    else { idx = m; break; }
  }
  if (idx < 0) return null;
  const s = spans[idx];
  return { node: s.node, start: gStart - s.globalStart, end: Math.min(gEnd, s.globalStart + s.length) - s.globalStart };
}

/** A Range possibly spanning multiple nodes (for the in-place highlighter). */
export function rangeFor(spans: NodeSpan[], gStart: number, gEnd: number, doc: Document): Range | null {
  const startLoc = locatorFor(spans, gStart, gStart + 1);
  let lo = 0, hi = spans.length - 1, ei = -1;
  const last = gEnd - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1, s = spans[m];
    if (last < s.globalStart) hi = m - 1;
    else if (last >= s.globalStart + s.length) lo = m + 1;
    else { ei = m; break; }
  }
  if (!startLoc || ei < 0) return null;
  const r = doc.createRange();
  r.setStart(startLoc.node, startLoc.start);
  r.setEnd(spans[ei].node, gEnd - spans[ei].globalStart);
  return r;
}

/** Map a live (node, offset) back to a global offset; for in-place click-to-start. */
export function globalOffsetOf(spans: NodeSpan[], node: Node, offset: number): number {
  for (const s of spans) if (s.node === node) return s.globalStart + offset;
  return -1;
}
