"""Opt-in first-party analytics through the existing structured-log infrastructure.

No immigration answers, names, emails, document keys, IPs, URLs or free text.
An operator must configure retention/access in the existing log sink before enablement.
AI cost is unknown until measured server-side; unknown is never reported as zero.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date, datetime, timedelta, timezone
import hashlib
import hmac
import json
import logging
import os
from typing import Literal
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger("northbridge.product")
EVENTS = frozenset({"registration", "onboarding_completed", "crs_engaged", "strategy_engaged",
                    "document_created", "document_used", "export_used", "upgrade_interest", "checkout_started",
                    "checkout_conversion", "workspace_return", "ai_usage"})

class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    event: Literal["crs_engaged", "strategy_engaged", "upgrade_interest", "workspace_return"]
    surface: Literal["dashboard", "profile", "strategy", "documents", "forms", "pricing"]


def emit(user_id, event, *, plan="free", idempotency_key=None, tokens=None, cost_microusd=None):
    if event not in EVENTS or type(user_id) is not int or user_id <= 0:
        raise ValueError("Unsupported analytics event")
    if any(v is not None and (type(v) is not int or not 0 <= v <= 1_000_000_000) for v in (tokens, cost_microusd)):
        raise ValueError("Invalid measured usage")
    key = os.environ.get("PRODUCT_ANALYTICS_KEY", "")
    if os.environ.get("PRODUCT_ANALYTICS_ENABLED") != "true" or len(key) < 32:
        return False
    def digest(value):
        return hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()
    record = {"event": event, "day": datetime.now(timezone.utc).date().isoformat(),
              "actor": digest("actor:" + str(user_id)),
              "plan": plan if plan in {"free", "individual_pro", "individual_premium"} else "other"}
    if idempotency_key is not None:
        record["deduplication_id"] = digest(event + ":" + str(idempotency_key))
    if event == "ai_usage":
        record.update(tokens=tokens, cost_microusd=cost_microusd, cost_status="measured" if cost_microusd is not None else "unknown")
    try:
        logger.info(json.dumps(record, sort_keys=True))
    except Exception:
        return False  # Telemetry failure never changes authentication/payment behavior.
    return True


def cohort_summary(records, *, as_of=None, retention_days=30):
    """Offline, bounded export of already allowlisted events; no raw app logs accepted."""
    if len(records) > 20000:
        raise ValueError("Analytics batch exceeds budget")
    as_of = as_of or datetime.now(timezone.utc).date()
    if type(as_of) is not date or type(retention_days) is not int or not 1 <= retention_days <= 30:
        raise ValueError("Invalid bounded retention window")
    earliest = as_of - timedelta(days=retention_days - 1)
    counts, actors, days, seen = {}, {}, {}, set()
    measured_cost = 0
    unknown_cost = 0
    for row in records:
        if not isinstance(row, dict) or row.get("event") not in EVENTS or set(row) - {"event", "day", "actor", "plan", "deduplication_id", "tokens", "cost_microusd", "cost_status"}:
            raise ValueError("Only privacy-filtered events accepted")
        actor, day = row.get("actor"), row.get("day")
        if not isinstance(actor, str) or len(actor) != 64 or any(c not in "0123456789abcdef" for c in actor):
            raise ValueError("Invalid actor digest")
        parsed_day = date.fromisoformat(day)
        if parsed_day.isoformat() != day:
            raise ValueError("Canonical analytics day required")
        if not earliest <= parsed_day <= as_of:
            continue
        if row.get("plan") not in {"free", "individual_pro", "individual_premium", "other"}:
            raise ValueError("Invalid analytics plan")
        if row.get("cost_status") not in {None, "measured", "unknown"}:
            raise ValueError("Invalid cost status")
        for field in ("tokens", "cost_microusd"):
            value = row.get(field)
            if value is not None and (type(value) is not int or not 0 <= value <= 1_000_000_000):
                raise ValueError("Invalid measured usage")
        marker = row.get("deduplication_id")
        if marker is not None and (not isinstance(marker, str) or len(marker) != 64 or any(c not in "0123456789abcdef" for c in marker)):
            raise ValueError("Invalid deduplication digest")
        if marker and marker in seen:
            continue
        if marker:
            seen.add(marker)
        event = row["event"]
        counts[event] = counts.get(event, 0) + 1
        actors.setdefault(event, set()).add(actor)
        days.setdefault(actor, set()).add(day)
        if event == "ai_usage":
            cost = row.get("cost_microusd")
            if cost is None:
                unknown_cost += 1
            elif type(cost) is int and cost >= 0:
                measured_cost += cost
            else:
                raise ValueError("Invalid measured cost")
    return {"events": counts, "unique_accounts": {k: len(v) for k,v in actors.items()},
            "returning_accounts": sum(len(v) > 1 for v in days.values()),
            "measured_ai_cost_microusd": measured_cost, "ai_events_with_unknown_cost": unknown_cost,
            "ai_cost_coverage_complete": unknown_cost == 0 and counts.get("ai_usage", 0) > 0,
            "contribution_margin_available": False,
            "margin_blocker": "Payment fees, revenue and other variable costs require reconciliation"}


_actor = ContextVar("product_analytics_actor", default=None)

@contextmanager
def usage_scope(user_id, plan):
    token = _actor.set((user_id, plan))
    try:
        yield
    finally:
        _actor.reset(token)

def record_provider_usage(usage):
    actor = _actor.get()
    if actor is None:
        return False
    tokens = getattr(usage, "total_tokens", None)
    if type(tokens) is not int or not 0 <= tokens <= 1_000_000_000:
        tokens = None
    return emit(actor[0], "ai_usage", plan=actor[1], tokens=tokens)
