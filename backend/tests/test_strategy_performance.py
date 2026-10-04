from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock
import pytest
import requests
from backend.tests.performance_cases import strategy_case
from app.services import noc_service as noc, strategy_service as strategy
from app.services import province_targeting_service as province
from app.services import immigration_intelligence_service as intelligence
from app.services.computation_context import computation_scope


def test_one_scan_one_province_one_snapshot(monkeypatch):
    monkeypatch.setattr(strategy, "generate_ai_strategy", lambda **kwargs: {})
    with computation_scope() as stats:
        strategy._build_unverified_strategy(*strategy_case(0))
    assert stats.counts["noc_scan"] == 1
    assert stats.counts["province"] == 1
    assert stats.counts["profile_snapshot"] == 1


@pytest.mark.parametrize("confidence", [.74, .75, .76, .82, .83, .84, .85])
def test_raw_reuse_preserves_distinct_resolver_policies(monkeypatch, confidence):
    # A confidence between the two thresholds must produce different decisions.
    suggestion = {"suggested_noc": "21232", "confidence": confidence, "teer": 1}
    monkeypatch.setattr(strategy, "suggest_noc_matches", lambda **kw: suggestion.copy())
    monkeypatch.setattr(province, "suggest_noc_matches", lambda **kw: suggestion.copy())
    profile = {"occupation": "developer", "noc_code": "13100"}
    assert strategy._resolve_noc_profile(profile)["resolved_noc_code"] == ("21232" if confidence >= .84 else "13100")
    assert province._resolve_noc(profile)["noc_code"] == ("21232" if confidence >= .75 else "13100")


def test_scoring_key_inputs_and_detached_results():
    with computation_scope() as stats:
        original = noc.suggest_noc_matches(occupation="Administrative officer")
        original["matches"].clear()
        translated = noc.suggest_noc_matches(occupation="Administrative officer", language="fr", top_k=10)
        assert translated["matches"]
        assert stats.counts["noc_scan"] == 1  # language/top_k are post-scoring presentation
        noc.suggest_noc_matches(occupation="Administrative officer", job_description="Scheduling")
        noc.suggest_noc_matches(occupation="Administrative officer", duties=["Scheduling"])
        assert stats.counts["noc_scan"] == 3
    with computation_scope() as next_request:
        noc.suggest_noc_matches(occupation="Administrative officer")
        assert next_request.counts["noc_scan"] == 1


@pytest.mark.parametrize("failure", [requests.Timeout, requests.ConnectionError, ValueError])
def test_public_failure_is_reused_only_within_request(monkeypatch, failure):
    intelligence._CACHE.clear()
    retrieve = Mock(side_effect=failure("synthetic source failure"))
    monkeypatch.setattr(intelligence, "_retrieve_json", retrieve)
    with computation_scope() as stats:
        result = intelligence.build_immigration_intelligence(profile={"nationality": "France"})
    counts = Counter(call.args[0] for call in retrieve.call_args_list)
    assert counts and max(counts.values()) == 1
    assert stats.counts["public_json"] == 2  # draws and processing source
    assert "ircc_processing_data:en" not in intelligence._CACHE
    assert result["processing_times"]["status"] == "source_unavailable"
    before = retrieve.call_count
    intelligence.build_immigration_intelligence(profile={})
    assert retrieve.call_count == before + 1  # retry on a new request; draw fallback retains existing TTL
    intelligence._CACHE.clear()


def test_malformed_processing_data_not_cached_as_success(monkeypatch):
    intelligence._CACHE.clear()
    retrieve = Mock(return_value={})
    monkeypatch.setattr(intelligence, "_retrieve_json", retrieve)
    with computation_scope():
        for _ in range(3):
            assert intelligence.get_processing_time_catalog()["status"] == "source_unavailable"
    assert retrieve.call_count == 3  # three distinct dataset URLs, once each
    assert "ircc_processing_data:en" not in intelligence._CACHE


