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
from testing.official_resource_fixtures import install as install_resource_fixtures
install_resource_fixtures()

@app.get("/_test/isolation")
def isolation_status():
    return {"environment": "TEST", "external_attempts": len(VIOLATIONS)}

@app.post("/_test/reset")
def reset_test_limits():
    reset_local_rate_limits()
    VIOLATIONS.clear()
    return {"environment": "TEST"}

def seed_resource_snapshots(test_engine):
    """Test entry point only: deterministic, idempotent public fixtures.

    Identity checks precede *any* query/write. No production startup imports this
    module; snapshot APIs keep their normal database read/validation path.
    """
    import re
    from sqlalchemy import inspect, select
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import sessionmaker
    from app.models.official_resource_snapshot_model import OfficialResourceSnapshot, OfficialResourceHead
    from app.services import official_resource_snapshots as snapshots
    from app.services import official_resources
    from testing.official_resource_fixtures import synthetic_source

    url = test_engine.url
    if os.environ.get('APP_ENV') != 'test' or url.query:
        raise RuntimeError('Explicit disposable test database required')
    if url.get_backend_name() == 'sqlite':
        safe = bool(url.database) and Path(url.database).resolve() == Path(__file__).resolve().parent / 'e2e-test.sqlite3'
    elif url.get_backend_name() == 'postgresql':
        raw = os.environ.get('TEST_POSTGRES_ADMIN_URL', '')
        admin = make_url(raw) if raw else None
        safe = bool(admin and not admin.query and admin.get_backend_name() == 'postgresql'
                    and admin.database == 'postgres' and admin.host in {'127.0.0.1','localhost','::1'}
                    and url.host == admin.host and url.port == admin.port
                    and re.fullmatch(r'nbai_rehearsal_[a-f0-9]{32}', url.database or ''))
    else:
        safe = False
    if not safe:
        raise RuntimeError('Explicit disposable test database required')
    if not {'official_resource_snapshots','official_resource_heads'} <= set(inspect(test_engine).get_table_names()):
        raise RuntimeError('Initialize disposable snapshot schema first')

    seed_at = datetime(2026, 10, 29, tzinfo=timezone.utc)
    keys = ('dli','processing_en','processing_fr')
    bundles = {key:snapshots.build_bundle(key, {part:synthetic_source(part) for part in snapshots.component_keys(key)}, observed_at=seed_at) for key in keys}
    result = {}
    with test_engine.begin() as connection:
        if url.get_backend_name() == 'sqlite':
            connection.exec_driver_sql('BEGIN')  # physical outer transaction before SAVEPOINTs
        sessions = sessionmaker(bind=connection, join_transaction_mode='create_savepoint')
        with sessions() as db:
            heads = {h.source_id:h.snapshot_id for h in db.scalars(select(OfficialResourceHead))}
            existing = {v.id:v for v in db.scalars(select(OfficialResourceSnapshot))}
            if set(heads) not in (set(),set(keys)) or len(existing) != len(heads):
                raise RuntimeError('Unexpected disposable fixture state')
            for key, identity in heads.items():
                candidate = existing.get(identity)
                manifest, rows = snapshots.validate_bundle(bundles[key], observed_at=seed_at)
                if candidate is None or candidate.envelope != manifest or candidate.records != rows:
                    raise RuntimeError('Unexpected disposable fixture state')
                result[key] = identity
        for key in keys:
            if key not in result:
                with sessions() as db:
                    result[key] = snapshots.promote(db, bundles[key], expected_head=None, observed_at=seed_at)
    # Freeze only the isolated fixture acquisition clock. Real DB reads and
    # snapshot checks still run. Production clocks and source adapters unchanged.
    read_sessions = sessionmaker(bind=test_engine)
    official_resources._snapshot_reader = lambda key:snapshots.read_snapshot(key, session_factory=read_sessions, observed_at=seed_at)
    provider_reader = official_resources._read_source
    def provider_only(key):
        if key in keys or key.startswith('json_'):
            raise RuntimeError('E2E DLI/processing requests must read snapshots')
        return provider_reader(key)
    provider_only.snapshot_fixture_guard = True
    if not getattr(provider_reader, 'snapshot_fixture_guard', False):
        official_resources._read_source = provider_only
    return result


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_resource_snapshots(engine)
    uvicorn.run(app, host="127.0.0.1", port=8010)
