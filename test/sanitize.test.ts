// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeFragment } from '../src/content/extract/sanitize';

function clean(html: string): HTMLElement {
  const div = document.createElement('div');
  div.appendChild(sanitizeFragment(html, document));
  return div;
}

describe('sanitizeFragment', () => {
  it('removes scripts, iframes, and other active/embedding elements', () => {
    const d = clean('<p>ok</p><script>steal()</script><iframe src="https://evil"></iframe><object></object>');
    expect(d.querySelector('script')).toBeNull();
    expect(d.querySelector('iframe')).toBeNull();
    expect(d.querySelector('object')).toBeNull();
    expect(d.textContent).toContain('ok');
  });

  it('strips inline event handlers and javascript: URLs but keeps the element/text', () => {
    const d = clean('<p onclick="evil()">hi</p><a href="javascript:alert(1)">x</a><a href="https://ok.com">ok</a>');
    expect(d.querySelector('[onclick]')).toBeNull();
    const links = [...d.querySelectorAll('a')];
    expect(links.some(a => /^javascript:/i.test(a.getAttribute('href') || ''))).toBe(false);
    expect(d.querySelector('a[href="https://ok.com"]')).not.toBeNull();
    expect(d.textContent).toContain('hi');
  });

  it('drops onerror on images and blocks data:text/html, allows data:image and normal src', () => {
    const d = clean(
      '<img id="a" src="https://img/x.png" onerror="evil()">' +
      '<img id="b" src="data:text/html,<script>e()</script>">' +
      '<img id="c" src="data:image/png;base64,iVBOR">',
    );
    expect(d.querySelector('#a')!.hasAttribute('onerror')).toBe(false);
    expect(d.querySelector('#a')!.getAttribute('src')).toBe('https://img/x.png');
    expect(d.querySelector('#b')!.hasAttribute('src')).toBe(false);
    expect(d.querySelector('#c')!.getAttribute('src')).toMatch(/^data:image\//);
  });

  it('preserves glossary-term button text (content not stripped)', () => {
    const d = clean('<p>An <button class="glossary-term">LLM</button> here.</p>');
    expect(d.textContent).toContain('LLM');
  });
});
