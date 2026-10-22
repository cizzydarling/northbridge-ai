"""Offline human review workflow. Detection cannot approve or activate executable rules."""
from dataclasses import dataclass, replace
from datetime import date
import hashlib
from urllib.parse import urlsplit


def official_url(url):
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    return (parsed.scheme == "https" and not parsed.username and not parsed.password and not parsed.query
            and not parsed.fragment and parsed.port in (None, 443)
            and any(host == domain or host.endswith('.' + domain) for domain in ("canada.ca", "quebec.ca")))


@dataclass(frozen=True)
class SourceProposal:
    source_url: str
    previous_hash: str
    observed_hash: str
    observed_on: date
    effective_from: date
    ruleset_version: str
    impacted_features: tuple[str, ...]
    status: str = "UNDER_REVIEW"
    reviewed_on: date | None = None
    reviewer: str | None = None
    fixture_digest: str | None = None

    def __post_init__(self):
        if not official_url(self.source_url) or not self.impacted_features or not self.ruleset_version.strip():
            raise ValueError("Official source, version and impacted features required")
        if any(len(h) != 64 or any(c not in '0123456789abcdef' for c in h) for h in (self.previous_hash, self.observed_hash)):
            raise ValueError("SHA256 content hashes required")


def detect_change(*, source_url, previous_hash, content, observed_on, effective_from, version, impacted_features):
    if not isinstance(content, bytes) or not content:
        raise ValueError("A failed or empty source response cannot become a rule proposal")
    digest = hashlib.sha256(content).hexdigest()
    if digest == previous_hash:
        return None
    return SourceProposal(source_url, previous_hash, digest, observed_on, effective_from, version, tuple(impacted_features))


def record_human_review(proposal, *, reviewer, authorized_reviewers, reviewed_on, fixture_digest):
    if reviewer not in authorized_reviewers or reviewed_on < proposal.observed_on or len(fixture_digest) != 64 or any(c not in '0123456789abcdef' for c in fixture_digest):
        raise ValueError("Trusted human review and fixture evidence required")
    return replace(proposal, status="REVIEWED_PENDING_RELEASE", reviewer=reviewer,
                   reviewed_on=reviewed_on, fixture_digest=fixture_digest)


def activation_eligible(proposal, *, as_of, released_versions, accepted_fixture_digests):
    return (proposal.status == "REVIEWED_PENDING_RELEASE" and proposal.effective_from <= as_of
            and proposal.ruleset_version in released_versions
            and proposal.fixture_digest in accepted_fixture_digests)
