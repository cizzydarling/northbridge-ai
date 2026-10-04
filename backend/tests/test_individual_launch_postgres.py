"""Real Alembic/PostgreSQL rehearsal. Never falls back to DATABASE_URL.

Set TEST_POSTGRES_ADMIN_URL to a disposable loopback PostgreSQL /postgres DB.
Each test creates and drops only a random nbai_rehearsal_* database it owns.
No production snapshots, credentials, or customer data are used.
"""
import os
from pathlib import Path
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.launch_smoke_test  # noqa: F401 -- registers application models
from app.data.db import get_db
from app.models.user_models import User
from app.routes import auth_routes as auth
from app.services import security_controls

ROOT = Path(__file__).resolve().parents[2]
HEAD = "ad2f6801c947"
DEFERRED = set()
TABLES = {"users", "profiles", "clients", "client_documents", "matters", "saved_simulation_scenarios",
          "recommendations", "self_applications", "self_documents", "disclosure_acceptances",
          "generated_documents", "billing_transactions", "promo_codes", "promo_code_redemptions",
          "citizenship_questions", "citizenship_quiz_attempts", "citizenship_answers",
          "language_practice_sessions", "saved_career_jobs", "alembic_version", "households", "household_members", "application_cases", "application_case_members", "beta_feedback"}


def test_revision_graph_from_repository_root():
    result = subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "heads"],
                            cwd=ROOT, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == HEAD + " (head)"
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    revisions = list(ScriptDirectory.from_config(Config(str(ROOT / "backend/alembic.ini"))).walk_revisions())
    assert len(revisions) == 21
    assert all(not revision.is_branch_point and not revision.is_merge_point for revision in revisions)


@pytest.fixture
def pg_database_factory():
    raw = os.environ.get("TEST_POSTGRES_ADMIN_URL")
    if not raw:
        pytest.skip("Set TEST_POSTGRES_ADMIN_URL to an isolated local PostgreSQL cluster")
    admin_url = make_url(raw)
    assert admin_url.get_backend_name() == "postgresql"
    assert admin_url.host in {"localhost", "127.0.0.1", "::1"}
    assert admin_url.database == "postgres"
    admin = sa.create_engine(admin_url, isolation_level="AUTOCOMMIT")
    databases = []
    def create():
        name = "nbai_rehearsal_" + uuid.uuid4().hex
        with admin.connect() as conn:
            conn.exec_driver_sql(f'CREATE DATABASE "{name}"')
        url = admin_url.set(database=name)
        engine = sa.create_engine(url)
        databases.append((name, engine))
        return engine, url
    try:
        yield create
    finally:
        for name, engine in databases:
            engine.dispose()
            with admin.connect() as conn:
                conn.exec_driver_sql(f'DROP DATABASE "{name}" WITH (FORCE)')
        admin.dispose()


@pytest.fixture
def pg_database(pg_database_factory):
    return pg_database_factory()


def migrate(url, target="head", *, success=True, action="upgrade"):
    assert url.host in {"localhost", "127.0.0.1", "::1"}
    assert url.database.startswith("nbai_rehearsal_")
    env = {**os.environ, "DATABASE_URL": url.render_as_string(hide_password=False),
           "APP_ENV": "test", "PYTHONDONTWRITEBYTECODE": "1",
           "OPENAI_API_KEY": "", "RESEND_API_KEY": "", "SMTP_HOST": ""}
    result = subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", action, target],
                            cwd=ROOT, env=env, capture_output=True, text=True, timeout=90)
    if success:
        assert result.returncode == 0, result.stderr
    else:
        assert result.returncode != 0
    return result


