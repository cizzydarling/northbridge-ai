"""Launch smoke checks for disclosure and checkout gating.

Run from the repo root with:
    .\.venv\Scripts\python.exe backend\launch_smoke_test.py
"""

import sys
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_launch_smoke")

from fastapi import FastAPI
from fastapi.testclient import TestClient
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
from app.models.client_model import Client  # noqa: E402
from app.models.disclosure_acceptance_model import DisclosureAcceptance  # noqa: E402
from app.models.matter_model import Matter  # noqa: E402
from app.models.user_models import User  # noqa: E402
from app.routes import billing_routes, disclosure_routes  # noqa: E402
from app.routes.auth_routes import get_current_user  # noqa: E402


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
            DisclosureAcceptance.__table__,
            BillingTransaction.__table__,
        ],
    )

    db = SessionLocal()
    db.add(
        User(
            email="launch-smoke@example.com",
            password="not-used",
            role="individual",
            plan="free",
        )
    )
    db.commit()
    db.close()

    app = FastAPI()
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
    client = build_client()

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
