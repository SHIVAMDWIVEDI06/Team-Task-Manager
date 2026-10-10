// Interaction test for the task peek panel (TaskPanel / TaskDetail).
// Usage: BASE=http://127.0.0.1:3103 node e2e/task-panel.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME });
const errors = [];
const track = (page, who) => {
  page.on('pageerror', (e) => errors.push(`[${who}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|net::|Failed to load resource/.test(m.text())) errors.push(`[${who}] ${m.text()}`); });
};
let failed = 0;
const assert = (cond, msg) => { if (cond) console.log('  ok  ', msg); else { failed++; console.log('  FAIL', msg); } };
const step = (name) => console.log(`\n# ${name}`);

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/w\//, { timeout: 15000 });
}
async function apiLogin(email) {
  const r = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) })).json();
  const token = r.accessToken;
  return { user: r.user, get: async (path) => (await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } })).json() };
}

const shivam = await apiLogin('shivam@demo.teamtask.app');
const priya = await apiLogin('priya@demo.teamtask.app');
const ws = (await shivam.get('/api/workspaces')).find((w) => w.slug === 'acme-labs');
const taskBefore = await shivam.get(`/api/tasks/by-key/APP-1?workspace=${ws.id}`);
const bundle = await shivam.get(`/api/projects/${taskBefore.projectId}/bundle`);
const notifsBefore = await priya.get('/api/notifications?limit=100');
const url = `${BASE}/w/acme-labs/p/APP?task=APP-1`;
const tag = String(Date.now() % 100000); // unique names so the test can be re-run against the same database

// ---- Context A: shivam ----
const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctxA.newPage();
track(page, 'shivam');
await login(page, 'shivam@demo.teamtask.app');

step('open panel');
await page.goto(url);
await page.waitForSelector('.task-panel .task-detail', { timeout: 10000 });
assert((await page.textContent('.task-panel-key')).includes('APP-1'), 'panel header shows the task key');
assert((await page.inputValue('.task-title')) === taskBefore.title, 'title rendered');

// ---- Context B: priya watching the same task (realtime) ----
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pageB = await ctxB.newPage();
track(pageB, 'priya');
await login(pageB, 'priya@demo.teamtask.app');
await pageB.goto(url);
await pageB.waitForSelector('.task-panel .task-detail', { timeout: 10000 });

step('edit title');
const newTitle = `Onboarding flow redesign v${Date.now() % 1000}`;
await page.fill('.task-title', newTitle);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
let t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.title === newTitle, 'title saved on the server');
await pageB.waitForFunction((v) => document.querySelector('.task-title')?.value === v, newTitle, { timeout: 5000 }).catch(() => {});
assert((await pageB.inputValue('.task-title')) === newTitle, 'priya sees the new title without reload (realtime)');

step('status / priority / assignee pickers');
const prop = (label) => page.locator('.task-prop', { has: page.locator('.task-prop-label', { hasText: label }) });
const target = bundle.statuses.find((s) => s.id !== t.statusId && s.category === 'in_progress') || bundle.statuses.find((s) => s.id !== t.statusId);
await prop('Status').locator('button').first().click();
await page.click(`.popover .picker-item:has-text("${target.name}")`);
await page.waitForTimeout(400);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.statusId === target.id, `status changed to "${target.name}"`);
assert((await prop('Status').textContent()).includes(target.name), 'status button shows new status');

await prop('Priority').locator('button').first().click();
await page.click('.popover .picker-item:has-text("High")');
await page.waitForTimeout(400);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.priority === 3, 'priority changed to High');

// pick an assignee who is not the current one so an "assigned" activity is produced
const assignee = t.assigneeId === priya.user.id ? bundle.members.find((m) => m.userId === shivam.user.id).user : priya.user;
await prop('Assignee').locator('button').first().click();
await page.fill('.popover .picker-input', assignee.name.split(' ')[0]);
await page.click(`.popover .picker-item:has-text("${assignee.name}")`);
await page.waitForTimeout(400);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.assigneeId === assignee.id, `assigned to ${assignee.name}`);

step('keyboard: S opens the status picker');
await page.click('.task-panel-head');
await page.keyboard.press('s');
assert(Boolean(await page.$('.popover .picker-item')), 'S opened the status popover');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
assert(!(await page.$('.popover')), 'Escape closed the popover (panel stays open)');
assert(Boolean(await page.$('.task-panel')), 'panel still open after closing popover');

