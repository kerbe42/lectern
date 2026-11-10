import type { LecternMessage } from '../shared/messages';
import { messageForCommand } from '../shared/commands';
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
