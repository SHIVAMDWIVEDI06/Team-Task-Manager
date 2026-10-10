// A small, dependency-free HTTP router built on node:http.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, errors } from './errors.ts';
import type { Schema } from '../../../../packages/shared/src/validate.ts';
import { parseMultipart, type UploadedFile } from './multipart.ts';

export interface AuthUser {
  id: string;
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export class Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  url: URL;
  path: string;
  params: Record<string, string> = {};
  query: URLSearchParams;
  user: AuthUser | null = null;
  startedAt = Date.now();
  private bodyCache: Promise<unknown> | null = null;
  private filesCache: Promise<{ fields: Record<string, string>; files: UploadedFile[] }> | null = null;
  responded = false;
  maxBodyBytes = 1024 * 1024;
  maxUploadBytes = 25 * 1024 * 1024;

  constructor(req: IncomingMessage, res: ServerResponse) {
    this.req = req;
    this.res = res;
    this.method = (req.method || 'GET').toUpperCase();
    this.url = new URL(req.url || '/', 'http://localhost');
    this.path = this.url.pathname.replace(/\/+$/, '') || '/';
    this.query = this.url.searchParams;
  }

  /** Set to true when running behind a trusted reverse proxy (Railway, nginx, …). */
  static trustProxy = false;

  get ip(): string {
    if (Ctx.trustProxy) {
      const fwd = this.req.headers['x-forwarded-for'];
      if (typeof fwd === 'string' && fwd) {
        // The last entry is the one appended by our own proxy; earlier ones are client-controlled.
        const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
      }
    }
    return this.req.socket.remoteAddress || 'unknown';
  }

  header(name: string): string | undefined {
    const v = this.req.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  }

  get cookies(): Record<string, string> {
    const out: Record<string, string> = {};
    const raw = this.header('cookie');
    if (!raw) return out;
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i === -1) continue;
      out[part.slice(0, i).trim()] = safeDecode(part.slice(i + 1).trim());
    }
    return out;
  }

  setCookie(
    name: string,
    value: string,
    opts: { maxAge?: number; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None' } = {},
  ) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    parts.push(`Path=${opts.path || '/'}`);
    if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.httpOnly !== false) parts.push('HttpOnly');
    if (opts.secure) parts.push('Secure');
    parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
    const prev = this.res.getHeader('Set-Cookie');
    const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
    list.push(parts.join('; '));
    this.res.setHeader('Set-Cookie', list);
  }

  clearCookie(name: string, path = '/') {
    this.setCookie(name, '', { maxAge: 0, path });
  }

  /** Raw body as Buffer (JSON / urlencoded). */
  private readRaw(limit: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let rejected = false;
      this.req.on('data', (c: Buffer) => {
        if (rejected) return;
        size += c.length;
        if (size > limit) {
          rejected = true;
          chunks.length = 0;
          // Respond with 413 first, then drop the connection so the client stops streaming.
          this.res.once('finish', () => this.req.destroy());
          this.res.setHeader('Connection', 'close');
          reject(errors.tooLarge());
          return;
        }
        chunks.push(c);
      });
      this.req.on('end', () => resolve(Buffer.concat(chunks)));
      this.req.on('error', reject);
    });
  }

  /** Parsed JSON body (cached). Returns {} for empty bodies. */
  body<T = unknown>(): Promise<T> {
    if (!this.bodyCache) {
      this.bodyCache = (async () => {
        const type = this.header('content-type') || '';
        const raw = await this.readRaw(this.maxBodyBytes);
        if (!raw.length) return {};
        if (type.includes('application/json')) {
          try {
            return JSON.parse(raw.toString('utf8'));
          } catch {
            throw errors.badRequest('Malformed JSON body');
          }
        }
        if (type.includes('application/x-www-form-urlencoded')) {
          return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
        }
        return {};
      })();
    }
    return this.bodyCache as Promise<T>;
  }

  /** Validate the JSON body with a schema; throws a 400 with field issues. */
  async json<T>(schema: Schema<T>): Promise<T> {
    const raw = await this.body();
    const r = schema.parse(raw);
    if (!r.ok) throw errors.validation(r.issues);
    return r.value;
  }

  /** Validate query params with a schema. */
  q<T>(schema: Schema<T>): T {
    const obj: Record<string, unknown> = {};
    for (const [k, val] of this.query.entries()) {
      if (k.endsWith('[]')) {
        const key = k.slice(0, -2);
        (obj[key] ||= []) as unknown[];
        (obj[key] as unknown[]).push(val);
      } else if (obj[k] !== undefined) {
        obj[k] = Array.isArray(obj[k]) ? [...(obj[k] as unknown[]), val] : [obj[k], val];
      } else obj[k] = val;
    }
    const r = schema.parse(obj);
    if (!r.ok) throw errors.validation(r.issues);
    return r.value;
  }

  /** Multipart form (files + fields). */
  multipart(): Promise<{ fields: Record<string, string>; files: UploadedFile[] }> {
    if (!this.filesCache) {
      const type = this.header('content-type') || '';
      if (!type.startsWith('multipart/form-data')) {
        this.filesCache = Promise.reject(errors.badRequest('Expected multipart/form-data'));
      } else {
        this.filesCache = this.readRaw(this.maxUploadBytes).then((raw) => parseMultipart(raw, type));
      }
    }
    return this.filesCache;
  }

  status(code: number) {
    this.res.statusCode = code;
    return this;
  }

  set(name: string, value: string) {
    this.res.setHeader(name, value);
    return this;
  }

  send(status: number, body: unknown) {
    if (this.responded) return;
    this.responded = true;
    if (body === null || body === undefined) {
      this.res.statusCode = status;
      this.res.end();
      return;
    }
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      this.res.statusCode = status;
      if (!this.res.getHeader('Content-Type')) this.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      this.res.end(body);
      return;
    }
    const json = JSON.stringify(body);
    this.res.statusCode = status;
    this.res.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.res.setHeader('Content-Length', Buffer.byteLength(json));
    this.res.end(json);
  }

  redirect(location: string, status = 302) {
    this.responded = true;
    this.res.statusCode = status;
    this.res.setHeader('Location', location);
    this.res.end();
  }

  requireUser(): AuthUser {
    if (!this.user) throw errors.unauthorized();
    return this.user;
  }
}

