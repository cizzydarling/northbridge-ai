"""Exercise the actual launch registry, not a test-only collection of routers."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import backend.launch_smoke_test  # noqa: F401
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.data.db import get_db
from app.routes import auth_routes, billing_routes, disclosure_routes, strategy_routes
from app.services.promo_code_service import redeem_promo_code


@pytest.fixture
def launch_app(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    from app.main import register_routers
    app = FastAPI()
    register_routers(app)
    def no_database():
        raise AssertionError("Disabled feature must not open a database session")
        yield
    app.dependency_overrides[get_db] = no_database
    return app


@pytest.mark.parametrize("path", [
    "/clients/", "/clients/1", "/clients/1/overview", "/clients/1/profile",
    "/client-strategy/1", "/client-strategy/1/report", "/client-simulations/1/run",
    "/clients/1/simulations", "/clients/1/simulations/2", "/clients/1/simulations/compare",
    "/clients/1/simulations/2/report", "/clients/1/simulations/compare/report",
    "/client-documents/1", "/client-documents/1/2", "/client-documents/1/2/upload",
    "/client-documents/1/2/file", "/client-documents/1/matters/2/generate",
    "/clients/1/matters", "/clients/1/matters/2", "/simulation-scenarios/",
    "/simulation-scenarios/2",
])
def test_disabled_routes_never_execute_dependencies(launch_app, path):
    with TestClient(launch_app) as client:
        for headers in ({}, {"Authorization": "Bearer stale-session"}):
            for method in ("GET", "POST", "PUT", "DELETE"):
                assert client.request(method, path, headers=headers, json={}).status_code == 404


@pytest.mark.parametrize("scope", [{"client_id": 1}, {"matter_id": 1}, {"client_id": 1, "matter_id": 1}])
def test_disclosure_scope_rejected_before_query(scope):
    db = Mock()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        disclosure_routes.validate_scope_or_400(db, SimpleNamespace(id=1), scope.get("client_id"), scope.get("matter_id"))
    assert error.value.status_code == 400
    db.query.assert_not_called()


@pytest.mark.parametrize("role", ["individual", "agent", "admin"])
def test_agent_checkout_disabled_before_stripe(launch_app, monkeypatch, role):
    stripe = Mock(side_effect=AssertionError("No Stripe operation permitted"))
    monkeypatch.setattr(billing_routes, "ensure_stripe_configured", stripe)
    launch_app.dependency_overrides[get_db] = lambda: Mock()
    launch_app.dependency_overrides[auth_routes.get_current_user] = lambda: SimpleNamespace(id=1, role=role)
    with TestClient(launch_app) as client:
        assert client.post("/billing/create-checkout-session", json={"plan": "agent_pro"}).status_code == 403
    stripe.assert_not_called()


def test_agent_promo_cannot_be_created_or_redeemed():
    from pydantic import ValidationError
    from fastapi import HTTPException
    with pytest.raises(ValidationError):
        billing_routes.PromoCodeCreateRequest(code="AGENT", access_type="agent_pro")
    with pytest.raises(ValidationError):
        billing_routes.PromoCodeUpdateRequest(access_type="agent_pro")
    db = Mock()
    code = SimpleNamespace(active=True, expires_at=None, current_uses=0, max_uses=None, access_type="agent_pro")
    db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = code
    user = SimpleNamespace(id=1, plan="free")
    with pytest.raises(HTTPException) as error:
        redeem_promo_code(db, user=user, code="AGENT")
    assert error.value.status_code == 400
    assert user.plan == "free" and code.current_uses == 0
    db.commit.assert_not_called()
