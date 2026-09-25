// Interaction test for Inbox, Team, Workspace/Account/Project settings.
// Usage: BASE=http://127.0.0.1:3105 node e2e/settings-pages.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|net::/.test(m.text())) errors.push(m.text()); });

let failed = 0;
const assert = (cond, msg) => { if (cond) console.log('  ok  ', msg); else { failed++; console.log('  FAIL', msg); } };
const section = (name) => console.log(`\n== ${name}`);

// ---- login (UI) + API token ----
await page.goto(`${BASE}/login`);
await page.fill('#email', 'shivam@demo.teamtask.app');
await page.fill('#password', 'password123');
await page.click('button[type=submit]');
await page.waitForURL(/\/w\//, { timeout: 10000 });

const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'shivam@demo.teamtask.app', password: 'password123' }) })).json();
const token = login.accessToken;
const api = async (path, init = {}) => {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = await r.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
};
const ws = (await api('/api/workspaces')).find((w) => w.slug === 'acme-labs');
const project = (await api(`/api/workspaces/${ws.id}/projects`)).find((p) => p.key === 'APP');
const members = await api(`/api/workspaces/${ws.id}/members`);
const arjun = members.find((m) => m.user.email === 'arjun@demo.teamtask.app');

// ---- Workspace settings: invite ----
section('Invite');
await page.goto(`${BASE}/w/acme-labs/settings/members?invite=1`);
await page.waitForSelector('#invite-emails', { timeout: 10000 });
assert(!new URL(page.url()).searchParams.has('invite'), 'invite=1 param consumed and dialog opened');
await page.fill('#invite-emails', 'newperson@example.com');
await page.waitForSelector('.invite-chip');
await page.click('[data-testid=invite-submit]');
await page.waitForSelector('[data-testid=invite-link]', { timeout: 10000 });
const link = await page.inputValue('[data-testid=invite-link]');
assert(/\/invite\/[A-Za-z0-9_-]+/.test(link), `invite link shown (${link})`);
await page.click('.dialog-footer >> text=Done');
await page.waitForSelector('[data-testid=invite-row][data-email="newperson@example.com"]', { timeout: 10000 });
assert(true, 'invite appears in pending invites');
const invites = await api(`/api/workspaces/${ws.id}/invites`);
assert(invites.some((i) => i.email === 'newperson@example.com'), 'API lists the pending invite');

// ---- Workspace settings: change role ----
section('Change role');
const pickItem = (label) => page.locator('.picker-item', { has: page.locator('.picker-label > .truncate', { hasText: new RegExp(`^${label}$`) }) }).first().click();
const arjunRow = page.locator(`[data-testid=member-row][data-user-id="${arjun.userId}"]`);
await arjunRow.locator('.member-cell-role .select-trigger').click();
await pickItem('Admin');
await page.waitForTimeout(500);
let after = (await api(`/api/workspaces/${ws.id}/members`)).find((m) => m.userId === arjun.userId);
assert(after.role === 'admin', `Arjun is now admin (server: ${after.role})`);
await arjunRow.locator('.member-cell-role .select-trigger').click();
await pickItem('Member');
await page.waitForTimeout(500);
after = (await api(`/api/workspaces/${ws.id}/members`)).find((m) => m.userId === arjun.userId);
assert(after.role === 'member', `Arjun is back to member (server: ${after.role})`);

// ---- Project settings: workflow ----
section('Workflow');
await page.goto(`${BASE}/w/acme-labs/p/APP/settings/workflow`);
await page.waitForSelector('[data-testid=status-row]', { timeout: 10000 });
const countBefore = await page.locator('[data-testid=status-row]').count();
await page.fill('[data-testid=new-status-name]', 'QA');
await page.press('[data-testid=new-status-name]', 'Enter');
await page.waitForSelector('[data-status-name="QA"]', { timeout: 10000 });
assert((await page.locator('[data-testid=status-row]').count()) === countBefore + 1, 'QA status added to the list');
let bundle = await api(`/api/projects/${project.id}/bundle`);
const qa = bundle.statuses.find((s) => s.name === 'QA');
assert(Boolean(qa), 'QA status exists on the server');

