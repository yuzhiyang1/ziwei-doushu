import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('../lib/local-dataset.worker.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../public/local-dataset.worker.js', import.meta.url)),
  bundle: true, platform: 'browser', format: 'iife', target: ['es2020'],
  minify: true, sourcemap: false, legalComments: 'eof', logLevel: 'info',
});
