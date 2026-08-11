import argparse
import secrets
import sys
from getpass import getpass
from pathlib import Path


backend_dir = Path(__file__).resolve().parents[1]
env_path = backend_dir / ".env"
sys.path.insert(0, str(backend_dir))


def read_env() -> tuple[list[str], dict[str, str]]:
    if not env_path.exists():
        return [], {}
    lines = env_path.read_text(encoding="utf-8").splitlines()
    values = {}
    for line in lines:
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return lines, values


def ensure_env(lines: list[str], values: dict[str, str]) -> None:
    if not lines:
        lines.extend(
            [
                "DATABASE_URL=postgresql+psycopg://toolbox:toolbox@localhost:5432/toolbox",
                "FRONTEND_ORIGINS=http://localhost:5173,https://toolbox-a9q.pages.dev",
                "GOOGLE_CLIENT_ID=",
                "SESSION_DAYS=30",
            ]
        )
    if not values.get("ADMIN_SESSION_SECRET"):
        lines.append(f"ADMIN_SESSION_SECRET={secrets.token_urlsafe(48)}")
    if "ADMIN_COOKIE_SECURE" not in values:
        lines.append("ADMIN_COOKIE_SECURE=false")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def remove_legacy_credentials() -> None:
    lines = env_path.read_text(encoding="utf-8").splitlines()
    kept = [line for line in lines if not line.startswith(("ADMIN_USERNAME=", "ADMIN_PASSWORD="))]
    env_path.write_text("\n".join(kept) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="在 PostgreSQL 建立或更新後台管理員")
    parser.add_argument("--email", default="admin@toolbox.local")
    password_group = parser.add_mutually_exclusive_group()
    password_group.add_argument("--password")
    password_group.add_argument("--prompt-password", action="store_true")
    args = parser.parse_args()

    lines, values = read_env()
    legacy_password = values.get("ADMIN_PASSWORD", "")
    prompted_password = getpass("管理員密碼：") if args.prompt_password else ""
    supplied_password = args.password or prompted_password or legacy_password
    if supplied_password and len(supplied_password) < 8:
        raise SystemExit("管理員密碼至少需要 8 個字元")

    ensure_env(lines, values)

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import User
    from app.security import hash_password

    email = args.email.strip().lower()
    generated_password = ""
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email)
            db.add(user)
        if supplied_password:
            user.password_hash = hash_password(supplied_password)
        elif not user.password_hash:
            generated_password = secrets.token_urlsafe(18)
            user.password_hash = hash_password(generated_password)
        user.is_admin = True
        db.commit()

    remove_legacy_credentials()
    print(f"管理員已儲存在 PostgreSQL：{email}")
    if legacy_password:
        print("已沿用原管理員密碼，並從 backend/.env 移除帳號與密碼。")
    elif args.password or args.prompt_password:
        print("已使用指定密碼；backend/.env 不會保存管理員密碼。")
    elif generated_password:
        print(f"初始密碼（僅顯示一次）：{generated_password}")
    else:
        print("已保留資料庫中的現有管理員密碼。")


if __name__ == "__main__":
    main()