// drag QA (last) to the top
const qaRow = page.locator('[data-status-name="QA"]');
const grip = qaRow.locator('.ps-grip');
const from = await grip.boundingBox();
const firstRow = await page.locator('[data-testid=status-row]').first().boundingBox();
const sx = from.x + from.width / 2;
const sy = from.y + from.height / 2;
const tx = sx;
const ty = firstRow.y + 6;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 14; i++) {
  await page.mouse.move(sx + ((tx - sx) * i) / 14, sy + ((ty - sy) * i) / 14);
  await page.waitForTimeout(25);
}
await page.waitForTimeout(150);
assert(Boolean(await page.$('.dnd-overlay')), 'drag overlay rendered while reordering');
await page.mouse.up();
await page.waitForTimeout(700);
const firstName = await page.locator('[data-testid=status-row]').first().getAttribute('data-status-name');
assert(firstName === 'QA', `QA is first in the DOM after drag (got ${firstName})`);
bundle = await api(`/api/projects/${project.id}/bundle`);
const ordered = [...bundle.statuses].sort((a, b) => a.position - b.position);
assert(ordered[0].name === 'QA', `server order starts with QA (${ordered.map((s) => s.name).join(' > ')})`);

// put a task into QA, then delete QA moving tasks elsewhere
const tasks = await api(`/api/projects/${project.id}/tasks`);
const victim = tasks.find((t) => !t.parentId);
await api(`/api/tasks/${victim.id}`, { method: 'PATCH', body: JSON.stringify({ statusId: qa.id }) });
await page.reload();
await page.waitForSelector('[data-status-name="QA"]', { timeout: 10000 });
const qaCount = await page.locator('[data-status-name="QA"] .ps-count').textContent();
assert(/^1 task/.test(qaCount.trim()), `QA shows 1 task (${qaCount.trim()})`);
await page.click('[data-status-name="QA"] button[title="Delete QA"]');
await page.waitForSelector('[data-testid=confirm-delete-status]');
const moveToLabel = await page.locator('.dialog .select-trigger').textContent();
assert(moveToLabel.trim().length > 0, `delete dialog proposes a target status (${moveToLabel.trim()})`);
await page.click('[data-testid=confirm-delete-status]');
await page.waitForSelector('[data-status-name="QA"]', { state: 'detached', timeout: 10000 });
bundle = await api(`/api/projects/${project.id}/bundle`);
assert(!bundle.statuses.some((s) => s.name === 'QA'), 'QA deleted on the server');
const moved = (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.id === victim.id);
assert(moved.statusId !== qa.id && bundle.statuses.some((s) => s.id === moved.statusId), `task ${victim.key} moved to ${moved.statusName}`);

// ---- Project settings: labels ----
section('Labels');
await page.goto(`${BASE}/w/acme-labs/p/APP/settings/labels`);
await page.waitForSelector('[data-testid=add-label]', { timeout: 10000 });
await page.fill('[data-testid=new-label-name]', 'E2E Label');
await page.press('[data-testid=new-label-name]', 'Enter');
await page.waitForSelector('[data-label-name="E2E Label"]', { timeout: 10000 });
bundle = await api(`/api/projects/${project.id}/bundle`);
assert(bundle.labels.some((l) => l.name === 'E2E Label'), 'label created on the server');
await page.click('[data-label-name="E2E Label"] button[title="Delete E2E Label"]');
await page.waitForSelector('.dialog-footer .btn-danger');
await page.click('.dialog-footer .btn-danger');
await page.waitForSelector('[data-label-name="E2E Label"]', { state: 'detached', timeout: 10000 });
bundle = await api(`/api/projects/${project.id}/bundle`);
assert(!bundle.labels.some((l) => l.name === 'E2E Label'), 'label deleted on the server');

// ---- Account: profile name ----
section('Account');
await page.goto(`${BASE}/w/acme-labs/account`);
await page.waitForSelector('[data-testid=profile-name]', { timeout: 10000 });
assert(await page.isDisabled('[data-testid=profile-save]'), 'save disabled while form is clean');
await page.fill('[data-testid=profile-name]', 'Shivam D. (e2e)');
assert(!(await page.isDisabled('[data-testid=profile-save]')), 'save enabled once dirty');
await page.click('[data-testid=profile-save]');
await page.waitForSelector('.toast-success', { timeout: 10000 });
let me = await api('/api/auth/me');
assert(me.name === 'Shivam D. (e2e)', `/api/auth/me reflects the new name (${me.name})`);
await page.fill('[data-testid=profile-name]', 'Shivam Dwivedi');
await page.click('[data-testid=profile-save]');
await page.waitForTimeout(600);
me = await api('/api/auth/me');
assert(me.name === 'Shivam Dwivedi', 'name restored');

