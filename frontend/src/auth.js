import { icon } from './icons.js';

const API_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');
const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '643484536755-cp7l7k4m0hieue03jirkr56j2271gbir.apps.googleusercontent.com';
const TOKEN_KEY = 'toolbox-auth-token';
let currentUser = null;

function getToken() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function clearSession() {
  currentUser = null;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function saveSession(session, remember) {
  clearSession();
  currentUser = session.user;
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, session.token);
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('無法連線到帳號伺服器');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || '帳號服務發生錯誤');
  }
  return response.status === 204 ? null : response.json();
}

export async function initializeAuth() {
  if (!getToken()) return;
  try {
    currentUser = await apiRequest('/auth/me');
  } catch {
    clearSession();
  }
}

export async function registerAccount({ email, password, remember = false }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember })
  });
}

export async function loginAccount({ email, password, remember = false }) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember })
  });
}

export async function loginWithGoogle(credential) {
  return apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
}

export function getCurrentUser() {
  return currentUser;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function googleLogo() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" stroke="none" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34a853" stroke="none" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" stroke="none" d="M6.39 13.88A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.29.32-1.88V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.61Z"/><path fill="#ea4335" stroke="none" d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.61C7.18 7.75 9.39 5.99 12 5.99Z"/></svg>';
}

export function accountControlTemplate() {
  const user = getCurrentUser();
  if (user) {
    return `
      <div class="account-summary">
        <span class="account-avatar">${escapeHtml(user.email.charAt(0).toUpperCase())}</span>
        <span class="account-copy"><strong>${user.provider === 'google' ? 'Google 帳號' : '已登入'}</strong><small>${escapeHtml(user.email)}</small></span>
        <button id="logout-button" class="account-icon-button" type="button" aria-label="登出">${icon('logout')}</button>
      </div>`;
  }
  return `
    <button id="login-button" class="login-button" type="button">
      ${icon('user')}<span><strong>登入帳號</strong><small>安全同步你的帳號</small></span>
    </button>`;
}

export function authDialogTemplate() {
  return `
    <dialog id="auth-dialog" class="auth-dialog" aria-labelledby="auth-title">
      <button id="auth-close" class="auth-close" type="button" aria-label="關閉">${icon('close')}</button>
      <div class="auth-brand"><img src="/logo.svg" alt="" /><span>Toolbox</span></div>
      <h2 id="auth-title">歡迎回來</h2>
      <p id="auth-description" class="auth-description">登入你的 Toolbox 帳號</p>
      <div class="auth-tabs" role="tablist" aria-label="帳號操作">
        <button class="active" type="button" role="tab" aria-selected="true" data-auth-mode="login">登入</button>
        <button type="button" role="tab" aria-selected="false" data-auth-mode="register">註冊</button>
      </div>
      <div id="google-auth-container">
        <button id="google-auth-placeholder" class="google-auth-button" type="button">${googleLogo()}使用 Google 繼續</button>
      </div>
      <div class="auth-divider"><span>或使用電子郵件</span></div>
      <form id="auth-form">
        <label class="auth-field">電子郵件<input id="auth-email" type="email" autocomplete="email" required placeholder="name@example.com" /></label>
        <label class="auth-field">密碼<input id="auth-password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required placeholder="至少 8 個字元" /></label>
        <label class="auth-remember"><input id="auth-remember" type="checkbox" /> 在這台裝置保持登入</label>
        <p id="auth-status" class="auth-status" role="status"></p>
        <button id="auth-submit" class="auth-submit" type="submit">登入</button>
      </form>
      <p class="auth-privacy">帳號由 Toolbox 後端驗證；PDF 與圖片仍只在瀏覽器本機處理。</p>
    </dialog>`;
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleIdentity = '';
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
}

async function setupGoogleButton(status) {
  const placeholder = document.querySelector('#google-auth-placeholder');
  if (!GOOGLE_CLIENT_ID) {
    placeholder?.addEventListener('click', () => {
      status.textContent = 'Google 登入尚未設定，請先填入 Google Client ID';
    });
    return;
  }
  try {
    await loadGoogleIdentity();
    const container = document.querySelector('#google-auth-container');
    container.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        status.textContent = '';
        try {
          const session = await loginWithGoogle(credential);
          saveSession(session, true);
          document.querySelector('#auth-dialog')?.close();
          window.dispatchEvent(new CustomEvent('authchange'));
        } catch (error) {
          status.textContent = error.message;
        }
      }
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: Math.min(330, window.innerWidth - 76),
      text: 'continue_with'
    });
  } catch {
    status.textContent = '無法載入 Google 登入服務';
  }
}

export function bindAuth() {
  const dialog = document.querySelector('#auth-dialog');
  const form = document.querySelector('#auth-form');
  const status = document.querySelector('#auth-status');
  const submit = document.querySelector('#auth-submit');
  const password = document.querySelector('#auth-password');
  let mode = 'login';

  document.querySelector('#login-button')?.addEventListener('click', () => {
    dialog.showModal();
    requestAnimationFrame(() => setupGoogleButton(status));
  });
  document.querySelector('#auth-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // 即使伺服器工作階段已失效，也要清除瀏覽器中的權杖。
    }
    clearSession();
    window.dispatchEvent(new CustomEvent('authchange'));
  });

  document.querySelectorAll('[data-auth-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.authMode;
      document.querySelectorAll('[data-auth-mode]').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelector('#auth-title').textContent = mode === 'login' ? '歡迎回來' : '建立帳號';
      document.querySelector('#auth-description').textContent = mode === 'login' ? '登入你的 Toolbox 帳號' : '註冊後可在不同裝置登入';
      submit.textContent = mode === 'login' ? '登入' : '建立帳號';
      password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      status.textContent = '';
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '';
    const remember = document.querySelector('#auth-remember').checked;
    try {
      const credentials = {
        email: document.querySelector('#auth-email').value,
        password: password.value,
        remember
      };
      const session = mode === 'login' ? await loginAccount(credentials) : await registerAccount(credentials);
      saveSession(session, remember);
      dialog.close();
      window.dispatchEvent(new CustomEvent('authchange'));
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}
