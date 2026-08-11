import { verifyPassword } from './auth.js';

const encoder = new TextEncoder();
const COOKIE_NAME = 'toolbox_admin';
const SESSION_SECONDS = 8 * 60 * 60;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(secret, value) {
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(value))));
}

async function validSignature(secret, value, signature) {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(value)
    );
  } catch {
    return false;
  }
}

function cookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? [] : [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
  }));
}

async function createSession(userId, secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const value = `${userId}.${expires}.${nonce}`;
  return `${value}.${await sign(secret, value)}`;
}

async function readSession(request, secret) {
  if (!secret) return null;
  const parts = (cookies(request)[COOKIE_NAME] || '').split('.');
  if (parts.length !== 4) return null;
  const [userId, expires, nonce, signature] = parts;
  const value = `${userId}.${expires}.${nonce}`;
  if (Number(expires) <= Date.now() / 1000 || !await validSignature(secret, value, signature)) return null;
  return { userId, nonce };
}

async function currentAdmin(request, env) {
  const session = await readSession(request, env.ADMIN_SESSION_SECRET);
  if (!session) return null;
  const user = await env.DB.prepare(
    'SELECT id, email FROM users WHERE id = ? AND is_admin = 1'
  ).bind(session.userId).first();
  return user ? { user, nonce: session.nonce } : null;
}

async function csrfToken(secret, nonce) {
  return sign(secret, `csrf:${nonce}`);
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    }
  });
}

function redirect(path, status = 303, headers = {}) {
  return new Response(null, { status, headers: { Location: path, 'Cache-Control': 'no-store', ...headers } });
}

function shell(title, body, adminEmail = '') {
  const sidebar = adminEmail ? `
    <aside class="admin-sidebar">
      <a class="admin-brand" href="/admin"><span class="brand-mark">T</span><span><strong>Toolbox</strong><small>CONTROL CENTER</small></span></a>
      <nav><a class="active" href="/admin">總覽與帳號</a><a href="/api/health">系統狀態</a><a href="/">返回工具箱</a></nav>
      <div class="sidebar-foot">
        <div class="admin-account"><span class="avatar">${escapeHtml(adminEmail[0].toUpperCase())}</span><span><strong>${escapeHtml(adminEmail)}</strong><small>管理員</small></span></div>
        <form method="post" action="/admin/logout"><button class="ghost-button" type="submit">登出</button></form>
      </div>
    </aside>` : '';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Toolbox Admin</title><link rel="stylesheet" href="/admin.css"></head><body class="${adminEmail ? 'dashboard-body' : 'login-body'}">${sidebar}${body}</body></html>`;
}

function loginPage(error = '', unavailable = false) {
  return shell('管理員登入', `
    <main class="login-shell"><section class="login-card">
      <div class="login-brand"><span class="brand-mark">T</span><span>Toolbox</span></div>
      <p class="eyebrow">ADMIN CONSOLE</p><h1>管理後台</h1>
      <p class="login-intro">登入後管理正式環境的帳號與工作階段。</p>
      ${error ? `<p class="form-error" role="alert">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/admin/login" class="login-form">
        <label>管理員電子郵件<input name="email" type="email" autocomplete="username" required></label>
        <label>管理員密碼<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary-button" type="submit" ${unavailable ? 'disabled' : ''}>登入後台</button>
      </form><a class="docs-link" href="/">返回 Toolbox</a>
    </section></main>`);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value));
}

function providerLabel(user) {
  if (user.password_hash && user.google_sub) return ['both', 'Email + Google'];
  if (user.google_sub) return ['google', 'Google'];
  return ['email', '電子郵件'];
}

