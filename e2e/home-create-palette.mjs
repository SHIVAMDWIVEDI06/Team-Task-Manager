// Interaction test for Home dashboard, Create task dialog, Command palette and My work.
// Usage: BASE=http://127.0.0.1:3104 node e2e/home-create-palette.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const SHOTS = process.env.SHOTS !== '0';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|net::/.test(m.text())) errors.push(m.text()); });

let failed = 0;
const assert = (cond, msg) => { if (cond) console.log('  ok  ', msg); else { failed++; console.log('  FAIL', msg); } };
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `e2e/screenshots/${name}.png` }); };
const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';

// ---- login (UI) + API token ----
await page.goto(`${BASE}/login`);
await page.fill('#email', 'shivam@demo.teamtask.app');
await page.fill('#password', 'password123');
await page.click('button[type=submit]');
await page.waitForURL(/\/w\//, { timeout: 10000 });

const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'shivam@demo.teamtask.app', password: 'password123' }) })).json();
const token = login.accessToken;
const api = async (path) => (await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } })).json();
const ws = (await api('/api/workspaces')).find((w) => w.slug === 'acme-labs');
const projects = await api(`/api/workspaces/${ws.id}/projects`);
const dashboard = await api(`/api/workspaces/${ws.id}/dashboard`);

// ---- Home renders ----
await page.goto(`${BASE}/w/acme-labs`);
await page.waitForSelector('.home-tile:not(.is-skeleton)', { timeout: 10000 });
const tiles = await page.$$('.home-tile:not(.is-skeleton)');
assert(tiles.length === 6, `home renders ${tiles.length} stat tiles`);
const tileValues = await page.$$eval('.home-tile-value', (els) => els.map((e) => e.textContent.trim()));
assert(tileValues.every((v) => /^\d+$/.test(v)), `tiles show numbers (${tileValues.join(', ')})`);
assert(tileValues[0] === String(dashboard.counts.assigned), `"Assigned to me" matches API (${dashboard.counts.assigned})`);
assert(tileValues[1] === String(dashboard.counts.overdue), `"Overdue" matches API (${dashboard.counts.overdue})`);
await page.waitForSelector('.chart-throughput svg', { timeout: 5000 });
assert(Boolean(await page.$('.chart-throughput svg')), 'throughput chart svg present');
assert(Boolean(await page.$('.chart-donut svg')), 'status donut svg present');
assert((await page.$$('.chart-hbar')).length === 5, 'priority bars rendered (5 rows)');
assert((await page.$$('#home-my-tasks ~ .home-card-body .task-row, .home-card .task-row')).length > 0, 'task rows rendered on home');
assert(Boolean(await page.$('.actv-item')), 'recent activity rendered');
// hover a throughput column → tooltip
const col = await page.$('.chart-col');
if (col) { await col.hover(); await page.waitForTimeout(150); }
assert(Boolean(await page.$('.chart-tip')), 'throughput tooltip appears on hover');
await shot('d-home-test');
const greeting = await page.textContent('.home-greeting');
assert(/^Good (morning|afternoon|evening|night), Shivam$/.test(greeting.trim()), `greeting "${greeting.trim()}"`);

// ---- "c" opens the create dialog ----
await page.mouse.move(700, 400);
await page.keyboard.press('c');
await page.waitForSelector('.ct-dialog', { timeout: 5000 });
assert(Boolean(await page.$('.ct-dialog')), 'pressing "c" opens the create-task dialog');
await page.waitForTimeout(200);
const focused = await page.evaluate(() => document.activeElement?.className || '');
assert(focused.includes('ct-title'), `title input is focused (${focused})`);

