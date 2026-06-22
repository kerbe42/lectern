export function estimateDurationMs(text: string, rate: number): number {
  const cps = 14 * Math.max(0.1, rate); // ~14 chars/sec at 1x
  return Math.max(300, (text.length / cps) * 1000);
}
export function estimateSchedule(
  tokens: { index: number; length: number }[],
  totalMs: number,
): { tokenIndex: number; atMs: number }[] {
  const weights = tokens.map(t => Math.max(1, t.length));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return tokens.map((t, i) => {
    const atMs = Math.round((acc / sum) * totalMs);
    acc += weights[i];
    return { tokenIndex: t.index, atMs };
  });
}
