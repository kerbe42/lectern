import type { LecternMessage } from '../shared/messages';

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
