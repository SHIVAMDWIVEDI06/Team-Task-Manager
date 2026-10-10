import fs from 'node:fs';
import path from 'node:path';
import { safeDecode, type Ctx } from './http.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

export function sendFile(ctx: Ctx, file: string, opts: { cache?: string; download?: string; contentType?: string } = {}): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  ctx.responded = true;
  const res = ctx.res;
  res.setHeader('Content-Type', opts.contentType || mimeFor(file));
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', opts.cache || 'no-cache');
  if (opts.download) {
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
  }
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  res.setHeader('ETag', etag);
  if (ctx.header('if-none-match') === etag) {
    res.statusCode = 304;
    res.end();
    return true;
  }
  res.statusCode = 200;
  if (ctx.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(file).pipe(res);
  return true;
}

/** Serve the SPA: hashed assets cached forever, everything else falls back to index.html. */
export function serveSpa(root: string) {
  const indexFile = path.join(root, 'index.html');
  return (ctx: Ctx) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      ctx.send(404, { error: { code: 'not_found', message: 'Not found' } });
      return;
    }
    const rel = safeDecode(ctx.path);
    const file = path.normalize(path.join(root, rel));
    if (file.startsWith(root) && rel !== '/' && path.extname(rel)) {
      const isHashed = /-[A-Z0-9]{8}\.(js|css)$/i.test(rel);
      if (sendFile(ctx, file, { cache: isHashed ? 'public, max-age=31536000, immutable' : 'no-cache' })) return;
      ctx.send(404, 'Not found');
      return;
    }
    if (!sendFile(ctx, indexFile, { cache: 'no-cache' })) {
      ctx.set('Content-Type', 'text/html; charset=utf-8').send(
        200,
        '<!doctype html><title>TeamTask</title><p style="font-family:sans-serif;padding:2rem">Web client not built yet. Run <code>npm run build</code> (or <code>npm run dev</code>).</p>',
      );
    }
  };
}
