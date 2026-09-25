// Interaction test for the Calendar + Timeline project views.
// Usage: BASE=http://127.0.0.1:3102 node e2e/calendar-timeline.mjs
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
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
const drag = async (sx, sy, tx, ty, steps = 14) => {
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + ((tx - sx) * i) / steps, sy + ((ty - sy) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(120);
};

// ---- login (UI) + API token ----
await page.goto(`${BASE}/login`);
await page.fill('#email', 'shivam@demo.teamtask.app');
await page.fill('#password', 'password123');
await page.click('button[type=submit]');
await page.waitForURL(/\/w\//, { timeout: 10000 });

const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'shivam@demo.teamtask.app', password: 'password123' }) })).json();
const token = login.accessToken;
const api = async (path, init = {}) => (await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } })).json();
const ws = (await api('/api/workspaces')).find((w) => w.slug === 'acme-labs');
const project = (await api(`/api/workspaces/${ws.id}/projects`)).find((p) => p.key === 'APP');
const taskOf = async (id) => (await api(`/api/projects/${project.id}/tasks`)).find((t) => t.id === id);

// deterministic fixtures: one single-day task and one 3-day task in the current month (avoid month edges)
const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');
const single = await api(`/api/projects/${project.id}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'E2E calendar single', dueDate: `${y}-${m}-10` }) });
const multi = await api(`/api/projects/${project.id}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'E2E timeline span', startDate: `${y}-${m}-15`, dueDate: `${y}-${m}-17` }) });
assert(single.id && multi.id, 'fixtures created via API');

// ================= Calendar =================
await page.goto(`${BASE}/w/acme-labs/p/APP?view=calendar`);
await page.waitForSelector('.calendar-grid', { timeout: 10000 });
assert((await page.$$('.calendar-day')).length % 7 === 0 && (await page.$$('.calendar-day')).length >= 35, 'month grid renders 5–6 week rows');
assert(Boolean(await page.$('.calendar-day-num.is-today')), 'today is highlighted');
assert(Boolean(await page.$('.calendar-tray-toggle')), 'no-due-date tray toggle present');

// drag the single-day chip two days later
const chip = await page.$(`.calendar-chip[data-task-id="${single.id}"]`);
assert(Boolean(chip), 'fixture chip rendered on its due date');
const targetDate = `${y}-${m}-12`;
const targetCell = await page.$(`.calendar-day[data-date="${targetDate}"]`);
const cb = await chip.boundingBox();
const tb = await targetCell.boundingBox();
await drag(cb.x + 20, cb.y + cb.height / 2, tb.x + tb.width / 2, tb.y + tb.height - 24);
assert(Boolean(await page.$('.dnd-overlay')), 'drag overlay rendered while dragging a chip');
assert(Boolean(await page.$(`.calendar-day[data-date="${targetDate}"].is-over`)), 'target day highlighted while hovering');
await page.mouse.up();
await page.waitForTimeout(600);
const movedSingle = await taskOf(single.id);
assert(movedSingle.dueDate === targetDate, `dueDate changed on the server (${movedSingle.dueDate})`);
const movedChipCell = await page.$(`.calendar-day[data-date="${targetDate}"]`);
const chipAfter = await page.$(`.calendar-chip[data-task-id="${single.id}"]`);
const cab = await chipAfter.boundingBox();
const mcb = await movedChipCell.boundingBox();
assert(cab.x >= mcb.x - 2 && cab.x < mcb.x + mcb.width, 'chip re-rendered inside the target cell');

// drag a multi-day bar: grab it on its first day, drop 1 day later → both dates shift
const bar = await page.$(`.calendar-chip[data-task-id="${multi.id}"]`);
const bb = await bar.boundingBox();
const startCell = await page.$(`.calendar-day[data-date="${y}-${m}-15"]`);
const sb = await startCell.boundingBox();
const nextCell = await page.$(`.calendar-day[data-date="${y}-${m}-16"]`);
const nb = await nextCell.boundingBox();
await drag(sb.x + 10, bb.y + bb.height / 2, nb.x + 10, nb.y + nb.height - 24);
await page.mouse.up();
await page.waitForTimeout(600);
const movedMulti = await taskOf(multi.id);
assert(movedMulti.startDate === `${y}-${m}-16` && movedMulti.dueDate === `${y}-${m}-18`, `multi-day drag preserved duration (${movedMulti.startDate} → ${movedMulti.dueDate})`);

// month navigation persists in the URL + keyboard
await page.click('.calendar-nav [aria-label="Next month"]');
await page.waitForTimeout(150);
assert(/[?&]date=\d{4}-\d{2}/.test(page.url()), 'next month writes ?date=YYYY-MM');
await page.click('.calendar-today-btn');
await page.waitForTimeout(150);
assert(!/[?&]date=/.test(page.url()), 'Today clears the date param');
await page.focus('.calendar');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(150);
assert(/[?&]date=/.test(page.url()), 'ArrowLeft navigates when the calendar is focused');
await page.keyboard.press('t');
await page.waitForTimeout(150);

// week mode
await page.click('.calendar-mode [role=tab]:has-text("Week")');
await page.waitForSelector('.calendar-week.is-weekmode', { timeout: 3000 });
assert((await page.$$('.calendar-day')).length === 7, 'week mode renders 7 day columns');
assert(/[?&]date=\d{4}-\d{2}-\d{2}/.test(page.url()), 'week mode persists the anchor day in the URL');
await page.click('.calendar-mode [role=tab]:has-text("Month")');
await page.waitForTimeout(150);

