import { Controller } from './controller';
import type { LecternMessage } from '../shared/messages';
import { sourceForSelection } from '../shared/commands';

const w = window as any;

/** The live controller, created on first use and recreated only after Close disposed it. */
function controller(): Controller {
  let c: Controller | undefined = w.__lecternController;
  if (!c || c.disposed) { c = new Controller(); w.__lecternController = c; }
  return c;
}

// Register the message listener exactly once, so re-injecting the bundle never
// stacks duplicate listeners or controllers.
if (!w.__lecternInit) {
  w.__lecternInit = true;
  chrome.runtime.onMessage.addListener((msg: LecternMessage, sender, sendResponse) => {
    // Defense-in-depth: only accept messages from our own extension contexts.
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === 'PING') { sendResponse({ pong: true }); return; }
    if (msg.type === 'START') {
      controller().start(msg.source);
      sendResponse({ ok: true });
    } else if (msg.type === 'REOPEN') {
      const c: Controller | undefined = w.__lecternController;
      if (!c || c.disposed) controller().start('page');
      sendResponse({ ok: true });
    } else if (msg.type === 'READ') {
      controller().start(sourceForSelection(window.getSelection()?.toString()));
      sendResponse({ ok: true });
    } else if (msg.type === 'TOGGLE') {
      const c: Controller | undefined = w.__lecternController;
      if (c && !c.disposed) c.playPause();
      sendResponse({ ok: true });
    }
  });
}
