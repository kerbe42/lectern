import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { messageForCommand, sourceForSelection, SHORTCUT_LABELS } from '../src/shared/commands';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const declared = Object.keys(manifest.commands ?? {});

describe('keyboard shortcuts', () => {
  it('every shortcut in the manifest is handled and labelled', () => {
    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      expect(messageForCommand(name), name).not.toBeNull();
      expect(SHORTCUT_LABELS[name], name).toBeTruthy();
    }
  });
  it('every handled shortcut is declared in the manifest', () => {
    expect(Object.keys(SHORTCUT_LABELS).sort()).toEqual([...declared].sort());
  });
  it("stays within Chrome's limit of 4 suggested keys", () => {
    const suggested = declared.filter(n => manifest.commands[n].suggested_key);
    expect(suggested.length).toBeLessThanOrEqual(4);
  });
  it('does not suggest keys the browser keeps for itself', () => {
    // Chromium silently leaves these unassigned (checked in a real browser), so the shortcut would just not work.
    const taken = ['Alt+Shift+R', 'Alt+Shift+P'];
    for (const n of declared) expect(taken, n).not.toContain(manifest.commands[n].suggested_key?.default);
  });
  it('ignores unknown commands', () => {
    expect(messageForCommand('something-else')).toBeNull();
  });
  it('reads the selection when there is one, otherwise the page', () => {
    expect(sourceForSelection('Hello there.')).toBe('selection');
    expect(sourceForSelection('  \n\t')).toBe('page');
    expect(sourceForSelection('')).toBe('page');
    expect(sourceForSelection(undefined)).toBe('page');
    expect(sourceForSelection(null)).toBe('page');
  });
});
