const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PASSWORD_ITERATIONS = 100_000;
const SESSION_DAYS = 30;

class ApiError extends Error {
  constructor(status, detail, code = null, headers = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

async function safely(action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ detail: error.message, ...(error.code ? { code: error.code } : {}) }, error.status, error.headers);
    }
    console.error(error);
    return json({ detail: '伺服器暫時無法處理請求' }, 500);
  }
}

function base64Url(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clientAddress(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

async function rateLimitKey(env, scope, subject) {
  if (!env.PASSWORD_PEPPER) throw new ApiError(503, '帳號安全設定尚未完成');
  return sha256(`${env.PASSWORD_PEPPER}:${scope}:${String(subject).toLowerCase()}`);
}

export async function consumeRateLimit(request, env, scope, subject, limit, windowSeconds) {
  const bucketKey = await rateLimitKey(env, scope, subject || clientAddress(request));
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + windowSeconds;
  const row = await env.DB.prepare(`
    INSERT INTO auth_rate_limits (bucket_key, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING attempts, expires_at
  `).bind(bucketKey, expiresAt, now, now).first();
  if (Number(row?.attempts || 0) > limit) {
    const retryAfter = Math.max(1, Number(row.expires_at) - now);
    throw new ApiError(429, '嘗試次數過多，請稍後再試', 'RATE_LIMITED', { 'Retry-After': String(retryAfter) });
  }
}

export async function clearRateLimit(env, scope, subject) {
  const bucketKey = await rateLimitKey(env, scope, subject);
  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE bucket_key = ?').bind(bucketKey).run();
}

async function passwordMaterial(password, pepper) {
  if (!pepper) throw new ApiError(503, '密碼服務尚未完成設定');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(password)));
}

async function derivePassword(password, salt, iterations, pepper) {
  const material = await passwordMaterial(password, pepper);
  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS, pepper);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(hash)}`;
}

export async function verifyPassword(password, encoded, pepper) {
  const [algorithm, iterations, salt, expected] = String(encoded || '').split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !expected) return false;
  const actual = await derivePassword(password, fromBase64Url(salt), Number(iterations), pepper);
  const expectedBytes = fromBase64Url(expected);
  if (actual.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expectedBytes[index];
  return difference === 0;
}

function normalizedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(422, '請輸入有效的電子郵件地址');
  }
  return email;
}

function validPassword(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(422, '密碼長度必須為 8 到 128 個字元');
  }
  return password;
}

async function payload(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, '請求格式不正確');
  }
}

function userResponse(user) {
  return { email: user.email, provider: user.google_sub ? 'google' : 'password' };
}

async function newSession(user, remember) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (remember ? SESSION_DAYS : 1) * 86_400_000);
  return {
    id: crypto.randomUUID(),
    token,
    tokenHash: await sha256(token),
    userId: user.id,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString()
  };
}

function sessionStatement(db, session) {
  return db.prepare(
    'INSERT INTO auth_sessions (id, token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(session.id, session.tokenHash, session.userId, session.expiresAt, session.createdAt);
}

function sessionResponse(user, session) {
  return {
    token: session.token,
    expires_at: session.expiresAt,
    user: userResponse(user)
  };
}

async function currentSession(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new ApiError(401, '請先登入');
  const tokenHash = await sha256(authorization.slice(7));
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.password_hash, u.google_sub
     FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
  ).bind(tokenHash).first();
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    if (row) await env.DB.prepare('DELETE FROM auth_sessions WHERE id = ?').bind(row.session_id).run();
    throw new ApiError(401, '登入已失效');
  }
  return row;
}

function decodeJwtPart(value) {
  return JSON.parse(decoder.decode(fromBase64Url(value)));
}

async function verifyGoogleCredential(credential, clientId) {
  const parts = String(credential || '').split('.');
  if (parts.length !== 3) throw new ApiError(401, '無效的 Google 登入憑證');
  let header;
  let claims;
  try {
    header = decodeJwtPart(parts[0]);
    claims = decodeJwtPart(parts[1]);
  } catch {
    throw new ApiError(401, '無效的 Google 登入憑證');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new ApiError(401, '無效的 Google 登入憑證');

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!response.ok) throw new ApiError(503, '暫時無法驗證 Google 登入');
  const { keys = [] } = await response.json();
  const jwk = keys.find((key) => key.kid === header.kid && key.alg === 'RS256');
  if (!jwk) throw new ApiError(401, '無效的 Google 登入憑證');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    fromBase64Url(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`)
  );
  const issuerValid = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    !verified || !issuerValid || !audience.includes(clientId) ||
    Number(claims.exp) * 1000 <= Date.now() || claims.email_verified !== true ||
    !claims.sub || !claims.email
  ) {
    throw new ApiError(401, '無效的 Google 登入憑證');
  }
  return claims;
}

