import { Mode, Source, TokenMap } from '../shared/types';
import { getSettings, setSettings, getPosition, setPosition, clearPosition } from '../shared/storage';
import { stepRate } from '../shared/rate';
import { collectDomText, CollectedText } from './extract/domtext';
import { buildTokenMap, findTokenByPhrase } from './extract/token-map';
import { extractReadable, findContentRoot } from './extract/readability';
import { chunkBySentence } from './speech/chunker';
import { loadVoices, pickVoice, rankVoices } from './speech/voices';
import { SpeechEngine } from './speech/engine';
import { Highlighter } from './highlight/highlighter';
import { OverlayHighlighter } from './highlight/overlay-highlighter';
import { InplaceHighlighter } from './highlight/inplace-highlighter';
import { OverlayPanel } from './ui/overlay-panel';
import { ControlBar } from './ui/control-bar';
import { SHADOW_CSS } from './ui/styles';
import { PageWatcher } from './page-watch';

// Page controls a tap must keep working on: links, buttons, expandable task/accordion headers,
// form fields. Tapping plain text starts reading; tapping these does what the page intends.
const INTERACTIVE = 'a[href], button, summary, label, input, select, textarea, [role="button"], [role="link"], ' +
  '[role="tab"], [role="menuitem"], [role="checkbox"], [aria-expanded], [contenteditable=""], [contenteditable="true"]';

/** The page's language (for choosing a voice), falling back to the browser's. */
function pageLang(): string {
  return document.documentElement.lang || navigator.language || 'en';
}

/** Tell the background whether the reader is open here, so it can reopen it after a page load. */
function tellBackground(type: 'OPENED' | 'CLOSED') {
  try { chrome.runtime.sendMessage({ type }).catch(() => {}); } catch { /* extension reloaded */ }
}

export class Controller {
  private shadow: ShadowRoot;
  private bar: ControlBar;
  private engine: SpeechEngine;
  private voices: SpeechSynthesisVoice[] = [];
  private map: TokenMap = { spokenText: '', tokens: [], sentences: [] };
  private highlighter: Highlighter | null = null;
  private panel: OverlayPanel | null = null;
  private mode: Mode = 'overlay';
  private source: Source = 'page';
  private voiceUri: string | null = null;
  private rate = 1;
  private wordColor = '#ffd54a';
  private sentColor = 'rgba(255, 213, 74, 0.28)';
  private lastSaved = 0;
  private inplaceClickAttached = false;
  private startCue: HTMLElement | null = null;
  private readRoot: Element | null = null; // element read in place, for re-scanning newly shown text
  private watcher: PageWatcher;
  private started = false;          // a page read was asked for: keep its scan current
  private rescanWhenIdle = false;   // the page changed while reading: re-scan once reading stops
  private resumeOffer: number | null = null; // token of the "resume" offer on screen, if any
  private playFrom: number | null = null;    // where ▶ starts after a quiet re-scan moved the words
  disposed = false;

  constructor() {
    const host = document.createElement('div');
    host.id = 'lectern-host';
    document.documentElement.appendChild(host);
    this.shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = SHADOW_CSS; this.shadow.appendChild(style);

    this.engine = new SpeechEngine(window.speechSynthesis, {
      onWord: ti => { this.highlighter?.highlightWord(ti); this.updateProgress(ti); this.maybeSave(ti); },
      onSentence: sid => this.highlighter?.highlightSentence(sid),
      onState: s => {
        this.bar.setState(s);
        if (s === 'playing') { this.clearStartCue(); this.playFrom = null; }
        else if (s === 'idle' && this.rescanWhenIdle) setTimeout(() => this.onPageChange(false), 0);
      },
      onEnd: () => { if (this.source === 'page') clearPosition(location.href); },
    });
    this.bar = new ControlBar(this.shadow, {
      onPlayPause: () => this.playPause(),
      onStop: () => this.engine.stop(),
      onPrev: () => this.engine.prevSentence(),
      onNext: () => this.engine.nextSentence(),
      onRate: r => { this.rate = r; setSettings({ rate: r }); this.engine.setRate(r); },
      onVoice: uri => {
        this.voiceUri = uri; setSettings({ defaultVoiceURI: uri });
        const v = pickVoice(this.voices, uri, pageLang());
        this.engine.load(this.map, chunkBySentence(this.map), v, this.rate);
        this.engine.play(this.engine.currentToken());
      },
      onSeekFraction: f => this.engine.seekToToken(Math.floor(f * Math.max(0, this.map.tokens.length - 1))),
      onToggleMode: () => this.toggleMode(),
      onRefresh: () => this.refresh(),
      onClose: () => this.close(),
    });

    // Keep the scan current without the ↻ button: new content, or a move to another page of a
    // single-page site, re-arms the reader by itself.
    this.watcher = new PageWatcher(document, {
      readableText: () => this.pageText(),
      onChange: c => this.onPageChange(c.urlChanged),
      ignore: host,
    });

    window.addEventListener('pagehide', () => {
      if (this.disposed || this.source !== 'page') return;
      setPosition(location.href, this.engine.currentToken());
    });
  }

