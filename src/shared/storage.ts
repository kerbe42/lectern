import { DEFAULT_SETTINGS, Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const o = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...((o.settings as Partial<Settings>) ?? {}) };
}
export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await chrome.storage.sync.set({ settings: { ...cur, ...patch } });
}

// Key by origin + pathname only — never persist query strings or fragments, which can carry
// secrets/tokens. Keeps reading positions while minimizing the browsing data stored on disk.
function posKey(url: string): string {
  try { const u = new URL(url); return 'pos:' + u.origin + u.pathname; }
  catch { return 'pos:' + url; }
}
export async function getPosition(url: string): Promise<number | null> {
  const o = await chrome.storage.local.get(posKey(url));
  const v = o[posKey(url)];
  return typeof v === 'number' ? v : null;
}
export async function setPosition(url: string, tokenIndex: number): Promise<void> {
  await chrome.storage.local.set({ [posKey(url)]: tokenIndex });
}
export async function clearPosition(url: string): Promise<void> {
  await chrome.storage.local.remove(posKey(url));
}
/** Remove every saved reading position (user-facing "clear" control). */
export async function clearAllPositions(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith('pos:'));
  if (keys.length) await chrome.storage.local.remove(keys);
}
