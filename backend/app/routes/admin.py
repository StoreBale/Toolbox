import hashlib
import hmac
import secrets
import time
from datetime import datetime, timezone
from html import escape
from typing import Annotated
from urllib.parse import parse_qs, quote
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import AuthSession, User
from ..security import DUMMY_PASSWORD_HASH, verify_password

router = APIRouter(include_in_schema=False)
settings = get_settings()
DbSession = Annotated[Session, Depends(get_db)]
COOKIE_NAME = "toolbox_admin"
SESSION_SECONDS = 8 * 60 * 60


def page_response(content: str, status_code: int = 200) -> HTMLResponse:
    response = HTMLResponse(content, status_code=status_code)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; style-src 'self'; img-src 'self'; "
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    )
    return response


def shell(title: str, body: str, *, admin_email: str | None = None) -> str:
    account = ""
    if admin_email:
        account = f"""
          <div class="admin-account">
            <span class="avatar">{escape(admin_email[:1].upper())}</span>
            <span><strong>{escape(admin_email)}</strong><small>管理員</small></span>
          </div>
          <form method="post" action="/admin/logout"><button class="ghost-button" type="submit">登出</button></form>
        """
    return f"""<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title)} · Toolbox Admin</title>
    <link rel="stylesheet" href="/admin/static/admin.css" />
  </head>
  <body class="{'dashboard-body' if admin_email else 'login-body'}">
    {f'''<aside class="admin-sidebar">
      <a class="admin-brand" href="/admin"><span class="brand-mark">T</span><span><strong>Toolbox</strong><small>CONTROL CENTER</small></span></a>
      <nav><a class="active" href="/admin">總覽與帳號</a><a href="/docs">API 文件</a><a href="/api/health">系統狀態</a></nav>
      <div class="sidebar-foot">{account}</div>
    </aside>''' if admin_email else ''}
    {body}
  </body>
</html>"""


def sign_admin_session(user_id: UUID) -> str:
    expires = str(int(time.time()) + SESSION_SECONDS)
    nonce = secrets.token_urlsafe(18)
    payload = f"{user_id}.{expires}.{nonce}"
    signature = hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_admin_session(request: Request) -> tuple[UUID, str] | None:
    if not settings.admin_session_secret:
        return None
    cookie = request.cookies.get(COOKIE_NAME, "")
    try:
        raw_user_id, expires, nonce, signature = cookie.split(".", 3)
        payload = f"{raw_user_id}.{expires}.{nonce}"
        expected = hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if int(expires) <= int(time.time()) or not hmac.compare_digest(signature, expected):
            return None
        return UUID(raw_user_id), nonce
    except (ValueError, TypeError):
        return None


def authenticated_admin(request: Request, db: Session) -> tuple[User, str] | None:
    admin_session = verify_admin_session(request)
    if not admin_session:
        return None
    user_id, nonce = admin_session
    user = db.get(User, user_id)
    if not user or not user.is_admin:
        return None
    return user, nonce


def csrf_token(nonce: str) -> str:
    return hmac.new(settings.admin_session_secret.encode(), f"csrf:{nonce}".encode(), hashlib.sha256).hexdigest()


async def form_data(request: Request) -> dict[str, str]:
    values = parse_qs((await request.body()).decode("utf-8"), keep_blank_values=True)
    return {key: items[-1] for key, items in values.items()}


def login_redirect() -> RedirectResponse:
    return RedirectResponse("/admin/login", status_code=status.HTTP_303_SEE_OTHER)


def login_page(error: str = "") -> str:
    error_html = f'<p class="form-error" role="alert">{escape(error)}</p>' if error else ""
    setup_html = ""
    if not settings.admin_session_secret:
        setup_html = """
          <div class="setup-note"><strong>後台尚未設定</strong><span>請先執行 <code>python scripts/bootstrap_admin.py</code>，再重新啟動後端。</span></div>
        """
    disabled = "disabled" if setup_html else ""
    return shell("管理員登入", f"""
      <main class="login-shell">
        <section class="login-card">
          <div class="login-brand"><span class="brand-mark">T</span><span>Toolbox</span></div>
          <p class="eyebrow">ADMIN CONSOLE</p>
          <h1>管理後台</h1>
          <p class="login-intro">查看帳號與登入狀態，管理 PostgreSQL 中的使用者資料。</p>
          {setup_html}{error_html}
          <form method="post" action="/admin/login" class="login-form">
            <label>管理員電子郵件<input name="email" type="email" autocomplete="username" required /></label>
            <label>管理員密碼<input name="password" type="password" autocomplete="current-password" required /></label>
            <button class="primary-button" type="submit" {disabled}>登入後台</button>
          </form>
          <a class="docs-link" href="/docs">前往 API 文件</a>
        </section>
      </main>
    """)


