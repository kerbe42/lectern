import type { Source } from './types';

export type LecternMessage =
  | { type: 'PING' }
  | { type: 'START'; source: Source }
  | { type: 'READ' }    // keyboard shortcut: the selection if any, else the page
  | { type: 'TOGGLE' }; // keyboard shortcut: play/pause the open reader

export type LecternResponse = { ok: true } | { pong: true };
