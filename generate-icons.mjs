import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';

// Lectern icon: dark rounded tile (#1f2937) with a "play" triangle in the highlight color (#ffd54a).
const BG = [31, 41, 55, 255];
const FG = [255, 213, 74, 255];

function inRoundedRect(x, y, s, r) {
  const cx = Math.min(x, s - 1 - x);
  const cy = Math.min(y, s - 1 - y);
  if (cx >= r || cy >= r) return true;
  const dx = r - cx, dy = r - cy;
  return dx * dx + dy * dy <= r * r;
}
function inTriangle(x, y, s) {
  const x0 = s * 0.34, x1 = s * 0.70, y0 = s * 0.28, y1 = s * 0.72, cyc = s * 0.5;
  if (x < x0 || x > x1) return false;
  const t = (x - x0) / (x1 - x0);
  return y >= y0 + (cyc - y0) * t && y <= y1 + (cyc - y1) * t;
}
function makeIcon(s) {
  const png = new PNG({ width: s, height: s });
  const r = Math.round(s * 0.22);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (s * y + x) << 2;
      const col = inTriangle(x, y, s) ? FG : inRoundedRect(x, y, s, r) ? BG : [0, 0, 0, 0];
      png.data[i] = col[0]; png.data[i + 1] = col[1]; png.data[i + 2] = col[2]; png.data[i + 3] = col[3];
    }
  }
  return PNG.sync.write(png);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 48, 128]) {
  writeFileSync(`public/icons/icon${s}.png`, makeIcon(s));
  console.log(`wrote public/icons/icon${s}.png`);
}
