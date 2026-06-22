import esbuild from 'esbuild';
import { cp, rm, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp('public', outdir, { recursive: true });

const opts = {
  entryPoints: {
    content: 'src/content/index.ts',
    'service-worker': 'src/background/service-worker.ts',
    popup: 'src/popup/popup.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('Lectern: watching for changes…');
} else {
  await esbuild.build(opts);
  console.log('Lectern: build complete → dist/');
}