/** Return this from a handler to control the status code. */
export class Reply {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    this.status = status;
    this.body = body;
  }
}
export const reply = (status: number, body: unknown = null) => new Reply(status, body);
export const created = (body: unknown) => new Reply(201, body);
export const noContent = () => new Reply(204, null);

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
export type Middleware = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = path
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      if (seg === '*') {
        keys.push('wildcard');
        return '(.*)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${src || '/'}$`), keys };
}

export class Router {
  private routes: Route[] = [];
  private prefix: string;

  constructor(prefix = '') {
    this.prefix = prefix.replace(/\/+$/, '');
  }

  add(method: string, path: string, handler: Handler) {
    const { pattern, keys } = compile(this.prefix + path);
    this.routes.push({ method: method.toUpperCase(), pattern, keys, handler });
    return this;
  }
  get(path: string, handler: Handler) {
    return this.add('GET', path, handler);
  }
  post(path: string, handler: Handler) {
    return this.add('POST', path, handler);
  }
  put(path: string, handler: Handler) {
    return this.add('PUT', path, handler);
  }
  patch(path: string, handler: Handler) {
    return this.add('PATCH', path, handler);
  }
  delete(path: string, handler: Handler) {
    return this.add('DELETE', path, handler);
  }

  /** Merge another router's routes into this one. */
  mount(router: Router) {
    this.routes.push(...router.routes);
    return this;
  }

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | 'method_not_allowed' | null {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method && !(r.method === 'GET' && method === 'HEAD')) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = safeDecode(m[i + 1])));
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method_not_allowed' : null;
  }
}

export interface AppOptions {
  router: Router;
  middleware: Middleware[];
  fallback?: (ctx: Ctx) => Promise<void> | void; // e.g. static files
  onError?: (err: unknown, ctx: Ctx) => void;
}

export function createApp(opts: AppOptions) {
  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const ctx = new Ctx(req, res);
    try {
      let i = 0;
      const run = async (): Promise<void> => {
        const mw = opts.middleware[i++];
        if (mw) return mw(ctx, run);
        const match = opts.router.match(ctx.method, ctx.path);
        if (match === 'method_not_allowed') throw new HttpError(405, 'method_not_allowed', 'Method not allowed');
        if (!match) {
          if (opts.fallback) return opts.fallback(ctx);
          throw errors.notFound('Route');
        }
        ctx.params = match.params;
        const result = await match.handler(ctx);
        if (ctx.responded) return;
        if (result instanceof Reply) ctx.send(result.status, result.body);
        else if (result === undefined) ctx.send(204, null);
        else ctx.send(200, result);
      };
      await run();
    } catch (err) {
      if (ctx.responded) return;
      if (err instanceof HttpError) {
        ctx.send(err.status, { error: { code: err.code, message: err.message, details: err.details } });
      } else {
        opts.onError?.(err, ctx);
        ctx.send(500, { error: { code: 'internal', message: 'Internal server error' } });
      }
    }
  };
}
