import type { Source } from './types';

export type LecternMessage =
  | { type: 'PING' }
  | { type: 'START'; source: Source }
  | { type: 'READ' }    // keyboard shortcut: the selection if any, else the page
  | { type: 'TOGGLE' }  // keyboard shortcut: play/pause the open reader
  | { type: 'REOPEN' }  // background -> page after a page load: open the reader unless it is open
  | { type: 'OPENED' }  // page -> background: the reader is open on this tab
  | { type: 'CLOSED' }; // page -> background: the reader was closed on this tab

export type LecternResponse = { ok: true } | { pong: true };
