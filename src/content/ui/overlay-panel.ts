export class OverlayPanel {
  readonly content: HTMLElement;
  private root: HTMLElement;

  constructor(shadow: ShadowRoot, titleText: string, contentHtml: string, onWordClick: (ti: number) => void) {
    this.root = document.createElement('div');
    this.root.className = 'lec-panel';
    const h = document.createElement('h1');
    h.textContent = titleText;
    this.content = document.createElement('div');
    this.content.innerHTML = contentHtml; // Readability output; rendered in isolated shadow, scripts don't execute
    this.root.append(h, this.content);
    shadow.appendChild(this.root);

    this.content.addEventListener('click', e => {
      const w = (e.target as HTMLElement)?.closest?.('.lec-w') as HTMLElement | null;
      if (w?.dataset.ti != null) onWordClick(Number(w.dataset.ti));
    });
  }
  destroy() { this.root.remove(); }
}
