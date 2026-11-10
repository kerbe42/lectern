/**
 * Watches the page for new content, so the reader never has to be re-scanned by hand.
 *
 * A scan is a snapshot. Pages keep changing after it: a single-page site swaps its content when
 * you follow a link, a slow page fills in after the reader opened, a collapsed section expands.
 * The watcher notices (DOM changes, or the address changing), waits for the page to settle, and
 * reports a change only when the readable text or the address is really different.
 */
export interface PageWatchOptions {
  /** The text the reader would scan right now. Compared with the last scan to skip no-op changes. */
  readableText(): string;
  /** Called when the page has new text to scan, or moved to another address. */
  onChange(change: { urlChanged: boolean }): void;
  /** Our own UI: changes inside it are not page changes. */
  ignore?: Element;
  /** Quiet time after the last DOM change before looking (ms). */
  settleMs?: number;
  /** How often to check the address when the DOM is quiet (ms). 0 turns it off. */
  pollMs?: number;
}

export class PageWatcher {
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private text: string | null = null;
  private readonly settleMs: number;
  private readonly onNav = () => this.schedule();

  constructor(private doc: Document, private opts: PageWatchOptions) {
    this.url = doc.location?.href ?? '';
    this.settleMs = opts.settleMs ?? 400;
  }

  /** Record what was just scanned: later changes are measured against it. */
  mark(text: string) {
    this.text = text;
    this.url = this.doc.location?.href ?? '';
  }

  start() {
    if (this.observer) return;
    const target = this.doc.body ?? this.doc.documentElement;
    this.observer = new MutationObserver(records => {
      const ignore = this.opts.ignore;
      if (ignore && records.every(r => ignore.contains(r.target))) return;
      this.schedule();
    });
    this.observer.observe(target, { childList: true, subtree: true, characterData: true });
    const view = this.doc.defaultView;
    view?.addEventListener('popstate', this.onNav);
    view?.addEventListener('hashchange', this.onNav);
    // A page script changing the address (history.pushState) fires no event we can see from
    // here. The DOM nearly always changes with it; this slow check covers the rest.
    const pollMs = this.opts.pollMs ?? 1000;
    if (pollMs > 0) {
      this.poll = setInterval(() => {
        if ((this.doc.location?.href ?? '') !== this.url) this.schedule();
      }, pollMs);
    }
  }

  stop() {
    this.observer?.disconnect(); this.observer = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    const view = this.doc.defaultView;
    view?.removeEventListener('popstate', this.onNav);
    view?.removeEventListener('hashchange', this.onNav);
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.check(); }, this.settleMs);
  }

  /** Compare the page with the last scan and report a real difference. */
  check() {
    const href = this.doc.location?.href ?? '';
    const urlChanged = href !== this.url;
    let text: string;
    try { text = this.opts.readableText(); } catch { return; }
    if (!urlChanged && text === this.text) return;
    this.url = href;
    this.text = text;
    this.opts.onChange({ urlChanged });
  }
}
