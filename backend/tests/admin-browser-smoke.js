import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const adminEmail = process.env.TOOLBOX_ADMIN_EMAIL;
const adminPassword = process.env.TOOLBOX_ADMIN_PASSWORD;
const baseUrl = process.env.TOOLBOX_ADMIN_BASE_URL || 'http://127.0.0.1:8000';
assert.ok(adminEmail && adminPassword, '請設定 TOOLBOX_ADMIN_EMAIL 與 TOOLBOX_ADMIN_PASSWORD');
await mkdir('tmp', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/admin/login');
  assert.equal(await page.locator('h1').textContent(), '管理後台');
  await page.screenshot({ path: 'tmp/admin-login.png', fullPage: true });

  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);
  await page.getByRole('button', { name: '登入後台' }).click();
  await page.waitForURL('**/admin');
  assert.equal(await page.locator('h1').first().textContent(), '後台控制中心');
  assert.equal(await page.locator('.stat-grid article').count(), 4);
  assert.match(await page.locator('.status-pill').textContent(), /PostgreSQL 已連線/);
  await page.screenshot({ path: 'tmp/admin-dashboard.png', fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: 'tmp/admin-login-mobile.png', fullPage: true });
  console.log('PASS: 後台登入、PostgreSQL 儀表板與手機版畫面可用');
} finally {
  await browser.close();
}
