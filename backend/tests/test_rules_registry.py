"""Synthetic metadata fixtures only; these are not immigration thresholds."""
from dataclasses import FrozenInstanceError, replace
from datetime import date
import pytest
from app.rules.registry import Rule, RuleRegistry, ReleaseApproval, RuleUnavailable, ValidationStatus as S

D = date.fromisoformat
BASE = Rule("synthetic", "extension", "CA", "https://www.canada.ca/en.html", D("2025-01-01"), D("2025-01-01"), "v1", S.CURRENT_VERIFIED, ("synthetic-only",))

def registry(*rules, reviewer="release-reviewer", digest=None):
    raw = RuleRegistry(rules)
    return RuleRegistry(rules, ReleaseApproval(reviewer, D("2025-01-01"), digest or raw.digest), authorized_reviewers=frozenset({"release-reviewer"}))

def select(reg, day="2025-06-01", **kw):
    return reg.select("synthetic", "extension", "CA", as_of=D(day), applicability="synthetic-only", **kw)

def test_dates_determinism_and_immutable_fixture():
    r = replace(BASE, effective_to=D("2026-01-01"))
    assert select(registry(r), "2025-01-01") == r
    assert select(registry(r), "2025-12-31") == r
    for day in ("2024-12-31", "2026-01-01"):
        with pytest.raises(RuleUnavailable): select(registry(r), day)
    assert select(registry(r)) == select(registry(r))
    with pytest.raises(FrozenInstanceError): r.version = "changed"
    reg = registry(r)
    with pytest.raises(FrozenInstanceError): reg._rules = ()

@pytest.mark.parametrize("change", [{"source_url":""}, {"reviewed_at":None}, {"status":S.UNDER_REVIEW}, {"status":S.UNSUPPORTED}, {"status":S.UNDER_REVIEW,"numerical":True}])
def test_fail_closed(change):
    with pytest.raises(RuleUnavailable): select(registry(replace(BASE, **change)))

def test_conflicts_do_not_fall_back_to_verified_version():
    with pytest.raises(RuleUnavailable): select(registry(BASE, replace(BASE, version="v2", status=S.UNDER_REVIEW)))

def test_supersession_and_historical_replay():
    old = replace(BASE, status=S.SUPERSEDED, effective_to=D("2025-07-01"))
    new = replace(BASE, version="v2", effective_from=D("2025-07-01"), supersedes="v1")
    reg = registry(old, new)
    with pytest.raises(RuleUnavailable): select(reg)
    assert select(reg, historical=True) == old
    assert select(reg, "2025-07-01") == new
    assert RuleRegistry((new, old)).digest == RuleRegistry((old, new)).digest
    with pytest.raises(ValueError): RuleRegistry((new,))
    with pytest.raises(ValueError): RuleRegistry((BASE, new))

@pytest.mark.parametrize("change", [{"source_url":"http://www.canada.ca/a"}, {"source_url":"https://canada.ca.evil.invalid/a"}, {"source_url":"https://www.canada.ca/a?token=x"}, {"rule_id":""}, {"status":"CURRENT_VERIFIED"}, {"effective_to":D("2024-01-01")}, {"applicability":[]}, {"reviewed_at":"2025-01-01"}, {"supersedes":"v1"}])
def test_invalid_metadata(change):
    with pytest.raises(ValueError): replace(BASE, **change)

def test_unauthorized_activation_and_manifest_changes():
    for reg in (RuleRegistry((BASE,)), registry(BASE, reviewer="untrusted"), registry(BASE, digest="wrong")):
        with pytest.raises(RuleUnavailable): select(reg)
    assert RuleRegistry(()).rules == ()
    with pytest.raises(RuleUnavailable): select(registry(BASE), "2024-12-31")
    with pytest.raises(RuleUnavailable): registry(BASE).select("synthetic","extension","QC",as_of=D("2025-06-01"),applicability="synthetic-only")
    with pytest.raises(ValueError): RuleRegistry((BASE, BASE))

def test_historical_evaluation_date_is_not_release_review_date():
    raw = RuleRegistry((BASE,))
    reg = RuleRegistry((BASE,), ReleaseApproval("reviewer", D("2026-01-01"), raw.digest), authorized_reviewers=frozenset({"reviewer"}))
    assert select(reg, "2025-06-01", historical=True) == BASE