  async start(source: Source) {
    const s = await getSettings();
    this.mode = s.mode; this.voiceUri = s.defaultVoiceURI; this.rate = stepRate(s.rate, 0);
    this.wordColor = s.wordColor; this.sentColor = s.sentenceColor;
    this.bar.setRate(this.rate);
    this.voices = await loadVoices(window.speechSynthesis);
    const voice = pickVoice(this.voices, this.voiceUri, pageLang());
    this.voiceUri = voice?.voiceURI ?? null;
    this.bar.setVoices(rankVoices(this.voices, pageLang()), this.voiceUri);

    this.source = source;
    this.rescanWhenIdle = false; this.playFrom = null;
    if (source === 'page') { this.started = true; this.watcher.start(); tellBackground('OPENED'); }
    const built = this.build(source, this.mode);
    if (source === 'page') this.watcher.mark(this.pageText());
    if (!built) {
      // A page that is still loading has nothing to read yet: wait for it instead of giving up.
      if (source === 'page') this.showCue('Nothing to read here yet. It will be picked up when the page shows it.');
      else alert('Simple Reader: nothing readable found here.');
      return;
    }
    if (this.highlighter instanceof InplaceHighlighter) this.attachInplaceClick();

    this.engine.load(this.map, chunkBySentence(this.map), voice, this.rate);

    // Page reads don't auto-play — the user taps a word to start (or resumes / presses ▶).
    // A selection is itself an explicit "read this now", so it plays immediately.
    if (source === 'page') {
      const saved = await getPosition(location.href);
      if (saved && saved > 0 && saved < this.map.tokens.length) { this.offerResume(saved); return; }
      this.showTapHint();
    } else {
      this.engine.play();
    }
  }

  /** Build token map + highlighter (+ panel) for the chosen source/mode. Returns false if empty. */
  private build(source: Source, mode: Mode): boolean {
    this.teardownReading();
    const sel = window.getSelection();
    const hasSel = source === 'selection' && sel && sel.rangeCount > 0 && sel.toString().trim().length > 0;

    // Selections always highlight in-place where the user selected.
    if (hasSel) {
      const range = sel!.getRangeAt(0);
      const collected = collectDomText(range.commonAncestorContainer, range);
      if (!collected.text.trim()) return false;
      this.map = buildTokenMap(collected.text, 'en', collected.headings);
      this.highlighter = this.makeInplace(collected);
      return this.map.tokens.length > 0;
    }

    if (mode === 'overlay') {
      const readable = extractReadable(document);
      const html = readable?.contentHtml ?? findContentRoot(document).innerHTML;
      this.panel = new OverlayPanel(this.shadow, readable?.title ?? document.title,
        html, ti => this.engine.seekToToken(ti));
      const collected = collectDomText(this.panel.content);
      if (!collected.text.trim()) return false;
      this.map = buildTokenMap(collected.text, 'en', collected.headings);
      this.highlighter = new OverlayHighlighter(this.panel.content, this.map, collected);
      return this.map.tokens.length > 0;
    }

    // in-place full page
    const root = findContentRoot(document);
    const collected = collectDomText(root);
    // Nothing on screen to read in place (content hidden, in frames, ...): use the reader panel.
    if (!collected.text.trim()) return mode === 'inplace' ? this.build(source, 'overlay') : false;
    this.readRoot = root;
    this.map = buildTokenMap(collected.text, 'en', collected.headings);
    this.highlighter = this.makeInplace(collected);
    return this.map.tokens.length > 0;
  }

  /** In-place highlighter, or overlay fallback if the Highlight API is unsupported. */
  private makeInplace(collected: CollectedText): Highlighter {
    if (InplaceHighlighter.supported()) {
      return new InplaceHighlighter(document, this.map, collected, this.wordColor, this.sentColor);
    }
    const readable = extractReadable(document);
    const html = readable?.contentHtml ?? findContentRoot(document).innerHTML;
    this.panel = new OverlayPanel(this.shadow, readable?.title ?? document.title, html,
      ti => this.engine.seekToToken(ti));
    const c2 = collectDomText(this.panel.content);
    this.map = buildTokenMap(c2.text, 'en', c2.headings);
    return new OverlayHighlighter(this.panel.content, this.map, c2);
  }

