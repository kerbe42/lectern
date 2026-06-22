import { PlaybackState } from '../../shared/types';

export interface ControlBarCallbacks {
  onPlayPause(): void; onStop(): void; onPrev(): void; onNext(): void;
  onRate(rate: number): void; onVoice(uri: string): void; onSeekFraction(f: number): void;
  onToggleMode(): void; onClose(): void;
}

export class ControlBar {
  private bar: HTMLElement;
  private playBtn: HTMLButtonElement;
  private rateLabel: HTMLElement;
  private progFill: HTMLElement;
  private prog: HTMLElement;
  private voiceSel: HTMLSelectElement;
  private rate = 1;

  constructor(shadow: ShadowRoot, private cb: ControlBarCallbacks) {
    this.bar = el('div', 'lec-bar');
    const prev = btn('⏮', cb.onPrev);
    this.playBtn = btn('▶', cb.onPlayPause);
    const next = btn('⏭', cb.onNext);
    const stop = btn('■', cb.onStop);
    const slower = btn('−', () => this.bumpRate(-0.1));
    this.rateLabel = el('span', 'lec-rate'); this.rateLabel.textContent = '1.0×';
    const faster = btn('+', () => this.bumpRate(0.1));
    this.prog = el('div', 'lec-prog'); this.progFill = el('div', ''); this.prog.appendChild(this.progFill);
    this.prog.addEventListener('click', e => {
      const r = this.prog.getBoundingClientRect();
      cb.onSeekFraction(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    });
    this.voiceSel = document.createElement('select');
    this.voiceSel.addEventListener('change', () => cb.onVoice(this.voiceSel.value));
    const mode = btn('▤', cb.onToggleMode); mode.title = 'Toggle overlay / in-place';
    const close = btn('✕', cb.onClose);
    this.bar.append(prev, this.playBtn, next, stop, slower, this.rateLabel, faster, this.prog, this.voiceSel, mode, close);
    shadow.appendChild(this.bar);
  }

  private bumpRate(d: number) {
    this.setRate(Math.min(4, Math.max(0.5, +(this.rate + d).toFixed(2))));
    this.cb.onRate(this.rate);
  }
  setRate(r: number) { this.rate = r; this.rateLabel.textContent = r.toFixed(1) + '×'; }
  setState(s: PlaybackState) { this.playBtn.textContent = s === 'playing' ? '⏸' : '▶'; }
  setProgress(f: number) { this.progFill.style.width = Math.round(f * 100) + '%'; }
  setVoices(voices: SpeechSynthesisVoice[], selectedUri: string | null) {
    this.voiceSel.innerHTML = '';
    for (const v of voices) {
      const o = document.createElement('option');
      o.value = v.voiceURI; o.textContent = `${v.name} (${v.lang})${v.localService ? '' : ' ☁'}`;
      if (v.voiceURI === selectedUri) o.selected = true;
      this.voiceSel.appendChild(o);
    }
  }
  destroy() { this.bar.remove(); }
}

function el(tag: string, cls: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e as HTMLElement; }
function btn(label: string, on: () => void) {
  const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', on); return b;
}
