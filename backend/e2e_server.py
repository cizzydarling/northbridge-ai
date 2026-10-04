"""Start an isolated backend for browser end-to-end tests."""

import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "e2e-test.sqlite3"

if DATABASE_PATH.exists():
    DATABASE_PATH.unlink()

from testing.isolation import configure_environment, install_network_guard, VIOLATIONS
configure_environment()
install_network_guard()
os.environ["DATABASE_URL"] = f"sqlite:///{DATABASE_PATH.as_posix()}"

import uvicorn  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kwargs):
    return "JSON"

from app.data.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


# These routes exist only in this loopback test entry point, never app.main.
from app.services.security_controls import reset_local_rate_limits
from app.services import immigration_intelligence_service as intelligence

def unavailable_source(_url):
    raise ConnectionError("Synthetic test provider unavailable")
intelligence._retrieve_json = unavailable_source

@app.get("/_test/isolation")
def isolation_status():
    return {"environment": "TEST", "external_attempts": len(VIOLATIONS)}

@app.post("/_test/reset")
def reset_test_limits():
    reset_local_rate_limits()
    VIOLATIONS.clear()
    return {"environment": "TEST"}

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    uvicorn.run(app, host="127.0.0.1", port=8010)
