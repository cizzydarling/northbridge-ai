"""Parity oracle frozen from cd0e858 readiness; all dependencies are local doubles."""

import asyncio
import json
import logging
import time
from contextlib import contextmanager
from unittest.mock import Mock

import httpx
import pytest
from botocore.exceptions import ReadTimeoutError
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app import main
from app.services import readiness_observability as diagnostics
from app.services.observability import observe_request


SECRET = "postgresql://private-user:private-password@private-db/private-data JWT private-token bucket-key"


def before_app(checks, noc=True, runner=run_in_threadpool):
    app = FastAPI()
    app.state.noc_ready = noc
    app.middleware("http")(observe_request)
    readiness_tasks = {}

    @app.get("/health/ready")
    async def readiness():
        components = {"noc": "ok" if app.state.noc_ready else "unavailable"}
        for name, check in checks.items():
            task = readiness_tasks.get(name)
            if task is None or task.done():
                if task is not None and not task.cancelled():
                    task.exception()
                readiness_tasks[name] = asyncio.create_task(runner(check))
        await asyncio.wait(list(readiness_tasks.values()), timeout=2.5)
        for name, task in readiness_tasks.items():
            components[name] = "ok" if task.done() and not task.cancelled() and task.exception() is None else "unavailable"
        ready = all(value == "ok" for value in components.values())
        payload = {"status": "ready" if ready else "not_ready", "components": components}
        if not ready:
            return JSONResponse(status_code=503, content=payload)
        return payload

    return app


def after_app(monkeypatch, checks, noc=True):
    @contextmanager
    def connect():
        yield Mock(execute=lambda *_: checks["database"]())
    monkeypatch.setattr(main, "engine", Mock(connect=connect))
    monkeypatch.setattr(main, "document_storage_healthcheck", checks["document_storage"])
    monkeypatch.setattr(main, "rate_limiter_healthcheck", checks["rate_limiter"])
    app = main.create_app()
    app.state.noc_ready = noc
    return app


