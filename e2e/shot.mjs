// Quick visual check helper: node e2e/shot.mjs <url-path> <out.png> [--dark] [--mobile] [--login]
import { chromium } from 'playwright';

const [, , path = '/', out = 'e2e/screenshots/shot.png', ...flags] = process.argv;
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: flags.includes('--mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 }, colorScheme: flags.includes('--dark') ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
if (flags.includes('--login')) {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', process.env.EMAIL || 'shivam@demo.teamtask.app');
  await page.fill('#password', process.env.PASSWORD || 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/w\//, { timeout: 10000 });
}
await page.goto(`${BASE}${path}`);
await page.waitForTimeout(Number(process.env.WAIT || 1200));
await page.screenshot({ path: out, fullPage: flags.includes('--full') });
console.log('saved', out, errors.length ? `\nERRORS:\n${errors.join('\n')}` : '(no console errors)');
await browser.close();
