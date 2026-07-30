import hashlib
import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from typing import Iterable

from fastapi import HTTPException, Request


logger = logging.getLogger("northbridge.security")
_local_attempts: dict[str, deque[float]] = defaultdict(deque)
_local_lock = threading.Lock()
_redis_client = None


def _environment() -> str:
    return os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "")).strip().lower()


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "").strip()


def _get_redis_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    redis_url = _redis_url()
    if not redis_url:
        return None

    try:
        import redis
    except ImportError as exc:
        raise RuntimeError("redis is required when REDIS_URL is configured.") from exc

    _redis_client = redis.Redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )
    return _redis_client


def privacy_safe_identifier(value: str | None) -> str:
    normalized = str(value or "unknown").strip().lower()
    secret = os.getenv("SECRET_KEY", "local-security-audit-key")
    return hashlib.sha256(f"{secret}:{normalized}".encode("utf-8")).hexdigest()[:20]


def request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _rate_limit_key(scope: str, identifiers: Iterable[str]) -> str:
    parts = [privacy_safe_identifier(value) for value in identifiers]
    return f"nbai:rate:{scope}:{':'.join(parts)}"


def _enforce_local(key: str, *, limit: int, window_seconds: int) -> int:
    now = time.monotonic()
    cutoff = now - window_seconds
    with _local_lock:
        attempts = _local_attempts[key]
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        if len(attempts) >= limit:
            return max(1, int(window_seconds - (now - attempts[0])))
        attempts.append(now)
    return 0


def _enforce_redis(key: str, *, limit: int, window_seconds: int) -> int:
    client = _get_redis_client()
    if client is None:
        return _enforce_local(key, limit=limit, window_seconds=window_seconds)

    try:
        with client.pipeline() as pipeline:
            pipeline.incr(key)
            pipeline.ttl(key)
            count, ttl = pipeline.execute()
        if count == 1 or ttl < 0:
            client.expire(key, window_seconds)
            ttl = window_seconds
        if count > limit:
            return max(1, int(ttl))
        return 0
    except Exception:
        if _environment() in {"prod", "production"}:
            logger.exception("Distributed rate limiter unavailable")
            raise HTTPException(
                status_code=503,
                detail="Security service is temporarily unavailable.",
            )
        logger.warning("Redis rate limiter unavailable; using local fallback", exc_info=True)
        return _enforce_local(key, limit=limit, window_seconds=window_seconds)


def enforce_rate_limit(
    scope: str,
    *,
    identifiers: Iterable[str],
    limit: int,
    window_seconds: int,
) -> None:
    key = _rate_limit_key(scope, identifiers)
    retry_after = _enforce_redis(key, limit=limit, window_seconds=window_seconds)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def log_security_event(
    event: str,
    *,
    request: Request,
    outcome: str,
    account_identifier: str | None = None,
) -> None:
    payload = {
        "event": event,
        "outcome": outcome,
        "ip_id": privacy_safe_identifier(request_ip(request)),
    }
    if account_identifier:
        payload["account_id"] = privacy_safe_identifier(account_identifier)
    logger.info(json.dumps(payload, sort_keys=True))


def reset_local_rate_limits() -> None:
    """Test helper for the process-local development limiter."""
    with _local_lock:
        _local_attempts.clear()


def rate_limiter_healthcheck() -> None:
    client = _get_redis_client()
    if client is not None:
        client.ping()
    # A process-local limiter is the intentional fallback for single-instance
    # deployments. Redis can be added later when the service scales horizontally.
