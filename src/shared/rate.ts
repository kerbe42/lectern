export const MIN_RATE = 0.5;
export const MAX_RATE = 4;

/**
 * Step the playback rate by `delta`, snapped to a clean 0.1 grid and clamped to [0.5, 4].
 * Snapping avoids float drift (1.1+0.1 = 1.2000000000000002) and pulls legacy off-grid
 * values (e.g. a 1.25 saved when the step was 0.25) back onto the grid, so the label never
 * shows uneven/duplicate steps. Call with delta 0 to just sanitize a stored value.
 */
export function stepRate(current: number, delta: number): number {
  const snapped = Math.round((current + delta) * 10) / 10;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, snapped));
}
