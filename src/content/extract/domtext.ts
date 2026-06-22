export interface NodeSpan { node: Text; globalStart: number; length: number; }
export interface CollectedText { text: string; spans: NodeSpan[]; }

const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','SVG','CANVAS','AUDIO','VIDEO','SELECT','TEXTAREA','BUTTON','CODE','PRE','FIGURE']);

export function collectDomText(root: Node, within?: Range): CollectedText {
  const doc = (root.ownerDocument ?? (root as Document));
  const view = doc.defaultView;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n as Text;
      if (!t.data || !t.data.trim()) return NodeFilter.FILTER_REJECT;
      const el = t.parentElement;
      if (!el || SKIP.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      if (within && !within.intersectsNode(t)) return NodeFilter.FILTER_REJECT;
      const cs = view?.getComputedStyle(el);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const spans: NodeSpan[] = [];
  let text = '';
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    if (text.length && !/\s$/.test(text) && !/^\s/.test(t.data)) text += ' ';
    spans.push({ node: t, globalStart: text.length, length: t.data.length });
    text += t.data;
  }
  return { text, spans };
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
