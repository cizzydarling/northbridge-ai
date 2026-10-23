"""Core readiness policy, original-failure reproducer, and probe isolation."""
import asyncio
import json
import logging
import threading
import time
from contextlib import contextmanager
from unittest.mock import Mock

import anyio
import httpx
import pytest
from botocore.exceptions import ClientError, ReadTimeoutError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from app import main
from app.services import readiness_observability as diagnostics

SECRET = "private-password private-token bucket-key private-document"

@pytest.fixture(autouse=True)
def logger_enabled(monkeypatch):
    monkeypatch.setattr(diagnostics.logger, "disabled", False)


def make_app(monkeypatch, checks=None, noc=True):
    checks = checks or {n: Mock(return_value=None) for n in ("database", "rate_limiter", "document_storage")}
    @contextmanager
    def connect():
        yield Mock(execute=lambda *_: checks["database"]())
    monkeypatch.setattr(main, "engine", Mock(connect=connect))
    monkeypatch.setattr(main, "document_storage_healthcheck", checks["document_storage"])
    monkeypatch.setattr(main, "rate_limiter_healthcheck", checks["rate_limiter"])
    app = main.create_app()
    app.state.noc_ready = noc
    return app, checks


async def request(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local-test") as client:
        return await client.get("/health/ready", headers={"x-request-id": "private-token-12345678", "authorization": "Bearer private-jwt"})


def events(caplog, event):
    return [json.loads(r.getMessage()) for r in caplog.records
            if r.name == "northbridge.readiness" and json.loads(r.getMessage())["event"] == event]


@pytest.mark.parametrize("component,error,classification", [
    ("database", RuntimeError(SECRET), "exception"),
    ("database", TimeoutError(SECRET), "component_timeout"),
    ("database", PoolTimeoutError(SECRET), "component_timeout"),
    ("rate_limiter", RuntimeError(SECRET), "exception"),
    ("noc", None, "not_ready"),
])
def test_required_failures_still_gate_and_are_redacted(monkeypatch, caplog, component, error, classification):
    caplog.set_level(logging.INFO, logger="northbridge.readiness")
    app, checks = make_app(monkeypatch, noc=component != "noc")
    if error is not None: checks[component].side_effect = error
    response = asyncio.run(request(app))
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    event = events(caplog, "readiness_failed")[0]
    assert event["components"][component]["failure_type"] == classification
    assert event["request_id"] == response.headers["x-request-id"]
    assert len(event["request_id"]) == 32
    assert SECRET not in json.dumps(event) + response.text
    assert "private-token" not in json.dumps(event)


@pytest.mark.parametrize("error,classification", [
    (ReadTimeoutError(endpoint_url=SECRET), "component_timeout"),
    (PermissionError(SECRET), "permission_denied"),
    (ClientError({"Error": {"Code": "AccessDenied", "Message": SECRET}, "ResponseMetadata": {"HTTPStatusCode": 403}}, "HeadBucket"), "permission_denied"),
])
def test_original_storage_only_failure_and_new_core_policy(monkeypatch, caplog, error, classification):
    # Frozen old reduction: a storage exception necessarily makes global readiness fail.
    old_components = {"noc": "ok", "database": "ok", "rate_limiter": "ok", "document_storage": "unavailable"}
    assert not all(v == "ok" for v in old_components.values())
    caplog.set_level(logging.INFO, logger="northbridge.readiness")
    app, checks = make_app(monkeypatch)
    checks["document_storage"].side_effect = error
    async def exercise():
        response = await request(app)
        await asyncio.sleep(.05)  # allow completion callback, not a production wait budget
        response = await request(app)
        assert response.status_code == 200
        assert response.json()["features"]["document_storage"]["status"] in {"checking", "degraded"}
        assert response.json()["components"]["document_storage"] == "unavailable"
        await asyncio.sleep(.05)
    asyncio.run(exercise())
    event = events(caplog, "storage_degraded")[0]
    assert event["failure_type"] == classification
    assert event["affected_feature"] == "document_upload_download"
    assert event["duration_ms"] >= 0 and len(event["request_id"]) == 32
    assert not events(caplog, "readiness_failed")
    assert SECRET not in json.dumps(event)


def test_slow_head_concurrent_requests_bounded_and_recovery(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="northbridge.readiness")
    started, release, finished = threading.Event(), threading.Event(), threading.Event()
    thread_ids = set()
    def slow():
        thread_ids.add(threading.get_ident()); started.set()
        try: assert release.wait(4)
        finally: finished.set()
    app, checks = make_app(monkeypatch)
    checks["document_storage"].side_effect = slow
    async def exercise():
        try:
            first = await request(app)
            for _ in range(100):
                if started.is_set(): break
                await asyncio.sleep(.005)
            assert started.is_set()
            # Old behavior awaited storage for2.5s then included it in all(ok).
            # Keep this same HEAD outstanding past that deadline.
            await asyncio.sleep(2.55)
            before = time.perf_counter()
            responses = await asyncio.gather(*(request(app) for _ in range(30)))
            assert time.perf_counter() - before < 1.5  # comfortably within Render5s
            assert first.status_code == 200
            assert all(r.status_code == 200 for r in responses)
            assert all(r.json()["features"]["document_storage"]["status"] == "degraded" for r in responses)
            assert checks["document_storage"].call_count == 1
            assert len(thread_ids) == 1
        finally:
            release.set()
        for _ in range(100):
            if finished.is_set(): break
            await asyncio.sleep(.005)
        await asyncio.sleep(.05)
        checks["document_storage"].side_effect = None
        assert (await request(app)).status_code == 200
    asyncio.run(exercise())
    assert finished.is_set()  # no abandoned blocked worker
    assert len(events(caplog, "storage_degraded")) == 1
    assert len(events(caplog, "storage_recovered")) == 1
    assert not events(caplog, "readiness_failed")


def test_storage_error_then_recovery_not_stale(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="northbridge.readiness")
    app, checks = make_app(monkeypatch)
    checks["document_storage"].side_effect = TimeoutError(SECRET)
    async def exercise():
        assert (await request(app)).status_code == 200
        await asyncio.sleep(.05)
        checks["document_storage"].side_effect = None
        recovered = await request(app)
        assert recovered.status_code == 200
        assert recovered.json()["features"]["document_storage"]["status"] in {"degraded", "healthy"}
        await asyncio.sleep(.05)
    asyncio.run(exercise())
    assert len(events(caplog, "storage_degraded")) == 1
    assert len(events(caplog, "storage_recovered")) == 1


def test_each_request_keeps_its_probe_generation(monkeypatch):
    app, checks = make_app(monkeypatch)
    async def exercise():
        db_done, limiter_release, second_db = asyncio.Event(), asyncio.Event(), asyncio.Event()
        calls = 0
        async def runner(timed_run, check):
            nonlocal calls
            if check == checks["rate_limiter"]:
                await limiter_release.wait()
            else:
                calls += 1
                if calls == 1: db_done.set()
                else:
                    second_db.set()
                    raise RuntimeError("second generation fails")
            return timed_run(check)
        monkeypatch.setattr(main, "run_in_threadpool", runner)
        first = asyncio.create_task(request(app))
        await db_done.wait(); await asyncio.sleep(.02)
        second = asyncio.create_task(request(app))
        await second_db.wait(); limiter_release.set()
        a, b = await asyncio.gather(first, second)
        assert a.status_code == 200
        assert b.status_code == 503
        assert a.json()["components"]["database"] == "ok"
        assert b.json()["components"]["database"] == "unavailable"
    asyncio.run(exercise())


def test_required_shared_deadline_and_no_duplicate_pending_probe(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    app, checks = make_app(monkeypatch)
    async def exercise():
        gate = asyncio.Event(); calls = 0
        async def queued(check, *args):
            nonlocal calls
            calls += 1
            await gate.wait()
        monkeypatch.setattr(main, "run_in_threadpool", queued)
        try:
            start = time.perf_counter()
            responses = await asyncio.gather(*(request(app) for _ in range(8)))
            assert 2.4 < time.perf_counter() - start < 4.5
            assert all(r.status_code == 503 for r in responses)
            assert calls == 2
            event = events(caplog, "readiness_failed")[0]
            for name in ("database", "rate_limiter"):
                assert event["components"][name]["failure_type"] == "shared_deadline_exhausted"
                assert event["components"][name]["execution_state"] == "queued"
        finally:
            gate.set(); await asyncio.sleep(.02)
    asyncio.run(exercise())


def test_storage_does_not_use_default_worker_capacity(monkeypatch):
    app, checks = make_app(monkeypatch)
    async def exercise():
        gate = asyncio.Event()
        limiter = anyio.to_thread.current_default_thread_limiter()
        old = limiter.total_tokens; limiter.total_tokens = 1
        original = main.run_in_threadpool
        async def occupy():
            async with limiter:
                await gate.wait()
        occupied = asyncio.create_task(occupy())
        try:
            await asyncio.sleep(.01)
            r = asyncio.create_task(request(app))
            for _ in range(100):
                if checks["document_storage"].called: break
                await asyncio.sleep(.005)
            checks["document_storage"].assert_called_once()
            gate.set(); await occupied
            assert (await r).status_code == 200
        finally:
            gate.set(); await occupied; limiter.total_tokens = old
    asyncio.run(exercise())


def test_cancelled_required_probe_fails_closed(monkeypatch):
    app, checks = make_app(monkeypatch)
    async def cancelled(*_): raise asyncio.CancelledError()
    monkeypatch.setattr(main, "run_in_threadpool", cancelled)
    assert asyncio.run(request(app)).status_code == 503


def test_unknown_exception_and_log_handler_failure(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="northbridge.readiness")
    app, checks = make_app(monkeypatch)
    checks["database"].side_effect = type("private_account_secret", (Exception,), {})(SECRET)
    assert asyncio.run(request(app)).status_code == 503
    assert events(caplog, "readiness_failed")[0]["components"]["database"]["exception_type"] == "Exception"
    monkeypatch.setattr(diagnostics.logger, "warning", Mock(side_effect=RuntimeError("handler failed")))
    assert asyncio.run(request(app)).status_code == 503


def test_configured_security_redis_failure(monkeypatch, caplog):
    from redis.exceptions import AuthenticationError
    from app.services import security_controls
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    redis = Mock(); redis.ping.side_effect = AuthenticationError(SECRET)
    monkeypatch.setattr(security_controls, "_get_redis_client", lambda: redis)
    checks = {"database": Mock(), "document_storage": Mock(), "rate_limiter": security_controls.rate_limiter_healthcheck}
    app, _ = make_app(monkeypatch, checks)
    assert asyncio.run(request(app)).status_code == 503
    redis.ping.assert_called_once_with()
    assert events(caplog, "readiness_failed")[0]["components"]["rate_limiter"]["exception_type"] == "AuthenticationError"


def test_non_readiness_correlation_unchanged(monkeypatch):
    app, _ = make_app(monkeypatch)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local-test") as c:
            return await c.get('/health/live', headers={'x-request-id':'ordinary-correlation-id'})
    assert asyncio.run(exercise()).headers['x-request-id'] == 'ordinary-correlation-id'


def test_cancelled_request_does_not_abandon_or_duplicate_storage_worker(monkeypatch):
    entered, release, finished = threading.Event(), threading.Event(), threading.Event()
    ids = set()
    def slow():
        ids.add(threading.get_ident()); entered.set()
        try: assert release.wait(5)
        finally: finished.set()
    app, checks = make_app(monkeypatch)
    checks['document_storage'].side_effect = slow
    async def exercise():
        caller = asyncio.create_task(request(app))
        try:
            for _ in range(100):
                if entered.is_set(): break
                await asyncio.sleep(.005)
            assert entered.is_set()
            caller.cancel()
            try: await caller
            except asyncio.CancelledError: pass
            results = await asyncio.gather(*(request(app) for _ in range(12)))
            assert all(r.status_code == 200 for r in results)
            assert checks['document_storage'].call_count == 1
            assert len(ids) == 1
        finally:
            release.set()
        for _ in range(100):
            if finished.is_set(): break
            await asyncio.sleep(.005)
        await asyncio.sleep(.02)
    asyncio.run(exercise())
    assert finished.is_set()
    # AnyIO's worker receives its stop notification when this loop shuts down.
    deadline = time.monotonic() + 1
    while any(t.ident in ids and t.is_alive() for t in threading.enumerate()) and time.monotonic() < deadline:
        time.sleep(.01)
    assert not any(t.ident in ids and t.is_alive() for t in threading.enumerate())
