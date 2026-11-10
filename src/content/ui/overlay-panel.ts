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
    // The title goes inside the read content, so it's spoken first (as a heading) and can be
    // tapped, unless the article already opens with the same heading.
    const first = this.content.querySelector('h1, h2');
    const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const a = norm(first?.textContent ?? null), b = norm(titleText);
    if (b && !(a && (a.includes(b) || b.includes(a)))) this.content.prepend(h);
    this.root.append(this.content);
    shadow.appendChild(this.root);

    this.content.addEventListener('click', e => {
      const w = (e.target as HTMLElement)?.closest?.('.lec-w') as HTMLElement | null;
      if (w?.dataset.ti != null) onWordClick(Number(w.dataset.ti));
    });
  }
  destroy() { this.root.remove(); }
}