// choose the APP project explicitly
await page.click('.ct-project-select');
await page.waitForSelector('.popover .picker-item');
await page.click('.popover .picker-item:has-text("Mobile App")');
await page.waitForTimeout(200);
await page.fill('.ct-title', 'Palette test !high #Bug');
await page.waitForTimeout(150);
assert(Boolean(await page.$('.ct-token-hint')), 'smart tokens detected in title');
const prioLabel = await page.textContent('.ct-fields [aria-label^="Priority"]');
assert(/High/.test(prioLabel || ''), `priority chip shows High (${(prioLabel || '').trim()})`);
// due date: open the due-date picker and pick "Tomorrow"
await page.click('.ct-fields .datepicker-trigger');
await page.waitForSelector('.datepicker');
await page.click('.datepicker-quick-item:has-text("Tomorrow")');
await page.waitForTimeout(150);
await shot('d-create-dialog');
await page.click('.ct-footer .btn-primary');
await page.waitForSelector('.ct-dialog', { state: 'detached', timeout: 8000 });
assert(!(await page.$('.ct-dialog')), 'dialog closes after create');
await page.waitForTimeout(400);
const toast = await page.$('.toast-success');
assert(Boolean(toast), 'success toast shown');

// ---- API: task exists with priority 3, Bug label, due date ----
const app = projects.find((p) => p.key === 'APP');
const bundle = await api(`/api/projects/${app.id}/bundle`);
const bug = bundle.labels.find((l) => l.name === 'Bug');
const tasks = await api(`/api/projects/${app.id}/tasks`);
const created = tasks.find((t) => t.title === 'Palette test');
assert(Boolean(created), 'task "Palette test" exists (tokens stripped from the title)');
assert(created?.priority === 3, `priority is 3 (got ${created?.priority})`);
assert(Boolean(bug) && created?.labelIds.includes(bug.id), 'Bug label applied');
assert(Boolean(created?.dueDate), `due date set (${created?.dueDate})`);
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
assert(created?.dueDate === tomorrowISO, `due date is tomorrow (${created?.dueDate})`);

// ---- Command palette ----
await page.keyboard.press(`${mod}+k`);
await page.waitForSelector('.cmdk', { timeout: 5000 });
assert(Boolean(await page.$('.cmdk')), 'mod+K opens the command palette');
await page.waitForTimeout(200);
assert((await page.$$('.cmdk .picker-item')).length > 5, 'default mode lists actions and projects');
await page.keyboard.type('Palette');
await page.waitForSelector('.cmdk .picker-item:has-text("Palette test")', { timeout: 6000 });
assert(Boolean(await page.$('.cmdk .picker-item:has-text("Palette test")')), 'search result "Palette test" appears');
await shot('d-palette-search');
// the task must be the active (first) item — Tasks section sorts first
const activeText = await page.textContent('.cmdk .picker-item.is-active');
assert(/Palette test/.test(activeText || ''), 'search result is the active item');
await page.keyboard.press('Enter');
await page.waitForURL(/\?task=APP-\d+/, { timeout: 6000 });
assert(/\/w\/acme-labs\/p\/APP\?task=APP-\d+/.test(page.url()), `Enter opens the task (${new URL(page.url()).pathname}${new URL(page.url()).search})`);
assert(!(await page.$('.cmdk')), 'palette closed after selecting');

// ">" shows only actions
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.keyboard.press(`${mod}+k`);
await page.waitForSelector('.cmdk');
await page.waitForTimeout(200);
await page.keyboard.type('>');
await page.waitForTimeout(150);
const sections = await page.$$eval('.cmdk .picker-section-title', (els) => els.map((e) => e.textContent.trim()));
assert(sections.length === 1 && sections[0] === 'Actions', `">" shows only the Actions section (${sections.join(', ')})`);
await shot('d-palette-actions');
await page.keyboard.type('shortcuts');
await page.waitForTimeout(150);
await page.keyboard.press('Enter');
await page.waitForSelector('.dialog:has-text("Keyboard shortcuts")', { timeout: 4000 });
assert(Boolean(await page.$('.dialog:has-text("Keyboard shortcuts")')), '"Keyboard shortcuts" action opens the shortcuts dialog');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// task-key jump
await page.keyboard.press(`${mod}+k`);
await page.waitForSelector('.cmdk');
await page.waitForTimeout(200);
await page.keyboard.type('web-1');
await page.waitForTimeout(150);
const jump = await page.textContent('.cmdk .picker-item.is-active');
assert(/Open WEB-1/.test(jump || ''), 'typing a task key offers a direct jump');
await page.keyboard.press('Escape');