step('description with @mention');
await page.click('.task-description-view, .task-description-empty'); // seed may or may not give APP-1 a description
await page.waitForSelector('.task-description-editor .editor-textarea');
await page.click('.task-description-editor .editor-textarea');
await page.keyboard.press('Control+End');
await page.keyboard.type('\n\nReviewer: @Pri');
await page.waitForSelector('.mention-menu .mention-item');
await page.keyboard.press('Enter');
await page.click('.task-description-editor button:has-text("Save")');
await page.waitForSelector('.task-description-view .mention', { timeout: 5000 });
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.description.includes(`@[Priya Sharma](${priya.user.id})`), 'description saved with mention markup');
assert((await page.textContent('.task-description-view .mention')) === '@Priya Sharma', 'mention rendered in the view');

step('add subtask');
const subCount = (await page.$$('.task-subtask')).length;
await page.hover('.task-section:has(.task-section-title:text-is("Subtasks"))');
await page.click('.task-section:has(.task-section-title:text-is("Subtasks")) button:has-text("Add subtask")');
await page.fill('input[aria-label="New subtask title"]', `E2E subtask ${tag}`);
await page.keyboard.press('Enter');
await page.waitForSelector(`.task-subtask:has-text("E2E subtask ${tag}")`, { timeout: 5000 });
assert((await page.$$('.task-subtask')).length === subCount + 1, 'subtask row appended');
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.subtasks.some((s) => s.title === `E2E subtask ${tag}`), 'subtask exists on the server');
await page.keyboard.press('Escape');

step('checklist: add, toggle, reorder');
const checklistSection = '.task-section:has(.task-section-title:text-is("Checklist"))';
await page.hover(checklistSection);
await page.click(`${checklistSection} button:has-text("Add item")`);
await page.fill('input[aria-label="New checklist item"]', `E2E item one ${tag}`);
await page.keyboard.press('Enter');
await page.waitForSelector(`.task-check:has-text("E2E item one ${tag}")`);
await page.fill('input[aria-label="New checklist item"]', `E2E item two ${tag}`);
await page.keyboard.press('Enter');
await page.waitForSelector(`.task-check:has-text("E2E item two ${tag}")`);
await page.keyboard.press('Escape');
await page.click(`.task-check:has-text("E2E item one ${tag}") .checkbox`);
await page.waitForTimeout(500);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
const one = t.checklist.find((c) => c.text === `E2E item one ${tag}`);
const two = t.checklist.find((c) => c.text === `E2E item two ${tag}`);
assert(one?.done === true, 'checklist item toggled done on the server');
assert(Boolean(await page.$(`.task-check.is-done:has-text("E2E item one ${tag}")`)), 'toggled item shows done');
// reorder: drag "two" above "one"
const rowTwo = await page.$(`.task-check:has-text("E2E item two ${tag}")`);
const rowOne = await page.$(`.task-check:has-text("E2E item one ${tag}")`);
const b2 = await rowTwo.boundingBox();
const b1 = await rowOne.boundingBox();
await page.mouse.move(b2.x + 120, b2.y + b2.height / 2);
await page.mouse.down();
const targetY = b1.y + 5; // inside row one, above its midpoint → index 0
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(b2.x + 120, b2.y + b2.height / 2 + ((targetY - b2.y - b2.height / 2) * i) / 10);
  await page.waitForTimeout(25);
}
await page.waitForTimeout(100);
assert(Boolean(await page.$('.task-check-placeholder')), 'reorder placeholder shown while dragging');
await page.mouse.up();
await page.waitForTimeout(600);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
const sorted = [...t.checklist].sort((a, b) => a.position - b.position).map((c) => c.text);
assert(sorted.indexOf(`E2E item two ${tag}`) < sorted.indexOf(`E2E item one ${tag}`), `checklist reordered on the server (${sorted.join(' | ')})`);
const domOrder = await page.$$eval('.task-check .task-check-text', (els) => els.map((e) => e.textContent));
assert(domOrder.indexOf(`E2E item two ${tag}`) < domOrder.indexOf(`E2E item one ${tag}`), 'checklist reordered in the DOM');

