r"""Launch smoke checks for disclosure and checkout gating.

Run from the repo root with:
    .\.venv\Scripts\python.exe backend\launch_smoke_test.py
"""

import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_launch_smoke")

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


from app.data.db import Base, get_db  # noqa: E402
from app.models.billing_transaction_model import BillingTransaction  # noqa: E402
from app.models.client_document_model import ClientDocument  # noqa: E402
from app.models.client_model import Client  # noqa: E402
from app.models.disclosure_acceptance_model import DisclosureAcceptance  # noqa: E402
from app.models.matter_model import Matter  # noqa: E402
from app.models.self_document_model import SelfDocument  # noqa: E402
from app.models.user_models import User  # noqa: E402
from app.routes import (  # noqa: E402
    auth_routes,
    billing_routes,
    client_document_routes,
    disclosure_routes,
    self_document_routes,
)
from app.routes.auth_routes import get_current_user  # noqa: E402
from app.services import document_storage  # noqa: E402
from app.services import observability  # noqa: E402
from app.services import security_controls  # noqa: E402


def build_client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Client.__table__,
            Matter.__table__,
            ClientDocument.__table__,
            SelfDocument.__table__,
            DisclosureAcceptance.__table__,
            BillingTransaction.__table__,
        ],
    )

    db = SessionLocal()
    db.add(
        User(
            email="launch-smoke@example.com",
            password=auth_routes.hash_password("launch-test-password"),
            role="individual",
            plan="free",
            email_confirmed_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(auth_routes.router)
    app.include_router(disclosure_routes.router)
    app.include_router(billing_routes.router)

    def override_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        session = SessionLocal()
        try:
            return (
                session.query(User)
                .filter(User.email == "launch-smoke@example.com")
                .first()
            )
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return TestClient(app)


def main() -> None:
    observed_app = FastAPI()
    observed_app.middleware("http")(observability.observe_request)

    @observed_app.get("/observed/{item_id}")
    def observed_route(item_id: int):
        return {"item_id": item_id}

    observed_client = TestClient(observed_app)
    accepted_request_id = "launch-request-123"
    observed_response = observed_client.get(
        "/observed/1",
        headers={"X-Request-ID": accepted_request_id},
    )
    assert observed_response.status_code == 200
    assert observed_response.headers["x-request-id"] == accepted_request_id
    generated_response = observed_client.get(
        "/observed/2",
        headers={"X-Request-ID": "invalid id with spaces"},
    )
    assert generated_response.status_code == 200
    assert generated_response.headers["x-request-id"] != "invalid id with spaces"
    assert len(generated_response.headers["x-request-id"]) == 32

    try:
        auth_routes.RegisterRequest(
            email="role-test@example.com",
            password="long-enough-password",
            role="admin",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Public registration accepted an elevated role")

    security_controls.reset_local_rate_limits()
    security_controls.enforce_rate_limit(
        "launch_test",
        identifiers=["test-account"],
        limit=2,
        window_seconds=60,
    )
    security_controls.enforce_rate_limit(
        "launch_test",
        identifiers=["test-account"],
        limit=2,
        window_seconds=60,
    )
    try:
        security_controls.enforce_rate_limit(
            "launch_test",
            identifiers=["test-account"],
            limit=2,
            window_seconds=60,
        )
    except HTTPException as exc:
        assert exc.status_code == 429
        assert int(exc.headers["Retry-After"]) > 0
    else:
        raise AssertionError("Rate limiter did not block excess attempts")
    security_controls.reset_local_rate_limits()

    ownership_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    OwnershipSession = sessionmaker(
        bind=ownership_engine,
        autoflush=False,
        autocommit=False,
    )
    Base.metadata.create_all(
        bind=ownership_engine,
        tables=[
            User.__table__,
            Client.__table__,
            Matter.__table__,
            ClientDocument.__table__,
            SelfDocument.__table__,
        ],
    )
    ownership_db = OwnershipSession()
    owner = User(
        email="owner@example.com",
        password="not-used",
        role="agent",
        plan="agent_pro",
    )
    attacker = User(
        email="attacker@example.com",
        password="not-used",
        role="agent",
        plan="agent_pro",
    )
    ownership_db.add_all([owner, attacker])
    ownership_db.flush()
    owned_client = Client(
        owner_user_id=owner.id,
        full_name="Owned Client",
        email="owned-client@example.com",
    )
    ownership_db.add(owned_client)
    ownership_db.flush()
    client_document = ClientDocument(
        client_id=owned_client.id,
        owner_user_id=owner.id,
        document_name="Private client document",
    )
    self_document = SelfDocument(
        user_id=owner.id,
        matter_type="permanent_residence",
        document_key="private-document",
        document_name="Private self document",
    )
    ownership_db.add_all([client_document, self_document])
    ownership_db.commit()
    for lookup in (
        lambda: client_document_routes.get_owned_document_or_404(
            ownership_db,
            owned_client.id,
            client_document.id,
            attacker,
        ),
        lambda: self_document_routes.get_owned_self_document_or_404(
            ownership_db,
            self_document.id,
            attacker.id,
        ),
    ):
        try:
            lookup()
        except HTTPException as exc:
            assert exc.status_code == 404
        else:
            raise AssertionError("Cross-user document access was not blocked")
    ownership_db.close()

    with TemporaryDirectory() as temporary_directory:
        storage_root = Path(temporary_directory)
        with patch.object(document_storage, "LOCAL_UPLOAD_ROOT", storage_root):
            locator = document_storage.store_document(
                b"%PDF-test-document",
                namespace="self_documents/1/1",
                filename_extension=".pdf",
                content_type="application/pdf",
            )
            # New storage locators resolve against LOCAL_UPLOAD_ROOT even when
            # a route's historical upload directory points somewhere else.
            legacy_root = storage_root / "legacy_self_documents"
            assert document_storage.read_document(
                locator,
                legacy_upload_dir=legacy_root,
            ) == b"%PDF-test-document"
            response = document_storage.document_download_response(
                locator,
                filename="launch test.pdf",
                legacy_upload_dir=legacy_root,
            )
            assert response.headers["cache-control"] == "private, no-store"
            assert "attachment" in response.headers["content-disposition"]
            document_storage.delete_document(
                locator,
                legacy_upload_dir=legacy_root,
            )
            assert not Path(locator).exists()

    production_settings = {
        "APP_ENV": "production",
        "SECRET_KEY": "production-test-secret",
        "DATABASE_URL": "postgresql://test/test",
        "FRONTEND_URL": "https://example.com",
        "OPENAI_API_KEY": "test-openai-key",
        "STRIPE_SECRET_KEY": "test-stripe-key",
        "STRIPE_WEBHOOK_SECRET": "test-webhook-key",
        "DOCUMENT_STORAGE_BUCKET": "test-bucket",
        "DOCUMENT_STORAGE_REGION": "ca-central-1",
        "DOCUMENT_STORAGE_BACKEND": "local",
    }
    from app.main import app as production_app
    from app.main import validate_runtime_configuration

    health_client = TestClient(production_app)
    live_response = health_client.get("/health/live")
    assert live_response.status_code == 200, live_response.text
    assert live_response.headers.get("x-request-id")
    with patch("app.main.engine", ownership_engine):
        ready_response = health_client.get("/health/ready")
    assert ready_response.status_code == 200, ready_response.text
    assert ready_response.json()["status"] == "ready"

    with patch.dict(os.environ, production_settings, clear=False):
        os.environ.pop("REDIS_URL", None)
        os.environ.pop("SENTRY_DSN", None)
        try:
            validate_runtime_configuration()
        except RuntimeError as exc:
            assert "must be 's3'" in str(exc)
        else:
            raise AssertionError("Production accepted local document storage")

    client = build_client()

    for _attempt in range(10):
        invalid_login = client.post(
            "/auth/login",
            data={
                "username": "launch-smoke@example.com",
                "password": "wrong-password",
            },
        )
        assert invalid_login.status_code == 401, invalid_login.text
    blocked_login = client.post(
        "/auth/login",
        data={
            "username": "launch-smoke@example.com",
            "password": "wrong-password",
        },
    )
    assert blocked_login.status_code == 429, blocked_login.text
    assert int(blocked_login.headers["retry-after"]) > 0
    security_controls.reset_local_rate_limits()

    requirements = client.get("/disclosures/requirements")
    assert requirements.status_code == 200, requirements.text
    items = requirements.json()["required_disclosures"]
    assert len(items) == 6
    assert all(item["disclosure_version"] == "v3" for item in items)

    status = client.get("/disclosures/status")
    assert status.status_code == 200, status.text
    assert status.json()["accepted"] is False

    blocked = client.post(
        "/billing/create-checkout-session",
        json={"plan": "individual_pro"},
    )
    assert blocked.status_code == 403, blocked.text
    assert blocked.json()["detail"]["code"] == "disclosures_required"

    for item in items:
        accepted = client.post(
            "/disclosures/accept",
            json={
                "disclosure_type": item["disclosure_type"],
                "disclosure_version": item["disclosure_version"],
                "accepted_text_snapshot": "client text must not be trusted",
            },
        )
        assert accepted.status_code == 200, accepted.text
        assert (
            accepted.json()["accepted_text_snapshot"]
            == item["accepted_text_snapshot"]
        )

    final_status = client.get("/disclosures/status")
    assert final_status.status_code == 200, final_status.text
    assert final_status.json()["accepted"] is True

    latest = client.get(
        "/disclosures/latest",
        params={"disclosure_type": items[0]["disclosure_type"]},
    )
    assert latest.status_code == 200, latest.text
    assert latest.json()["disclosure_version"] == "v3"

    print("launch smoke OK")


if __name__ == "__main__":
    main()
