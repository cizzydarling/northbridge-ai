"""Passive readiness diagnostics; never decide health or impose a timeout."""

import json
import logging
import time
from datetime import datetime, timezone


logger = logging.getLogger("northbridge.readiness")
# Do not emit arbitrary class names: application-defined names can contain data.
SAFE_EXCEPTION_CLASSES = {
    "builtins": {"TimeoutError", "RuntimeError", "ValueError", "OSError", "ConnectionError", "PermissionError"},
    "sqlalchemy.exc": {"TimeoutError", "OperationalError", "InterfaceError", "DBAPIError", "DisconnectionError"},
    "botocore.exceptions": {"ReadTimeoutError", "ConnectTimeoutError", "ClientError", "EndpointConnectionError", "NoCredentialsError"},
    "redis.exceptions": {"TimeoutError", "ConnectionError", "AuthenticationError"},
}
TIMEOUT_CLASSES = {"TimeoutError", "ReadTimeoutError", "ConnectTimeoutError"}


class ProbeTiming:
    def __init__(self):
        self.enqueued = time.perf_counter()
        self.started = None
        self.finished = None
        self.failure_type = None
        self.exception_type = None

    def run(self, check):
        self.started = time.perf_counter()
        try:
            return check()
        except BaseException as exc:
            cls = type(exc)
            safe = cls.__name__ in SAFE_EXCEPTION_CLASSES.get(cls.__module__, ())
            self.exception_type = cls.__name__ if safe else "Exception"
            self.failure_type = "component_timeout" if safe and cls.__name__ in TIMEOUT_CLASSES else "exception"
            if isinstance(exc, PermissionError) or (safe and cls.__name__ == "ClientError"
                    and getattr(exc, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode") in {401, 403}):
                self.failure_type = "permission_denied"
            raise
        finally:
            self.finished = time.perf_counter()

    def diagnostic(self, task, status, now):
        cancelled = task.cancelled()
        pending = not task.done()
        return {
            "status": status,
            # Pending duration is elapsed, not a claim that the operation finished.
            "duration_ms": round(((self.finished or now) - self.started) * 1000, 3) if self.started is not None else 0.0,
            "queue_ms": round(((self.started or now) - self.enqueued) * 1000, 3),
            "task_age_ms": round(((self.finished or now) - self.enqueued) * 1000, 3),
            "execution_state": "cancelled" if cancelled else "queued" if self.started is None else "running" if self.finished is None else "completed",
            "failure_type": None if status == "ok" else "unavailable" if cancelled else "shared_deadline_exhausted" if pending else self.failure_type or "unavailable",
            "exception_type": self.exception_type,
        }


def log_readiness_failure(request_id, started, noc_duration_ms, components, tasks, timings):
    # A logging/handler error must not replace the existing readiness response.
    try:
        now = time.perf_counter()
        diagnostics = {
            "noc": {
                "status": components["noc"],
                "duration_ms": noc_duration_ms,
                "failure_type": None if components["noc"] == "ok" else "not_ready",
            },
        }
        diagnostics.update({name: timings[name].diagnostic(task, components[name], now) for name, task in tasks.items()})
        for name, detail in diagnostics.items():
            detail["required_for_readiness"] = name != "document_storage"
        if "document_storage" in tasks and not tasks["document_storage"].done():
            diagnostics["document_storage"]["failure_type"] = (
                "diagnostic_deadline_exhausted" if now - timings["document_storage"].enqueued >= 1.5 else "probe_pending")
        logger.warning(json.dumps({
            "event": "readiness_failed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "status_code": 503,
            "duration_ms": round((now - started) * 1000, 3),
            "components": diagnostics,
        }, sort_keys=True))
    except Exception:
        pass


def log_storage_transition(request_id, degraded, diagnostic):
    """Only allowlisted diagnostic fields; never provider messages or locators."""
    try:
        log = logger.warning if degraded else logger.info
        log(json.dumps({
            "event": "storage_degraded" if degraded else "storage_recovered",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "affected_feature": "document_upload_download",
            **diagnostic,
        }, sort_keys=True))
    except Exception:
        pass
