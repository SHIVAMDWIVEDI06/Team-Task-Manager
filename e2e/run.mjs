// Runs every browser suite against BASE (default http://127.0.0.1:3000). Start the server first:
//   PORT=3000 SEED_DEMO=true NODE_ENV=development npm run dev:api
import { spawnSync } from 'node:child_process';
const suites = ['project-views', 'calendar-timeline', 'task-panel', 'home-create-palette', 'settings-pages'];
let failed = 0;
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [`e2e/${s}.mjs`], { stdio: 'inherit', env: { ...process.env, BASE: process.env.BASE || 'http://127.0.0.1:3000' } });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll browser suites passed');
process.exit(failed ? 1 : 0);
