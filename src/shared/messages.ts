import type { Source } from './types';

export type LecternMessage =
  | { type: 'PING' }
  | { type: 'START'; source: Source };

export type LecternResponse = { ok: true } | { pong: true };
