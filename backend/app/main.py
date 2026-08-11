import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

if __package__:
    from .config import get_settings
    from .routes.admin import router as admin_router
    from .routes.auth import router as auth_router
    from .schemas import HealthResponse
else:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.config import get_settings
    from app.routes.admin import router as admin_router
    from app.routes.auth import router as auth_router
    from app.schemas import HealthResponse

settings = get_settings()
app = FastAPI(title="Toolbox API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.mount("/admin/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="admin-static")
app.include_router(admin_router)
app.include_router(auth_router)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


if __name__ == "__main__":
    import uvicorn

    backend_dir = Path(__file__).resolve().parents[1]
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=str(backend_dir),
        env_file=backend_dir / ".env",
    )
