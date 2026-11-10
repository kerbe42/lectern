/**
 * Version strings as used by the manifest ("0.2.0") and release tags ("v0.2.0").
 * Returns the numeric segments, or null when the string isn't a plain dotted version.
 */
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+(?:\.\d+)*)$/i.exec(v.trim());
  return m ? m[1].split('.').map(Number) : null;
}

/**
 * Compares two versions segment by segment as numbers ("0.10.0" is newer than "0.9.9").
 * A leading "v" is ignored and missing segments count as 0, so "1.2" equals "v1.2.0".
 * Returns -1 when a < b, 0 when equal, 1 when a > b. Throws on a malformed version.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Not a version: ${!pa ? a : b}`);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** True when `latest` is a valid version newer than `current`; false for anything malformed. */
export function isNewerVersion(latest: string, current: string): boolean {
  try { return compareVersions(latest, current) > 0; } catch { return false; }
}
