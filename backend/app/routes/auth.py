from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuthSession, User
from ..schemas import EmailCredentials, GoogleCredentials, SessionResponse, UserResponse
from ..security import (
    DUMMY_PASSWORD_HASH,
    create_session_token,
    digest_token,
    hash_password,
    verify_google_credential,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def user_response(user: User) -> UserResponse:
    return UserResponse(email=user.email, provider="google" if user.google_sub else "password")


def issue_session(db: Session, user: User, remember: bool) -> SessionResponse:
    token, token_hash, expires_at = create_session_token(remember)
    db.add(AuthSession(token_hash=token_hash, user_id=user.id, expires_at=expires_at))
    db.commit()
    return SessionResponse(token=token, expires_at=expires_at, user=user_response(user))


def require_session(credentials: Credentials, db: DbSession) -> AuthSession:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="尚未登入")
    auth_session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == digest_token(credentials.credentials))
    )
    expires_at = auth_session.expires_at if auth_session and auth_session.expires_at.tzinfo else (
        auth_session.expires_at.replace(tzinfo=timezone.utc) if auth_session else None
    )
    if not auth_session or expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登入已失效")
    return auth_session


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: EmailCredentials, db: DbSession) -> SessionResponse:
    email = str(payload.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個電子郵件已經註冊")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個電子郵件已經註冊") from None
    return issue_session(db, user, payload.remember)


@router.post("/login", response_model=SessionResponse)
def login(payload: EmailCredentials, db: DbSession) -> SessionResponse:
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    encoded = user.password_hash if user and user.password_hash else DUMMY_PASSWORD_HASH
    if not verify_password(payload.password, encoded) or not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="電子郵件或密碼不正確")
    return issue_session(db, user, payload.remember)


@router.post("/google", response_model=SessionResponse)
def google_login(payload: GoogleCredentials, db: DbSession) -> SessionResponse:
    try:
        claims = verify_google_credential(payload.credential)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無法驗證 Google 帳號") from None

    email = claims["email"].lower()
    google_sub = claims["sub"]
    user = db.scalar(select(User).where((User.google_sub == google_sub) | (User.email == email)))
    if user:
        if user.google_sub and user.google_sub != google_sub:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="此電子郵件已連結其他 Google 帳號")
        user.google_sub = google_sub
    else:
        user = User(email=email, google_sub=google_sub)
        db.add(user)
    db.flush()
    return issue_session(db, user, True)


@router.get("/me", response_model=UserResponse)
def me(auth_session: Annotated[AuthSession, Depends(require_session)]) -> UserResponse:
    return user_response(auth_session.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(auth_session: Annotated[AuthSession, Depends(require_session)], db: DbSession) -> None:
    db.delete(auth_session)
    db.commit()