def format_datetime(value: datetime | None) -> str:
    if not value:
        return "—"
    if not value.tzinfo:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone().strftime("%Y/%m/%d %H:%M")


def dashboard_page(db: Session, admin_user: User, nonce: str, notice: str = "") -> str:
    now = datetime.now(timezone.utc)
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    password_users = db.scalar(select(func.count()).select_from(User).where(User.password_hash.is_not(None))) or 0
    google_users = db.scalar(select(func.count()).select_from(User).where(User.google_sub.is_not(None))) or 0
    active_sessions = db.scalar(
        select(func.count()).select_from(AuthSession).where(AuthSession.expires_at > now)
    ) or 0
    users = list(db.scalars(select(User).order_by(User.created_at.desc())))
    session_counts = dict(
        db.execute(
            select(AuthSession.user_id, func.count(AuthSession.id))
            .where(AuthSession.expires_at > now)
            .group_by(AuthSession.user_id)
        ).all()
    )
    token = csrf_token(nonce)
    rows = "".join(
        f"""
          <tr>
            <td><div class="user-cell"><span class="user-avatar">{escape(user.email[:1].upper())}</span><span><strong>{escape(user.email)}{' · 管理員' if user.is_admin else ''}</strong><small>{escape(str(user.id))}</small></span></div></td>
            <td><span class="provider-badge {'google' if user.google_sub else 'email'}">{'Google' if user.google_sub else '電子郵件'}</span></td>
            <td>{session_counts.get(user.id, 0)}</td>
            <td>{format_datetime(user.created_at)}</td>
            <td><div class="table-actions">
              <form method="post" action="/admin/users/{user.id}/revoke"><input type="hidden" name="csrf" value="{token}" /><button type="submit" class="table-button" {'disabled' if not session_counts.get(user.id, 0) else ''}>撤銷登入</button></form>
              <a class="table-button danger" href="/admin/users/{user.id}/delete">刪除</a>
            </div></td>
          </tr>
        """ for user in users
    ) or '<tr><td colspan="5" class="empty-table">目前還沒有註冊帳號</td></tr>'
    notice_html = f'<div class="notice">{escape(notice)}</div>' if notice else ""
    return shell("控制中心", f"""
      <main class="admin-main">
        <header class="admin-header"><div><p class="eyebrow">OVERVIEW</p><h1>後台控制中心</h1><p>管理帳號、登入工作階段與 API 狀態。</p></div><span class="status-pill"><i></i> PostgreSQL 已連線</span></header>
        {notice_html}
        <section class="stat-grid">
          <article><span>使用者總數</span><strong>{total_users}</strong><small>所有已建立帳號</small></article>
          <article><span>有效登入</span><strong>{active_sessions}</strong><small>尚未過期的工作階段</small></article>
          <article><span>電子郵件帳號</span><strong>{password_users}</strong><small>使用 Argon2 密碼</small></article>
          <article><span>Google 帳號</span><strong>{google_users}</strong><small>已連結 Google 身分</small></article>
        </section>
        <section class="panel">
          <div class="panel-heading"><div><p class="eyebrow">USERS</p><h2>帳號管理</h2></div><span>{total_users} 筆資料</span></div>
          <div class="table-wrap"><table><thead><tr><th>使用者</th><th>登入方式</th><th>有效登入</th><th>建立時間</th><th>操作</th></tr></thead><tbody>{rows}</tbody></table></div>
        </section>
      </main>
    """, admin_email=admin_user.email)


def database_error_page(message: str, admin_email: str | None = None) -> str:
    return shell("資料庫未連線", f"""
      <main class="admin-main">
        <header class="admin-header"><div><p class="eyebrow">SYSTEM</p><h1>後台控制中心</h1><p>管理帳號、登入工作階段與 API 狀態。</p></div><span class="status-pill error"><i></i> PostgreSQL 未連線</span></header>
        <section class="panel error-panel"><h2>無法連接 PostgreSQL</h2><p>請先在專案根目錄執行 <code>docker compose up -d postgres</code>，再重新整理此頁。</p><details><summary>錯誤資訊</summary><pre>{escape(message)}</pre></details></section>
      </main>
    """, admin_email=admin_email)


@router.get("/")
def root() -> RedirectResponse:
    return RedirectResponse("/admin", status_code=status.HTTP_302_FOUND)


@router.get("/admin/login", response_class=HTMLResponse, response_model=None)
def admin_login_page(request: Request, db: DbSession) -> HTMLResponse | RedirectResponse:
    try:
        if authenticated_admin(request, db):
            return RedirectResponse("/admin", status_code=status.HTTP_302_FOUND)
        return page_response(login_page())
    except SQLAlchemyError:
        return page_response(login_page("無法連接 PostgreSQL"), status.HTTP_503_SERVICE_UNAVAILABLE)


