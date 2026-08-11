import assert from 'node:assert/strict';

const baseUrl = (process.env.TOOLBOX_API_BASE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const email = process.env.TOOLBOX_TEST_EMAIL || `registration-smoke-${Date.now()}@example.com`;
const password = 'registration-test-password';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

const health = await request('/api/health');
assert.equal(health.response.status, 200);
assert.equal(health.body.status, 'ok');

const registration = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, remember: false })
});
assert.equal(registration.response.status, 201, JSON.stringify(registration.body));
assert.equal(registration.body.user.email, email);
assert.equal(registration.body.user.provider, 'password');

const duplicate = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, remember: false })
});
assert.equal(duplicate.response.status, 409);

const wrongPassword = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'incorrect-password', remember: false })
});
assert.equal(wrongPassword.response.status, 401);

const login = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password, remember: false })
});
assert.equal(login.response.status, 200, JSON.stringify(login.body));

const me = await request('/api/auth/me', {
  headers: { Authorization: `Bearer ${login.body.token}` }
});
assert.equal(me.response.status, 200);
assert.equal(me.body.email, email);

const logout = await request('/api/auth/logout', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.body.token}` }
});
assert.equal(logout.response.status, 204);

const expired = await request('/api/auth/me', {
  headers: { Authorization: `Bearer ${login.body.token}` }
});
assert.equal(expired.response.status, 401);

console.log(`PASS: Cloudflare 註冊、重複檢查、登入、工作階段與登出均正常（${email}）`);
