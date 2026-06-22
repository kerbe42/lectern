import { Mode, Source, TokenMap } from '../shared/types';
import { getSettings, setSettings, getPosition, setPosition, clearPosition } from '../shared/storage';
import { collectDomText, CollectedText } from './extract/domtext';
import { buildTokenMap } from './extract/token-map';
import { extractReadable, findContentRoot } from './extract/readability';
import { chunkBySentence } from './speech/chunker';
import { loadVoices, pickVoice } from './speech/voices';
import { SpeechEngine } from './speech/engine';
import { Highlighter } from './highlight/highlighter';
import { OverlayHighlighter } from './highlight/overlay-highlighter';
import { InplaceHighlighter } from './highlight/inplace-highlighter';
import { OverlayPanel } from './ui/overlay-panel';
import { ControlBar } from './ui/control-bar';
import { SHADOW_CSS } from './ui/styles';

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
      onState: s => this.bar.setState(s),
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
        const v = pickVoice(this.voices, uri);
        this.engine.load(this.map, chunkBySentence(this.map), v, this.rate);
        this.engine.play(this.engine.currentToken());
      },
      onSeekFraction: f => this.engine.seekToToken(Math.floor(f * Math.max(0, this.map.tokens.length - 1))),
      onToggleMode: () => this.toggleMode(),
      onClose: () => this.close(),
    });

    window.addEventListener('pagehide', () => {
      if (this.disposed || this.source !== 'page') return;
      setPosition(location.href, this.engine.currentToken());
    });
  }

  async start(source: Source) {
    const s = await getSettings();
    this.mode = s.mode; this.voiceUri = s.defaultVoiceURI; this.rate = s.rate;
    this.wordColor = s.wordColor; this.sentColor = s.sentenceColor;
    this.bar.setRate(this.rate);
    this.voices = await loadVoices(window.speechSynthesis);
    const voice = pickVoice(this.voices, this.voiceUri);
    this.voiceUri = voice?.voiceURI ?? null;
    this.bar.setVoices(this.voices, this.voiceUri);

    this.source = source;
    if (!this.build(source, this.mode)) {
      alert('Lectern: nothing readable found here.');
      return;
    }

    this.engine.load(this.map, chunkBySentence(this.map), voice, this.rate);

    if (source === 'page') {
      const saved = await getPosition(location.href);
      if (saved && saved > 0 && saved < this.map.tokens.length) { this.offerResume(saved); return; }
    }
    this.engine.play();
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
      this.map = buildTokenMap(collected.text);
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
      this.map = buildTokenMap(collected.text);
      this.highlighter = new OverlayHighlighter(this.panel.content, this.map, collected);
      return this.map.tokens.length > 0;
    }

    // in-place full page
    const root = findContentRoot(document);
    const collected = collectDomText(root);
    if (!collected.text.trim()) return false;
    this.map = buildTokenMap(collected.text);
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
    this.map = buildTokenMap(c2.text);
    return new OverlayHighlighter(this.panel.content, this.map, c2);
  }

  private toggleMode() {
    this.mode = this.mode === 'overlay' ? 'inplace' : 'overlay';
    setSettings({ mode: this.mode });
    const at = this.engine.currentToken();
    this.engine.stop();
    if (this.build('page', this.mode)) {
      this.engine.load(this.map, chunkBySentence(this.map), pickVoice(this.voices, this.voiceUri), this.rate);
      this.engine.play(Math.min(at, this.map.tokens.length - 1));
    }
  }

  private playPause() {
    const st = this.engine.getState();
    if (st === 'playing') this.engine.pause();
    else if (st === 'paused') this.engine.resume();
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
    const b = document.createElement('div'); b.className = 'lec-resume';
    b.textContent = 'Resume where you left off ▶';
    const fromStart = document.createElement('span'); fromStart.textContent = '   ·   Start over';
    fromStart.style.cssText = 'opacity:.85;text-decoration:underline;';
    b.appendChild(fromStart);
    const go = (ti: number) => { b.remove(); this.engine.play(ti); };
    b.addEventListener('click', e => { if (e.target === fromStart) go(0); else go(tokenIndex); });
    this.shadow.appendChild(b);
  }
  private teardownReading() {
    this.highlighter?.destroy(); this.highlighter = null;
    this.panel?.destroy(); this.panel = null;
  }
  private close() {
    this.disposed = true;
    this.engine.stop();
    this.teardownReading();
    this.bar.destroy();
    (this.shadow.host as HTMLElement).remove();
  }
}
