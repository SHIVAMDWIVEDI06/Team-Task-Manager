import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Load .env from the repo root (no dotenv dependency).
function loadDotEnv() {
  for (const candidate of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')]) {
    if (!fs.existsSync(candidate)) continue;
    const text = fs.readFileSync(candidate, 'utf8');
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}
loadDotEnv();

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function secret(): string {
  if (env.JWT_SECRET && env.JWT_SECRET !== 'change-me-please') return env.JWT_SECRET;
  if (isProd) {
    console.warn('[config] JWT_SECRET is not set — generating an ephemeral one. Sessions will not survive restarts.');
  }
  return crypto.randomBytes(32).toString('hex');
}

const dataDir = path.resolve(env.DATA_DIR || './data');
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

export const config = {
  isProd,
  port: Number(env.PORT || 3000),
  trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === 'true' : isProd,
  host: env.HOST || '0.0.0.0',
  appUrl: (env.APP_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  jwtSecret: secret(),
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 30 * 24 * 3600,
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  dataDir,
  dbFile: env.DB_FILE || path.join(dataDir, 'teamtask.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  maxUploadBytes: Number(env.MAX_UPLOAD_MB || 25) * 1024 * 1024,
  webDist: path.resolve(env.WEB_DIST || 'dist/web'),
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
        from: env.SMTP_FROM || 'TeamTask <no-reply@example.com>',
      }
    : null,
  demoSeed: env.SEED_DEMO === 'true',
};

export type Config = typeof config;
