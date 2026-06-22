import { getSettings, setSettings } from '../shared/storage';
import { stepRate } from '../shared/rate';
import type { LecternMessage } from '../shared/messages';
import type { Mode } from '../shared/types';

async function injectAndStart() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const msg: LecternMessage = { type: 'START', source: 'page' };
  await chrome.tabs.sendMessage(tab.id, msg);
  window.close();
}

async function render() {
  const app = document.getElementById('app')!;
  const s = await getSettings();
  const r0 = stepRate(s.rate, 0); // snap any legacy off-grid value
  app.innerHTML = `
    <h1>Lectern</h1>
    <button class="primary" id="read">▶ Read this page</button>
    <label>Mode
      <select id="mode">
        <option value="overlay">Reader overlay</option>
        <option value="inplace">In-place on page</option>
      </select>
    </label>
    <label>Speed <span id="ratev">${r0.toFixed(1)}×</span></label>
    <input type="range" id="rate" min="0.5" max="4" step="0.1" value="${r0}" />
    <label>Highlight color
      <input type="color" id="wc" value="${toHex(s.wordColor)}" />
    </label>
  `;
  (document.getElementById('mode') as HTMLSelectElement).value = s.mode;
  document.getElementById('read')!.addEventListener('click', injectAndStart);
  document.getElementById('mode')!.addEventListener('change', e =>
    setSettings({ mode: (e.target as HTMLSelectElement).value as Mode }));
  const rate = document.getElementById('rate') as HTMLInputElement;
  rate.addEventListener('input', () => {
    const r = stepRate(+rate.value, 0);
    document.getElementById('ratev')!.textContent = r.toFixed(1) + '×';
    setSettings({ rate: r });
  });
  document.getElementById('wc')!.addEventListener('change', e =>
    setSettings({ wordColor: (e.target as HTMLInputElement).value }));
}
function toHex(c: string) { return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#ffd54a'; }
render();