  private toggleMode() {
    // Capture the current words BEFORE rebuilding — the two modes index differently,
    // so we relocate by matching the words, not the index.
    const at = this.engine.currentToken();
    const phrase = this.map.tokens.slice(at, at + 5).map(t => t.text);
    const wasPlaying = this.engine.getState() === 'playing';

    this.mode = this.mode === 'overlay' ? 'inplace' : 'overlay';
    setSettings({ mode: this.mode });
    this.engine.stop();
    if (this.build('page', this.mode)) {
      this.engine.load(this.map, chunkBySentence(this.map), pickVoice(this.voices, this.voiceUri, pageLang()), this.rate);
      if (this.highlighter instanceof InplaceHighlighter) this.attachInplaceClick(); else this.detachInplaceClick();
      const target = findTokenByPhrase(this.map, phrase);
      const from = target >= 0 ? target : 0;
      if (wasPlaying) this.engine.play(from);
      else { this.highlighter?.highlightWord(from); this.updateProgress(from); }
    }
  }

  /** Re-extract the current (now-visible) page content and read it. For accordions/SPAs
   *  where panels load on expand — the original snapshot can't see content added later. */
  private refresh() {
    this.source = 'page';
    this.started = true; this.watcher.start();
    this.rescanWhenIdle = false; this.playFrom = null;
    this.engine.stop();
    const built = this.build('page', this.mode);
    this.watcher.mark(this.pageText());
    if (!built) { alert('Simple Reader: nothing readable found here.'); return; }
    if (this.highlighter instanceof InplaceHighlighter) this.attachInplaceClick();
    this.engine.load(this.map, chunkBySentence(this.map), pickVoice(this.voices, this.voiceUri, pageLang()), this.rate);
    this.showTapHint(); // re-scan arms the new content; tap a word to start
  }

  /** The text a page scan would read right now (what the watcher compares). */
  private pageText(): string {
    return collectDomText(findContentRoot(document)).text;
  }

  /**
   * The page has new text, or moved to another address (single-page sites do this without a
   * reload). Re-scan by itself, so a tap works straight away. Reading in progress is never cut
   * off by new text on the same page: the re-scan waits until it stops. A move to another page
   * does stop it, because the text being read is gone.
   */
  private onPageChange(urlChanged: boolean) {
    if (this.disposed || !this.started || this.source !== 'page') return;
    if (!urlChanged && this.engine.getState() !== 'idle') { this.rescanWhenIdle = true; return; }
    this.rescanWhenIdle = false;

    // Same page: keep the reader's place by matching the words, since the indexes moved.
    const at = this.playFrom ?? this.engine.currentToken();
    const phrase = urlChanged ? [] : this.map.tokens.slice(at, at + 5).map(t => t.text);
    const offer = urlChanged ? null : this.resumeOffer;
    this.playFrom = null;

    this.engine.stop();
    const built = this.build('page', this.mode);
    this.watcher.mark(this.pageText());
    if (!built) {
      this.map = { spokenText: '', tokens: [], sentences: [] };
      this.showCue('Nothing to read here yet. It will be picked up when the page shows it.');
      return;
    }
    if (this.highlighter instanceof InplaceHighlighter) this.attachInplaceClick();
    this.engine.load(this.map, chunkBySentence(this.map), pickVoice(this.voices, this.voiceUri, pageLang()), this.rate);

    if (offer != null && offer < this.map.tokens.length) { this.offerResume(offer); return; }
    const target = at > 0 && phrase.length ? findTokenByPhrase(this.map, phrase) : -1;
    if (target > 0) { this.playFrom = target; this.updateProgress(target); }
    else this.updateProgress(0);
    this.showTapHint();
    if (urlChanged) {
      const href = location.href;
      getPosition(href).then(saved => {
        if (this.disposed || location.href !== href || this.engine.getState() !== 'idle') return;
        if (saved && saved > 0 && saved < this.map.tokens.length) this.offerResume(saved);
      }).catch(() => {});
    }
  }