def test_successful_public_data_retains_ttl(monkeypatch):
    intelligence._CACHE.clear()
    retrieve = Mock(return_value={"country-name": {"FR": "France"}, "data": {}})
    monkeypatch.setattr(intelligence, "_retrieve_json", retrieve)
    for _ in range(2):
        with computation_scope():
            assert intelligence.get_processing_time_catalog()["status"] == "live"
    assert retrieve.call_count == 3
    intelligence._CACHE.clear()


def test_ai_failure_leaves_deterministic_strategy_unchanged(monkeypatch):
    monkeypatch.setattr(strategy, "generate_ai_strategy", lambda **kw: {})
    expected = strategy._build_unverified_strategy(*strategy_case(0))
    monkeypatch.setattr(strategy, "generate_ai_strategy", Mock(side_effect=TimeoutError("synthetic")))
    actual = strategy._build_unverified_strategy(*strategy_case(0))
    expected.pop("ai_strategy")
    actual.pop("ai_strategy")
    assert actual == expected


def test_ai_provider_budget(monkeypatch):
    from app.services import ai_advisor
    client = Mock()
    client.with_options.return_value.chat.completions.create.side_effect = TimeoutError("synthetic")
    monkeypatch.setattr(ai_advisor, "_get_openai_client", lambda: client)
    ai_advisor.generate_ai_strategy(profile=strategy_case(0)[0])
    client.with_options.assert_called_once_with(timeout=15.0, max_retries=0)


def test_startup_failure_and_readiness(monkeypatch):
    from app import main
    from fastapi.testclient import TestClient
    app = main.create_app()
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["components"]["noc"] == "unavailable"
    with TestClient(app) as client:
        assert app.state.noc_ready is True
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").json()["components"]["noc"] == "ok"
    assert app.state.noc_ready is False
    monkeypatch.setattr(main, "prepare_noc_data", Mock(side_effect=RuntimeError("synthetic initialization failure")))
    with pytest.raises(RuntimeError, match="initialization failure"):
        with TestClient(main.create_app()):
            pass


def test_required_dataset_failure(monkeypatch):
    monkeypatch.setattr(noc, "_PREPARED_FEATURES", None)
    monkeypatch.setattr(noc, "load_noc_dataset", lambda: [])
    with pytest.raises(RuntimeError, match="datasets"):
        noc.prepare_noc_data()


def test_ai_cannot_mutate_response_snapshot(monkeypatch):
    def mutate(**kwargs):
        kwargs["strategy_data"]["profile_snapshot"]["occupation"] = "mutated"
        return {}
    monkeypatch.setattr(strategy, "generate_ai_strategy", mutate)
    result = strategy._build_unverified_strategy(*strategy_case(0))
    assert result["profile_snapshot"]["occupation"] == "Administrative officer"


def test_raw_ranking_stable_ties(monkeypatch):
    records = [{"noc": code} for code in ["10000", "20000", "30000"]]
    monkeypatch.setattr(noc, "load_noc_dataset", lambda: records)
    monkeypatch.setattr(noc, "prepare_noc_data", lambda: {id(record): None for record in records})
    def score(record, **kwargs):
        return noc.NocMatch(record["noc"], "Synthetic", 1, 50.0, .7, "", [], False, [])
    monkeypatch.setattr(noc, "_score_record", score)
    assert [item.noc for item in noc._raw_noc_scores("Synthetic", "", [])] == ["10000", "20000", "30000"]


def test_concurrent_preparation_publishes_one_immutable_copy(monkeypatch):
    records = [{"noc": "10000"}, {"noc": "20000"}]
    monkeypatch.setattr(noc, "_PREPARED_FEATURES", None)
    monkeypatch.setattr(noc, "load_noc_dataset", lambda: records)
    monkeypatch.setattr(noc, "load_french_noc_index", lambda: {"10000": {}})
    prepare = Mock(side_effect=lambda record: record["noc"])
    monkeypatch.setattr(noc, "_prepare_record", prepare)
    with ThreadPoolExecutor(max_workers=8) as pool:
        copies = list(pool.map(lambda _: noc.prepare_noc_data(), range(16)))
    assert prepare.call_count == len(records)
    assert all(copy is copies[0] for copy in copies)
    with pytest.raises(TypeError):
        copies[0]["new"] = "value"
