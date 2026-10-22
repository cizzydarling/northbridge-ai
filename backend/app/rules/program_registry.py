"""Jurisdiction references, not an eligibility engine or an intake availability feed.

Availability is never inferred from a program name, NOC or French language.
Stream activation requires a separately reviewed, dated registry release.
"""
from dataclasses import asdict, dataclass
from datetime import date
import unicodedata
from app.rules.official_sources import SOURCES

PNP_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees/non-express-entry/eligibility.html"
EE_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply.html"
QUEBEC_SOURCE = "https://www.quebec.ca/en/immigration/permanent/skilled-workers"
ONTARIO_SOURCE = "https://www.ontario.ca/page/2026-ontario-immigrant-nominee-program-updates"
CHECKED = date(2026, 10, 18)
PNP_JURISDICTIONS = frozenset({"AB", "BC", "MB", "NB", "NL", "NS", "NT", "ON", "PE", "SK", "YT"})
ALIASES = {"quebec": "QC", "nunavut": "NU", "ontario": "ON", "alberta": "AB",
           "british columbia": "BC", "colombie-britannique": "BC", "manitoba": "MB",
           "new brunswick": "NB", "nouveau-brunswick": "NB", "newfoundland and labrador": "NL",
           "nova scotia": "NS", "northwest territories": "NT", "prince edward island": "PE",
           "saskatchewan": "SK", "yukon": "YT"}


def jurisdiction(value):
    text = "".join(c for c in unicodedata.normalize("NFKD", str(value or "").strip().lower()) if not unicodedata.combining(c))
    return ALIASES.get(text, text.upper() if text.upper() in PNP_JURISDICTIONS | {"QC", "NU"} else None)


@dataclass(frozen=True)
class Program:
    identifier: str
    jurisdiction: str
    family: str
    official_source: str
    effective_from: date | None
    review_status: str
    availability: str
    express_entry_linked: bool | None
    settlement: str
    checked_on: date = CHECKED
    availability_verified_until: date | None = None

    def __post_init__(self):
        if self.family == "pnp" and self.jurisdiction not in PNP_JURISDICTIONS:
            raise ValueError("Jurisdiction has no PNP")
        if self.jurisdiction == "QC" and (self.family != "quebec_selection" or self.express_entry_linked is not False):
            raise ValueError("Quebec selection is separate from Express Entry and PNP")
        if self.availability not in {"unknown", "inactive", "open"}:
            raise ValueError("Invalid availability")
        if self.availability == "open" and (self.review_status != "CURRENT_VERIFIED" or not self.effective_from or not self.availability_verified_until):
            raise ValueError("Open status requires dated verification")


# References are deliberately UNDER_REVIEW, not claims that intake is open.
# Ontario's 2026 transition must be reconciled before any stream is supported.
PROGRAMS = (
    Program("federal.express_entry", "CA", "express_entry", EE_SOURCE, None, "UNDER_REVIEW", "unknown", True, "outside_QC"),
    Program("quebec.skilled_worker_selection", "QC", "quebec_selection", QUEBEC_SOURCE, None, "UNDER_REVIEW", "unknown", False, "QC"),
    Program("ontario.oinp.reference", "ON", "pnp", ONTARIO_SOURCE, None, "UNDER_REVIEW", "unknown", None, "ON"),
) + tuple(Program(f"{source.jurisdiction.lower()}.pnp.reference", source.jurisdiction, "pnp", source.url,
                  None, "UNDER_REVIEW", "unknown", None, source.jurisdiction)
          for source in SOURCES.values() if source.family == "pnp" and source.jurisdiction != "ON")


def reference_context(destination=None, *, as_of=None):
    target = jurisdiction(destination)
    records = [p for p in PROGRAMS if (p.settlement == target or (target and target != "QC" and p.settlement == "outside_QC"))]
    return {"jurisdiction": target, "pnp_exists": target in PNP_JURISDICTIONS if target else None,
            "references": [asdict(p) for p in records], "active_recommendations": [],
            "eligibility": "not_assessed", "source": PNP_SOURCE,
            "constraints": ["QC and NU have no PNP", "Quebec selection is not Express Entry",
                            "French does not override settlement requirements", "Unverified stream availability is not active"]}


def active_streams(destination, *, as_of, programs=PROGRAMS):
    """Fail closed even for metadata that merely looks like a current stream."""
    target = jurisdiction(destination)
    if target not in PNP_JURISDICTIONS:
        return []
    return [asdict(p) | {"eligibility": "not_assessed"} for p in programs
            if p.family == "pnp" and p.jurisdiction == target and not p.identifier.endswith(".reference")
            and p.review_status == "CURRENT_VERIFIED" and p.availability == "open"
            and p.effective_from <= as_of <= p.availability_verified_until]
