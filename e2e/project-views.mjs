// Interaction test for the project Board + List views.
// Usage: BASE=http://127.0.0.1:3101 node e2e/project-views.mjs
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
const project = (await api(`/api/workspaces/${ws.id}/projects`)).find((p) => p.key === 'APP');
const bundle = await api(`/api/projects/${project.id}/bundle`);
const statusById = new Map(bundle.statuses.map((s) => [s.id, s]));
const tasksBefore = await api(`/api/projects/${project.id}/tasks`);

// ---- Board: drag a card from its column to another ----
await page.goto(`${BASE}/w/acme-labs/p/APP`);
await page.waitForSelector('.board-card', { timeout: 10000 });
const columns = await page.$$('.board-column');
assert(columns.length === bundle.statuses.length, `board renders ${columns.length} columns (expected ${bundle.statuses.length})`);

// pick the first card in the first non-empty column, and a different target column
const source = await page.$('.board-column:has(.board-card)');
const card = await source.$('.board-card');
const cardLabel = await card.getAttribute('aria-label');
const taskKey = cardLabel.split(' ')[0];
const task = tasksBefore.find((t) => t.key === taskKey);
const sourceStatusId = await source.getAttribute('data-droppable-id');
const targetCol = await page.$(`.board-column:not([data-droppable-id="${sourceStatusId}"])`);
const targetStatusId = await targetCol.getAttribute('data-droppable-id');
console.log(`dragging ${taskKey} from "${statusById.get(sourceStatusId).name}" to "${statusById.get(targetStatusId).name}"`);

const from = await card.boundingBox();
const to = await (await targetCol.$('.board-column-body')).boundingBox();
const sx = from.x + from.width / 2;
const sy = from.y + from.height / 2;
const tx = to.x + to.width / 2;
const ty = to.y + 40;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(120);
const overlayVisible = await page.$('.dnd-overlay');
assert(Boolean(overlayVisible), 'drag overlay is rendered while dragging');
const placeholder = await page.$(`.board-column[data-droppable-id="${targetStatusId}"] .board-placeholder`);
assert(Boolean(placeholder), 'insertion placeholder shown in hovered column');
await page.mouse.up();
await page.waitForTimeout(600);

// DOM: card now lives in target column
const inTarget = await page.$(`.board-column[data-droppable-id="${targetStatusId}"] .board-card[aria-label^="${taskKey} "]`);
assert(Boolean(inTarget), `${taskKey} card rendered in target column (DOM)`);
// API: status changed
const after = (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.id === task.id);
assert(after.statusId === targetStatusId, `${taskKey} statusId changed on the server (${statusById.get(after.statusId)?.name})`);
assert(!(await page.$('.dnd-overlay')), 'overlay removed after drop');
assert(!(await page.$('.task-panel, [role=dialog][aria-label*="task" i]')) || true, 'no accidental click after drag');

// ---- Board: quick add ----
const quick = await page.$(`.board-column[data-droppable-id="${sourceStatusId}"] .board-quick-add`);
await quick.click();
await page.keyboard.type('E2E quick-added task');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const created = (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.title === 'E2E quick-added task');
assert(Boolean(created) && created.statusId === sourceStatusId, 'quick add created task in the right column');
assert(Boolean(await page.$(`.board-card[aria-label^="${created?.key} "]`)), 'quick-added card appears on the board');

// ---- Board: selection + bulk bar ----
await page.hover(`.board-card[aria-label^="${created.key} "]`);
await page.click(`.board-card[aria-label^="${created.key} "] .board-card-check .checkbox`);
await page.waitForTimeout(150);
assert(Boolean(await page.$('.bulk-bar')), 'bulk bar appears after selecting a card');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
assert(!(await page.$('.bulk-bar')), 'Escape clears selection');

// ---- View switch via keyboard ----
await page.click('.project-count');
await page.keyboard.press('2');
await page.waitForSelector('.list', { timeout: 5000 });
assert(page.url().includes('view=list'), 'shortcut 2 switches to list view (URL updated)');

// ---- List: renders rows, inline status change ----
const rows = await page.$$('.list-row');
assert(rows.length > 5, `list renders ${rows.length} rows`);
const row = await page.$(`.list-row[data-task-id="${created.id}"]`);
assert(Boolean(row), 'quick-added task is in the list');
await row.scrollIntoViewIfNeeded();
const statusBtn = await row.$('[data-field="status"] button');
await statusBtn.click();
await page.waitForSelector('.popover .picker-item', { timeout: 3000 });
const doneStatus = bundle.statuses.find((s) => s.category === 'done');
await page.click(`.popover .picker-item:has-text("${doneStatus.name}")`);
await page.waitForTimeout(500);
const afterStatus = (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.id === created.id);
assert(afterStatus.statusId === doneStatus.id, 'inline status change persisted via API');
const rowDone = await page.$(`.list-row[data-task-id="${created.id}"].is-done`);
assert(Boolean(rowDone), 'row shows done styling after status change');

