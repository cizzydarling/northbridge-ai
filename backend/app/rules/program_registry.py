"""Jurisdiction references, not an eligibility engine or an intake availability feed.

Availability is never inferred from a program name, NOC or French language.
Stream activation requires a separately reviewed, dated registry release.
"""
from dataclasses import asdict, dataclass
from datetime import date
import json
from pathlib import Path
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


def criteria_records(*, as_of=None):
    """Read reviewed factual summaries; never activate a stream or assess a user."""
    today = as_of or date.today()
    envelope = json.loads(Path(__file__).with_name("program_criteria.json").read_text(encoding="utf-8"))
    if set(envelope) != {"schema_version", "coverage", "records"} or envelope["schema_version"] != 1:
        raise ValueError("Unsupported program criteria schema")
    records = envelope["records"]
    if not isinstance(records, list) or len(records) != 3:
        raise ValueError("Expected the bounded three-program criteria slice")
    expected = {"federal.cec": "ircc.cec", "federal.fsw": "ircc.fsw", "federal.fst": "ircc.fst"}
    found = set()
    normalized = []
    required = {"identifier", "title_en", "title_fr", "source_id", "official_source", "criteria", "jurisdiction", "family", "source_reviewed_on", "source_published_at", "effective_from", "review_required_from", "review_status", "independent_review", "intake_status", "eligibility", "settlement"}
    for record in records:
        if not isinstance(record, dict) or set(record) != required:
            raise ValueError("Malformed criteria record")
        identifier = record["identifier"]
        if identifier not in expected or identifier in found or record["source_id"] != expected[identifier]:
            raise ValueError("Unknown or duplicate program criteria")
        source = SOURCES.get(record["source_id"])
        if not source or record["official_source"] != source.url:
            raise ValueError("Unverified program source")
        if any(record[key] != value for key, value in {"jurisdiction": "CA", "family": "express_entry", "settlement": "outside_QC", "review_status": "UNDER_REVIEW", "independent_review": "pending", "intake_status": "unknown", "eligibility": "not_assessed"}.items()):
            raise ValueError("Criteria cannot activate intake or eligibility")
        # Review/retrieval dates are not legal commencement or publication dates.
        if record["effective_from"] is not None or record["source_published_at"] is not None:
            raise ValueError("Unestablished source dates must remain unknown")
        reviewed = date.fromisoformat(record["source_reviewed_on"])
        next_review = date.fromisoformat(record["review_required_from"])
        if reviewed >= next_review or reviewed > today:
            raise ValueError("Invalid review dates")
        if not all(isinstance(record[k], str) and record[k].strip() for k in ("title_en", "title_fr")):
            raise ValueError("Missing bilingual title")
        if not isinstance(record["criteria"], list) or not record["criteria"]:
            raise ValueError("Empty criteria")
        keys = set()
        for criterion in record["criteria"]:
            if not isinstance(criterion, dict) or set(criterion) != {"key", "en", "fr"} or not all(isinstance(v, str) and v.strip() for v in criterion.values()) or criterion["key"] in keys:
                raise ValueError("Malformed bilingual criterion")
            keys.add(criterion["key"])
        found.add(identifier)
        normalized.append({**record, "criteria_status": "review_required" if today >= next_review else "source_reviewed_information"})
    return normalized


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


def catalog(query='', destination=None, *, as_of=None):
    target='CA' if str(destination or '').strip().upper()=='CA' else jurisdiction(destination)
    if destination and target is None:
        return {'records':[],'jurisdiction':None,'eligibility':'not_assessed','automatic_activation':False,'status':'unsupported_jurisdiction'}
    def norm(value):
        return ''.join(c for c in unicodedata.normalize('NFKD',str(value).casefold()) if not unicodedata.combining(c))
    terms=norm(query or '')
    records=[]
    for p in PROGRAMS:
        if target and p.jurisdiction!=target and not (p.jurisdiction=='CA' and target!='QC'): continue
        title={'express_entry':'Federal Express Entry / Entrée express fédéral','quebec_selection':'Quebec skilled-worker selection / Sélection québécoise','pnp':'Provincial nominee reference / Référence du programme provincial'}[p.family]
        records.append(asdict(p)|{'title':title,'description_status':'reference_only','description_en':{
 'express_entry':'Federal online system for managing applications under participating economic immigration programs. This description does not confirm personal eligibility or that an invitation round is open.',
 'quebec_selection':'Quebec has a separate selection process for skilled workers intending to settle in Quebec. Quebec selection and the federal permanent-residence decision are separate stages; this is not a PNP or Express Entry pathway.',
 'pnp':'Provincial or territorial nomination reference for intended settlement in the nominating jurisdiction. Stream requirements and intake availability require separate official verification. Nomination is not a federal permanent-residence decision.'}[p.family],
 'description_fr':{
 'express_entry':'Système fédéral en ligne de gestion des demandes de programmes d’immigration économique participants. Cette description ne confirme ni votre admissibilité ni l’ouverture d’une ronde d’invitations.',
 'quebec_selection':'Le Québec dispose d’un processus distinct de sélection des travailleurs qualifiés qui souhaitent s’y établir. La sélection québécoise et la décision fédérale de résidence permanente sont des étapes distinctes ; il ne s’agit ni d’un PCP ni d’Entrée express.',
 'pnp':'Référence à la désignation provinciale ou territoriale pour l’établissement dans le territoire concerné. Les critères des volets et leur ouverture exigent une vérification officielle distincte. Une désignation n’est pas une décision fédérale de résidence permanente.'}[p.family],
 'eligibility':'not_assessed','intake_status':p.availability})
    if target != 'QC':
        for item in criteria_records(as_of=as_of):
            records.append({**item, 'title': item['title_en'] + ' / ' + item['title_fr'],
                'description_status': 'reviewed_factual_summary', 'description_en': 'Program-specific preparation reference, not a personal eligibility decision.',
                'description_fr': 'Référence de préparation propre au programme, pas une décision d’admissibilité.',
                'checked_on': item['source_reviewed_on'], 'availability': 'unknown'})
    if terms:
        records=[r for r in records if terms in norm(' '.join([r['title'],r['identifier'],r['description_en'],r['description_fr'],* [name for name,code in ALIASES.items() if code==r['jurisdiction']]]))]
    return {'records':records,'jurisdiction':target,'eligibility':'not_assessed','automatic_activation':False,'constraints':['QC and NU have no PNP','Reference existence is not intake availability','Unsupported streams remain under review']}
