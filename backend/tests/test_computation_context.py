from concurrent.futures import ThreadPoolExecutor
import pytest
from app.services.computation_context import computation_scope, reuse


def test_reuse_detaches_results_and_clears_private_values():
    with computation_scope() as context:
        first = reuse("raw", ("private duties",), lambda: {"matches": [1]})
        first["matches"].clear()
        assert reuse("raw", ("private duties",), lambda: None) == {"matches": [1]}
        assert context.counts == {"raw": 1}
    assert context.values == {}
    with computation_scope() as other:
        assert reuse("raw", ("private duties",), lambda: {"matches": [2]}) == {"matches": [2]}
        assert other.counts == {"raw": 1}


def test_failure_reuse_ends_with_scope():
    def fail():
        raise TimeoutError("synthetic")
    with computation_scope() as context:
        for _ in range(3):
            with pytest.raises(TimeoutError):
                reuse("public", "source", fail, cache_failure=True)
        assert context.counts == {"public": 1}
    assert context.failures == {}
    with computation_scope():
        assert reuse("public", "source", lambda: "recovered", cache_failure=True) == "recovered"


def test_parallel_contexts_are_isolated():
    def compute(value):
        with computation_scope():
            return reuse("raw", "same-key", lambda: value)
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(compute, range(20))) == list(range(20))