// ---- Account: notification preference ----
section('Notifications preference');
await page.goto(`${BASE}/w/acme-labs/account/notifications`);
await page.waitForSelector('[data-testid=notif-dueSoon] .switch', { timeout: 10000 });
const beforePref = (await api('/api/auth/me')).preferences.notifications.dueSoon;
await page.click('[data-testid=notif-dueSoon] .switch');
await page.waitForTimeout(600);
let pref = (await api('/api/auth/me')).preferences.notifications.dueSoon;
assert(pref === !beforePref, `dueSoon toggled on the server (${beforePref} -> ${pref})`);
const ariaChecked = await page.getAttribute('[data-testid=notif-dueSoon] .switch', 'aria-checked');
assert(ariaChecked === String(!beforePref), 'switch state matches');
await page.click('[data-testid=notif-dueSoon] .switch');
await page.waitForTimeout(600);
pref = (await api('/api/auth/me')).preferences.notifications.dueSoon;
assert(pref === beforePref, 'dueSoon restored');

// ---- Account: theme ----
section('Theme');
await page.goto(`${BASE}/w/acme-labs/account/preferences`);
await page.waitForSelector('[data-testid=theme-dark]', { timeout: 10000 });
await page.click('[data-testid=theme-dark]');
await page.waitForTimeout(500);
const themeAttr = await page.evaluate(() => document.documentElement.dataset.theme);
assert(themeAttr === 'dark', `document.documentElement.dataset.theme === 'dark' (${themeAttr})`);
assert((await api('/api/auth/me')).preferences.theme === 'dark', 'theme persisted on the server');
await page.click('[data-testid=theme-light]');
await page.waitForTimeout(500);
assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'theme back to light');
await page.click('[data-testid=theme-system]');
await page.waitForTimeout(400);

// ---- Team page ----
section('Team');
await page.goto(`${BASE}/w/acme-labs/team`);
await page.waitForSelector('[data-testid=team-card]', { timeout: 10000 });
assert((await page.locator('[data-testid=team-card]').count()) === members.length, `team renders ${members.length} member cards`);
await page.click(`[data-testid=team-card][data-user-id="${arjun.userId}"]`);
await page.waitForSelector('[data-testid=member-profile]', { timeout: 5000 });
assert((await page.textContent('[data-testid=member-profile]')).includes('arjun@demo.teamtask.app'), 'member profile dialog shows Arjun');
await page.keyboard.press('Escape');
await page.waitForSelector('[data-testid=member-profile]', { state: 'detached' });

// ---- Inbox: mark all read ----
section('Inbox');
await page.goto(`${BASE}/w/acme-labs/inbox`);
await page.waitForSelector('[data-testid=mark-all-read]', { timeout: 10000 });
const notifsBefore = await api('/api/notifications?limit=100');
if (!notifsBefore.unread) {
  // make sure there is at least one unread notification: assign a task to me from another user
  const priya = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'priya@demo.teamtask.app', password: 'password123' }) })).json();
  const t = (await api(`/api/projects/${project.id}/tasks`)).find((x) => x.assigneeId !== me.id);
  await fetch(`${BASE}/api/tasks/${t.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${priya.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: me.id }) });
  await page.waitForTimeout(800);
}
await page.waitForFunction(() => !document.querySelector('[data-testid=mark-all-read]').disabled, null, { timeout: 5000 }).catch(() => {});
await page.click('[data-testid=mark-all-read]');
await page.waitForTimeout(700);
const notifsAfter = await api('/api/notifications?limit=100');
assert(notifsAfter.unread === 0, `unread count is 0 after mark all read (server: ${notifsAfter.unread})`);
assert(!(await page.$('[data-testid=inbox-unread]')), 'unread pill hidden in the UI');
// keyboard: j focuses first, e toggles unread
if (notifsAfter.items.length) {
  await page.keyboard.press('j');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const again = await api('/api/notifications?limit=100');
  assert(again.unread === 1, `"e" marks the focused notification unread (server unread: ${again.unread})`);
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
}

console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASSED'}${errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\n(no console errors)'}`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