// chip click opens the task
await page.click(`.calendar-chip[data-task-id="${single.id}"]`);
await page.waitForTimeout(300);
assert(new URL(page.url()).searchParams.get('task') === single.key, 'clicking a chip opens the task (?task=KEY)');

// ================= Timeline =================
await page.goto(`${BASE}/w/acme-labs/p/APP?view=timeline`);
await page.waitForSelector('.timeline-bar', { timeout: 10000 });
assert(Boolean(await page.$('.timeline-today-line')), 'today line rendered');
assert((await page.$$('.timeline-group')).length >= 2, 'status groups rendered');

// make sure the fixture bar is in view (it is centered on today, the bar is mid-month)
const tlBar = await page.$(`.timeline-bar[data-task-id="${multi.id}"]`);
await tlBar.scrollIntoViewIfNeeded();
await page.waitForTimeout(100);
const before = await taskOf(multi.id);
const rb = await tlBar.boundingBox();
const dayW = 40; // day scale
// drag the right edge handle by 2 days
const handle = await tlBar.$('.timeline-bar-handle.is-right');
const hb = await handle.boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(hb.x + hb.width / 2 + (2 * dayW * i) / 10, hb.y + hb.height / 2);
  await page.waitForTimeout(25);
}
await page.waitForTimeout(150);
assert(Boolean(await page.$('.timeline-tip')), 'date tooltip shown while resizing');
const pvb = await (await page.$(`.timeline-bar[data-task-id="${multi.id}"]`)).boundingBox();
assert(Math.round(pvb.width - rb.width) === 2 * dayW, `live preview grew by 2 days (${Math.round(pvb.width - rb.width)}px)`);
await page.mouse.up();
await page.waitForTimeout(600);
const resized = await taskOf(multi.id);
assert(resized.dueDate === addDays(before.dueDate, 2) && resized.startDate === before.startDate, `right-edge resize extended dueDate by 2 days (${before.dueDate} → ${resized.dueDate})`);
assert(!(await page.$('.timeline-tip')), 'tooltip removed after drop');

// move the whole bar 3 days later
const tlBar2 = await page.$(`.timeline-bar[data-task-id="${multi.id}"]`);
const rb2 = await tlBar2.boundingBox();
await page.mouse.move(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(rb2.x + rb2.width / 2 + (3 * dayW * i) / 10, rb2.y + rb2.height / 2);
  await page.waitForTimeout(25);
}
await page.mouse.up();
await page.waitForTimeout(600);
const moved = await taskOf(multi.id);
assert(moved.startDate === addDays(resized.startDate, 3) && moved.dueDate === addDays(resized.dueDate, 3), `bar move shifted both dates by 3 days (${moved.startDate} → ${moved.dueDate})`);
assert(new URL(page.url()).searchParams.get('task') === null, 'drag did not open the task panel');

// Escape cancels a drag
const tlBar3 = await page.$(`.timeline-bar[data-task-id="${multi.id}"]`);
const rb3 = await tlBar3.boundingBox();
await page.mouse.move(rb3.x + rb3.width / 2, rb3.y + rb3.height / 2);
await page.mouse.down();
await page.mouse.move(rb3.x + rb3.width / 2 + 3 * dayW, rb3.y + rb3.height / 2, { steps: 6 });
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.mouse.up();
await page.waitForTimeout(400);
const cancelled = await taskOf(multi.id);
assert(cancelled.startDate === moved.startDate && cancelled.dueDate === moved.dueDate, 'Escape cancels the drag without saving');

// schedule an unscheduled task via the row button
const unsched = await api(`/api/projects/${project.id}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'E2E unscheduled' }) });
await page.waitForTimeout(400);
const row = await page.$(`.timeline-row[data-task-id="${unsched.id}"]`);
assert(Boolean(row), 'unscheduled task listed in the timeline');
await row.hover();
await page.click(`.timeline-row[data-task-id="${unsched.id}"] .timeline-schedule`);
await page.waitForTimeout(500);
const scheduled = await taskOf(unsched.id);
assert(scheduled.startDate && scheduled.dueDate === addDays(scheduled.startDate, 2), `Schedule set a 3-day span (${scheduled.startDate} → ${scheduled.dueDate})`);
assert(Boolean(await page.$(`.timeline-bar[data-task-id="${unsched.id}"]`)), 'bar appears after scheduling');

// zoom keeps working
await page.click('.timeline-scale [role=tab]:has-text("Month")');
await page.waitForTimeout(200);
assert(Boolean(await page.$('.timeline-scale-month')), 'month scale applied');
await page.click('.timeline-scale [role=tab]:has-text("Day")');

// bar click opens the task
await page.click(`.timeline-bar[data-task-id="${multi.id}"]`);
await page.waitForTimeout(300);
assert(new URL(page.url()).searchParams.get('task') === multi.key, 'clicking a bar opens the task');

// cleanup
for (const t of [single, multi, unsched]) await fetch(`${BASE}/api/tasks/${t.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\n(no console errors)');
console.log(failed ? `\n${failed} assertion(s) failed` : '\nall assertions passed');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
