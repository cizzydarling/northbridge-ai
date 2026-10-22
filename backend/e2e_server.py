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
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Literal
from app.data.db import get_db
from app.routes.auth_routes import get_current_user


class SyntheticAccess(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan: Literal["free", "individual_pro"] = "individual_pro"
    admin: bool = False


@app.post("/_test/sprint2-access")
def synthetic_access(body: SyntheticAccess, db=Depends(get_db), user=Depends(get_current_user)):
    # Test entry point only, served exclusively on loopback with isolated DB.
    if not user.email.startswith("sprint2-") or not user.email.endswith("@example.com"):
        raise HTTPException(403, "Synthetic Sprint 2 identity required")
    user.plan = body.plan
    user.role = "admin" if body.admin else "individual"
    user.subscription_status = "active" if body.plan != "free" else None
    user.subscription_current_period_end = datetime.now(timezone.utc) + timedelta(days=30) if body.plan != "free" else None
    db.commit()
    return {"synthetic": True}


@app.post("/_test/sprint2-rules-seed")
def synthetic_rules(db=Depends(get_db), user=Depends(get_current_user)):
    if user.role != "admin" or not user.email.startswith("sprint2-"):
        raise HTTPException(403)
    from app.rules.source_monitor import run_due
    return run_due(db, fetch=lambda _id: b"<main>SYNTHETIC TEST FIXTURE, NOT OFFICIAL EVIDENCE. As of November 3, 2026, a proposed change requires independent review.</main>", limit=1)

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
