import assert from 'node:assert/strict';
import { googleLogin } from '../server/auth.js';

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

const clientId = 'security-test-client-id';
const email = 'existing@example.com';
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
const jwk = await crypto.subtle.exportKey('jwk', publicKey);
jwk.kid = 'security-test-key';
jwk.alg = 'RS256';
const header = base64Url(JSON.stringify({ alg: 'RS256', kid: jwk.kid }));
const claims = base64Url(JSON.stringify({
  iss: 'https://accounts.google.com', aud: clientId, exp: Math.floor(Date.now() / 1000) + 300,
  email_verified: true, sub: 'google-security-test', email
}));
const signature = await crypto.subtle.sign(
  'RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${claims}`)
);
const credential = `${header}.${claims}.${base64Url(signature)}`;

globalThis.fetch = async () => Response.json({ keys: [jwk] });

let linked = false;
const db = {
  prepare(sql) {
    return {
      bind() {
        if (sql.includes('INSERT INTO auth_rate_limits')) {
          return { first: async () => ({ attempts: 1, expires_at: Math.floor(Date.now() / 1000) + 900 }) };
        }
        if (sql.includes('SELECT id, email, password_hash, google_sub FROM users')) {
          return {
            all: async () => ({
              results: [{ id: 'existing-user', email, password_hash: 'pbkdf2_sha256$100000$invalid$invalid', google_sub: null }]
            })
          };
        }
        if (sql.includes('UPDATE users SET google_sub')) linked = true;
        return { run: async () => ({ success: true }) };
      }
    };
  },
  batch: async () => ({ success: true })
};

const response = await googleLogin(new Request('https://example.com/api/auth/google', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
  body: JSON.stringify({ credential })
}), { DB: db, GOOGLE_CLIENT_ID: clientId, PASSWORD_PEPPER: 'security-test-pepper' });

assert.equal(response.status, 409);
assert.equal((await response.json()).code, 'LINK_PASSWORD_REQUIRED');
assert.equal(linked, false);
console.log('PASS: 既有密碼帳號未驗證原密碼時不會自動連結 Google');
