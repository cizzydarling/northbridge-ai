from fastapi.testclient import TestClient

from backend.tests.test_password_reset_sessions import auth_client  # noqa: F401


def source_client(app, ip):
    # Set the ASGI transport peer, not an untrusted forwarding header.
    async def with_peer(scope, receive, send):
        await app({**scope, "client": (ip, 12345)}, receive, send)

    return TestClient(with_peer)


def attempt(client, email="victim@example.com", password="wrong-password", **kwargs):
    return client.post(
        "/auth/login", data={"username": email, "password": password}, **kwargs
    )


def test_attacker_cannot_lock_account_out_at_another_ip(auth_client):
    client, _ = auth_client
    with source_client(client.app, "198.51.100.1") as attacker:
        for _ in range(10):
            assert attempt(attacker).status_code == 401
        blocked = attempt(attacker)
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) > 0
        # Changing headers cannot manufacture a new source allowance.
        assert attempt(attacker, headers={
            "X-Forwarded-For": "203.0.113.2", "X-Real-IP": "203.0.113.2"
        }).status_code == 429

    with source_client(client.app, "203.0.113.2") as owner:
        response = attempt(owner, password="original-password")
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        assert owner.get("/auth/me", headers={
            "Authorization": f"Bearer {token}"
        }).status_code == 200


def test_source_limit_still_blocks_password_spraying(auth_client):
    client, _ = auth_client
    with source_client(client.app, "198.51.100.1") as attacker:
        for index in range(20):
            assert attempt(attacker, email=f"missing{index}@example.com").status_code == 401
        response = attempt(attacker, email="another@example.com")
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) > 0

    with source_client(client.app, "203.0.113.2") as owner:
        assert attempt(owner, password="original-password").status_code == 200


def test_targeted_limit_does_not_block_other_accounts_at_same_source(auth_client):
    client, _ = auth_client
    for _ in range(10):
        assert attempt(client).status_code == 401
    assert attempt(client).status_code == 429
    assert attempt(client, email="other@example.com", password="original-password").status_code == 200