async function dashboard(request, env, admin) {
  const now = new Date().toISOString();
  const [statsResult, usersResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total_users,
      SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) AS password_users,
      SUM(CASE WHEN google_sub IS NOT NULL THEN 1 ELSE 0 END) AS google_users,
      (SELECT COUNT(*) FROM auth_sessions WHERE expires_at > ?) AS active_sessions FROM users`).bind(now),
    env.DB.prepare(`SELECT u.id, u.email, u.password_hash, u.google_sub, u.is_admin, u.created_at,
      (SELECT COUNT(*) FROM auth_sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS session_count
      FROM users u ORDER BY u.created_at DESC`).bind(now)
  ]);
  const stats = statsResult.results[0] || {};
  const token = await csrfToken(env.ADMIN_SESSION_SECRET, admin.nonce);
  const rows = usersResult.results.map((user) => {
    const [providerClass, provider] = providerLabel(user);
    const revokeDisabled = Number(user.session_count) < 1 ? 'disabled' : '';
    const deleteAction = user.id === admin.user.id ? '<span class="self-label">目前帳號</span>' : `<a class="table-button danger" href="/admin/users/${encodeURIComponent(user.id)}/delete">刪除</a>`;
    return `<tr><td><div class="user-cell"><span class="user-avatar">${escapeHtml(user.email[0].toUpperCase())}</span><span><strong>${escapeHtml(user.email)}${user.is_admin ? ' · 管理員' : ''}</strong><small>${escapeHtml(user.id)}</small></span></div></td><td><span class="provider-badge ${providerClass}">${provider}</span></td><td>${Number(user.session_count)}</td><td>${formatDate(user.created_at)}</td><td><div class="table-actions"><form method="post" action="/admin/users/${encodeURIComponent(user.id)}/revoke"><input type="hidden" name="csrf" value="${token}"><button type="submit" class="table-button" ${revokeDisabled}>撤銷登入</button></form>${deleteAction}</div></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-table">目前沒有帳號</td></tr>';
  const notice = new URL(request.url).searchParams.get('notice');
  return html(shell('後台控制中心', `<main class="admin-main">
    <header class="admin-header"><div><p class="eyebrow">OVERVIEW</p><h1>後台控制中心</h1><p>管理正式 D1 的帳號與登入工作階段。</p></div><span class="status-pill"><i></i> Cloudflare D1 已連線</span></header>
    ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ''}
    <section class="stat-grid"><article><span>使用者總數</span><strong>${Number(stats.total_users || 0)}</strong><small>所有已建立帳號</small></article><article><span>有效登入</span><strong>${Number(stats.active_sessions || 0)}</strong><small>尚未過期的工作階段</small></article><article><span>電子郵件帳號</span><strong>${Number(stats.password_users || 0)}</strong><small>具備密碼登入</small></article><article><span>Google 帳號</span><strong>${Number(stats.google_users || 0)}</strong><small>已連結 Google</small></article></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">USERS</p><h2>帳號管理</h2></div><span>${Number(stats.total_users || 0)} 個帳號</span></div><div class="table-wrap"><table><thead><tr><th>使用者</th><th>登入方式</th><th>有效登入</th><th>建立時間</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  </main>`, admin.user.email));
}

async function login(request, env) {
  if (!env.ADMIN_SESSION_SECRET || !env.PASSWORD_PEPPER) {
    return html(loginPage('後台尚未完成安全設定', true), 503);
  }
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const user = await env.DB.prepare(
    'SELECT id, email, password_hash FROM users WHERE email = ? AND is_admin = 1'
  ).bind(email).first();
  if (!user?.password_hash || !await verifyPassword(password, user.password_hash, env.PASSWORD_PEPPER)) {
    return html(loginPage('帳號或密碼不正確'), 401);
  }
  const session = await createSession(user.id, env.ADMIN_SESSION_SECRET);
  return redirect('/admin', 303, {
    'Set-Cookie': `${COOKIE_NAME}=${session}; Max-Age=${SESSION_SECONDS}; Path=/admin; HttpOnly; Secure; SameSite=Strict`
  });
}

async function validCsrf(request, env, admin) {
  const form = await request.formData();
  const provided = String(form.get('csrf') || '');
  return provided && await validSignature(env.ADMIN_SESSION_SECRET, `csrf:${admin.nonce}`, provided);
}

function validUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleAdmin(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/admin/login' && request.method === 'GET') {
      return await currentAdmin(request, env) ? redirect('/admin', 302) : html(loginPage());
    }
    if (path === '/admin/login' && request.method === 'POST') return login(request, env);
    if (path === '/admin/logout' && request.method === 'POST') {
      return redirect('/admin/login', 303, { 'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/admin; HttpOnly; Secure; SameSite=Strict` });
    }

    const admin = await currentAdmin(request, env);
    if (!admin) return redirect('/admin/login');
    if (path === '/admin' && request.method === 'GET') return dashboard(request, env, admin);

    const match = path.match(/^\/admin\/users\/([^/]+)\/(revoke|delete)$/);
    if (!match || !validUserId(match[1])) return html(shell('找不到頁面', '<main class="admin-main"><section class="panel"><h1>找不到頁面</h1><a href="/admin">返回後台</a></section></main>', admin.user.email), 404);
    const [, userId, action] = match;
    if (action === 'revoke' && request.method === 'POST') {
      if (!await validCsrf(request, env, admin)) return redirect('/admin?notice=' + encodeURIComponent('操作驗證失敗'));
      await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId).run();
      return redirect('/admin?notice=' + encodeURIComponent('已撤銷此帳號的所有登入'));
    }
    if (action === 'delete' && request.method === 'GET') {
      if (userId === admin.user.id) return redirect('/admin?notice=' + encodeURIComponent('不能刪除目前登入的管理員'));
      const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
      if (!user) return redirect('/admin?notice=' + encodeURIComponent('找不到此帳號'));
      const token = await csrfToken(env.ADMIN_SESSION_SECRET, admin.nonce);
      return html(shell('確認刪除', `<main class="admin-main narrow-main"><a class="back-link" href="/admin">← 返回帳號管理</a><section class="panel confirm-panel"><span class="danger-icon">!</span><p class="eyebrow">DANGEROUS ACTION</p><h1>刪除帳號？</h1><p>這會永久刪除 <strong>${escapeHtml(user.email)}</strong> 及其所有登入工作階段，無法復原。</p><div class="confirm-actions"><a class="secondary-button" href="/admin">取消</a><form method="post" action="/admin/users/${encodeURIComponent(user.id)}/delete"><input type="hidden" name="csrf" value="${token}"><button class="danger-button" type="submit">永久刪除帳號</button></form></div></section></main>`, admin.user.email));
    }
    if (action === 'delete' && request.method === 'POST') {
      if (userId === admin.user.id) return redirect('/admin?notice=' + encodeURIComponent('不能刪除目前登入的管理員'));
      if (!await validCsrf(request, env, admin)) return redirect('/admin?notice=' + encodeURIComponent('操作驗證失敗'));
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return redirect('/admin?notice=' + encodeURIComponent('帳號已刪除'));
    }
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  } catch (error) {
    console.error(error);
    return html(shell('後台錯誤', '<main class="login-shell"><section class="login-card"><h1>後台暫時無法使用</h1><p>請稍後再試。</p></section></main>'), 500);
  }
}