  /** ▶/⏸ button and the play/pause keyboard shortcut. */
  playPause() {
    const st = this.engine.getState();
    if (st === 'playing') this.engine.pause();
    else if (st === 'paused') this.engine.resume();
    else if (this.playFrom != null) this.engine.play(this.playFrom);
    else this.engine.play();
  }
  private updateProgress(ti: number) {
    const f = this.map.tokens.length > 1 ? ti / (this.map.tokens.length - 1) : 0;
    this.bar.setProgress(f);
  }
  private maybeSave(ti: number) {
    if (this.source !== 'page') return;
    const now = Date.now();
    if (now - this.lastSaved > 2000) { this.lastSaved = now; setPosition(location.href, ti); }
  }
  private offerResume(tokenIndex: number) {
    this.clearStartCue();
    const b = document.createElement('div'); b.className = 'lec-resume';
    b.textContent = 'Resume where you left off ▶';
    const fromStart = document.createElement('span'); fromStart.textContent = '   ·   Start over';
    fromStart.style.cssText = 'opacity:.85;text-decoration:underline;';
    b.appendChild(fromStart);
    const go = (ti: number) => { this.clearStartCue(); this.engine.play(ti); };
    b.addEventListener('click', e => { if (e.target === fromStart) go(0); else go(tokenIndex); });
    this.startCue = b;
    this.resumeOffer = tokenIndex;
    this.shadow.appendChild(b);
  }
  /** Non-playing cue shown after arming a page read. Removed once playback starts. */
  private showTapHint() { this.showCue('Tap a word to start reading'); }
  private showCue(text: string) {
    this.clearStartCue();
    const h = document.createElement('div');
    h.className = 'lec-resume';
    h.style.cursor = 'default';
    h.textContent = text;
    this.startCue = h;
    this.shadow.appendChild(h);
  }
  private clearStartCue() { this.startCue?.remove(); this.startCue = null; this.resumeOffer = null; }
  // Tap a word on the live page (in-place mode) to start reading there. Capture phase, so a tap
  // on read text seeks instead of reaching the page. Taps on page controls (links, buttons,
  // task headers) and on our own UI pass through untouched.
  private onInplaceClick = (e: MouseEvent) => {
    if (!this.highlighter) return;
    if (e.composedPath().includes(this.shadow.host)) return;
    if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
    let ti = this.highlighter.tokenAtPoint(e.clientX, e.clientY);
    if (ti < 0 && this.isUnreadTextAt(e.clientX, e.clientY)) {
      // Text that wasn't on screen when we scanned (e.g. a task expanded since): re-scan, retry.
      if (this.rescanInPlace()) ti = this.highlighter?.tokenAtPoint(e.clientX, e.clientY) ?? -1;
    }
    if (ti >= 0) { e.preventDefault(); e.stopPropagation(); this.engine.seekToToken(ti); }
  };
  /** True if (x, y) is on visible text inside the element we read, which our scan didn't include. */
  private isUnreadTextAt(x: number, y: number): boolean {
    const r = (document as any).caretRangeFromPoint?.(x, y) as Range | null;
    const node = r?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE || !(node as Text).data.trim()) return false;
    if ((this.shadow.host as Element).contains(node)) return false;
    // The element we scanned was replaced (the site swapped its content): anything readable counts.
    if (!this.readRoot || !this.readRoot.isConnected) return true;
    return this.readRoot.contains(node) || findContentRoot(document).contains(node);
  }
  /** Rebuild the in-place map from what's on screen now. False if that didn't give an in-place map. */
  private rescanInPlace(): boolean {
    this.engine.stop();
    const built = this.build('page', 'inplace');
    this.watcher.mark(this.pageText());
    this.rescanWhenIdle = false; this.playFrom = null;
    if (!built || !(this.highlighter instanceof InplaceHighlighter)) return false;
    this.attachInplaceClick();
    this.engine.load(this.map, chunkBySentence(this.map), pickVoice(this.voices, this.voiceUri, pageLang()), this.rate);
    return true;
  }
  private attachInplaceClick() {
    if (this.inplaceClickAttached) return;
    document.addEventListener('click', this.onInplaceClick, true);
    this.inplaceClickAttached = true;
  }
  private detachInplaceClick() {
    if (!this.inplaceClickAttached) return;
    document.removeEventListener('click', this.onInplaceClick, true);
    this.inplaceClickAttached = false;
  }
  private teardownReading() {
    this.detachInplaceClick();
    this.readRoot = null;
    this.clearStartCue();
    this.highlighter?.destroy(); this.highlighter = null;
    this.panel?.destroy(); this.panel = null;
  }
  private close() {
    this.disposed = true;
    this.started = false;
    tellBackground('CLOSED');
    this.watcher.stop();
    this.engine.stop();
    this.teardownReading();
    this.bar.destroy();
    (this.shadow.host as HTMLElement).remove();
  }
}
