import { describe, it, expect } from 'vitest';
import { estimateDurationMs, estimateSchedule } from '../src/content/speech/estimator';

describe('estimator', () => {
  it('duration scales inversely with rate', () => {
    expect(estimateDurationMs('hello world', 1)).toBeGreaterThan(estimateDurationMs('hello world', 2));
  });
  it('schedule is monotonic and proportional to word length', () => {
    const sched = estimateSchedule([{ index: 0, length: 2 }, { index: 1, length: 8 }], 1000);
    expect(sched[0]).toEqual({ tokenIndex: 0, atMs: 0 });
    expect(sched[1].tokenIndex).toBe(1);
    expect(sched[1].atMs).toBeGreaterThan(0);
    expect(sched[1].atMs).toBeLessThan(1000);
  });
});
