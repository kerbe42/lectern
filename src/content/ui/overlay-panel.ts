import { sanitizeFragment } from '../extract/sanitize';

export class OverlayPanel {
  readonly content: HTMLElement;
  private root: HTMLElement;

  constructor(shadow: ShadowRoot, titleText: string, contentHtml: string, onWordClick: (ti: number) => void) {
    this.root = document.createElement('div');
    this.root.className = 'lec-panel';
    const h = document.createElement('h1');
    h.textContent = titleText;
    this.content = document.createElement('div');
    // Sanitize before rendering (defense-in-depth): strips scripts, frames, inline handlers,
    // javascript:/external-resource vectors — covers both Readability output and the raw fallback.
    this.content.replaceChildren(sanitizeFragment(contentHtml, document));
    this.root.append(h, this.content);
    shadow.appendChild(this.root);

    this.content.addEventListener('click', e => {
      const w = (e.target as HTMLElement)?.closest?.('.lec-w') as HTMLElement | null;
      if (w?.dataset.ti != null) onWordClick(Number(w.dataset.ti));
    });
  }
  destroy() { this.root.remove(); }
}
