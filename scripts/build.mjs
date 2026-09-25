// Builds the web client (apps/web) and the API server (apps/api) with esbuild.
// Usage: node scripts/build.mjs [--watch]
import * as esbuild from 'esbuild';
import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const isProd = !watch && process.env.NODE_ENV !== 'development';

const webOut = path.join(root, 'dist', 'web');
const apiOut = path.join(root, 'dist', 'api');

async function writeHtml(assetNames) {
  const template = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  const html = template
    .replace('{{JS}}', `/assets/${assetNames.js}`)
    .replace('{{CSS}}', `/assets/${assetNames.css}`);
  await writeFile(path.join(webOut, 'index.html'), html);
}

/** Plugin: after each build, hash the output file names and rewrite index.html. */
const htmlPlugin = {
  name: 'html',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const meta = result.metafile;
      const names = { js: 'app.js', css: 'app.css' };
      if (meta) {
        for (const out of Object.keys(meta.outputs)) {
          const base = path.basename(out);
          if (base.endsWith('.js') && base.startsWith('app')) names.js = base;
          if (base.endsWith('.css') && base.startsWith('app')) names.css = base;
        }
      }
      await writeHtml(names);
      console.log(`[web] built ${names.js} ${names.css} ${new Date().toLocaleTimeString()}`);
    });
  },
};

const webOptions = {
  entryPoints: [{ in: path.join(root, 'apps/web/src/main.tsx'), out: 'app' }],
  bundle: true,
  outdir: path.join(webOut, 'assets'),
  entryNames: isProd ? '[name]-[hash]' : '[name]',
  format: 'esm',
  target: ['es2022', 'chrome110', 'firefox110', 'safari16'],
  jsx: 'automatic',
  sourcemap: isProd ? false : 'inline',
  minify: isProd,
  metafile: true,
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    '__APP_VERSION__': JSON.stringify(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version),
  },
  loader: { '.svg': 'file', '.png': 'file', '.woff2': 'file' },
  plugins: [htmlPlugin],
  logLevel: 'warning',
};

const apiOptions = {
  entryPoints: [path.join(root, 'apps/api/src/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.join(apiOut, 'server.js'),
  sourcemap: false,
  minify: false,
  packages: 'external',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
};

await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(webOut, 'assets'), { recursive: true });
await mkdir(apiOut, { recursive: true });
await cp(path.join(root, 'apps/web/public'), webOut, { recursive: true });

if (watch) {
  const ctx = await esbuild.context(webOptions);
  await ctx.watch();
  console.log('[web] watching…');
} else {
  await esbuild.build(webOptions);
  await esbuild.build(apiOptions);
  const stat = await readFile(path.join(webOut, 'index.html'));
  console.log(`[api] built dist/api/server.js`);
  console.log(`[done] index.html ${createHash('sha1').update(stat).digest('hex').slice(0, 8)}`);
}
