import assert from 'node:assert/strict';

const baseUrl = (process.env.TOOLBOX_API_BASE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const email = process.env.TOOLBOX_ADMIN_EMAIL || 'admin-smoke@example.com';
const password = process.env.TOOLBOX_ADMIN_PASSWORD || 'admin-smoke-password';
const targetEmail = `admin-target-${Date.now()}@example.com`;
const targetPassword = 'admin-target-password';

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual', ...options });
}

const protectedPage = await request('/admin');
assert.equal(protectedPage.status, 303);
assert.equal(protectedPage.headers.get('location'), '/admin/login');

const loginPage = await request('/admin/login');
assert.equal(loginPage.status, 200);
assert.match(await loginPage.text(), /管理後台/);
assert.equal(loginPage.headers.get('x-frame-options'), 'DENY');

const targetRegistration = await request('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: targetEmail, password: targetPassword, remember: false })
});
assert.equal(targetRegistration.status, 201);
const targetSession = await targetRegistration.json();

const wrongLogin = await request('/admin/login', {
  method: 'POST',
  body: new URLSearchParams({ email, password: 'incorrect-password' })
});
assert.equal(wrongLogin.status, 401);

const login = await request('/admin/login', {
  method: 'POST',
  body: new URLSearchParams({ email, password })
});
assert.equal(login.status, 303);
assert.equal(login.headers.get('location'), '/admin');
const cookie = login.headers.get('set-cookie');
assert.match(cookie, /toolbox_admin=/);
assert.match(cookie, /HttpOnly/i);
assert.match(cookie, /Secure/i);
assert.match(cookie, /SameSite=Strict/i);

const dashboard = await request('/admin', { headers: { Cookie: cookie.split(';', 1)[0] } });
assert.equal(dashboard.status, 200);
const dashboardHtml = await dashboard.text();
assert.match(dashboardHtml, /後台控制中心/);
assert.match(dashboardHtml, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
const targetRow = dashboardHtml.match(new RegExp(`<tr>[\\s\\S]*?${targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?action="/admin/users/([^/]+)/revoke"[\\s\\S]*?name="csrf" value="([^"]+)"[\\s\\S]*?</tr>`));
assert.ok(targetRow, '後台應顯示測試帳號與管理操作');
const [, targetId, csrf] = targetRow;

const revoke = await request(`/admin/users/${targetId}/revoke`, {
  method: 'POST',
  headers: { Cookie: cookie.split(';', 1)[0] },
  body: new URLSearchParams({ csrf })
});
assert.equal(revoke.status, 303);
const revokedSession = await request('/api/auth/me', {
  headers: { Authorization: `Bearer ${targetSession.token}` }
});
assert.equal(revokedSession.status, 401);

const confirmDelete = await request(`/admin/users/${targetId}/delete`, {
  headers: { Cookie: cookie.split(';', 1)[0] }
});
assert.equal(confirmDelete.status, 200);
assert.match(await confirmDelete.text(), new RegExp(targetEmail));
const deleteUser = await request(`/admin/users/${targetId}/delete`, {
  method: 'POST',
  headers: { Cookie: cookie.split(';', 1)[0] },
  body: new URLSearchParams({ csrf })
});
assert.equal(deleteUser.status, 303);
const deletedLogin = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: targetEmail, password: targetPassword })
});
assert.equal(deletedLogin.status, 401);

const logout = await request('/admin/logout', {
  method: 'POST',
  headers: { Cookie: cookie.split(';', 1)[0] }
});
assert.equal(logout.status, 303);
assert.equal(logout.headers.get('location'), '/admin/login');
assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);

console.log(`PASS: Cloudflare 後台保護、登入、控制台、撤銷登入、刪除帳號與登出均正常（${email}）`);
