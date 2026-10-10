// Demo data seeder. Run with `npm run seed` or set SEED_DEMO=true. Idempotent (skips if demo users exist).
import { db, now } from './index.ts';
import { newId, hashPassword } from '../lib/crypto.ts';
import { DEFAULT_PREFS } from '../lib/serialize.ts';
import { createWorkspaceInternal } from '../modules/workspaces.ts';
import { createProjectInternal } from '../modules/projects.ts';
import { createTaskInternal, updateTaskInternal } from '../modules/tasks.ts';
import { addDays, todayISO } from '../../../../packages/shared/src/index.ts';

export const DEMO_PASSWORD = 'password123';

const people = [
  { name: 'Shivam Dwivedi', email: 'shivam@demo.teamtask.app', tz: 'Asia/Kolkata' },
  { name: 'Priya Sharma', email: 'priya@demo.teamtask.app', tz: 'Asia/Kolkata' },
  { name: 'Arjun Mehta', email: 'arjun@demo.teamtask.app', tz: 'Asia/Kolkata' },
  { name: 'Sofia Alvarez', email: 'sofia@demo.teamtask.app', tz: 'Europe/Madrid' },
  { name: 'Liam Chen', email: 'liam@demo.teamtask.app', tz: 'America/Los_Angeles' },
];

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rnd(arr.length)];