step('add relation');
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
const projectTasks = await shivam.get(`/api/projects/${taskBefore.projectId}/tasks`);
const relTarget = projectTasks.find((x) => x.id !== taskBefore.id && x.parentId !== taskBefore.id && !t.relations.some((r) => r.task.id === x.id));
await page.hover('.task-section:has(.task-section-title:text-is("Relations"))');
await page.click('.task-section:has(.task-section-title:text-is("Relations")) button:has-text("Add relation")');
await page.waitForSelector('.task-relation-popover .picker-input');
await page.fill('.task-relation-popover .picker-input', relTarget.key);
await page.click(`.task-relation-popover .picker-item:has-text("${relTarget.key}")`);
await page.waitForSelector(`.task-relation:has-text("${relTarget.key}")`, { timeout: 5000 });
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.relations.some((r) => r.task.key === relTarget.key && r.type === 'blocked_by'), `relation stored (blocked by ${relTarget.key})`);

step('upload attachment');
await page.setInputFiles('input[aria-label="Upload files"]', { name: 'e2e-note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from the e2e test') });
await page.waitForSelector('.task-attachment:has-text("e2e-note.txt"):not(.is-uploading)', { timeout: 10000 });
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.attachments.some((a) => a.filename === 'e2e-note.txt'), 'attachment stored on the server');
// image upload → thumbnail rendered via authenticated blob URL
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await page.setInputFiles('input[aria-label="Upload files"]', { name: 'pixel.png', mimeType: 'image/png', buffer: png });
await page.waitForSelector('.task-attachment:has-text("pixel.png") img', { timeout: 10000 });
assert(Boolean(await page.$('.task-attachment:has-text("pixel.png") img[src^="blob:"]')), 'image attachment shows a thumbnail');

step('log time');
const spentBefore = t.timeSpentMinutes;
await page.hover('.task-prop:has-text("Time spent")');
await page.click('.task-prop:has-text("Time spent") button:has-text("Log time")');
await page.fill('input[aria-label="Duration"]', '1h 30m');
await page.fill('input[aria-label="Note"]', `E2E session ${tag}`);
await page.click('.task-time-form button[type=submit]');
await page.waitForSelector(`.task-time-entry:has-text("E2E session ${tag}")`, { timeout: 5000 });
await page.waitForTimeout(400);
t = await shivam.get(`/api/tasks/${taskBefore.id}`);
assert(t.timeSpentMinutes === spentBefore + 90, `time spent increased by 90m (${spentBefore} → ${t.timeSpentMinutes})`);
const expectSpent = `${Math.floor(t.timeSpentMinutes / 60)}h${t.timeSpentMinutes % 60 ? ` ${t.timeSpentMinutes % 60}m` : ''}`;
assert((await page.textContent('.task-prop:has-text("Time spent")')).includes(expectSpent), `time spent property shows ${expectSpent}`);

step('comment with @mention → notification + realtime');
const commentsB = (await pageB.$$('.task-comment')).length;
await page.click('.task-composer .editor-textarea');
await page.keyboard.type('Hey @Pri');
await page.waitForSelector('.mention-menu .mention-item');
await page.keyboard.press('Enter');
await page.waitForTimeout(150); // caret is repositioned on the next frame after a mention is inserted
await page.keyboard.type(`please review this e2e comment ${tag}`);
// typing indicator should reach priya
const typing = await pageB.waitForSelector('.task-typing', { timeout: 5000 }).catch(() => null);
assert(Boolean(typing), 'priya sees the typing indicator');
if (typing) assert((await typing.textContent()).includes('Shivam is typing'), 'typing indicator names Shivam');
await page.click('.task-composer button:has-text("Comment")');
await page.waitForSelector(`.task-comment:has-text("please review this e2e comment ${tag}")`, { timeout: 5000 });
assert(Boolean(await page.$('.task-comment .mention:has-text("Priya")')), 'comment renders the mention');
assert((await page.inputValue('.task-composer .editor-textarea')) === '', 'composer cleared after posting');
const arrived = await pageB.waitForSelector(`.task-comment:has-text("please review this e2e comment ${tag}")`, { timeout: 6000 }).catch(() => null);
assert(Boolean(arrived), 'comment appears for priya without reload (realtime)');
assert((await pageB.$$('.task-comment')).length === commentsB + 1, 'priya sees exactly one new comment');
const notifsAfter = await priya.get('/api/notifications?limit=100');
const mention = notifsAfter.items.find((n) => n.type === 'mentioned' && !notifsBefore.items.some((o) => o.id === n.id));
assert(Boolean(mention), `priya received a "mentioned" notification (${mention?.title ?? 'none'})`);
assert(Boolean(await pageB.$('.task-comment-list')), 'priya comment list rendered');