def production_shape(engine, url):
    """Historical objects plus inventoried out-of-band DDL; deliberately no create_all.

    DDL below is independent of the reconciliation helpers. Counts mirror the
    inventoried core tables, using synthetic values. Generated docs are populated
    too, to exercise safe adoption more strongly than the empty production table.
    """
    migrate(url, "f6a1b2c3d4e5")
    with engine.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN job_description TEXT")
        conn.exec_driver_sql("ALTER TABLE profiles ADD COLUMN job_duties TEXT")
        conn.exec_driver_sql("""CREATE TABLE generated_documents (
            id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
            document_type VARCHAR NOT NULL, title VARCHAR NOT NULL, language VARCHAR NOT NULL,
            content TEXT NOT NULL, tone VARCHAR, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
        conn.exec_driver_sql("CREATE INDEX ix_generated_documents_id ON generated_documents(id)")
        conn.exec_driver_sql("CREATE INDEX ix_generated_documents_user_id ON generated_documents(user_id)")
        password = auth.hash_password("original-password")
        for i in range(24):
            user_id = conn.execute(sa.text("""INSERT INTO users(email,password,role,plan)
                VALUES (:email,:password,'individual','free') RETURNING id"""),
                {"email": f"fixture{i}@example.invalid", "password": password}).scalar_one()
            conn.execute(sa.text("""INSERT INTO profiles(user_id,job_description,job_duties)
                VALUES (:id,:job,NULL)"""), {"id": user_id, "job": "é Long existing job " * 2000 if i == 0 else None})
            for version in ("v1", "v2"):
                conn.execute(sa.text("""INSERT INTO disclosure_acceptances
                    (user_id,disclosure_type,disclosure_version,accepted_text_snapshot)
                    VALUES (:id,'terms',:version,'Preserve accepted text')"""), {"id": user_id, "version": version})
        for i in range(10):
            conn.exec_driver_sql("INSERT INTO self_applications(user_id,matter_type) VALUES (1,'permanent_residence')")
        for i in range(73):
            conn.execute(sa.text("""INSERT INTO self_documents
                (user_id,matter_type,document_key,document_name,priority,required,completed)
                VALUES (1,'case_777',:key,'Existing document','Required',true,false)"""), {"key": f"document-{i}"})
        conn.exec_driver_sql("""INSERT INTO generated_documents(user_id,document_type,title,language,content)
            VALUES (1,'letter','Existing letter','fr','Contenu à conserver')""")


def rows(engine):
    with engine.connect() as conn:
        result = {}
        for table in ("users", "profiles", "disclosure_acceptances", "self_applications", "self_documents", "generated_documents"):
            result[table] = [dict(row) for row in conn.execute(sa.text(f'SELECT * FROM "{table}" ORDER BY id')).mappings()]
            for row in result[table]:
                row.pop("token_version", None)
                row.pop("application_case_id", None)
        return result


def schema(engine):
    inspector = sa.inspect(engine)
    result = {}
    for table in sorted(inspector.get_table_names()):
        result[table] = {
            "columns": {c["name"]: (str(c["type"]), c["nullable"], c["default"]) for c in inspector.get_columns(table)},
            "pk": inspector.get_pk_constraint(table),
            "fk": sorted(inspector.get_foreign_keys(table), key=lambda v: v["name"]),
            "unique": sorted(inspector.get_unique_constraints(table), key=lambda v: v["name"]),
            "indexes": sorted(inspector.get_indexes(table), key=lambda v: v["name"]),
        }
    return result


def assert_contract(engine):
    inspector = sa.inspect(engine)
    assert set(inspector.get_table_names()) == TABLES
    profiles = {c["name"]: c for c in inspector.get_columns("profiles")}
    assert "client_id" not in profiles
    assert profiles["user_id"]["nullable"] is False
    assert any(c["column_names"] == ["user_id"] for c in inspector.get_unique_constraints("profiles"))
    assert any(c["constrained_columns"] == ["user_id"] and c["referred_table"] == "users"
               for c in inspector.get_foreign_keys("profiles"))
    for name in ("age", "education", "language_score", "experience_years", "has_job_offer",
                 "has_canadian_experience", "studied_in_canada"):
        assert profiles[name]["nullable"]
    for name in ("job_description", "job_duties"):
        assert str(profiles[name]["type"]) == "TEXT"
    users = {c["name"]: c for c in inspector.get_columns("users")}
    assert not users["token_version"]["nullable"]
    assert "first_name" not in users and "last_name" not in users
    assert "updated_at" not in {c["name"] for c in inspector.get_columns("saved_simulation_scenarios")}
    from migration_contract import disclosure_table, generated_table, profile_table, validate_table
    with engine.connect() as conn:
        for table in (disclosure_table(), generated_table(), profile_table()):
            validate_table(conn, table)
        assert conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == HEAD


def test_empty_upgrade_and_repeat(pg_database):
    engine, url = pg_database
    migrate(url)
    assert_contract(engine)
    before = schema(engine)
    migrate(url)
    assert schema(engine) == before
    # Exercise actual constraints, including incomplete onboarding insert.
    with engine.begin() as conn:
        conn.exec_driver_sql("INSERT INTO users(email,password,role,plan) VALUES ('a@invalid','hash','individual','free')")
        conn.exec_driver_sql("INSERT INTO profiles(user_id) VALUES (1)")
        assert conn.exec_driver_sql("SELECT token_version FROM users").scalar_one() == 0
        conn.exec_driver_sql("""INSERT INTO disclosure_acceptances(user_id,disclosure_type,disclosure_version,accepted_text_snapshot)
            VALUES (1,'terms','v1','text')""")
        assert conn.exec_driver_sql("SELECT acceptance_scope FROM disclosure_acceptances").scalar_one() == "global"
    for sql in ("INSERT INTO profiles(user_id) VALUES (1)", "INSERT INTO profiles(user_id) VALUES (NULL)",
                "INSERT INTO profiles(user_id) VALUES (999)"):
        with pytest.raises(sa.exc.IntegrityError), engine.begin() as conn:
            conn.exec_driver_sql(sql)


def test_production_shape_preservation_and_authentication(pg_database, monkeypatch):
    engine, url = pg_database
    production_shape(engine, url)
    before = rows(engine)
    sessions = sessionmaker(bind=engine)
    # Reproduce the code/schema incompatibility locally, not a claim about Render logs.
    with sessions() as db, pytest.raises(sa.exc.ProgrammingError) as error:
        db.query(User).filter(User.email == "fixture0@example.invalid").first()
    assert error.value.orig.pgcode == "42703"
    assert "token_version" in str(error.value.orig)
    migrate(url)
    assert_contract(engine)
    assert rows(engine) == before
    with sessions() as db:
        users = db.query(User).all()
        assert len(users) == 24
        assert all(user.token_version == 0 for user in users)
    expected_schema = schema(engine)
    migrate(url)
    assert schema(engine) == expected_schema
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setattr(security_controls, "_redis_client", None)
    security_controls.reset_local_rate_limits()
    monkeypatch.setattr(auth, "SessionLocal", sessions)
    app = FastAPI()
    app.include_router(auth.router)
    def get_test_db():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app, raise_server_exceptions=False) as client:
        def login(password="original-password", email="fixture0@example.invalid"):
            return client.post("/auth/login", data={"username": email, "password": password})
        assert login("wrong-password").status_code == 401
        assert login(email="missing@example.invalid").status_code == 401
        response = login()
        assert response.status_code == 200, response.text
        old = {"Authorization": "Bearer " + response.json()["access_token"]}
        assert client.get("/auth/me", headers=old).status_code == 200
        reset_token = "synthetic-reset-token"
        with sessions() as db:
            user = db.query(User).filter_by(email="fixture0@example.invalid").one()
            user.password_reset_token_hash = auth._hash_token(reset_token)
            user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
            db.commit()
        assert client.post("/auth/reset-password", json={"token": reset_token, "password": "new-password-2026"}).status_code == 200
        with sessions() as db:
            assert db.query(User).filter_by(email="fixture0@example.invalid").one().token_version == 1
        assert client.get("/auth/me", headers=old).status_code == 401
        assert login().status_code == 401
        fresh = login("new-password-2026")
        assert fresh.status_code == 200
        assert client.get("/auth/me", headers={"Authorization": "Bearer " + fresh.json()["access_token"]}).status_code == 200
    security_controls.reset_local_rate_limits()


@pytest.mark.parametrize("drift", [
    "ALTER TABLE users DROP COLUMN password_reset_token_hash",
    "ALTER TABLE users ADD COLUMN first_name VARCHAR",
    "ALTER TABLE profiles ALTER COLUMN user_id DROP NOT NULL",
    "ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_key",
    "ALTER TABLE profiles ADD COLUMN client_id INTEGER",
    "ALTER TABLE profiles ALTER COLUMN job_duties TYPE VARCHAR(50)",
    "ALTER TABLE disclosure_acceptances ALTER COLUMN acceptance_scope DROP DEFAULT",
    "DROP INDEX ix_disclosure_acceptances_user_id",
    "ALTER TABLE generated_documents ALTER COLUMN content TYPE VARCHAR",
    "ALTER TABLE generated_documents DROP CONSTRAINT generated_documents_user_id_fkey",
    "ALTER TABLE generated_documents ADD COLUMN unexpected INTEGER",
])
def test_incompatible_schema_aborts_atomically(pg_database, drift):
    engine, url = pg_database
    production_shape(engine, url)
    with engine.begin() as conn:
        conn.exec_driver_sql(drift)
    before = rows(engine)
    result = migrate(url, success=False)
    assert "Unsupported schema" in result.stderr
    assert rows(engine) == before
    assert "token_version" not in {c["name"] for c in sa.inspect(engine).get_columns("users")}
    with engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "f6a1b2c3d4e5"


def test_reconciliation_downgrade_refuses_data_loss(pg_database):
    engine, url = pg_database
    production_shape(engine, url)
    migrate(url)
    before = rows(engine)
    result = migrate(url, "da7e2f901c63", action="downgrade", success=False)
    assert "destructive downgrade is not supported" in result.stderr
    assert rows(engine) == before
    assert_contract(engine)


def test_empty_and_production_shape_converge(pg_database_factory):
    fresh, fresh_url = pg_database_factory()
    existing, existing_url = pg_database_factory()
    migrate(fresh_url)
    production_shape(existing, existing_url)
    migrate(existing_url)
    assert schema(fresh) == schema(existing)


def test_metadata_comparison_excludes_only_deferred_features(pg_database, monkeypatch):
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.environment import EnvironmentContext
    engine, url = pg_database
    migrate(url)
    monkeypatch.setenv("DATABASE_URL", url.render_as_string(hide_password=False))
    config = Config(str(ROOT / "backend/alembic.ini"))
    script = ScriptDirectory.from_config(config)
    differences = []
    def compare(revision, context):
        metadata = context.opts["target_metadata"]
        assert TABLES - {"alembic_version"} <= set(metadata.tables)
        differences.extend(compare_metadata(context, metadata))
        return []
    with EnvironmentContext(config, script, fn=compare):
        script.run_env()
    # Existing intentional differences: retained DB defaults and redundant billing
    # unique constraints. No table/column/type/ownership changes are permitted.
    for difference in differences:
        for item in difference if isinstance(difference, list) else [difference]:
            if item[0] == "modify_default":
                assert (item[2], item[3]) in {("promo_codes", "active"), ("promo_codes", "current_uses"),
                                             ("citizenship_questions", "active")}, item
            else:
                assert item[0] == "remove_constraint" and item[1].table.name == "billing_transactions", item
                assert tuple(c.name for c in item[1].columns) in {("stripe_session_id",), ("stripe_invoice_id",)}


def test_repaired_early_downgrades_match_upgrades(pg_database):
    engine, url = pg_database
    migrate(url, "0f98882e3384")
    migrate(url, "base", action="downgrade")
    assert set(sa.inspect(engine).get_table_names()) == {"alembic_version"}
    migrate(url, "7c1f4c9b2a10")
    migrate(url, "0338efb1cafc", action="downgrade")
    assert "disclosure_acceptances" in sa.inspect(engine).get_table_names()
    assert "first_name" not in {c["name"] for c in sa.inspect(engine).get_columns("profiles")}


def test_individual_journey_without_deferred_tables(pg_database, monkeypatch):
    engine, url = pg_database
    migrate(url)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setattr(security_controls, "_redis_client", None)
    security_controls.reset_local_rate_limits()
    from app.main import register_routers
    from app.routes import recommendation_routes
    # External delivery/AI boundaries only; real profile, strategy and DB code.
    monkeypatch.setattr(auth, "_send_email_confirmation", lambda *args: None)
    monkeypatch.setattr(auth, "_send_onboarding_email", lambda *args: None)
    monkeypatch.setattr(recommendation_routes, "generate_ai_strategy", lambda *args: "Synthetic AI response")
    sessions = sessionmaker(bind=engine)
    monkeypatch.setattr(auth, "SessionLocal", sessions)
    def get_test_db():
        with sessions() as db:
            yield db
    app = FastAPI()
    register_routers(app)
    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as client:
        email = "journey@example.com"
        response = client.post("/auth/register", json={"email": email, "password": "journey-password-2026"})
        assert response.status_code == 200, response.text
        response = client.post("/auth/login", data={"username": email, "password": "journey-password-2026"})
        assert response.status_code == 200, response.text
        headers = {"Authorization": "Bearer " + response.json()["access_token"]}
        requirements = client.get("/disclosures/requirements").json()["required_disclosures"]
        for item in requirements:
            response = client.post("/disclosures/accept", headers=headers, json={
                "disclosure_type": item["disclosure_type"], "disclosure_version": item["disclosure_version"],
                "accepted_text_snapshot": "Synthetic acceptance for integration testing"})
            assert response.status_code == 200, response.text
        profile = {"first_name": "Launch", "last_name": "Test", "nationality": "France",
                   "current_country": "France", "current_city": "Paris", "marital_status": "single",
                   "preferred_language": "en", "age": 28, "education": "bachelor", "language_score": 9,
                   "english_language_score": 9, "experience_years": 3, "occupation": "Administrative officer",
                   "noc_code": "13100", "preferred_province": "Ontario"}
        response = client.put("/profiles/me", headers=headers, json=profile)
        assert response.status_code == 200, response.text
        response = client.get("/app/bootstrap", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["profile_complete"]
        for path in ("/self/strategy", "/self/application", "/self-documents/", "/forms/application-types"):
            response = client.get(path, headers=headers)
            assert response.status_code == 200, (path, response.text)
        response = client.post("/recommendations/simulate", headers=headers, json={"language_score": 10})
        assert response.status_code == 404, response.text
        response = client.post("/recommendations/generate", headers=headers)
        assert response.status_code == 404, response.text
        response = client.post("/forms/package/preview", headers=headers, json={"application_type": "express_entry", "language": "en"})
        assert response.status_code == 200, response.text
        case = client.get("/application-cases/context", headers=headers).json()["case"]
        assert client.put(f"/application-cases/{case['id']}", headers=headers, json={"application_type": "study_permit"}).status_code == 200
        response = client.post("/self/workspace", headers=headers, json={"matter_type": "study_permit", "intake": {}})
        assert response.status_code == 200, response.text
        response = client.post("/self-documents/", headers=headers, json={"matter_type": f"case_{case['id']}", "document_key": "saved",
                              "document_name": "Preserved category"})
        assert response.status_code == 200, response.text
        docs = client.get("/self-documents/", headers=headers).json()
        assert any(d["matter_type"] == f"case_{case['id']}" for d in docs)
    assert not DEFERRED.intersection(sa.inspect(engine).get_table_names())
    security_controls.reset_local_rate_limits()
