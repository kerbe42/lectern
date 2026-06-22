import { describe, it, expect } from 'vitest';
import { stepRate } from '../src/shared/rate';

const onGrid = (r: number) => Math.round(r * 10) / 10 === r;

describe('stepRate', () => {
  it('steps by exactly 0.1, staying on the grid', () => {
    expect(stepRate(1.0, 0.1)).toBe(1.1);
    expect(stepRate(1.1, 0.1)).toBe(1.2);
    expect(stepRate(1.3, -0.1)).toBe(1.2);
    expect(stepRate(0.9, -0.1)).toBe(0.8);
  });
  it('snaps legacy off-grid values (e.g. 1.25) onto the 0.1 grid', () => {
    expect(onGrid(stepRate(1.25, 0.1))).toBe(true);
    expect(onGrid(stepRate(1.25, 0))).toBe(true); // sanitize-only
  });
  it('clamps to [0.5, 4]', () => {
    expect(stepRate(4, 0.1)).toBe(4);
    expect(stepRate(0.5, -0.1)).toBe(0.5);
  });
  it('has no float drift across many steps', () => {
    let r = 0.5;
    for (let i = 0; i < 40; i++) r = stepRate(r, 0.1);
    expect(r).toBe(4);                 // climbs cleanly then clamps
    expect(onGrid(stepRate(2.0, 0.1))).toBe(true);
    expect(stepRate(2.0, 0.1)).toBe(2.1);
  });
});
