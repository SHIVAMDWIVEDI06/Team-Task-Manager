// Runs the API (with auto-restart) and the web bundler (in watch mode) together.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NODE_ENV: 'development' };

const procs = [
  spawn(process.execPath, ['scripts/build.mjs', '--watch'], { cwd: root, stdio: 'inherit', env }),
  spawn(
    process.execPath,
    ['--watch', '--watch-path=apps/api/src', '--watch-path=packages/shared/src', '--no-warnings=ExperimentalWarning', 'apps/api/src/server.ts'],
    { cwd: root, stdio: 'inherit', env },
  ),
];

const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