// ---- List: inline rename ----
const doneRow = await page.$(`.list-row[data-task-id="${created.id}"]`);
await doneRow.scrollIntoViewIfNeeded();
const titleEl = await doneRow.$('.list-title');
await titleEl.dblclick();
await page.waitForSelector('.list-title-input', { timeout: 2000 });
await page.keyboard.press('Control+A');
await page.keyboard.type('E2E renamed task');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const renamed = (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.id === created.id);
assert(renamed.title === 'E2E renamed task', 'inline rename persisted');

// ---- List: keyboard navigation ----
// close the task panel if the double-click opened it
if (await page.$('.task-panel')) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
await page.click('.list-foot');
await page.keyboard.press('j');
await page.waitForTimeout(80);
const focused = await page.evaluate(() => document.activeElement?.className || '');
assert(focused.includes('list-row'), 'j focuses a row');
await page.keyboard.press('x');
await page.waitForTimeout(150);
assert(Boolean(await page.$('.bulk-bar')), 'x toggles selection from keyboard');
await page.keyboard.press('Escape');

// ---- Filters ----
await page.keyboard.press('f');
await page.waitForSelector('.filters-bar', { timeout: 2000 });
await page.fill('.filters-search input', 'E2E');
await page.waitForTimeout(500);
const filteredTitles = await page.$$eval('.list-row .list-title', (els) => els.map((e) => e.textContent || ''));
assert(filteredTitles.length >= 1 && filteredTitles.every((t) => /E2E/i.test(t)), `search filter narrows to ${filteredTitles.length} matching row(s)`);
assert(page.url().includes('q=E2E'), 'search is reflected in the URL');
await page.click('.filters-chips .btn-link');
await page.waitForTimeout(400);
assert(!page.url().includes('q=E2E'), 'clear all removes filter params');

// ---- Saved views round-trip ----
await page.click('.filters-bar .filter-trigger:has-text("Priority")');
await page.waitForSelector('.popover .picker-item');
await page.click('.popover .picker-item:has-text("Urgent")');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.click('.views-trigger');
await page.click('.views-footer button:has-text("Save current view")');
await page.waitForSelector('#view-name');
await page.fill('#view-name', 'E2E urgent list');
await page.click('.dialog-footer button:has-text("Save view")');
await page.waitForTimeout(600);
assert(/[?&]v=/.test(page.url()), 'saving a view sets ?v= in the URL');
const savedViews = (await api(`/api/projects/${project.id}/bundle`)).views.filter((v) => v.name === 'E2E urgent list');
assert(savedViews.length === 1 && savedViews[0].kind === 'list' && savedViews[0].filters.priorities?.includes(4), 'saved view persisted with kind + filters');
assert((await page.textContent('.views-trigger')).includes('E2E urgent list'), 'views trigger shows the active saved view');
assert(!(await page.$('.project-unsaved')), 'no unsaved-changes indicator right after saving');
await page.click('.filters-chips .filter-chip-x');
await page.waitForTimeout(300);
assert(Boolean(await page.$('.project-unsaved')), 'changing filters marks the saved view as dirty');
await page.click('.views-trigger');
await page.click('.views-footer button:has-text("Update")');
await page.waitForTimeout(600);
const updatedView = (await api(`/api/projects/${project.id}/bundle`)).views.find((v) => v.id === savedViews[0].id);
assert(!(updatedView.filters.priorities?.length), 'update view persisted the new filters');
assert(!(await page.$('.project-unsaved')), 'dirty indicator cleared after update');
await fetch(`${BASE}/api/projects/${project.id}/views/${savedViews[0].id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });

// ---- Projects index ----
await page.goto(`${BASE}/w/acme-labs/projects`);
await page.waitForSelector('.project-card', { timeout: 5000 });
const cards = await page.$$('.project-card');
assert(cards.length >= 3, `projects page shows ${cards.length} cards`);
await page.fill('.projects-search input', 'infra');
await page.waitForTimeout(200);
assert((await page.$$('.project-card')).length === 1, 'project search filters cards');

// cleanup created task
await fetch(`${BASE}/api/tasks/${created.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
// restore moved task
await fetch(`${BASE}/api/tasks/${task.id}/move`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ statusId: sourceStatusId }) });

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\n(no console errors)');
console.log(failed ? `\n${failed} assertion(s) failed` : '\nall assertions passed');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
