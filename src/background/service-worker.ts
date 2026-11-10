import type { LecternMessage } from '../shared/messages';
import { messageForCommand } from '../shared/commands';
import { sessionStore, rememberTab, forgetTab, reopenAfterLoad } from './keep-open';
import { checkForUpdate, getStoredUpdate, showUpdateBadge, UPDATE_ALARM, UPDATE_PERIOD_MINUTES } from '../update/check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lectern-read-selection',
      title: 'Read selection with Simple Reader',
      contexts: ['selection'],
    });
  });
});

async function injectAndSend(tabId: number, msg: LecternMessage) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tabId, msg);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lectern-read-selection' && tab?.id != null) {
    injectAndSend(tab.id, { type: 'START', source: 'selection' }).catch(console.error);
  }
});

// Keyboard shortcuts (change them at chrome://extensions/shortcuts). Pressing one grants
// activeTab for the current tab, so no extra permissions are needed. Not every browser
// has the commands API (some on Android), hence the guard.
chrome.commands?.onCommand.addListener(async (command, tab) => {
  const msg = messageForCommand(command);
  if (!msg) return;
  const tabId = tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (tabId == null) return;
  if (msg.type === 'TOGGLE') {
    // Play/pause only means something when the reader is already open on this page,
    // so don't inject just to pause; no listener simply means nothing to do.
    chrome.tabs.sendMessage(tabId, msg).catch(() => {});
  } else {
    injectAndSend(tabId, msg).catch(console.error);
  }
});

// The reader says when it is opened on a page and when it is closed. A tab where it is open gets
// it back after loading a new page (same site only; see keep-open.ts).
chrome.runtime.onMessage.addListener((msg: LecternMessage, sender) => {
  if (sender.id !== chrome.runtime.id || sender.tab?.id == null) return;
  if (msg.type === 'OPENED') rememberTab(sessionStore, sender.tab.id).catch(() => {});
  else if (msg.type === 'CLOSED') forgetTab(sessionStore, sender.tab.id).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'complete') return;
  reopenAfterLoad(sessionStore, tabId, id => injectAndSend(id, { type: 'REOPEN' })).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => { forgetTab(sessionStore, tabId).catch(() => {}); });

// Update check: on install/update, on browser start, and every 12 hours. A newer release is
// stored for the popup and shown as a badge; the popup's "Update now" opens update.html.
async function scheduleUpdateChecks() {
  await showUpdateBadge(await getStoredUpdate()); // the badge doesn't survive a browser restart; restore it even when offline
  if (!(await chrome.alarms.get(UPDATE_ALARM))) {
    await chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_PERIOD_MINUTES });
  }
  await checkForUpdate();
}
chrome.runtime.onInstalled.addListener(() => { scheduleUpdateChecks().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { scheduleUpdateChecks().catch(() => {}); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === UPDATE_ALARM) checkForUpdate().catch(() => {});
});
