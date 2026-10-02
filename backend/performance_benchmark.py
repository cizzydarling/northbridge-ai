"""Synthetic local PostgreSQL benchmark; never uses DATABASE_URL as an input.

Run with TEST_POSTGRES_ADMIN_URL pointing to a disposable loopback /postgres DB.
Creates/drops only its own random database. Blocks non-loopback socket connections.
Reports counts/times only, never connection strings, tokens or profile content.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import sqlalchemy as sa
from sqlalchemy.engine import make_url


def working_set_bytes():
    """Optional Windows process working set, sampled without a tracing profiler."""
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in ("peak", "working", "paged_peak", "paged",
                                               "nonpaged_peak", "nonpaged", "pagefile", "pagefile_peak")]
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        return counters.working
    return None


def main():
    url = make_url(os.environ["TEST_POSTGRES_ADMIN_URL"])
    if url.get_backend_name() != "postgresql" or url.host not in {"127.0.0.1", "localhost", "::1"} or url.database != "postgres":
        raise RuntimeError("Requires an explicitly configured disposable loopback PostgreSQL /postgres database")
    root = Path(__file__).resolve().parents[1]
    name = "nbai_perf_" + uuid.uuid4().hex
    admin = sa.create_engine(url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.exec_driver_sql(f'CREATE DATABASE "{name}"')
    engine = None
    try:
        os.environ.update(DATABASE_URL=url.set(database=name).render_as_string(hide_password=False),
                          APP_ENV="test", DB_SSL_MODE="disable", SECRET_KEY="synthetic-performance-only",
                          OPENAI_API_KEY="", JOB_BANK_XML_FEED_URL="", IRCC_PROCESSING_TIME_API_URL="",
                          DOCUMENT_STORAGE_BACKEND="local", REDIS_URL="")
        migration = subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
                                   cwd=root, capture_output=True, text=True, timeout=90)
        if migration.returncode:
            raise RuntimeError("Synthetic benchmark database migration failed")
        original_connect = socket.socket.connect
        def local_connect(sock, address):
            if isinstance(address, tuple) and address[0] not in {"127.0.0.1", "::1", "localhost"}:
                raise RuntimeError("External connection blocked by benchmark")
            return original_connect(sock, address)
        with patch.object(socket.socket, "connect", local_connect):
            from app.main import app
            from app.data.db import engine as application_engine, SessionLocal
            from app.models.user_models import User
            from app.models.profile_model import Profile
            from app.routes.auth_routes import create_access_token
            from app.services.household_service import resolve_application_context
            from app.services.computation_context import computation_scope
            from app.services import noc_service as noc
            from fastapi.testclient import TestClient
            engine = application_engine
            with SessionLocal() as db:
                user = User(email="performance@example.invalid", password="unused", role="individual",
                            plan="individual_premium", subscription_status="active",
                            subscription_current_period_end=datetime.now(timezone.utc) + timedelta(days=1))
                db.add(user)
                db.flush()
                db.add(Profile(user_id=user.id, age=28, education="bachelor", language_score=9,
                               english_language_score=9, experience_years=3, occupation="Administrative officer",
                               noc_code="13100", preferred_province="Ontario", nationality="France",
                               current_country="France", current_city="Paris", marital_status="single"))
                db.commit()
                resolve_application_context(db, user)
            token = create_access_token({"sub": "performance@example.invalid", "token_version": 0})
            queries = []
            @sa.event.listens_for(engine, "before_cursor_execute")
            def count_query(conn, cursor, statement, parameters, context, executemany):
                queries.append(time.perf_counter())
            original_scan = noc._raw_noc_scores
            scans = []
            def timed_scan(*args, **kwargs):
                wall, cpu = time.perf_counter(), time.process_time()
                try:
                    return original_scan(*args, **kwargs)
                finally:
                    scans.append({"wall_s": time.perf_counter()-wall, "cpu_s": time.process_time()-cpu})
            output = {"provider": "OpenAI disabled; external sockets blocked"}
            memory_before = working_set_bytes()
            started = time.perf_counter()
            with patch.object(noc, "_raw_noc_scores", timed_scan), TestClient(app) as client:
                output["startup_preparation_s"] = time.perf_counter()-started
                output["noc_ready"] = app.state.noc_ready
                memory_after = working_set_bytes()
                output["startup_working_set_delta_bytes"] = memory_after-memory_before if memory_after is not None and memory_before is not None else None
                for label, path in [("strategy_first", "/self/strategy"), ("strategy_warm", "/self/strategy"),
                                    ("noc_ready_worker", "/noc/suggest"), ("noc_repeated_input", "/noc/suggest")]:
                    queries.clear()
                    scans.clear()
                    started, cpu = time.perf_counter(), time.process_time()
                    with computation_scope() as stats:
                        headers = {"Authorization": "Bearer " + token}
                        response = client.get(path, headers=headers) if path.startswith("/self") else client.post(
                            path, headers=headers, json={"occupation": "Administrative officer", "language": "en"})
                    if response.status_code != 200:
                        raise RuntimeError(f"Benchmark {label} returned {response.status_code}")
                    output[label] = {"wall_s": time.perf_counter()-started, "cpu_s": time.process_time()-cpu,
                                     "queries": len(queries), "counts": stats.counts, "seconds": stats.seconds,
                                     "scans": list(scans)}
            print(json.dumps(output, indent=2))
    finally:
        if engine is not None:
            engine.dispose()
        with admin.connect() as conn:
            conn.exec_driver_sql(f'DROP DATABASE "{name}"')
        admin.dispose()


if __name__ == "__main__":
    main()