step('comment edit + delete');
await page.hover(`.task-comment:has-text("please review this e2e comment ${tag}")`);
await page.click(`.task-comment:has-text("please review this e2e comment ${tag}") button[aria-label="Edit comment"]`);
await page.fill('.task-comment-edit .editor-textarea', `edited e2e comment ${tag}`);
await page.click('.task-comment-edit button:has-text("Save")');
await page.waitForSelector(`.task-comment:has-text("edited e2e comment ${tag}") .xs:has-text("edited")`, { timeout: 5000 });
assert(true, 'comment edited and marked (edited)');
const editedB = await pageB.waitForSelector(`.task-comment:has-text("edited e2e comment ${tag}")`, { timeout: 5000 }).catch(() => null);
assert(Boolean(editedB), 'priya sees the edited comment (realtime)');

step('activity tab');
await page.click('.task-feed .tab:has-text("Activity")');
await page.waitForSelector('.task-activity-item', { timeout: 5000 });
const activityText = await page.textContent('.task-activity');
assert(activityText.includes('changed status'), 'activity lists the status change');
assert(activityText.includes('logged 1h 30m'), 'activity lists the time log');
assert(activityText.includes(`assigned to ${assignee.name}`), 'activity resolves assignee names');
assert(activityText.includes('commented: “Hey @Priya Sharma'), 'comment excerpt shows plain mention');

step('navigation + close');
await page.click('.task-feed .tab:has-text("Comments")');
await page.click('.task-panel-head');
await page.keyboard.press('j');
await page.waitForTimeout(500);
const keyAfterJ = await page.textContent('.task-panel-key');
assert(keyAfterJ.trim() !== 'APP-1', `J moved to the next task (${keyAfterJ.trim()})`);
assert(new URL(page.url()).searchParams.get('task') === keyAfterJ.trim(), 'URL ?task= follows the panel');
await page.keyboard.press('k');
await page.waitForTimeout(500);
assert((await page.textContent('.task-panel-key')).trim() === 'APP-1', 'K moved back to APP-1');
await page.click(`.task-subtask:has-text("E2E subtask ${tag}") .task-row-title`);
await page.waitForSelector('.task-parent-note', { timeout: 5000 });
assert(Boolean(await page.$('.task-panel-crumb:has-text("APP-1")')), 'subtask shows parent breadcrumb');
await page.click('.task-panel-crumb:has-text("APP-1")');
await page.waitForSelector('.task-subtask', { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
assert(!(await page.$('.task-panel')), 'Escape closed the panel');
assert(!new URL(page.url()).searchParams.get('task'), '?task removed from the URL');

step('not found state');
await page.goto(`${BASE}/w/acme-labs/p/APP?task=APP-9999`);
await page.waitForSelector('.task-panel-state', { timeout: 10000 });
assert((await page.textContent('.task-panel-state')).includes("doesn't exist"), 'not-found message shown');
await page.click('.task-panel-state button:has-text("Close")');
await page.waitForTimeout(300);
assert(!(await page.$('.task-panel')), 'not-found close works');

step('mobile');
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageM = await ctxM.newPage();
track(pageM, 'mobile');
await login(pageM, 'shivam@demo.teamtask.app');
await pageM.goto(url);
await pageM.waitForSelector('.task-panel .task-detail', { timeout: 10000 });
const w = await pageM.$eval('.task-panel', (el) => el.getBoundingClientRect().width);
assert(Math.round(w) === 390, `panel is full-screen on mobile (${w}px)`);
assert(Boolean(await pageM.$('.task-panel-scrim')), 'scrim rendered on mobile');
await pageM.screenshot({ path: 'e2e/screenshots/c-task-mobile.png' });

// dark screenshot for the record
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const pageD = await ctxD.newPage();
track(pageD, 'dark');
await login(pageD, 'shivam@demo.teamtask.app');
await pageD.goto(url);
await pageD.waitForSelector('.task-panel .task-detail', { timeout: 10000 });
await pageD.waitForTimeout(600);
await pageD.screenshot({ path: 'e2e/screenshots/c-task-dark.png' });
await page.goto(url);
await page.waitForSelector('.task-panel .task-detail', { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'e2e/screenshots/c-task.png' });

await browser.close();
console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASSED'}${errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\n(no console errors)'}`);
process.exit(failed || errors.length ? 1 : 0);
