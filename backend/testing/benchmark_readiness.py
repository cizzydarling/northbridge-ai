"""Isolated before/after benchmark using the exact original backend source.

Run: .venv/Scripts/python.exe backend/testing/benchmark_readiness.py
No providers or production database are contacted. Dependency work is mocked;
the measurement isolates instrumentation overhead, not production I/O latency.
"""

import asyncio
import json
import statistics
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.testing.isolation import configure_environment, install_network_guard

configure_environment()
install_network_guard()

import httpx
from app import main

BASE = "cd0e8585fd8cfaa1a9763e1ea7e647bceb378907"
source = subprocess.run(
    ["git", "show", BASE + ":backend/app/main.py"], cwd=ROOT,
    check=True, capture_output=True, text=True,
).stdout
original = {"__name__": "readiness_baseline", "__file__": str(ROOT / "backend/app/main.py")}
exec(compile(source, "readiness_baseline", "exec"), original)
observability_source = subprocess.run(
    ["git", "show", BASE + ":backend/app/services/observability.py"], cwd=ROOT,
    check=True, capture_output=True, text=True,
).stdout
original_observability = {"__name__": "observability_baseline"}
exec(compile(observability_source, "observability_baseline", "exec"), original_observability)
original["observe_request"] = original_observability["observe_request"]


@contextmanager
def connect():
    yield SimpleNamespace(execute=lambda *_: None)


engine = SimpleNamespace(connect=connect)
original.update(engine=engine, document_storage_healthcheck=lambda: None, rate_limiter_healthcheck=lambda: None)
main.engine = engine
main.document_storage_healthcheck = lambda: None
main.rate_limiter_healthcheck = lambda: None
before = original["create_app"]()
after = main.create_app()
before.state.noc_ready = after.state.noc_ready = True


async def benchmark():
    samples = {"before": [], "after": []}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=before), base_url="http://local-test") as old, \
            httpx.AsyncClient(transport=httpx.ASGITransport(app=after), base_url="http://local-test") as new:
        for client in (old, new):
            for _ in range(30):
                assert (await client.get("/health/ready")).status_code == 200
        # Alternate block order to reduce warmup/drift bias.
        for block in range(8):
            clients = [("before", old), ("after", new)]
            if block % 2:
                clients.reverse()
            for name, client in clients:
                for _ in range(100):
                    started = time.perf_counter()
                    response = await client.get("/health/ready")
                    samples[name].append((time.perf_counter() - started) * 1000)
                    assert response.status_code == 200
                    assert all(value == "ok" for value in response.json()["components"].values())
    old_median = statistics.median(samples["before"])
    new_median = statistics.median(samples["after"])
    assert new_median - old_median < 0.1, "Readiness instrumentation overhead exceeded 0.1 ms"
    print(json.dumps({
        "baseline_sha": BASE,
        "samples_each": len(samples["before"]),
        "healthy_median_before_ms": round(old_median, 4),
        "healthy_median_after_ms": round(new_median, 4),
        "difference_ms": round(new_median - old_median, 4),
        "overhead_limit_ms": 0.1,
        "dependency_mode": "local no-op doubles; no production I/O",
    }, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(benchmark())
