import { TokenMap } from '../../shared/types';
import { CollectedText, locatorFor } from '../extract/domtext';
import { Highlighter } from './highlighter';

export class OverlayHighlighter implements Highlighter {
  private spanByToken: (HTMLElement | null)[];
  private curWord = -1;
  private curSentence = -1;

  constructor(private container: HTMLElement, private map: TokenMap, collected: CollectedText) {
    const doc = container.ownerDocument!;
    this.spanByToken = new Array(map.tokens.length).fill(null);
    const locs = map.tokens.map(t => locatorFor(collected.spans, t.charIndex, t.charEnd));
    // Wrap descending by charIndex so splitting a text node never shifts unprocessed earlier tokens.
    const order = [...map.tokens].sort((a, b) => b.charIndex - a.charIndex);
    for (const t of order) {
      const loc = locs[t.index];
      if (!loc || loc.end <= loc.start) continue;
      const r = doc.createRange();
      r.setStart(loc.node, loc.start);
      r.setEnd(loc.node, loc.end);
      const span = doc.createElement('span');
      span.className = 'lec-w';
      span.dataset.ti = String(t.index);
      try { r.surroundContents(span); this.spanByToken[t.index] = span; } catch { /* skip */ }
    }
  }

  highlightWord(ti: number) {
    if (this.curWord >= 0) this.spanByToken[this.curWord]?.classList.remove('lec-w-active');
    this.curWord = ti;
    const el = this.spanByToken[ti];
    if (el) { el.classList.add('lec-w-active'); this.scrollIfNeeded(el); }
  }
  private scrollIfNeeded(el: HTMLElement) {
    const panel = this.container.closest('.lec-panel') as HTMLElement | null;
    const r = el.getBoundingClientRect();
    const top = panel ? panel.getBoundingClientRect().top + 48 : 60;
    const bottom = panel ? panel.getBoundingClientRect().bottom - 96 : window.innerHeight - 120;
    if (r.top < top || r.bottom > bottom) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  highlightSentence(sid: number) {
    if (this.curSentence === sid) return;
    this.toggleSentence(this.curSentence, false);
    this.curSentence = sid;
    this.toggleSentence(sid, true);
  }
  private toggleSentence(sid: number, on: boolean) {
    const s = this.map.sentences[sid];
    if (!s) return;
    for (let i = s.firstToken; i <= s.lastToken; i++) this.spanByToken[i]?.classList.toggle('lec-sent-active', on);
  }
  clearActive() {
    if (this.curWord >= 0) this.spanByToken[this.curWord]?.classList.remove('lec-w-active');
    this.toggleSentence(this.curSentence, false);
    this.curWord = -1; this.curSentence = -1;
  }
  tokenAtPoint(x: number, y: number): number {
    const root = this.container.getRootNode() as ShadowRoot | Document;
    const el = (root as any).elementFromPoint?.(x, y) as HTMLElement | null;
    const w = el?.closest?.('.lec-w') as HTMLElement | null;
    return w?.dataset.ti != null ? Number(w.dataset.ti) : -1;
  }
  destroy() { this.clearActive(); }
}