// recent tasks remembered
const recent = await page.evaluate((id) => JSON.parse(localStorage.getItem(`tt.recentTasks:${id}`) || '[]'), ws.id);
assert(recent.length >= 1 && recent[0].key === created.key, `recent tasks remembered (${recent.map((r) => r.key).join(', ')})`);

// ---- My work ----
// assign the new task to me so it shows up
await fetch(`${BASE}/api/tasks/${created.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: login.user.id }) });
await page.goto(`${BASE}/w/acme-labs/my-work`);
await page.waitForSelector('.my-work-card .task-row', { timeout: 10000 });
const allCount = await page.textContent('.my-work-tabs .tab.is-active .tab-count');
assert(Number(allCount) > 0, `All tab shows a count (${allCount})`);
assert(Boolean(await page.$(`.my-work-card .task-row[aria-label^="${created.key} "]`)), 'new task listed under All');
await page.click('.my-work-tabs .tab:has-text("This week")');
await page.waitForTimeout(200);
assert(Boolean(await page.$(`.my-work-card .task-row[aria-label^="${created.key} "]`)), 'new task listed under "This week" (due tomorrow)');
await page.click('.my-work-tabs .tab:has-text("Today")');
await page.waitForTimeout(200);
assert(!(await page.$(`.my-work-card .task-row[aria-label^="${created.key} "]`)), 'new task not listed under "Today"');
await page.click('.my-work-tabs .tab:has-text("All")');
await page.waitForTimeout(150);
// group by due date
await page.click('.my-work-controls .segmented-item:has-text("Due date")');
await page.waitForTimeout(200);
assert(Boolean(await page.$('.my-work-group-head:has-text("Tomorrow")')), 'group-by date shows a "Tomorrow" group');
await shot('d-mywork-test');
// j/k navigation + Enter
await page.mouse.move(700, 800);
await page.keyboard.press('j');
await page.keyboard.press('j');
await page.waitForTimeout(100);
assert((await page.$$('.task-row.is-active')).length === 1, 'j moves the active row');
await page.keyboard.press('k');
await page.waitForTimeout(100);
const activeIdx = await page.$eval('.task-row.is-active', (el) => el.dataset.index);
assert(activeIdx === '0', `k moves back (active index ${activeIdx})`);
await page.keyboard.press('Enter');
await page.waitForURL(/\?task=/, { timeout: 5000 });
assert(/\?task=/.test(page.url()), 'Enter opens the active task');
// inline priority change from My work
await page.goto(`${BASE}/w/acme-labs/my-work`);
await page.waitForSelector(`.my-work-card .task-row[aria-label^="${created.key} "]`, { timeout: 10000 });
const row = await page.$(`.my-work-card .task-row[aria-label^="${created.key} "]`);
await row.$eval('[aria-label^="Priority"]', (el) => el.click());
await page.waitForSelector('.popover .picker-item:has-text("Urgent")');
await page.click('.popover .picker-item:has-text("Urgent")');
await page.waitForTimeout(500);
const after = (await api(`/api/projects/${app.id}/tasks`)).find((t) => t.id === created.id);
assert(after.priority === 4, `inline priority change persisted (priority ${after.priority})`);
// ?filter=overdue from Home tiles
await page.goto(`${BASE}/w/acme-labs/my-work?filter=overdue`);
await page.waitForSelector('.my-work-tabs', { timeout: 10000 });
await page.waitForTimeout(300);
const activeTab = await page.textContent('.my-work-tabs .tab.is-active');
assert(/Overdue/.test(activeTab || ''), `?filter=overdue selects the Overdue tab (${(activeTab || '').trim()})`);

// ---- Empty-state sanity: guest-safe skeleton classes exist ----
assert(errors.length === 0, `no console errors${errors.length ? `:\n${errors.join('\n')}` : ''}`);

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
await browser.close();
process.exit(failed ? 1 : 0);
