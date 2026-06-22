import { Chunk, PlaybackState, TokenMap } from '../../shared/types';
import { tokenAtOffset } from '../extract/token-map';
import { estimateDurationMs, estimateSchedule } from './estimator';

export interface EngineCallbacks {
  onWord(tokenIndex: number): void;
  onSentence(sentenceId: number): void;
  onState(state: PlaybackState): void;
  onEnd(): void;
}

export class SpeechEngine {
  private map: TokenMap = { spokenText: '', tokens: [], sentences: [] };
  private chunks: Chunk[] = [];
  private voice: SpeechSynthesisVoice | null = null;
  private rate = 1;
  private ci = 0;
  private current = 0;
  private state: PlaybackState = 'idle';
  private gotBoundary = false;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private estTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(private synth: SpeechSynthesis, private cb: EngineCallbacks) {}

  load(map: TokenMap, chunks: Chunk[], voice: SpeechSynthesisVoice | null, rate: number) {
    this.stop();
    this.map = map; this.chunks = chunks; this.voice = voice; this.rate = rate;
    this.ci = 0; this.current = 0;
  }
  getState() { return this.state; }
  currentToken() { return this.current; }

  play(fromToken?: number) {
    if (fromToken != null) this.ci = this.chunkForToken(fromToken);
    this.synth.cancel();
    this.setState('playing');
    this.speakCurrent(fromToken);
  }
  pause() { if (this.state === 'playing') { this.synth.pause(); this.setState('paused'); } }
  resume() { if (this.state === 'paused') { this.synth.resume(); this.setState('playing'); } }
  stop() { this.clearTimers(); this.synth.cancel(); if (this.state !== 'idle') this.setState('idle'); }
  setRate(rate: number) { this.rate = rate; if (this.state === 'playing') this.play(this.current); }

  nextSentence() {
    const sid = this.map.tokens[this.current]?.sentenceId ?? 0;
    const next = this.map.sentences[sid + 1];
    if (next) this.play(next.firstToken); else this.finish();
  }
  prevSentence() {
    const sid = this.map.tokens[this.current]?.sentenceId ?? 0;
    const prev = this.map.sentences[Math.max(0, sid - 1)];
    if (prev) this.play(prev.firstToken);
  }
  seekToToken(ti: number) { this.play(ti); }

  private chunkForToken(ti: number) {
    for (let i = 0; i < this.chunks.length; i++) if (ti <= this.chunks[i].lastToken) return i;
    return Math.max(0, this.chunks.length - 1);
  }
  private setState(s: PlaybackState) { this.state = s; this.cb.onState(s); }

  private speakCurrent(fromToken?: number) {
    this.clearTimers();
    const c = this.chunks[this.ci];
    if (!c) return this.finish();

    let text = c.text;
    let baseOffset = c.startOffset;
    if (fromToken != null && fromToken > c.firstToken && fromToken <= c.lastToken) {
      const tk = this.map.tokens[fromToken];
      const adj = tk.charIndex - c.startOffset;
      text = c.text.slice(adj);
      baseOffset = tk.charIndex;
    }

    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    this.gotBoundary = false;

    u.onstart = () => {
      this.fallbackTimer = setTimeout(() => {
        if (!this.gotBoundary) this.runEstimated(c, baseOffset, text);
      }, 400);
    };
    u.onboundary = (e) => {
      this.gotBoundary = true;
      if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
      this.emit(tokenAtOffset(this.map, baseOffset + (e.charIndex || 0)));
    };
    u.onend = () => {
      this.clearTimers();
      if (this.state !== 'playing') return;
      this.ci++;
      if (this.ci < this.chunks.length) this.speakCurrent(); else this.finish();
    };
    u.onerror = (e) => {
      if (this.state !== 'playing') return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.ci++;
      if (this.ci < this.chunks.length) this.speakCurrent(); else this.finish();
    };
    this.synth.speak(u);
  }

  private emit(ti: number) {
    if (ti < 0) return;
    this.current = ti;
    this.cb.onWord(ti);
    const sid = this.map.tokens[ti]?.sentenceId;
    if (sid != null) this.cb.onSentence(sid);
  }
  private runEstimated(c: Chunk, baseOffset: number, text: string) {
    const endG = c.startOffset + c.text.length;
    const toks = this.map.tokens.filter(t => t.charIndex >= baseOffset && t.charIndex < endG);
    const sched = estimateSchedule(toks.map(t => ({ index: t.index, length: t.text.length })),
                                   estimateDurationMs(text, this.rate));
    for (const s of sched) this.estTimers.push(setTimeout(() => this.emit(s.tokenIndex), s.atMs));
  }
  private clearTimers() {
    if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
    for (const t of this.estTimers) clearTimeout(t);
    this.estTimers = [];
  }
  private finish() { this.clearTimers(); this.setState('idle'); this.cb.onEnd(); }
}
