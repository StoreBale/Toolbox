import re

from sqlalchemy import select

from app.models import User
from app.routes import admin as admin_routes
from app.security import hash_password


ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "test-admin-password"


def create_admin(db_session) -> User:
    user = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        is_admin=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def login_admin(client, db_session, monkeypatch) -> User:
    admin = db_session.scalar(select(User).where(User.email == ADMIN_EMAIL)) or create_admin(db_session)
    monkeypatch.setattr(admin_routes.settings, "admin_session_secret", "test-session-secret-with-enough-length")
    response = client.post(
        "/admin/login",
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        follow_redirects=False,
    )
    assert response.status_code == 303
    return admin


def csrf_from(html: str) -> str:
    match = re.search(r'name="csrf" value="([^"]+)"', html)
    assert match
    return match.group(1)


def test_root_and_admin_login(client, db_session, monkeypatch):
    assert client.get("/", follow_redirects=False).headers["location"] == "/admin"
    assert client.get("/admin", follow_redirects=False).headers["location"] == "/admin/login"
    assert "管理後台" in client.get("/admin/login").text
    assert client.get("/admin/static/admin.css").status_code == 200

    create_admin(db_session)
    monkeypatch.setattr(admin_routes.settings, "admin_session_secret", "test-session-secret-with-enough-length")
    wrong = client.post("/admin/login", data={"email": ADMIN_EMAIL, "password": "wrong"})
    assert wrong.status_code == 401
    assert "帳號或密碼不正確" in wrong.text

    login_admin(client, db_session, monkeypatch)
    dashboard = client.get("/admin")
    assert dashboard.status_code == 200
    assert "後台控制中心" in dashboard.text
    assert "PostgreSQL 已連線" in dashboard.text
    assert f"{ADMIN_EMAIL} · 管理員" in dashboard.text


def test_normal_user_cannot_log_in_to_admin(client, db_session, monkeypatch):
    db_session.add(User(email="member@example.com", password_hash=hash_password(ADMIN_PASSWORD)))
    db_session.commit()
    monkeypatch.setattr(admin_routes.settings, "admin_session_secret", "test-session-secret-with-enough-length")

    response = client.post(
        "/admin/login",
        data={"email": "member@example.com", "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 401


def test_admin_can_revoke_and_delete_user(client, db_session, monkeypatch):
    registration = client.post(
        "/api/auth/register",
        json={"email": "managed@example.com", "password": "password12345", "remember": True},
    ).json()
    user = db_session.scalar(select(User).where(User.email == "managed@example.com"))
    login_admin(client, db_session, monkeypatch)

    dashboard = client.get("/admin")
    csrf = csrf_from(dashboard.text)
    revoked = client.post(
        f"/admin/users/{user.id}/revoke",
        data={"csrf": csrf},
        follow_redirects=False,
    )
    assert revoked.status_code == 303
    assert client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {registration['token']}"},
    ).status_code == 401

    confirmation = client.get(f"/admin/users/{user.id}/delete")
    assert "永久刪除" in confirmation.text
    deleted = client.post(
        f"/admin/users/{user.id}/delete",
        data={"csrf": csrf_from(confirmation.text)},
        follow_redirects=False,
    )
    assert deleted.status_code == 303
    assert db_session.get(User, user.id) is None


def test_admin_cannot_delete_current_account(client, db_session, monkeypatch):
    admin = login_admin(client, db_session, monkeypatch)
    response = client.get(f"/admin/users/{admin.id}/delete", follow_redirects=False)
    assert response.status_code == 303
    assert db_session.get(User, admin.id) is not None


def test_admin_actions_reject_invalid_csrf(client, db_session, monkeypatch):
    db_session.add(User(email="protected@example.com", password_hash=hash_password("password123")))
    db_session.commit()
    user = db_session.scalar(select(User).where(User.email == "protected@example.com"))
    login_admin(client, db_session, monkeypatch)
    client.post(f"/admin/users/{user.id}/delete", data={"csrf": "invalid"})
    assert db_session.get(User, user.id) is not None
