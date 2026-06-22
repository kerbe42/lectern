// Conservative HTML sanitizer for content rendered into the reader overlay.
//
// Content scripts run in an isolated world, so injected inline handlers execute in the page's
// MAIN world (never reaching the extension's chrome.* APIs) and innerHTML never runs <script>.
// This sanitizer is defense-in-depth: it strips executable/embedding/external-resource vectors
// so the reader panel never renders active or remotely-loading content — including the raw
// findContentRoot() fallback path, which bypasses Readability's own cleaning.

const BLOCK_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'PORTAL',
  'LINK', 'META', 'BASE', 'STYLE', 'NOSCRIPT', 'TEMPLATE',
]);
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'data', 'codebase']);
const BAD_URL = /^\s*(javascript|vbscript):/i;
const DATA_OK = /^\s*data:image\//i; // allow inline images, block data:text/html etc.

/** Parse `html` in an inert document, strip dangerous nodes/attrs, and return an importable fragment. */
export function sanitizeFragment(html: string, doc: Document): DocumentFragment {
  // DOMParser builds a disconnected document: no scripts execute and no resources load here.
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  cleanTree(parsed.body);
  const frag = doc.createDocumentFragment();
  for (const node of Array.from(parsed.body.childNodes)) frag.appendChild(doc.importNode(node, true));
  return frag;
}

function cleanTree(root: Element): void {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const els: Element[] = [];
  let n: Node | null = walker.nextNode();
  while (n) { els.push(n as Element); n = walker.nextNode(); }

  for (const el of els) {
    if (BLOCK_TAGS.has(el.tagName)) { el.remove(); continue; }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'style') { el.removeAttribute(attr.name); continue; }
      if (URL_ATTRS.has(name)) {
        const v = attr.value;
        if (BAD_URL.test(v)) { el.removeAttribute(attr.name); continue; }
        if (/^\s*data:/i.test(v) && !DATA_OK.test(v)) el.removeAttribute(attr.name);
      }
    }
  }
}
