import assert from 'node:assert/strict';
import { loginAccount, registerAccount } from '../src/auth.js';

const requests = [];
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  requests.push({ url, body });
  if (url.endsWith('/login') && body.password === 'wrong-password') {
    return new Response(JSON.stringify({ detail: '電子郵件或密碼不正確' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({
    token: 'test-token',
    expires_at: '2026-09-05T00:00:00Z',
    user: { email: body.email.toLowerCase(), provider: 'password' }
  }), { status: url.endsWith('/register') ? 201 : 200, headers: { 'Content-Type': 'application/json' } });
};

const registered = await registerAccount({ email: 'User@Example.com', password: 'password123', remember: true });
assert.equal(registered.user.email, 'user@example.com');
assert.deepEqual(requests[0].body, { email: 'User@Example.com', password: 'password123', remember: true });

await assert.rejects(loginAccount({ email: 'user@example.com', password: 'wrong-password' }), /不正確/);
const loggedIn = await loginAccount({ email: 'user@example.com', password: 'password123' });
assert.equal(loggedIn.token, 'test-token');

console.log('PASS: 前端帳號請求正確連接 Python API 並處理錯誤');