async def request(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local-test") as client:
        return await client.get("/health/ready", headers={
            "x-request-id": "private-token-12345678", "authorization": "Bearer private-jwt",
            "cookie": "session=private-cookie",
        })


def events(caplog):
    return [json.loads(r.getMessage()) for r in caplog.records if r.name == "northbridge.readiness"]


@pytest.mark.parametrize("component,error,failure_type", [
    ("database", RuntimeError(SECRET), "exception"),
    ("database", TimeoutError(SECRET), "component_timeout"),
    ("database", PoolTimeoutError(SECRET), "component_timeout"),
    ("document_storage", RuntimeError(SECRET), "exception"),
    ("document_storage", ReadTimeoutError(endpoint_url=SECRET), "component_timeout"),
    ("rate_limiter", RuntimeError(SECRET), "exception"),
    ("noc", None, "not_ready"),
    (None, None, None),
])
def test_failure_classification_secret_safety_and_before_after_parity(monkeypatch, caplog, component, error, failure_type):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    checks = {name: Mock(return_value=None) for name in ("database", "rate_limiter", "document_storage")}
    if error is not None:
        checks[component].side_effect = error
    noc = component != "noc"
    before = before_app(checks, noc)
    after = after_app(monkeypatch, checks, noc)
    async def compare():
        return await asyncio.gather(request(before), request(after))
    old, new = asyncio.run(compare())
    assert (old.status_code, old.json()) == (new.status_code, new.json())
    assert new.status_code == (503 if component else 200)
    recorded = events(caplog)
    if component is None:
        assert recorded == []
        return
    assert len(recorded) == 1
    event = recorded[0]
    assert event["event"] == "readiness_failed" and event["status_code"] == 503
    assert event["timestamp"].endswith("+00:00")
    assert event["duration_ms"] >= 0
    assert event["request_id"] == new.headers["x-request-id"]
    assert len(event["request_id"]) == 32
    assert event["components"][component]["status"] == "unavailable"
    assert event["components"][component]["failure_type"] == failure_type
    assert all(value["duration_ms"] >= 0 for value in event["components"].values())
    assert all(value["status"] == "ok" for name, value in event["components"].items() if name != component)
    text = json.dumps(event) + new.text
    for secret in (SECRET, "private-user", "private-password", "private-token", "private-jwt", "private-cookie", "private-db", "bucket-key"):
        assert secret not in text


@pytest.mark.parametrize("component", ["database", "document_storage"])
def test_slow_dependency_shared_deadline_parity_and_reuse(monkeypatch, caplog, component):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    checks = {name: Mock(return_value=None) for name in ("database", "rate_limiter", "document_storage")}
    checks[component].side_effect = lambda: time.sleep(2.65)
    old_app = before_app(checks)
    new_app = after_app(monkeypatch, checks)
    async def compare():
        started = time.perf_counter()
        old, new = await asyncio.gather(request(old_app), request(new_app))
        # Windows event-loop timers can wake within one clock tick of the target.
        assert 2.4 <= time.perf_counter() - started < 3.5
        assert (old.status_code, old.json()) == (new.status_code, new.json())
        assert new.status_code == 503
        event = events(caplog)[0]
        assert event["components"][component]["failure_type"] == "shared_deadline_exhausted"
        assert event["components"][component]["execution_state"] == "running"
        assert event["components"][component]["duration_ms"] >= 2400
        # Still-running probes must be reused, not canceled/replaced by diagnostics.
        old, new = await asyncio.gather(request(old_app), request(new_app))
        assert (old.status_code, old.json()) == (new.status_code, new.json())
        assert new.status_code == 200
    asyncio.run(compare())
    assert checks[component].call_count == 2  # one for each independent app
    assert len(events(caplog)) == 1


def test_shared_deadline_before_execution(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    checks = {name: Mock() for name in ("database", "rate_limiter", "document_storage")}
    async def compare():
        gate = asyncio.Event()
        async def queued(check, *args):
            await gate.wait()
            return check(*args)
        monkeypatch.setattr(main, "run_in_threadpool", queued)
        old_app = before_app(checks, runner=queued)
        new_app = after_app(monkeypatch, checks)
        try:
            old, new = await asyncio.gather(request(old_app), request(new_app))
            assert (old.status_code, old.json()) == (new.status_code, new.json())
            assert new.status_code == 503
            event = events(caplog)[0]
            for name in checks:
                detail = event["components"][name]
                assert detail["failure_type"] == "shared_deadline_exhausted"
                assert detail["execution_state"] == "queued"
                assert detail["duration_ms"] == 0
                assert detail["queue_ms"] >= 2400
                checks[name].assert_not_called()
        finally:
            gate.set()
            await asyncio.sleep(0)
    asyncio.run(compare())
    assert len(events(caplog)) == 1


def test_log_handler_failure_does_not_change_response(monkeypatch):
    checks = {name: Mock(return_value=None) for name in ("database", "rate_limiter", "document_storage")}
    checks["database"].side_effect = RuntimeError(SECRET)
    monkeypatch.setattr(diagnostics.logger, "warning", Mock(side_effect=RuntimeError("handler failed")))
    response = asyncio.run(request(after_app(monkeypatch, checks)))
    assert response.status_code == 503
    assert response.json()["components"]["database"] == "unavailable"


def test_cancelled_probe_remains_unavailable(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    checks = {name: Mock() for name in ("database", "rate_limiter", "document_storage")}
    async def cancelled(*_):
        raise asyncio.CancelledError()
    monkeypatch.setattr(main, "run_in_threadpool", cancelled)
    async def compare():
        return await asyncio.gather(request(before_app(checks, runner=cancelled)), request(after_app(monkeypatch, checks)))
    old, new = asyncio.run(compare())
    assert (old.status_code, old.json()) == (new.status_code, new.json())
    assert new.status_code == 503
    event = events(caplog)[0]
    for name in checks:
        assert event["components"][name]["execution_state"] == "cancelled"
        assert event["components"][name]["failure_type"] == "unavailable"


def test_unknown_exception_class_name_is_not_logged(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    secret_class = type("private_account_27_secret", (Exception,), {})
    checks = {name: Mock(return_value=None) for name in ("database", "rate_limiter", "document_storage")}
    checks["database"].side_effect = secret_class(SECRET)
    response = asyncio.run(request(after_app(monkeypatch, checks)))
    assert response.status_code == 503
    event = events(caplog)[0]
    assert event["components"]["database"]["exception_type"] == "Exception"
    assert "private" not in json.dumps(event)


def test_configured_redis_ping_failure_is_observable(monkeypatch, caplog):
    from redis.exceptions import TimeoutError as RedisTimeoutError
    from app.services import security_controls
    caplog.set_level(logging.WARNING, logger="northbridge.readiness")
    redis = Mock()
    redis.ping.side_effect = RedisTimeoutError(SECRET)
    monkeypatch.setattr(security_controls, "_get_redis_client", lambda: redis)
    checks = {"database": Mock(), "document_storage": Mock(),
              "rate_limiter": security_controls.rate_limiter_healthcheck}
    response = asyncio.run(request(after_app(monkeypatch, checks)))
    assert response.status_code == 503
    redis.ping.assert_called_once_with()
    detail = events(caplog)[0]["components"]["rate_limiter"]
    assert detail["failure_type"] == "component_timeout"
    assert detail["exception_type"] == "TimeoutError"
    assert SECRET not in json.dumps(events(caplog))


def test_non_readiness_request_id_handling_unchanged():
    app = FastAPI()
    app.middleware("http")(observe_request)
    @app.get("/ordinary-test-route")
    def ordinary():
        return {"ok": True}
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local-test") as client:
            return await client.get("/ordinary-test-route", headers={"x-request-id": "ordinary-correlation-id"})
    response = asyncio.run(check())
    assert response.headers["x-request-id"] == "ordinary-correlation-id"
