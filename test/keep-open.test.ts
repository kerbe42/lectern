import { describe, it, expect } from 'vitest';
import { KeepOpenStore, rememberTab, forgetTab, reopenAfterLoad } from '../src/background/keep-open';

function memory(): KeepOpenStore & { ids: number[] } {
  const s = { ids: [] as number[], async get() { return s.ids; }, async set(v: number[]) { s.ids = v; } };
  return s;
}

describe('reader stays open across page loads', () => {
  it('does nothing for a tab where the reader is not open', async () => {
    const s = memory(); let opened = 0;
    expect(await reopenAfterLoad(s, 7, async () => { opened++; })).toBe('skipped');
    expect(opened).toBe(0);
  });

  it('reopens the reader when a remembered tab finishes loading', async () => {
    const s = memory(); const opened: number[] = [];
    await rememberTab(s, 7); await rememberTab(s, 7);
    expect(s.ids).toEqual([7]);
    expect(await reopenAfterLoad(s, 7, async id => { opened.push(id); })).toBe('reopened');
    expect(opened).toEqual([7]);
    expect(s.ids).toEqual([7]); // still open for the next page
  });

  it('forgets the tab when the browser refuses (the tab left the site)', async () => {
    const s = memory(); await rememberTab(s, 7); await rememberTab(s, 8);
    expect(await reopenAfterLoad(s, 7, async () => { throw new Error('Cannot access contents of the page'); })).toBe('forgotten');
    expect(s.ids).toEqual([8]);
  });

  it('forgets a tab when the reader is closed', async () => {
    const s = memory(); await rememberTab(s, 7);
    await forgetTab(s, 7);
    expect(await reopenAfterLoad(s, 7, async () => {})).toBe('skipped');
  });
});
