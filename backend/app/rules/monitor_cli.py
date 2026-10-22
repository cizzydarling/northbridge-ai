"""Opt-in local scheduler: no app-startup hook, deployment or automatic migration.

Example (explicit disposable local DB configured): python -m app.rules.monitor_cli
--loop checks due sources once per hour; each pass is bounded to two sources.
Production scheduling, alert delivery and AI analysis are deferred release work.
"""
import argparse
import json
import os
from pathlib import Path
import time


def safe_local_database(url, root):
    # Query parameters can override a parsed host or enable SQLite URI routing.
    if url is None or url.query:
        return False
    if url.get_backend_name() == "postgresql":
        return url.host in {"localhost", "127.0.0.1", "::1"} and (url.database or "").startswith("nbai_")
    if url.get_backend_name() == "sqlite":
        return bool(url.database) and not url.database.startswith("file:") and Path(url.database).resolve().is_relative_to(root) and "sprint2" in Path(url.database).name
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--cadence-json", default="{}")
    args = parser.parse_args()
    from sqlalchemy.engine import make_url
    raw = os.environ.get("DATABASE_URL", "")  # Do not load a dotenv file.
    url = make_url(raw) if raw else None
    if os.environ.get("APP_ENV") not in {"test", "local", "development"} or url is None:
        raise SystemExit("Explicit isolated local environment required; no changes performed")
    if not safe_local_database(url, Path(__file__).resolve().parents[3]):
        raise SystemExit("Disposable local nbai_ PostgreSQL or workspace sprint2 SQLite database required")
    overrides = json.loads(args.cadence_json)
    from app.data.db import SessionLocal
    from app.rules.source_monitor import run_due
    lock = Path(__file__).resolve().parents[3] / ".sprint2-rules-monitor.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SystemExit("Monitor lock exists; inspect the prior process before removing it")
    try:
        os.close(descriptor)
        while True:
            with SessionLocal() as db:
                print(json.dumps(run_due(db, cadence_overrides=overrides)))
            if not args.loop:
                break
            time.sleep(3600)
    finally:
        lock.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