export async function seedDemoAsync(): Promise<{ email: string; password: string; slug: string } | null> {
  if (db.one('SELECT 1 FROM users WHERE email = ?', [people[0].email])) {
    console.log('[seed] demo data already present');
    return null;
  }
  const hash = await hashPassword(DEMO_PASSWORD);
  const ts = now();
  const userIds: string[] = [];
  for (const p of people) {
    const id = newId();
    db.run('INSERT INTO users (id, email, name, password_hash, timezone, preferences, created_at, last_active_at) VALUES (?,?,?,?,?,?,?,?)', [id, p.email, p.name, hash, p.tz, JSON.stringify(DEFAULT_PREFS), ts, ts]);
    userIds.push(id);
  }
  const [owner, ...others] = userIds;
  const ws = createWorkspaceInternal(owner, 'Acme Labs');
  const wsId = ws.id as string;
  others.forEach((uid, i) => db.run('INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?,?,?,?)', [wsId, uid, i === 0 ? 'admin' : 'member', ts]));

  const today = todayISO();
  const projects = [
    { name: 'Mobile App', key: 'APP', color: '#6b7cff', icon: '◆', description: 'iOS & Android app for Acme customers.', tasks: [
      'Onboarding flow redesign', 'Push notification opt-in screen', 'Fix crash on cold start (Android 14)', 'Biometric login', 'Offline mode for task list', 'App Store screenshots', 'Migrate to new analytics SDK', 'Dark mode polish', 'Rate-the-app prompt', 'Deep links for shared tasks', 'Accessibility audit', 'Reduce bundle size by 20%', 'Crash reporting dashboard', 'Localization: Spanish & Hindi', 'Widget for today\'s tasks',
    ] },
    { name: 'Website Relaunch', key: 'WEB', color: '#f97316', icon: '★', description: 'Marketing site + docs on the new design system.', tasks: [
      'Homepage hero section', 'Pricing page A/B test', 'Docs search with instant results', 'Blog migration from WordPress', 'SEO: structured data', 'Customer logos carousel', 'Cookie consent banner', 'Lighthouse score ≥ 95', 'Careers page', 'Changelog page', 'Contact form spam protection', 'Newsletter signup',
    ] },
    { name: 'Platform Infrastructure', key: 'INFRA', color: '#22c55e', icon: '⬢', description: 'Reliability, CI/CD and observability.', tasks: [
      'Zero-downtime deploys', 'Postgres read replica', 'Alerting for p95 latency', 'Rotate secrets quarterly', 'CI pipeline under 8 minutes', 'Backup restore drill', 'Cost report: Q3', 'Upgrade Node to 22 LTS', 'Rate limiting at the edge', 'Audit log retention policy',
    ] },
  ];

  const comments = [
    'I can pick this up tomorrow morning.', 'Blocked on design review — @[Priya Sharma](PRIYA) can you take a look?', 'Shipped to staging, please verify.', 'This is more complex than expected; splitting into subtasks.', 'Done. Closing.', 'Let\'s discuss in standup.', 'Added a checklist with the remaining steps.', 'Great progress here 🚀',
  ];

  for (const p of projects) {
    const pid = createProjectInternal({ workspaceId: wsId, userId: owner, name: p.name, key: p.key, description: p.description, color: p.color, icon: p.icon, leadId: pick(userIds), startDate: addDays(today, -30), targetDate: addDays(today, 45) });
    const statuses = db.all<{ id: string; category: string; name: string }>('SELECT id, category, name FROM task_statuses WHERE project_id = ? ORDER BY position', [pid]);
    const labels = db.all<{ id: string }>('SELECT id FROM labels WHERE project_id = ?', [pid]).map((l) => l.id);
    p.tasks.forEach((title, i) => {
      const status = statuses[Math.min(statuses.length - 1, [0, 1, 1, 2, 2, 2, 3, 4, 4, 4, 5][rnd(11)])];
      const doneLike = status.category === 'done' || status.category === 'cancelled';
      const due = rnd(10) < 7 ? addDays(today, rnd(30) - 8) : null;
      const start = due && rnd(2) ? addDays(due, -(2 + rnd(10))) : null;
      const labelIds = [...new Set([pick(labels), ...(rnd(3) === 0 ? [pick(labels)] : [])])];
      const assignee = rnd(8) === 0 ? null : pick(userIds);
      const t = createTaskInternal({
        projectId: pid, userId: pick(userIds), title, description: rnd(2) ? `## Context\n\n${title} — part of the **${p.name}** roadmap.\n\n- [ ] Write spec\n- [ ] Implement\n- [ ] QA\n\nSee also the design doc.` : '',
        statusId: status.id, priority: [0, 1, 2, 2, 3, 3, 4][rnd(7)] as 0 | 1 | 2 | 3 | 4, assigneeId: assignee, startDate: start, dueDate: due,
        estimateMinutes: rnd(3) ? [60, 120, 240, 480, 960][rnd(5)] : null, labelIds, position: (i + 1) * 1000, silent: true,
      });
      // spread creation/completion dates so the throughput chart has data
      const createdAt = new Date(Date.now() - rnd(20) * 86400_000).toISOString();
      db.run('UPDATE tasks SET created_at = ?, updated_at = ? WHERE id = ?', [createdAt, createdAt, t.id]);
      if (doneLike) db.run('UPDATE tasks SET completed_at = ? WHERE id = ?', [new Date(Date.now() - rnd(10) * 86400_000).toISOString(), t.id]);
      if (rnd(3) === 0) {
        for (let k = 0; k < 1 + rnd(3); k++) {
          createTaskInternal({ projectId: pid, userId: pick(userIds), title: ['Write tests', 'Update docs', 'Design review', 'Implement API', 'QA pass'][k % 5], statusId: statuses[rnd(2) ? 1 : 4].id, priority: 0, parentId: t.id, assigneeId: pick(userIds), silent: true });
        }
      }
      if (rnd(2) === 0) {
        ['Investigate', 'Implement', 'Review', 'Release'].slice(0, 2 + rnd(3)).forEach((text, k) => db.run('INSERT INTO checklist_items (id, task_id, text, done, position) VALUES (?,?,?,?,?)', [newId(), t.id, text, k === 0 ? 1 : rnd(2), (k + 1) * 1000]));
      }
      if (rnd(3) > 0) {
        for (let k = 0; k < 1 + rnd(3); k++) {
          const author = pick(userIds);
          const body = pick(comments).replace('PRIYA', userIds[1]);
          db.run('INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?,?,?,?,?)', [newId(), t.id, author, body, new Date(Date.now() - rnd(5) * 86400_000).toISOString()]);
        }
      }
      if (rnd(3) === 0 && assignee) {
        db.run('INSERT INTO time_entries (id, task_id, user_id, minutes, note, date, created_at) VALUES (?,?,?,?,?,?,?)', [newId(), t.id, assignee, [30, 45, 60, 90, 120][rnd(5)], 'Work session', addDays(today, -rnd(5)), now()]);
      }
    });
    // A few activity entries via the real update path so the feed has content
    const some = db.all<{ id: string }>('SELECT id FROM tasks WHERE project_id = ? AND parent_id IS NULL LIMIT 4', [pid]);
    for (const s of some) {
      try {
        updateTaskInternal(pick(userIds), s.id, { priority: [1, 2, 3, 4][rnd(4)] });
      } catch {
        /* ignore */
      }
    }
  }
  console.log(`[seed] demo workspace "Acme Labs" created. Login: ${people[0].email} / ${DEMO_PASSWORD}`);
  return { email: people[0].email, password: DEMO_PASSWORD, slug: ws.slug as string };
}

export function seedDemo() {
  void seedDemoAsync();
}

// Allow `node apps/api/src/db/seed.ts`
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seedDemoAsync().then((r) => {
    if (r) console.log(`Workspace slug: ${r.slug}`);
    db.close();
  });
}
