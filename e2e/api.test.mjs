// API integration test: boots a server on a temp DB and exercises the main flows.
// Run: node e2e/api.test.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3900 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'tt-api-'));

const server = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', 'apps/api/src/server.ts'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'test', APP_URL: BASE, JWT_SECRET: 'test-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start\n' + serverLog);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}

function client() {
  let token = null;
  let cookie = '';
  const call = async (method, url, body, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = cookie;
    let payload = body;
    if (body && !(body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const r = await fetch(`${BASE}${url}`, { method, headers, body: payload });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: r.status, data, headers: r.headers };
  };
  return {
    call,
    setToken: (t) => (token = t),
    get: (u) => call('GET', u),
    post: (u, b) => call('POST', u, b),
    patch: (u, b) => call('PATCH', u, b),
    put: (u, b) => call('PUT', u, b),
    del: (u) => call('DELETE', u),
  };
}

await waitForServer();
console.log(`API test server on ${BASE}`);

const alice = client();
const bob = client();
let ws, project, bundle, task, subtask;

await test('signup validates input', async () => {
  const r = await alice.post('/api/auth/signup', { name: '', email: 'bad', password: 'short' });
  assert.equal(r.status, 400);
  assert.equal(r.data.error.code, 'validation_error');
  assert.ok(r.data.error.details.length >= 3);
});

await test('signup + me', async () => {
  const r = await alice.post('/api/auth/signup', { name: 'Alice', email: 'alice@example.com', password: 'password123' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  alice.setToken(r.data.accessToken);
  const me = await alice.get('/api/auth/me');
  assert.equal(me.data.email, 'alice@example.com');
  assert.equal(me.data.preferences.theme, 'system');
});

await test('duplicate signup conflicts', async () => {
  const r = await client().post('/api/auth/signup', { name: 'Alice', email: 'ALICE@example.com', password: 'password123' });
  assert.equal(r.status, 409);
});

await test('login wrong password → 401', async () => {
  const r = await client().post('/api/auth/login', { email: 'alice@example.com', password: 'nope-nope' });
  assert.equal(r.status, 401);
});

await test('refresh rotates the session', async () => {
  const r = await alice.post('/api/auth/refresh');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.accessToken);
  alice.setToken(r.data.accessToken);
});

await test('unauthenticated request → 401', async () => {
  const r = await client().get('/api/workspaces');
  assert.equal(r.status, 401);
});

await test('create workspace with sample project', async () => {
  const r = await alice.post('/api/workspaces', { name: 'Acme Inc', withSampleProject: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  ws = r.data;
  assert.equal(ws.role, 'owner');
  assert.equal(ws.slug, 'acme-inc');
  const list = await alice.get('/api/workspaces');
  assert.equal(list.data.length, 1);
  const bySlug = await alice.get('/api/workspaces/by-slug/acme-inc');
  assert.equal(bySlug.data.id, ws.id);
});

await test('list projects + bundle', async () => {
  const r = await alice.get(`/api/workspaces/${ws.id}/projects`);
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 1);
  project = r.data[0];
  assert.equal(project.key, 'START');
  assert.ok(project.taskCount >= 5);
  const b = await alice.get(`/api/projects/${project.id}/bundle`);
  bundle = b.data;
  assert.equal(bundle.statuses.length, 6);
  assert.equal(bundle.labels.length, 4);
  assert.equal(bundle.members.length, 1);
});

await test('create project with custom key, reject dupes', async () => {
  const r = await alice.post(`/api/workspaces/${ws.id}/projects`, { name: 'Mobile App', key: 'app', color: '#ef4444' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.key, 'APP');
  const dup = await alice.post(`/api/workspaces/${ws.id}/projects`, { name: 'Other', key: 'APP' });
  assert.equal(dup.status, 409);
  const bad = await alice.post(`/api/workspaces/${ws.id}/projects`, { name: 'Other', key: '1ABC' });
  assert.equal(bad.status, 400);
});

await test('create task with labels + due date', async () => {
  const todo = bundle.statuses.find((s) => s.category === 'todo');
  const r = await alice.post(`/api/projects/${project.id}/tasks`, { title: 'Ship v2', priority: 3, statusId: todo.id, dueDate: '2030-01-15', labelIds: [bundle.labels[0].id] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  task = r.data;
  assert.equal(task.key, `START-${task.number}`);
  assert.equal(task.labelIds.length, 1);
  assert.equal(task.statusName, 'Todo');
  assert.equal(task.priority, 3);
});

await test('list project tasks', async () => {
  const r = await alice.get(`/api/projects/${project.id}/tasks`);
  assert.ok(r.data.length >= 6);
  assert.ok(r.data.find((t) => t.id === task.id));
});

await test('update task fields + status → completed', async () => {
  const done = bundle.statuses.find((s) => s.category === 'done');
  const r = await alice.patch(`/api/tasks/${task.id}`, { statusId: done.id, title: 'Ship v2.0', estimateMinutes: 120 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.statusCategory, 'done');
  assert.ok(r.data.completedAt);
  assert.equal(r.data.title, 'Ship v2.0');
  const back = await alice.patch(`/api/tasks/${task.id}`, { statusId: bundle.statuses.find((s) => s.category === 'todo').id });
  assert.equal(back.data.completedAt, null);
});

await test('move task between neighbours', async () => {
  const inprog = bundle.statuses.find((s) => s.category === 'in_progress');
  const all = (await alice.get(`/api/projects/${project.id}/tasks`)).data.filter((t) => t.statusId === inprog.id);
  const r = await alice.post(`/api/tasks/${task.id}/move`, { statusId: inprog.id, beforeId: all[0]?.id ?? null, afterId: null });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.statusId, inprog.id);
  if (all[0]) assert.ok(r.data.position > all[0].position);
});

await test('subtask, checklist, relations, watchers', async () => {
  const s = await alice.post(`/api/projects/${project.id}/tasks`, { title: 'Write release notes', parentId: task.id });
  assert.equal(s.status, 201);
  subtask = s.data;
  const nested = await alice.post(`/api/projects/${project.id}/tasks`, { title: 'nope', parentId: subtask.id });
  assert.equal(nested.status, 400);
  const c1 = await alice.post(`/api/tasks/${task.id}/checklist`, { text: 'Tag release' });
  assert.equal(c1.status, 201);
  const c2 = await alice.patch(`/api/checklist/${c1.data.id}`, { done: true });
  assert.equal(c2.data.done, true);
  const rel = await alice.post(`/api/tasks/${task.id}/relations`, { type: 'blocked_by', targetTaskId: subtask.id });
  assert.equal(rel.status, 201);
  const dupRel = await alice.post(`/api/tasks/${task.id}/relations`, { type: 'blocked_by', targetTaskId: subtask.id });
  assert.equal(dupRel.status, 409);
  const detail = await alice.get(`/api/tasks/${task.id}`);
  assert.equal(detail.data.subtasks.length, 1);
  assert.equal(detail.data.checklist.length, 1);
  assert.equal(detail.data.checklistDoneCount, 1);
  assert.equal(detail.data.relations.length, 1);
  assert.equal(detail.data.relations[0].type, 'blocked_by');
  assert.ok(detail.data.watcherIds.includes((await alice.get('/api/auth/me')).data.id));
  const other = await alice.get(`/api/tasks/${subtask.id}`);
  assert.equal(other.data.relations[0].type, 'blocks');
  const byKey = await alice.get(`/api/tasks/by-key/${task.key}?workspace=${ws.id}`);
  assert.equal(byKey.data.id, task.id);
});

await test('comments with @mention notify', async () => {
  // invite bob first
  const inv = await alice.post(`/api/workspaces/${ws.id}/invites`, { emails: ['bob@example.com'], role: 'member' });
  assert.equal(inv.status, 201, JSON.stringify(inv.data));
  assert.equal(inv.data.results[0].status, 'sent');
  const token = inv.data.results[0].link.split('/invite/')[1];
  const preview = await client().get(`/api/invites/${token}`);
  assert.equal(preview.data.workspaceName, 'Acme Inc');
  assert.equal(preview.data.hasAccount, false);
  const su = await bob.post('/api/auth/signup', { name: 'Bob', email: 'bob@example.com', password: 'password123', inviteToken: token });
  assert.equal(su.status, 201);
  assert.equal(su.data.joinedWorkspaceSlug, 'acme-inc');
  bob.setToken(su.data.accessToken);
  const bobId = su.data.user.id;
  const members = await alice.get(`/api/workspaces/${ws.id}/members`);
  assert.equal(members.data.length, 2);

  const c = await alice.post(`/api/tasks/${task.id}/comments`, { body: `Hey @[Bob](${bobId}) can you review?` });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const n = await bob.get('/api/notifications');
  assert.equal(n.data.unread, 1);
  assert.equal(n.data.items[0].type, 'mentioned');
  assert.ok(n.data.items[0].link.includes(`task=${task.key}`));
  await bob.post('/api/notifications/read', { all: true });
  assert.equal((await bob.get('/api/notifications')).data.unread, 0);
});

await test('assignment notifies assignee; guests are read-only', async () => {
  const bobId = (await bob.get('/api/auth/me')).data.id;
  await alice.patch(`/api/tasks/${task.id}`, { assigneeId: bobId });
  const n = await bob.get('/api/notifications?unread=true');
  assert.equal(n.data.items[0].type, 'assigned');
  await alice.patch(`/api/workspaces/${ws.id}/members/${bobId}`, { role: 'guest' });
  const r = await bob.post(`/api/projects/${project.id}/tasks`, { title: 'nope' });
  assert.equal(r.status, 403);
  await alice.patch(`/api/workspaces/${ws.id}/members/${bobId}`, { role: 'member' });
  const ok = await bob.post(`/api/projects/${project.id}/tasks`, { title: 'Bob task' });
  assert.equal(ok.status, 201);
});

await test('private project hides from non-members', async () => {
  const p = await alice.post(`/api/workspaces/${ws.id}/projects`, { name: 'Secret', key: 'SEC', visibility: 'private' });
  assert.equal(p.status, 201);
  const bobList = await bob.get(`/api/workspaces/${ws.id}/projects`);
  assert.ok(!bobList.data.find((x) => x.id === p.data.id));
  const direct = await bob.get(`/api/projects/${p.data.id}/bundle`);
  assert.equal(direct.status, 404);
  const bobId = (await bob.get('/api/auth/me')).data.id;
  await alice.put(`/api/projects/${p.data.id}/members`, { userIds: [bobId] });
  const now = await bob.get(`/api/projects/${p.data.id}/bundle`);
  assert.equal(now.status, 200);
});

await test('attachments upload + download', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['hello world'], { type: 'text/plain' }), 'notes.txt');
  const r = await alice.post(`/api/tasks/${task.id}/attachments`, fd);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data[0].filename, 'notes.txt');
  const dl = await alice.get(r.data[0].url);
  assert.equal(dl.status, 200);
  assert.equal(dl.data, 'hello world');
  const anon = await client().get(r.data[0].url);
  assert.equal(anon.status, 401);
});

await test('time entries + time spent aggregate', async () => {
  const r = await alice.post(`/api/tasks/${task.id}/time`, { minutes: 90, note: 'Pairing' });
  assert.equal(r.status, 201);
  const t = await alice.get(`/api/tasks/${task.id}`);
  assert.equal(t.data.timeSpentMinutes, 90);
});

await test('recurring task creates next occurrence on completion', async () => {
  const done = bundle.statuses.find((s) => s.category === 'done');
  const r = await alice.post(`/api/projects/${project.id}/tasks`, { title: 'Weekly report', dueDate: '2030-01-07', recurrence: { freq: 'weekly', interval: 1 } });
  assert.equal(r.status, 201);
  const before = (await alice.get(`/api/projects/${project.id}/tasks`)).data.length;
  await alice.patch(`/api/tasks/${r.data.id}`, { statusId: done.id });
  const after = (await alice.get(`/api/projects/${project.id}/tasks`)).data;
  assert.equal(after.length, before + 1);
  const next = after.find((t) => t.title === 'Weekly report' && t.id !== r.data.id);
  assert.equal(next.dueDate, '2030-01-14');
  assert.ok(next.recurrence);
});

await test('statuses: create, reorder, delete moves tasks', async () => {
  const s = await alice.post(`/api/projects/${project.id}/statuses`, { name: 'QA', color: '#123456', category: 'in_progress' });
  assert.equal(s.status, 201);
  const todo = bundle.statuses.find((x) => x.category === 'todo');
  await alice.patch(`/api/tasks/${task.id}`, { statusId: s.data.id });
  const del = await alice.del(`/api/projects/${project.id}/statuses/${s.data.id}?moveTo=${todo.id}`);
  assert.equal(del.status, 204);
  const t = await alice.get(`/api/tasks/${task.id}`);
  assert.equal(t.data.statusId, todo.id);
});

await test('search, dashboard, activity, my-tasks', async () => {
  const s = await alice.get(`/api/workspaces/${ws.id}/search?q=ship`);
  assert.ok(s.data.tasks.find((t) => t.id === task.id));
  const byKey = await alice.get(`/api/workspaces/${ws.id}/search?q=${task.key}`);
  assert.ok(byKey.data.tasks.find((t) => t.id === task.id));
  const d = await alice.get(`/api/workspaces/${ws.id}/dashboard`);
  assert.equal(d.status, 200, JSON.stringify(d.data));
  assert.equal(d.data.throughput.length, 14);
  assert.ok(d.data.projects.length >= 3);
  assert.ok(d.data.workload.length >= 1);
  const a = await alice.get(`/api/workspaces/${ws.id}/activity`);
  assert.ok(a.data.length > 5);
  assert.ok(a.data.some((x) => x.type === 'task.commented'));
  const mine = await bob.get(`/api/workspaces/${ws.id}/my-tasks`);
  assert.ok(mine.data.find((t) => t.id === task.id));
});

await test('saved views', async () => {
  const r = await alice.post(`/api/projects/${project.id}/views`, { name: 'My urgent', kind: 'list', filters: { priorities: [4], assigneeIds: ['me'] }, shared: true });
  assert.equal(r.status, 201);
  assert.equal(r.data.userId, null);
  const b = await bob.get(`/api/projects/${project.id}/bundle`);
  assert.ok(b.data.views.find((v) => v.id === r.data.id));
  const forbidden = await bob.del(`/api/projects/${project.id}/views/${r.data.id}`);
  assert.equal(forbidden.status, 403);
});

await test('SSE stream delivers task updates', async () => {
  const token = (await alice.post('/api/auth/refresh')).data.accessToken;
  alice.setToken(token);
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/events?workspace=${ws.id}&token=${token}`, { signal: ctrl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  const readUntil = async (pred, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ value: null, done: false }), 200))]);
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const p of parts) {
          const line = p.split('\n').find((l) => l.startsWith('data: '));
          if (line) events.push(JSON.parse(line.slice(6)));
        }
      }
      if (events.some(pred)) return;
    }
    throw new Error('event not received: ' + JSON.stringify(events.map((e) => e.type)));
  };
  await readUntil((e) => e.type === 'presence');
  await bob.patch(`/api/tasks/${task.id}`, { priority: 4 });
  await readUntil((e) => e.type === 'task.updated' && e.task.id === task.id && e.task.priority === 4);
  ctrl.abort();
});

await test('bulk update + delete', async () => {
  const ids = (await alice.get(`/api/projects/${project.id}/tasks`)).data.slice(0, 2).map((t) => t.id);
  const r = await alice.post('/api/tasks/bulk', { taskIds: ids, patch: { priority: 1 } });
  assert.equal(r.status, 200);
  assert.ok(r.data.every((t) => t.priority === 1));
  const d = await alice.post('/api/tasks/bulk-delete', { taskIds: [subtask.id] });
  assert.equal(d.status, 204);
  assert.equal((await alice.get(`/api/tasks/${subtask.id}`)).status, 404);
});

await test('password reset flow', async () => {
  const r = await client().post('/api/auth/forgot-password', { email: 'alice@example.com' });
  assert.equal(r.status, 200);
  assert.ok(r.data.devLink, 'dev link is returned when SMTP is not configured (non-prod)');
  const token = new URL(r.data.devLink).searchParams.get('token');
  const rs = await client().post('/api/auth/reset-password', { token, password: 'newpassword123' });
  assert.equal(rs.status, 200, JSON.stringify(rs.data));
  const login = await client().post('/api/auth/login', { email: 'alice@example.com', password: 'newpassword123' });
  assert.equal(login.status, 200);
});

await test('rate limiting on login', async () => {
  const c = client();
  let limited = false;
  for (let i = 0; i < 15; i++) {
    const r = await c.post('/api/auth/login', { email: 'x@example.com', password: 'wrongwrong' });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited);
});

await test('SPA fallback serves index or placeholder', async () => {
  const r = await fetch(`${BASE}/w/acme-inc/p/START`);
  assert.equal(r.status, 200);
  assert.ok((r.headers.get('content-type') || '').includes('text/html'));
});

server.kill('SIGTERM');
rmSync(dataDir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\n--- server log ---\n' + serverLog.slice(-4000));
  process.exit(1);
}
