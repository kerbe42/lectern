import { Controller } from './controller';
import type { LecternMessage } from '../shared/messages';

const w = window as any;
// Register the message listener exactly once. The controller is created lazily on
// the first START and recreated only after it has been disposed (Close), so
// re-injecting the bundle never stacks duplicate listeners or controllers.
if (!w.__lecternInit) {
  w.__lecternInit = true;
  chrome.runtime.onMessage.addListener((msg: LecternMessage, sender, sendResponse) => {
    // Defense-in-depth: only accept messages from our own extension contexts.
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === 'PING') { sendResponse({ pong: true }); return; }
    if (msg.type === 'START') {
      let c: Controller | undefined = w.__lecternController;
      if (!c || c.disposed) { c = new Controller(); w.__lecternController = c; }
      c.start(msg.source);
      sendResponse({ ok: true });
    }
  });
}
