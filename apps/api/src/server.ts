import http from 'node:http';
import { config } from './config.ts';
import { db } from './db/index.ts';
import { createApp, Router, Ctx, type Middleware } from './lib/http.ts';
import { verifyJwt } from './lib/crypto.ts';
import { errors } from './lib/errors.ts';
import { RateLimiter } from './lib/ratelimit.ts';
import { realtime } from './lib/realtime.ts';
import { canSeeProject } from './lib/access.ts';
import { serveSpa } from './lib/static.ts';
import { authRouter } from './modules/auth.ts';
import { usersRouter, touchLastActive } from './modules/users.ts';
import { workspacesRouter } from './modules/workspaces.ts';
import { invitesRouter } from './modules/invites.ts';
import { projectsRouter } from './modules/projects.ts';
import { tasksRouter } from './modules/tasks.ts';
import { collabRouter } from './modules/collab.ts';
import { feedRouter, sendDueSoonReminders } from './modules/feed.ts';
import { seedDemo } from './db/seed.ts';

const apiLimiter = new RateLimiter(300, 600);
Ctx.trustProxy = config.trustProxy;
realtime.setVisibilityCheck(canSeeProject);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://rsms.me",
  "font-src 'self' https://rsms.me data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const lastActive = new Map<string, number>();

const securityHeaders: Middleware = async (ctx, next) => {
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  ctx.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!ctx.path.startsWith('/api/')) ctx.set('Content-Security-Policy', CSP);
  if (config.isProd && config.appUrl.startsWith('https')) ctx.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  await next();
};

const cors: Middleware = async (ctx, next) => {
  const origin = ctx.header('origin');
  if (origin && config.corsOrigins.includes(origin)) {
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    ctx.set('Vary', 'Origin');
    if (ctx.method === 'OPTIONS') return ctx.send(204, null);
  }
  await next();
};

const rateLimit: Middleware = async (ctx, next) => {
  if (ctx.path.startsWith('/api/') && !apiLimiter.take(ctx.ip)) throw errors.rateLimited();
  await next();
};

const authenticate: Middleware = async (ctx, next) => {
  const header = ctx.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const payload = verifyJwt(header.slice(7), config.jwtSecret);
    if (payload) {
      ctx.user = { id: payload.sub };
      const last = lastActive.get(payload.sub) || 0;
      if (Date.now() - last > 60_000) {
        lastActive.set(payload.sub, Date.now());
        try {
          touchLastActive(payload.sub);
        } catch {
          /* user may have been deleted */
        }
      }
    }
  }
  await next();
};

const logger: Middleware = async (ctx, next) => {
  try {
    await next();
  } finally {
    if (!config.isProd && ctx.path.startsWith('/api/') && ctx.path !== '/api/events') {
      console.log(`${ctx.method} ${ctx.path} → ${ctx.res.statusCode} ${Date.now() - ctx.startedAt}ms`);
    }
  }
};

const router = new Router();
router.get('/api/health', () => ({ status: 'ok', version: '2.0.0', time: new Date().toISOString(), db: db.one<{ n: number }>('SELECT 1 AS n')?.n === 1 }));
router.mount(authRouter).mount(usersRouter).mount(workspacesRouter).mount(invitesRouter).mount(projectsRouter).mount(tasksRouter).mount(collabRouter).mount(feedRouter);

const app = createApp({
  router,
  middleware: [securityHeaders, cors, logger, rateLimit, authenticate],
  fallback: serveSpa(config.webDist),
  onError: (err, ctx) => console.error(`[error] ${ctx.method} ${ctx.path}`, err),
});

if (config.demoSeed) {
  try {
    seedDemo();
  } catch (e) {
    console.error('[seed] failed', e);
  }
}

// Daily reminders (every hour, deduplicated per task per day).
setInterval(() => {
  try {
    sendDueSoonReminders();
  } catch (e) {
    console.error('[reminders] failed', e);
  }
}, 3600_000).unref();
setTimeout(() => sendDueSoonReminders(), 10_000).unref();

const server = http.createServer(app);
server.keepAliveTimeout = 65_000;
server.listen(config.port, config.host, () => {
  console.log(`TeamTask API listening on http://${config.host}:${config.port} (${config.isProd ? 'production' : 'development'})`);
  console.log(`[db] ${config.dbFile}`);
});

const shutdown = () => {
  console.log('Shutting down…');
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