@router.post("/admin/login", response_model=None)
async def admin_login(request: Request, db: DbSession) -> HTMLResponse | RedirectResponse:
    data = await form_data(request)
    if not settings.admin_session_secret:
        return page_response(login_page("後台尚未完成設定"), status.HTTP_503_SERVICE_UNAVAILABLE)
    email = data.get("email", "").strip().lower()
    try:
        admin_user = db.scalar(select(User).where(User.email == email, User.is_admin.is_(True)))
    except SQLAlchemyError:
        return page_response(login_page("無法連接 PostgreSQL"), status.HTTP_503_SERVICE_UNAVAILABLE)
    encoded_password = admin_user.password_hash if admin_user and admin_user.password_hash else DUMMY_PASSWORD_HASH
    if not admin_user or not verify_password(data.get("password", ""), encoded_password):
        return page_response(login_page("帳號或密碼不正確"), status.HTTP_401_UNAUTHORIZED)
    response = RedirectResponse("/admin", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        COOKIE_NAME,
        sign_admin_session(admin_user.id),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=settings.admin_cookie_secure,
        samesite="strict",
        path="/admin",
    )
    return response


@router.post("/admin/logout")
def admin_logout() -> RedirectResponse:
    response = RedirectResponse("/admin/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(COOKIE_NAME, path="/admin")
    return response


@router.get("/admin", response_class=HTMLResponse, response_model=None)
def admin_dashboard(request: Request, db: DbSession, notice: str = "") -> HTMLResponse | RedirectResponse:
    try:
        authentication = authenticated_admin(request, db)
        if not authentication:
            return login_redirect()
        admin_user, nonce = authentication
        return page_response(dashboard_page(db, admin_user, nonce, notice))
    except SQLAlchemyError as error:
        return page_response(database_error_page(str(error)), status.HTTP_503_SERVICE_UNAVAILABLE)


@router.post("/admin/users/{user_id}/revoke")
async def revoke_sessions(user_id: UUID, request: Request, db: DbSession) -> RedirectResponse:
    authentication = authenticated_admin(request, db)
    if not authentication:
        return login_redirect()
    _, nonce = authentication
    data = await form_data(request)
    if not secrets.compare_digest(data.get("csrf", ""), csrf_token(nonce)):
        return RedirectResponse("/admin?notice=操作驗證失敗", status_code=status.HTTP_303_SEE_OTHER)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
    db.commit()
    return RedirectResponse("/admin?notice=" + quote("已撤銷此帳號的所有登入"), status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/users/{user_id}/delete", response_class=HTMLResponse, response_model=None)
def confirm_delete(user_id: UUID, request: Request, db: DbSession) -> HTMLResponse | RedirectResponse:
    authentication = authenticated_admin(request, db)
    if not authentication:
        return login_redirect()
    admin_user, nonce = authentication
    if user_id == admin_user.id:
        return RedirectResponse("/admin?notice=" + quote("不能刪除目前登入的管理員"), status_code=status.HTTP_303_SEE_OTHER)
    user = db.get(User, user_id)
    if not user:
        return RedirectResponse("/admin?notice=" + quote("找不到此帳號"), status_code=status.HTTP_303_SEE_OTHER)
    return page_response(shell("確認刪除", f"""
      <main class="admin-main narrow-main">
        <a class="back-link" href="/admin">← 返回帳號管理</a>
        <section class="panel confirm-panel"><span class="danger-icon">!</span><p class="eyebrow">DANGEROUS ACTION</p><h1>刪除帳號？</h1><p>即將永久刪除 <strong>{escape(user.email)}</strong>，包含所有登入工作階段。此操作無法復原。</p>
          <div class="confirm-actions"><a class="secondary-button" href="/admin">取消</a><form method="post" action="/admin/users/{user.id}/delete"><input type="hidden" name="csrf" value="{csrf_token(nonce)}" /><button class="danger-button" type="submit">永久刪除帳號</button></form></div>
        </section>
      </main>
    """, admin_email=admin_user.email))


@router.post("/admin/users/{user_id}/delete")
async def delete_user(user_id: UUID, request: Request, db: DbSession) -> RedirectResponse:
    authentication = authenticated_admin(request, db)
    if not authentication:
        return login_redirect()
    admin_user, nonce = authentication
    if user_id == admin_user.id:
        return RedirectResponse("/admin?notice=" + quote("不能刪除目前登入的管理員"), status_code=status.HTTP_303_SEE_OTHER)
    data = await form_data(request)
    if not secrets.compare_digest(data.get("csrf", ""), csrf_token(nonce)):
        return RedirectResponse("/admin?notice=" + quote("操作驗證失敗"), status_code=status.HTTP_303_SEE_OTHER)
    user = db.get(User, user_id)
    if user:
        db.delete(user)
        db.commit()
    return RedirectResponse("/admin?notice=" + quote("帳號已刪除"), status_code=status.HTTP_303_SEE_OTHER)
