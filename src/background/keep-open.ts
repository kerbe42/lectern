/**
 * Keeps the reader open when its tab loads a new page.
 *
 * A full page load throws the reader away with the old page. Tabs where the reader is open are
 * remembered (for the browser session only), and when such a tab finishes loading, the reader
 * is opened on the new page too. The browser lets the extension back in only while the tab
 * stays on the same site (the "activeTab" grant ends when the tab leaves the site). On another
 * site the attempt is refused, the tab is forgotten, and the reader is opened by hand as before.
 */
const KEY = 'lecternOpenTabs';

export interface KeepOpenStore {
  get(): Promise<number[]>;
  set(ids: number[]): Promise<void>;
}

export const sessionStore: KeepOpenStore = {
  async get() {
    const v = (await chrome.storage.session.get(KEY))[KEY];
    return Array.isArray(v) ? v : [];
  },
  async set(ids) { await chrome.storage.session.set({ [KEY]: ids }); },
};

export async function rememberTab(store: KeepOpenStore, tabId: number) {
  const ids = await store.get();
  if (!ids.includes(tabId)) await store.set([...ids, tabId]);
}

export async function forgetTab(store: KeepOpenStore, tabId: number) {
  const ids = await store.get();
  if (ids.includes(tabId)) await store.set(ids.filter(i => i !== tabId));
}

/**
 * A tab finished loading: reopen the reader there if it was open before the load.
 * Returns what happened, for tests: 'skipped' (reader was not open), 'reopened', or 'forgotten'
 * (the browser refused, so the tab left the site it was opened on).
 */
export async function reopenAfterLoad(
  store: KeepOpenStore, tabId: number, open: (tabId: number) => Promise<void>,
): Promise<'skipped' | 'reopened' | 'forgotten'> {
  if (!(await store.get()).includes(tabId)) return 'skipped';
  try { await open(tabId); return 'reopened'; }
  catch { await forgetTab(store, tabId); return 'forgotten'; }
}
