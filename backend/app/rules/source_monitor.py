"""Bounded official-source monitoring. No AI calls, rule writes or activation.

Run through the explicit local CLI, never app startup or a user request. Store
normalized public evidence, not HTTP headers, cookies or remote scripts. Access
restrictions are errors, never unchanged/verified results.
"""
from datetime import datetime, timedelta, timezone, date
from dataclasses import asdict
from difflib import SequenceMatcher
from html.parser import HTMLParser
import hashlib
import ipaddress
import re
import socket
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
import requests
from sqlalchemy.exc import IntegrityError

from app.rules.official_sources import SOURCES
from app.models.rule_monitor_model import RuleSourceCheck, RuleSourceSnapshot, RuleSourceChange, RuleReviewDecision

MAX_BYTES = 512_000
MAX_TEXT = 60_000
MAX_SOURCES_PER_RUN = 2  # sequential, hard bound; no automatic retries per run
AGENT = "NorthBridgeAI-RulesMonitor/1.0"


class RetrievalFailure(ValueError):
    pass


class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.main = 0
        self.has_main = False
        self.all_text, self.main_text = [], []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "nav", "footer", "header", "noscript"}:
            self.hidden += 1
        if tag == "main":
            self.main += 1
            self.has_main = True

    def handle_endtag(self, tag):
        if tag in {"script", "style", "nav", "footer", "header", "noscript"}:
            self.hidden = max(0, self.hidden - 1)
        if tag == "main":
            self.main = max(0, self.main - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.all_text.append(data)
            if self.main:
                self.main_text.append(data)


def normalize(content):
    if not isinstance(content, bytes) or not 0 < len(content) <= MAX_BYTES:
        raise RetrievalFailure("size_or_empty")
    try:
        parser = PageText()
        parser.feed(content.decode("utf-8", errors="strict"))
        text = re.sub(r"\s+", " ", " ".join(parser.main_text if parser.has_main else parser.all_text)).strip()
    except (UnicodeError, ValueError) as exc:
        raise RetrievalFailure("parse_failed") from exc
    if len(text) < 40 or len(text) > MAX_TEXT:
        raise RetrievalFailure("parse_or_text_limit")
    # Unexpected sensitive material is discarded, never snapshotted or logged.
    if re.search(r"(?i)(?:bearer\s+[a-z0-9._-]{15,}|sk_(?:live|test)_[a-z0-9]+|password\s*[:=]|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.)", text):
        raise RetrievalFailure("sensitive_content_rejected")
    return text


def effective_date_candidate(text):
    matches = re.findall(r"(?:as of|effective(?: on| from)?|comes into effect on)\s+([A-Z][a-z]+ \d{1,2}, \d{4})", text, re.I)
    dates = set()
    for value in matches:
        try:
            dates.add(datetime.strptime(value, "%B %d, %Y").date())
        except ValueError:
            return None, "REVIEW_REQUIRED"
    return (next(iter(dates)), "EXPLICIT_DATE_REQUIRES_REVIEW") if len(dates) == 1 else (None, "CONFLICTING_DATES" if dates else "UNKNOWN")


def _public_host(host):
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise RetrievalFailure("non_public_address")


def retrieve(source_id):
    source = SOURCES[source_id]  # no arbitrary URL input, redirects deliberately blocked
    url = urlsplit(source.url)
    _public_host(url.hostname)
    with requests.Session() as session:
        session.trust_env = False  # never use ambient credentials/proxy/cookies
        session.headers.update({"User-Agent": AGENT})
        def read(target):
            started = time.monotonic()
            with session.get(target, timeout=(3, 8), stream=True, allow_redirects=False) as response:
                if response.status_code != 200:
                    raise RetrievalFailure("http_" + str(response.status_code))
                if not any(t in response.headers.get("Content-Type", "").lower() for t in ("text/html", "text/plain")):
                    raise RetrievalFailure("unsupported_content_type")
                result = bytearray()
                for chunk in response.iter_content(8192):
                    if time.monotonic() - started > 15:
                        raise RetrievalFailure("total_read_deadline")
                    result.extend(chunk)
                    if len(result) > MAX_BYTES:
                        raise RetrievalFailure("size_limit")
                return bytes(result)
        robots = RobotFileParser()
        try:
            robots.parse(read(f"https://{url.netloc}/robots.txt").decode("utf-8").splitlines())
        except RetrievalFailure as exc:
            if str(exc) != "http_404":
                raise
            robots.parse([])
        if not robots.can_fetch(AGENT, source.url):
            raise RetrievalFailure("robots_blocked")
        delay = robots.crawl_delay(AGENT) or robots.crawl_delay("*") or 0
        if delay:
            # Do not sleep inside jobs or bypass a site's crawl policy.
            raise RetrievalFailure("crawl_delay_requires_operator_schedule")
        return read(source.url)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def run_due(db, *, now=None, fetch=retrieve, limit=MAX_SOURCES_PER_RUN, cadence_overrides=None):
    now = now or datetime.now(timezone.utc)
    if not 1 <= limit <= MAX_SOURCES_PER_RUN:
        raise ValueError("Run size outside budget")
    overrides = cadence_overrides or {}
    if any(k not in SOURCES or type(v) is not int or not 6 <= v <= 720 for k, v in overrides.items()):
        raise ValueError("Invalid bounded cadence configuration")
    results = []
    for source in SOURCES.values():
        if len(results) >= limit:
            break
        latest = db.query(RuleSourceCheck).filter_by(source_id=source.identifier).order_by(RuleSourceCheck.checked_at.desc()).first()
        cadence = overrides.get(source.identifier, source.cadence_hours)
        if latest and now < _utc(latest.checked_at) + timedelta(hours=cadence):
            continue
        previous_check = db.query(RuleSourceCheck).filter_by(source_id=source.identifier, status="success").order_by(RuleSourceCheck.checked_at.desc()).first()
        previous = db.query(RuleSourceSnapshot).filter_by(source_id=source.identifier, fingerprint=previous_check.fingerprint).first() if previous_check else None
        try:
            text = normalize(fetch(source.identifier))
            digest = hashlib.sha256(text.encode()).hexdigest()
            snapshot = db.query(RuleSourceSnapshot).filter_by(source_id=source.identifier, fingerprint=digest).first()
            if snapshot is None:
                db.add(RuleSourceSnapshot(source_id=source.identifier, fingerprint=digest, normalized_text=text, captured_at=now))
            if previous is None or previous.fingerprint != digest:
                old = previous.normalized_text if previous else ""
                blocks = SequenceMatcher(None, old, text).get_opcodes()
                changed = next((b for b in blocks if b[0] != "equal"), ("insert", 0, 0, 0, len(text)))
                _, a, b, c, d = changed
                effective, extraction = effective_date_candidate(text)
                classification = {"ircc.ee": "CRS_numerical_rule", "ircc.crs": "CRS_numerical_rule", "ircc.instructions": "CRS_numerical_rule", "ircc.language": "language_requirement", "ircc.noc_levels": "NOC_requirement", "ircc.forms": "document_form_update", "ircc.rounds": "invitation_draw"}.get(source.identifier, "provincial_stream_change" if source.jurisdiction != "CA" else "REVIEW_REQUIRED")
                db.add(RuleSourceChange(source_id=source.identifier, previous_fingerprint=previous.fingerprint if previous else None,
                    new_fingerprint=digest, detected_at=now, effective_date=effective, classification=classification,
                    before_excerpt=old[max(0, a-60):min(len(old), b+60)][:400], after_excerpt=text[max(0, c-60):min(len(text), d+60)][:400],
                    extraction_status=extraction, modules=list(source.modules)))
            status = "success"
        except Exception as exc:
            # Only fixed safe labels persist; never store exception text/URLs/headers.
            status = "blocked" if isinstance(exc, RetrievalFailure) and str(exc) in {"robots_blocked", "http_403", "http_401", "http_429", "crawl_delay_requires_operator_schedule"} else "retrieval_failed"
            digest = None
        db.add(RuleSourceCheck(source_id=source.identifier, checked_at=now, status=status, fingerprint=digest))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # duplicate run/snapshot; next scheduled pass reconciles
            status = "duplicate_run"
        results.append({"source_id": source.identifier, "status": status})
    return results


def source_status(db):
    result = []
    for source in SOURCES.values():
        checks = db.query(RuleSourceCheck).filter_by(source_id=source.identifier)
        latest = checks.order_by(RuleSourceCheck.checked_at.desc()).first()
        good = checks.filter_by(status="success").order_by(RuleSourceCheck.checked_at.desc()).first()
        result.append(asdict(source) | {"last_successful_check": good.checked_at if good else None,
            "content_fingerprint": good.fingerprint if good else None,
            "retrieval_status": latest.status if latest else "never_checked", "rule_verified": False})
    return result
