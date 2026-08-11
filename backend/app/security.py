import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pwdlib import PasswordHash

from .config import get_settings

password_hash = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hash.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    return password_hash.verify(password, encoded)


def create_session_token(remember: bool) -> tuple[str, str, datetime]:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    days = get_settings().session_days if remember else 1
    expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    return token, token_hash, expires_at


def digest_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_google_credential(credential: str) -> dict:
    client_id = get_settings().google_client_id
    if not client_id:
        raise ValueError("Google 登入尚未設定")
    claims = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    if not claims.get("email_verified"):
        raise ValueError("Google 電子郵件尚未驗證")
    return claims
