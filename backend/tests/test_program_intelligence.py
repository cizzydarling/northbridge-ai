"""Bounded factual program references never activate or assess immigration."""
import copy
import json
from datetime import date
from pathlib import Path

import pytest

from app.rules import program_registry as registry

AS_OF = date(2026, 10, 30)


def test_three_federal_programs_have_bilingual_source_review_without_legal_date_inference():
    records = registry.criteria_records(as_of=AS_OF)
    assert {r["identifier"] for r in records} == {"federal.cec", "federal.fsw", "federal.fst"}
    for record in records:
        assert record["criteria_status"] == "source_reviewed_information"
        assert record["review_status"] == "UNDER_REVIEW"
        assert record["effective_from"] is None
        assert record["source_published_at"] is None
        assert record["intake_status"] == "unknown"
        assert record["eligibility"] == "not_assessed"
        assert record["independent_review"] == "pending"
        assert all(c["en"] and c["fr"] for c in record["criteria"])


def test_change_date_requires_review_without_activating_rules():
    for record in registry.criteria_records(as_of=date(2026, 11, 3)):
        assert record["criteria_status"] == "review_required"
        assert record["intake_status"] == "unknown"
    assert registry.catalog(as_of=date(2026, 11, 3))["automatic_activation"] is False


@pytest.mark.parametrize("target", ["QC", "Québec", "Quebec", "NU", "Nunavut"])
def test_jurisdiction_aliases_never_produce_pnp(target):
    result = registry.catalog(destination=target, as_of=AS_OF)
    assert not any(r["family"] == "pnp" for r in result["records"])
    if registry.jurisdiction(target) == "QC":
        assert all(r["family"] == "quebec_selection" for r in result["records"])
    assert result["eligibility"] == "not_assessed"
    assert registry.active_streams(target, as_of=AS_OF) == []


def test_federal_criteria_keep_program_windows_and_crs_separate():
    records = {r["identifier"]: r for r in registry.criteria_records(as_of=AS_OF)}
    assert "three years" in records["federal.cec"]["criteria"][0]["en"]
    assert "ten years" in records["federal.fsw"]["criteria"][0]["en"]
    assert "five years" in records["federal.fst"]["criteria"][0]["en"]
    assert "not CRS" in records["federal.fsw"]["criteria"][1]["en"]
    assert registry.catalog(query="Canadian Experience Class", as_of=AS_OF)["records"][0]["identifier"] == "federal.cec"


@pytest.mark.parametrize("mutation", ["duplicate", "source", "open", "eligibility", "date", "missing_french", "structure"])
def test_malformed_or_activating_criteria_fail_closed(monkeypatch, mutation):
    original = json.loads(Path(registry.__file__).with_name("program_criteria.json").read_text(encoding="utf-8"))
    envelope = copy.deepcopy(original)
    item = envelope["records"][0]
    if mutation == "duplicate":
        envelope["records"][1] = copy.deepcopy(item)
    elif mutation == "source":
        item["official_source"] = "https://example.com/invented"
    elif mutation == "open":
        item["intake_status"] = "open"
    elif mutation == "eligibility":
        item["eligibility"] = "eligible"
    elif mutation == "date":
        item["effective_from"] = "2026-10-30"
    elif mutation == "missing_french":
        item["criteria"][0]["fr"] = ""
    else:
        item["criteria"] = {"unexpected": "substitution"}
    monkeypatch.setattr(Path, "read_text", lambda *_args, **_kwargs: json.dumps(envelope))
    with pytest.raises(ValueError):
        registry.criteria_records(as_of=AS_OF)


def test_reference_existence_never_implies_open_intake():
    result = registry.catalog(as_of=AS_OF)
    assert len({r["jurisdiction"] for r in result["records"] if r["family"] == "pnp"}) == 11
    assert all(r["intake_status"] == "unknown" for r in result["records"])
    assert registry.active_streams("ON", as_of=AS_OF) == []
