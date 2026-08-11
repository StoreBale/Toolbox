from sqlalchemy import select

from app.models import AuthSession, User


def authorization(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_login_me_and_logout(client, db_session):
    too_short = client.post(
        "/api/auth/register",
        json={"email": "short@example.com", "password": "password1", "remember": False},
    )
    assert too_short.status_code == 422

    registration = client.post(
        "/api/auth/register",
        json={"email": "User@Example.com", "password": "password12345", "remember": True},
    )
    assert registration.status_code == 201
    session = registration.json()
    assert session["user"] == {"email": "user@example.com", "provider": "password"}
    assert session["token"]

    stored_user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    assert stored_user.password_hash != "password12345"
    assert stored_user.password_hash.startswith("$argon2")

    duplicate = client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "another-password", "remember": False},
    )
    assert duplicate.status_code == 409

    wrong = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrong-password", "remember": False},
    )
    assert wrong.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password12345", "remember": False},
    )
    assert login.status_code == 200
    token = login.json()["token"]
    assert client.get("/api/auth/me", headers=authorization(token)).json()["email"] == "user@example.com"
    assert client.post("/api/auth/logout", headers=authorization(token)).status_code == 204
    assert client.get("/api/auth/me", headers=authorization(token)).status_code == 401

    for _ in range(12):
        assert client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "password12345", "remember": True},
        ).status_code == 200
    assert len(list(db_session.scalars(select(AuthSession).where(AuthSession.user_id == stored_user.id)))) == 10


def test_google_registration_and_existing_email_link(client, db_session, monkeypatch):
    client.post(
        "/api/auth/register",
        json={"email": "google@example.com", "password": "password12345", "remember": False},
    )
    monkeypatch.setattr(
        "app.routes.auth.verify_google_credential",
        lambda credential: {"sub": "google-user-123", "email": "google@example.com", "email_verified": True},
    )

    required = client.post("/api/auth/google", json={"credential": "mock-google-credential-value"})
    assert required.status_code == 409

    response = client.post(
        "/api/auth/google",
        json={"credential": "mock-google-credential-value", "password": "password12345"},
    )
    assert response.status_code == 200
    assert response.json()["user"] == {"email": "google@example.com", "provider": "google"}

    users = list(db_session.scalars(select(User).where(User.email == "google@example.com")))
    assert len(users) == 1
    assert users[0].google_sub == "google-user-123"
    assert users[0].password_hash

    password_login = client.post(
        "/api/auth/login",
        json={"email": "google@example.com", "password": "password12345", "remember": False},
    )
    assert password_login.status_code == 200
    assert password_login.json()["user"]["email"] == "google@example.com"


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
