"""Immutable metadata and fail-closed, effective-dated selection.

This is an internal release contract, not an HTTP administration interface.
Reviewer identities come from trusted release configuration, never request data.
No immigration thresholds or production rules are registered by this module.
"""
from dataclasses import asdict, dataclass
from datetime import date
from enum import Enum
import hashlib
import json
from urllib.parse import urlsplit


class ValidationStatus(str, Enum):
    CURRENT_VERIFIED = "CURRENT_VERIFIED"
    UNDER_REVIEW = "UNDER_REVIEW"
    SUPERSEDED = "SUPERSEDED"
    UNSUPPORTED = "UNSUPPORTED"


class RuleUnavailable(ValueError):
    """No unambiguous, authorized rule applies; do not calculate a fallback."""


@dataclass(frozen=True)
class Rule:
    rule_id: str
    program: str
    jurisdiction: str
    source_url: str
    effective_from: date
    reviewed_at: date | None
    version: str
    status: ValidationStatus
    applicability: tuple[str, ...]
    effective_to: date | None = None  # exclusive
    supersedes: str | None = None  # version of this same rule/scope
    numerical: bool = False

    def __post_init__(self):
        for name in ("rule_id", "program", "jurisdiction", "version"):
            if not isinstance(getattr(self, name), str) or not getattr(self, name).strip():
                raise ValueError(f"Invalid {name}")
        if not isinstance(self.status, ValidationStatus):
            raise ValueError("Invalid validation status")
        if type(self.effective_from) is not date or (self.effective_to is not None and type(self.effective_to) is not date):
            raise ValueError("Effective dates must be dates")
        if self.reviewed_at is not None and type(self.reviewed_at) is not date:
            raise ValueError("Review date must be a date")
        if self.effective_to is not None and self.effective_to <= self.effective_from:
            raise ValueError("Empty applicability interval")
        if not isinstance(self.applicability, tuple) or not self.applicability or any(not isinstance(x, str) or not x.strip() for x in self.applicability):
            raise ValueError("Applicability must be an immutable, nonempty tuple")
        if len(set(self.applicability)) != len(self.applicability):
            raise ValueError("Duplicate applicability")
        if type(self.numerical) is not bool:
            raise ValueError("Invalid numerical flag")
        if self.supersedes is not None and (not isinstance(self.supersedes, str) or not self.supersedes.strip() or self.supersedes == self.version):
            raise ValueError("Invalid supersession")
        if not isinstance(self.source_url, str):
            raise ValueError("Invalid source URL")
        if self.source_url:
            url = urlsplit(self.source_url)
            host = (url.hostname or "").lower()
            official = host == "canada.ca" or host.endswith(".canada.ca") or host == "justice.gc.ca" or host.endswith(".justice.gc.ca") or host == "quebec.ca" or host.endswith(".quebec.ca")
            if url.scheme != "https" or not official or url.username or url.password or url.query or url.fragment or url.port not in (None, 443):
                raise ValueError("Source must be a direct official HTTPS URL")

    @property
    def scope(self):
        return self.rule_id, self.program, self.jurisdiction


@dataclass(frozen=True)
class ReleaseApproval:
    reviewer: str
    reviewed_at: date
    manifest_digest: str


@dataclass(frozen=True, init=False)
class RuleRegistry:
    _rules: tuple[Rule, ...]
    _approval: ReleaseApproval | None
    _reviewers: frozenset[str]

    def __init__(self, rules: tuple[Rule, ...], approval: ReleaseApproval | None = None, *, authorized_reviewers: frozenset[str] = frozenset()):
        object.__setattr__(self, "_rules", tuple(rules))
        if any(not isinstance(rule, Rule) for rule in self._rules):
            raise ValueError("Invalid rule metadata")
        keys = [(r.scope, r.version) for r in self._rules]
        if len(set(keys)) != len(keys):
            raise ValueError("Duplicate rule version")
        for rule in self._rules:
            if rule.supersedes:
                previous = next((r for r in self._rules if r.scope == rule.scope and r.version == rule.supersedes), None)
                if previous is None or previous.effective_from >= rule.effective_from:
                    raise ValueError("Invalid supersession target")
                if previous.effective_to is None or previous.effective_to > rule.effective_from:
                    raise ValueError("Supersession must close the previous interval")
        object.__setattr__(self, "_approval", approval)
        object.__setattr__(self, "_reviewers", frozenset(authorized_reviewers))

    @property
    def rules(self):
        return self._rules

    @property
    def digest(self):
        records = [asdict(r) for r in sorted(self._rules, key=lambda r: (*r.scope, r.version))]
        return hashlib.sha256(json.dumps(records, default=str, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    def select(self, rule_id: str, program: str, jurisdiction: str, *, as_of: date, applicability: str, historical: bool = False) -> Rule:
        if type(as_of) is not date:
            raise ValueError("An explicit evaluation date is required")
        approval = self._approval
        if not isinstance(approval, ReleaseApproval) or approval.reviewer not in self._reviewers or type(approval.reviewed_at) is not date or approval.manifest_digest != self.digest:
            raise RuleUnavailable("Release activation not authorized")
        candidates = [r for r in self._rules if r.scope == (rule_id, program, jurisdiction) and applicability in r.applicability and r.effective_from <= as_of and (r.effective_to is None or as_of < r.effective_to)]
        if len(candidates) != 1:
            raise RuleUnavailable("Missing or conflicting applicable versions")
        rule = candidates[0]
        allowed = {ValidationStatus.CURRENT_VERIFIED}
        if historical:
            allowed.add(ValidationStatus.SUPERSEDED)
        # A later review may authorize replay of an earlier dated rule.
        if not rule.source_url or rule.reviewed_at is None or rule.reviewed_at > approval.reviewed_at or rule.status not in allowed:
            raise RuleUnavailable("Rule source or verification unavailable")
        return rule
