import { TokenMap } from '../../shared/types';
import { CollectedText, globalOffsetOf, rangeFor } from '../extract/domtext';
import { tokenAtOffset } from '../extract/token-map';
import { Highlighter } from './highlighter';

export class InplaceHighlighter implements Highlighter {
  private wordHL: any;
  private sentHL: any;
  private ranges: (Range | null)[];
  private styleEl: HTMLStyleElement;

  constructor(
    private doc: Document, private map: TokenMap, private collected: CollectedText,
    wordColor: string, sentColor: string,
  ) {
    const HL: any = (globalThis as any).Highlight;
    this.wordHL = new HL();
    this.sentHL = new HL();
    this.ranges = map.tokens.map(t => rangeFor(collected.spans, t.charIndex, t.charEnd, doc));
    (CSS as any).highlights.set('lec-word', this.wordHL);
    (CSS as any).highlights.set('lec-sent', this.sentHL);
    this.styleEl = doc.createElement('style');
    this.styleEl.id = 'lectern-highlights';
    this.styleEl.textContent =
      `::highlight(lec-sent){background:${sentColor};}` +
      `::highlight(lec-word){background:${wordColor};color:#111;border-radius:2px;}`;
    doc.head.appendChild(this.styleEl);
  }

  highlightWord(ti: number) {
    this.wordHL.clear();
    const r = this.ranges[ti];
    if (r) {
      this.wordHL.add(r);
      const el = r.startContainer.parentElement as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 60 || rect.bottom > window.innerHeight - 120) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
  }
  highlightSentence(sid: number) {
    this.sentHL.clear();
    const s = this.map.sentences[sid];
    if (!s) return;
    for (let i = s.firstToken; i <= s.lastToken; i++) { const r = this.ranges[i]; if (r) this.sentHL.add(r); }
  }
  clearActive() { this.wordHL.clear(); this.sentHL.clear(); }
  tokenAtPoint(x: number, y: number): number {
    const r = (this.doc as any).caretRangeFromPoint?.(x, y) as Range | null;
    if (!r) return -1;
    const g = globalOffsetOf(this.collected.spans, r.startContainer, r.startOffset);
    return g < 0 ? -1 : tokenAtOffset(this.map, g);
  }
  destroy() {
    this.clearActive();
    (CSS as any).highlights.delete('lec-word');
    (CSS as any).highlights.delete('lec-sent');
    this.styleEl.remove();
  }
  static supported(): boolean {
    return typeof (globalThis as any).Highlight !== 'undefined' && !!(CSS as any).highlights;
  }
}
