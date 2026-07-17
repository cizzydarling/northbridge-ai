"""Start an isolated backend for browser end-to-end tests."""

import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "e2e-test.sqlite3"

if DATABASE_PATH.exists():
    DATABASE_PATH.unlink()

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{DATABASE_PATH.as_posix()}"
os.environ.setdefault("SECRET_KEY", "e2e-only-secret-key")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:4173")
os.environ.setdefault("CORS_ORIGINS", "http://127.0.0.1:4173")
os.environ.setdefault("DOCUMENT_STORAGE_BACKEND", "local")
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""

import uvicorn  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kwargs):
    return "JSON"

from app.data.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    uvicorn.run(app, host="127.0.0.1", port=8010)
