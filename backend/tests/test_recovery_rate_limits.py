import pytest
from fastapi.testclient import TestClient

from backend.tests.test_password_reset_sessions import auth_client  # noqa: F401
from app.services import security_controls as security


@pytest.mark.parametrize("endpoint", ["/auth/reset-password", "/auth/confirm-email"])
def test_rotating_tokens_cannot_bypass_ip_limit(auth_client, endpoint):
    client, _ = auth_client
    for index in range(10):
        response = client.post(endpoint, json={
            "token": f"invalid-{index}", "password": "replacement-password"
        })
        assert response.status_code == 400
    response = client.post(endpoint, json={
        "token": "another-token", "password": "replacement-password"
    })
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0
    # Token rotation does not allocate new tracking buckets either.
    assert len(security._local_attempts) == 1
    with TestClient(client.app, client=("203.0.113.2", 12345)) as other:
        assert other.post(endpoint, json={
            "token": "another-token", "password": "replacement-password"
        }).status_code == 400


def test_confirmation_get_and_post_share_allowance(auth_client):
    client, _ = auth_client
    for index in range(10):
        if index % 2:
            response = client.get("/auth/confirm-email", params={"token": str(index)})
        else:
            response = client.post("/auth/confirm-email", json={"token": str(index)})
        assert response.status_code == 400
    assert client.get("/auth/confirm-email", params={"token": "new"}).status_code == 429
    assert client.post("/auth/confirm-email", json={"token": "newer"}).status_code == 429


@pytest.fixture
def local_clock(monkeypatch):
    security.reset_local_rate_limits()
    now = [100.0]
    monkeypatch.setattr(security.time, "monotonic", lambda: now[0])
    monkeypatch.setattr(security, "LOCAL_RATE_LIMIT_MAX_KEYS", 3)
    monkeypatch.setattr(security, "LOCAL_RATE_LIMIT_CLEANUP_SECONDS", 5)
    yield now
    security.reset_local_rate_limits()


def test_local_capacity_does_not_evict_active_limits(local_clock):
    for key in ("a", "b", "c"):
        assert security._enforce_local(key, limit=1, window_seconds=60) == 0
    for index in range(100):
        assert security._enforce_local(f"churn-{index}", limit=1, window_seconds=60) > 0
    assert set(security._local_attempts) == {"a", "b", "c"}
    assert len(security._local_expirations) == 3
    assert security._enforce_local("a", limit=1, window_seconds=60) > 0


def test_cleanup_reclaims_unvisited_keys_using_their_own_windows(local_clock):
    assert security._enforce_local("short", limit=1, window_seconds=5) == 0
    assert security._enforce_local("long", limit=1, window_seconds=60) == 0
    local_clock[0] = 106.0
    assert security._enforce_local("new", limit=1, window_seconds=5) == 0
    assert set(security._local_attempts) == {"long", "new"}
    assert set(security._local_expirations) == {"long", "new"}
    assert security._enforce_local("long", limit=1, window_seconds=60) > 0
    local_clock[0] = 161.0
    assert security._enforce_local("after-expiry", limit=1, window_seconds=5) == 0
    assert set(security._local_attempts) == {"after-expiry"}


def test_rejected_requests_do_not_extend_expiration(local_clock):
    assert security._enforce_local("a", limit=1, window_seconds=10) == 0
    local_clock[0] = 109.0
    assert security._enforce_local("a", limit=1, window_seconds=10) > 0
    local_clock[0] = 110.0
    assert security._enforce_local("a", limit=1, window_seconds=10) == 0
