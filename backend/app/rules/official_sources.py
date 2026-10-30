"""Exact public authority URLs, checked against IRCC's directory 2026-10-18.

An official directory link establishes authority, not availability or successful
retrieval. Several provincial servers block automated retrieval; never bypass it.
"""
from dataclasses import dataclass
from types import MappingProxyType
from app.rules.crs_versions import SOURCE, CRITERIA, NOC_SOURCE
from app.services.language_assessment_service import SOURCE as LANGUAGE_SOURCE


@dataclass(frozen=True)
class OfficialSource:
    identifier: str
    url: str
    authority: str
    jurisdiction: str
    family: str
    source_type: str
    cadence_hours: int
    language: str
    priority: str
    modules: tuple[str, ...]


BASE = "https://www.canada.ca/en/immigration-refugees-citizenship/"
FEDERAL = (
    OfficialSource("ircc.ee", SOURCE, "IRCC", "CA", "express_entry", "announcement", 12, "en", "high", ("CRS", "Express Entry", "Strategy", "AI")),
    OfficialSource("ircc.crs", CRITERIA, "IRCC", "CA", "express_entry", "criteria", 12, "en", "high", ("CRS", "Strategy", "AI")),
    OfficialSource("ircc.instructions", BASE + "corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/current.html", "IRCC", "CA", "express_entry", "instructions", 12, "en", "high", ("CRS", "Express Entry", "AI")),
    OfficialSource("ircc.noc_levels", NOC_SOURCE, "IRCC", "CA", "express_entry", "occupation_list", 12, "en", "high", ("CRS", "NOC", "AI")),
    OfficialSource("ircc.rounds", BASE + "services/immigrate-canada/express-entry/rounds-invitations.html", "IRCC", "CA", "express_entry", "draw", 12, "en", "high", ("Express Entry", "Strategy")),
    OfficialSource("ircc.language", LANGUAGE_SOURCE, "IRCC", "CA", "language", "criteria", 12, "en", "high", ("Language", "CRS", "Schools & Test Centres", "AI")),
    OfficialSource("ircc.forms", BASE + "services/application/application-forms-guides.html", "IRCC", "CA", "forms", "reference", 168, "en", "normal", ("Forms/Documents", "AI")),
    *(OfficialSource(f"ircc.{identifier}", BASE + "services/immigrate-canada/express-entry/who-can-apply/" + page + ".html", "IRCC", "CA", "express_entry", "criteria", 24, "en", "high", ("Program references", "Language", "NOC"))
      for identifier, page in (("cec", "canadian-experience-class"), ("fsw", "federal-skilled-workers"), ("fst", "federal-skilled-trades"))),
)
PROVINCIAL = (
    ("QC", "MIFI", "quebec_selection", "https://www.quebec.ca/en/immigration/permanent/skilled-workers"),
    ("ON", "OINP", "pnp", "https://www.ontario.ca/page/2026-ontario-immigrant-nominee-program-updates"),
    ("BC", "BC PNP", "pnp", "https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program"),
    ("AB", "AAIP", "pnp", "https://www.alberta.ca/alberta-advantage-immigration-program"),
    ("MB", "MPNP", "pnp", "https://immigratemanitoba.com/mpnp/"),
    ("SK", "SINP", "pnp", "https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program"),
    ("NS", "NSNP", "pnp", "https://novascotiaimmigration.com/move-here/"),
    ("NB", "New Brunswick", "pnp", "https://www2.gnb.ca/content/gnb/en/corporate/promo/immigration/immigrating-to-nb/nb-immigration-program-streams.html"),
    ("NL", "NLPNP", "pnp", "https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/provincial-nominee-program/overview/"),
    ("PE", "PEI PNP", "pnp", "https://www.princeedwardisland.ca/en/topic/immigrate-to-pei-as-a-worker"),
    ("YT", "Yukon", "pnp", "https://yukon.ca/en/immigration/apply-immigrate-yukon/immigrate-yukon"),
    ("NT", "NTNP", "pnp", "https://www.immigratenwt.ca/immigrate-here"),
)
SOURCES = MappingProxyType({s.identifier: s for s in (*FEDERAL, *(
    OfficialSource(f"province.{j.lower()}", url, authority, j, family, "program", 24, "en", "high", ("Provincial matching" if family == "pnp" else "Quebec selection", "Strategy", "AI"))
    for j, authority, family, url in PROVINCIAL))})
