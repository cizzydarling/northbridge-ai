import json
import logging
import os
import re
import time
from uuid import uuid4

from fastapi import Request


logger = logging.getLogger("northbridge.http")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,128}$")


def configure_error_monitoring() -> bool:
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
    except ImportError as exc:
        raise RuntimeError("sentry-sdk is required when SENTRY_DSN is configured.") from exc

    environment = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development"))
    sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        send_default_pii=False,
        traces_sample_rate=max(0.0, min(sample_rate, 1.0)),
    )
    return True


def resolve_request_id(request: Request) -> str:
    candidate = request.headers.get("x-request-id", "").strip()
    if candidate and REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return uuid4().hex


def route_label(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", None) or request.url.path


async def observe_request(request: Request, call_next):
    request_id = resolve_request_id(request)
    request.state.request_id = request_id
    started = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.exception(
            json.dumps(
                {
                    "event": "request_failed",
                    "request_id": request_id,
                    "method": request.method,
                    "route": route_label(request),
                    "duration_ms": duration_ms,
                    "exception_type": type(exc).__name__,
                },
                sort_keys=True,
            )
        )
        try:
            import sentry_sdk

            sentry_sdk.set_tag("request_id", request_id)
            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass
        raise

    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "request_completed",
                "request_id": request_id,
                "method": request.method,
                "route": route_label(request),
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
            sort_keys=True,
        )
    )
    return response