export function register(request, env) {
  return safely(async () => {
    await consumeRateLimit(request, env, 'register-ip', null, 8, 15 * 60);
    const body = await payload(request);
    const email = normalizedEmail(body.email);
    const password = validPassword(body.password);
    if (password.length < 12) throw new ApiError(422, '新密碼至少需要 12 個字元');
    if (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()) {
      throw new ApiError(409, '此電子郵件已經註冊');
    }
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      password_hash: await hashPassword(password, env.PASSWORD_PEPPER),
      google_sub: null,
      created_at: now
    };
    const session = await newSession(user, Boolean(body.remember));
    try {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, google_sub, created_at) VALUES (?, ?, ?, NULL, ?)'
        ).bind(user.id, user.email, user.password_hash, user.created_at),
        sessionStatement(env.DB, session)
      ]);
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new ApiError(409, '此電子郵件已經註冊');
      throw error;
    }
    return json(sessionResponse(user, session), 201);
  });
}

export function login(request, env) {
  return safely(async () => {
    await consumeRateLimit(request, env, 'login-ip', null, 40, 15 * 60);
    const body = await payload(request);
    const email = normalizedEmail(body.email);
    const password = validPassword(body.password);
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, google_sub FROM users WHERE email = ?'
    ).bind(email).first();
    if (!user || !user.password_hash || !await verifyPassword(password, user.password_hash, env.PASSWORD_PEPPER)) {
      await consumeRateLimit(request, env, 'login-account', email, 8, 15 * 60);
      throw new ApiError(401, '電子郵件或密碼不正確');
    }
    await clearRateLimit(env, 'login-account', email);
    const session = await newSession(user, Boolean(body.remember));
    await sessionStatement(env.DB, session).run();
    return json(sessionResponse(user, session));
  });
}

export function googleLogin(request, env) {
  return safely(async () => {
    await consumeRateLimit(request, env, 'google-ip', null, 30, 15 * 60);
    const body = await payload(request);
    if (!env.GOOGLE_CLIENT_ID) throw new ApiError(503, 'Google 登入尚未設定');
    const claims = await verifyGoogleCredential(body.credential, env.GOOGLE_CLIENT_ID);
    const email = normalizedEmail(claims.email);
    const googleSub = String(claims.sub);
    const result = await env.DB.prepare(
      'SELECT id, email, password_hash, google_sub FROM users WHERE google_sub = ? OR email = ?'
    ).bind(googleSub, email).all();
    const users = result.results || [];
    if (new Set(users.map((user) => user.id)).size > 1) {
      throw new ApiError(409, 'Google 帳號與既有帳號發生衝突');
    }

    let user = users[0];
    const statements = [];
    if (user) {
      if (user.google_sub && user.google_sub !== googleSub) {
        throw new ApiError(409, '此電子郵件已連結其他 Google 帳號');
      }
      if (!user.google_sub) {
        if (!user.password_hash) throw new ApiError(409, '此帳號無法自動連結 Google');
        const linkPassword = String(body.password || '');
        if (!linkPassword || !await verifyPassword(linkPassword, user.password_hash, env.PASSWORD_PEPPER)) {
          await consumeRateLimit(request, env, 'google-link-account', email, 8, 15 * 60);
          throw new ApiError(
            409,
            '這個信箱已有密碼帳號，請輸入原帳號密碼後再次使用 Google 登入以完成連結',
            'LINK_PASSWORD_REQUIRED'
          );
        }
        await clearRateLimit(env, 'google-link-account', email);
        statements.push(env.DB.prepare('UPDATE users SET google_sub = ? WHERE id = ?').bind(googleSub, user.id));
        user = { ...user, google_sub: googleSub };
      }
    } else {
      user = {
        id: crypto.randomUUID(),
        email,
        password_hash: null,
        google_sub: googleSub,
        created_at: new Date().toISOString()
      };
      statements.push(env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, google_sub, created_at) VALUES (?, ?, NULL, ?, ?)'
      ).bind(user.id, user.email, user.google_sub, user.created_at));
    }

    const session = await newSession(user, true);
    statements.push(sessionStatement(env.DB, session));
    await env.DB.batch(statements);
    return json(sessionResponse(user, session));
  });
}

export function me(request, env) {
  return safely(async () => json(userResponse(await currentSession(request, env))));
}

export function logout(request, env) {
  return safely(async () => {
    const session = await currentSession(request, env);
    await env.DB.prepare('DELETE FROM auth_sessions WHERE id = ?').bind(session.session_id).run();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  });
}
