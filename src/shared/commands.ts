import type { LecternMessage } from './messages';
import type { Source } from './types';

/** Keyboard shortcuts declared under "commands" in public/manifest.json, as shown in the popup. */
export const SHORTCUT_LABELS: Record<string, string> = {
  'read': 'read',
  'play-pause': 'play/pause',
};

/** The message the background sends to the page for a keyboard shortcut (null if unknown). */
export function messageForCommand(command: string): LecternMessage | null {
  switch (command) {
    case 'read': return { type: 'READ' };
    case 'play-pause': return { type: 'TOGGLE' };
    default: return null;
  }
}

/** A shortcut read uses the selected text if there is any, otherwise the whole page. */
export function sourceForSelection(selected: string | null | undefined): Source {
  return selected && selected.trim() ? 'selection' : 'page';
}
