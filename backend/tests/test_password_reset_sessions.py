from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

import pytest
import backend.launch_smoke_test  # noqa: F401 -- shared model/test setup
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.data.db import Base, get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes import auth_routes as auth
from app.services import security_controls


@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setattr(security_controls, "_redis_client", None)
    security_controls.reset_local_rate_limits()
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    sessions = sessionmaker(bind=engine)
    monkeypatch.setattr(auth, "SessionLocal", sessions)
    Base.metadata.create_all(engine, tables=[User.__table__, Profile.__table__])
    with sessions() as db:
        for email in ("victim@example.com", "other@example.com"):
            db.add(User(email=email, password=auth.hash_password("original-password")))
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client, sessions
    engine.dispose()
    security_controls.reset_local_rate_limits()


def login(client, email="victim@example.com", password="original-password"):
    response = client.post("/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def me(client, token):
    return client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})


def prepare_reset(sessions, *, expired=False):
    token = auth._new_token()
    with sessions() as db:
        user = db.query(User).filter_by(email="victim@example.com").one()
        user.password_reset_token_hash = auth._hash_token(token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=-1 if expired else 45
        )
        db.commit()
    return token


def test_reset_revokes_all_old_sessions_and_allows_new_login(auth_client):
    client, sessions = auth_client
    old_tokens = [login(client), login(client)]
    legacy_token = auth.create_access_token({"sub": "victim@example.com"})
    other_token = login(client, email="other@example.com")
    for token in [*old_tokens, legacy_token, other_token]:
        assert me(client, token).status_code == 200

    reset_token = prepare_reset(sessions)
    response = client.post(
        "/auth/reset-password", json={"token": reset_token, "password": "replacement-password"}
    )
    assert response.status_code == 200
    for token in [*old_tokens, legacy_token]:
        assert me(client, token).status_code == 401
    assert me(client, other_token).status_code == 200
    assert client.post("/auth/login", data={
        "username": "victim@example.com", "password": "original-password"
    }).status_code == 401
    fresh_token = login(client, password="replacement-password")
    assert me(client, fresh_token).status_code == 200
    assert client.post("/auth/reset-password", json={
        "token": reset_token, "password": "another-password"
    }).status_code == 400
    assert me(client, fresh_token).status_code == 200

    second_reset = prepare_reset(sessions)
    assert client.post("/auth/reset-password", json={
        "token": second_reset, "password": "another-password"
    }).status_code == 200
    assert me(client, fresh_token).status_code == 401
    assert me(client, login(client, password="another-password")).status_code == 200


@pytest.mark.parametrize("expired", [False, True])
def test_failed_reset_preserves_session_and_password(auth_client, expired):
    client, sessions = auth_client
    token = login(client)
    reset_token = prepare_reset(sessions, expired=expired) if expired else "invalid-token"
    assert client.post("/auth/reset-password", json={
        "token": reset_token, "password": "replacement-password"
    }).status_code == 400
    assert me(client, token).status_code == 200
    assert me(client, login(client)).status_code == 200


def test_reset_during_login_cannot_issue_current_version(auth_client, monkeypatch):
    client, sessions = auth_client
    verify = auth.verify_password

    def reset_after_verification(password, hashed):
        valid = verify(password, hashed)
        with sessions() as db:
            user = db.query(User).filter_by(email="victim@example.com").one()
            user.password = auth.hash_password("replacement-password")
            user.token_version += 1
            db.commit()
        return valid

    monkeypatch.setattr(auth, "verify_password", reset_after_verification)
    stale_token = login(client)
    assert me(client, stale_token).status_code == 401


def test_migration_backfills_existing_users_and_defaults_new_users(monkeypatch):
    path = Path(__file__).resolve().parents[1] / "alembic/versions/da7e2f901c63_add_user_token_version.py"
    spec = importlib.util.spec_from_file_location("token_version_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO users (id) VALUES (1)")
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        connection.exec_driver_sql("INSERT INTO users (id) VALUES (2)")
        assert connection.exec_driver_sql(
            "SELECT token_version FROM users ORDER BY id"
        ).scalars().all() == [0, 0]
        migration.downgrade()
        assert connection.exec_driver_sql("SELECT id FROM users ORDER BY id").scalars().all() == [1, 2]
    engine.dispose()
