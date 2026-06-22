import { Readability } from '@mozilla/readability';

export interface Readable { title: string; contentHtml: string; }

export function extractReadable(doc: Document): Readable | null {
  try {
    const clone = doc.cloneNode(true) as Document;
    const art = new Readability(clone).parse();
    if (art?.content && art.textContent && art.textContent.trim().length > 40) {
      return { title: art.title || doc.title, contentHtml: art.content };
    }
  } catch { /* fall through */ }
  return null;
}

export function findContentRoot(doc: Document): HTMLElement {
  const direct = doc.querySelector('article, main, [role="main"]') as HTMLElement | null;
  if (direct && (direct.textContent || '').trim().length > 200) return direct;
  let best: HTMLElement = doc.body, bestLen = 0;
  doc.querySelectorAll<HTMLElement>('article, main, section, div').forEach(el => {
    const len = (el.textContent || '').length;
    if (len > bestLen && el.querySelectorAll('p').length >= 3) { bestLen = len; best = el; }
  });
  return best;
}
