from datetime import datetime, timezone
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from backend.tests.test_password_reset_sessions import auth_client  # noqa: F401
from app.models.user_models import User
from app.routes import auth_routes as auth
from app.services.email_service import EmailSendResult


ENDPOINTS = [
    ("/auth/request-password-reset", "password_reset"),
    ("/auth/request-email-confirmation", "email_confirmation"),
]


@pytest.mark.parametrize("endpoint,prefix", ENDPOINTS)
@pytest.mark.parametrize("delivery", ["sent", "failed", "not_configured", "exception"])
def test_recovery_response_hides_account_and_delivery(auth_client, monkeypatch, endpoint, prefix, delivery):
    client, sessions = auth_client
    error = None if delivery == "sent" else "internal provider diagnostic"
    sender = Mock(return_value=EmailSendResult(delivery == "sent", delivery, error))
    if delivery == "exception":
        sender.side_effect = RuntimeError(error)
    monkeypatch.setattr(auth, "send_email", sender)

    known = client.post(endpoint, json={"email": "victim@example.com"})
    unknown = client.post(endpoint, json={"email": "missing@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.content == unknown.content
    assert dict(known.headers) == dict(unknown.headers)
    assert set(known.json()) == {"message"}
    assert "If that account is eligible" in known.json()["message"]
    sender.assert_called_once()
    assert sender.call_args.kwargs["to_email"] == "victim@example.com"

    with sessions() as db:
        user = db.query(User).filter_by(email="victim@example.com").one()
        if delivery == "exception":
            assert getattr(user, f"{prefix}_token_hash") is None
        else:
            assert getattr(user, f"{prefix}_status") == delivery
            assert getattr(user, f"{prefix}_error") == error
            assert getattr(user, f"{prefix}_token_hash")


def test_already_confirmed_account_has_same_response(auth_client, monkeypatch):
    client, sessions = auth_client
    with sessions() as db:
        user = db.query(User).filter_by(email="victim@example.com").one()
        user.email_confirmed_at = datetime.now(timezone.utc)
        db.commit()
    sender = Mock()
    monkeypatch.setattr(auth, "send_email", sender)
    known = client.post("/auth/request-email-confirmation", json={"email": "victim@example.com"})
    unknown = client.post("/auth/request-email-confirmation", json={"email": "missing@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.content == unknown.content
    sender.assert_not_called()


@pytest.mark.parametrize("endpoint,prefix", ENDPOINTS)
def test_account_lookup_and_delivery_start_after_response(auth_client, monkeypatch, endpoint, prefix):
    client, _ = auth_client
    response_complete = False
    lookup = auth.get_user_by_email

    async def app(scope, receive, send):
        async def track_send(message):
            nonlocal response_complete
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                response_complete = True
        await client.app(scope, receive, track_send)

    def checked_lookup(*args):
        assert response_complete
        return lookup(*args)

    def checked_send(**kwargs):
        assert response_complete
        return EmailSendResult(True, "sent")

    lookup_spy = Mock(side_effect=checked_lookup)
    sender = Mock(side_effect=checked_send)
    monkeypatch.setattr(auth, "get_user_by_email", lookup_spy)
    monkeypatch.setattr(auth, "send_email", sender)
    with TestClient(app) as tracked_client:
        assert tracked_client.post(endpoint, json={"email": "victim@example.com"}).status_code == 200
    lookup_spy.assert_called_once()
    sender.assert_called_once()
