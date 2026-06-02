from __future__ import annotations

from dataclasses import dataclass
import os
import re
import time
from typing import Any, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from app.models.profile_model import Profile
from app.schemas.career_match_schema import CareerMatchRequest
from app.services.noc_service import lookup_noc_by_code, suggest_noc_matches


PROVINCES = [
    {
        "code": "ON",
        "name": "Ontario",
        "fr": "Ontario",
        "base": 80,
        "pathways": ["OINP", "Express Entry", "Federal Skilled Worker"],
        "strengths": ["business", "administration", "technology", "finance", "health"],
        "wage": (25, 48),
    },
    {
        "code": "BC",
        "name": "British Columbia",
        "fr": "Colombie-Britannique",
        "base": 76,
        "pathways": ["BC PNP", "Express Entry BC"],
        "strengths": ["technology", "health", "trades", "tourism", "education"],
        "wage": (24, 46),
    },
    {
        "code": "AB",
        "name": "Alberta",
        "fr": "Alberta",
        "base": 74,
        "pathways": ["AAIP", "Express Entry"],
        "strengths": ["trades", "construction", "energy", "health", "transport"],
        "wage": (25, 50),
    },
    {
        "code": "QC",
        "name": "Quebec",
        "fr": "Québec",
        "base": 72,
        "pathways": ["Quebec Skilled Worker", "PEQ"],
        "strengths": ["french", "health", "education", "manufacturing", "technology"],
        "wage": (23, 43),
    },
    {
        "code": "MB",
        "name": "Manitoba",
        "fr": "Manitoba",
        "base": 69,
        "pathways": ["MPNP", "Skilled Worker in Manitoba"],
        "strengths": ["transport", "manufacturing", "health", "agriculture", "trades"],
        "wage": (22, 40),
    },
    {
        "code": "SK",
        "name": "Saskatchewan",
        "fr": "Saskatchewan",
        "base": 68,
        "pathways": ["SINP", "Occupation In-Demand"],
        "strengths": ["agriculture", "health", "trades", "transport", "construction"],
        "wage": (22, 41),
    },
    {
        "code": "NS",
        "name": "Nova Scotia",
        "fr": "Nouvelle-Écosse",
        "base": 66,
        "pathways": ["NSNP", "Atlantic Immigration Program"],
        "strengths": ["health", "education", "administration", "hospitality", "technology"],
        "wage": (21, 39),
    },
    {
        "code": "NB",
        "name": "New Brunswick",
        "fr": "Nouveau-Brunswick",
        "base": 64,
        "pathways": ["NBPNP", "Atlantic Immigration Program"],
        "strengths": ["bilingual", "french", "health", "customer service", "manufacturing"],
        "wage": (20, 38),
    },
    {
        "code": "NL",
        "name": "Newfoundland and Labrador",
        "fr": "Terre-Neuve-et-Labrador",
        "base": 61,
        "pathways": ["NLPNP", "Atlantic Immigration Program"],
        "strengths": ["health", "trades", "energy", "hospitality", "transport"],
        "wage": (21, 40),
    },
    {
        "code": "PE",
        "name": "Prince Edward Island",
        "fr": "Île-du-Prince-Édouard",
        "base": 59,
        "pathways": ["PEI PNP", "Atlantic Immigration Program"],
        "strengths": ["hospitality", "health", "agriculture", "food", "customer service"],
        "wage": (19, 35),
    },
]

OCCUPATION_SIGNALS = {
    "technology": ["software", "developer", "programmer", "data", "it", "analyst", "cyber", "system"],
    "business": ["business", "coordinator", "project", "manager", "consultant", "operations"],
    "administration": ["admin", "administrative", "office", "coordinator", "assistant", "clerk"],
    "finance": ["accountant", "bookkeeper", "finance", "payroll", "auditor"],
    "health": ["nurse", "doctor", "care", "health", "medical", "personal support"],
    "trades": ["mechanic", "electrician", "welder", "plumber", "carpenter", "technician"],
    "construction": ["construction", "builder", "site", "foreman", "civil"],
    "education": ["teacher", "instructor", "professor", "education", "trainer"],
    "transport": ["driver", "truck", "logistics", "warehouse", "dispatcher", "transport"],
    "hospitality": ["cook", "food", "hotel", "restaurant", "server", "hospitality"],
    "agriculture": ["farm", "agriculture", "harvest", "greenhouse"],
    "manufacturing": ["manufacturing", "production", "machine", "assembler", "operator"],
    "customer service": ["customer", "service", "sales", "retail", "call centre"],
    "french": ["french", "bilingual", "francais", "français"],
}

PROVINCE_NAME_BY_CODE = {item["code"]: item for item in PROVINCES}
JOB_BANK_XML_FEED_URL = os.getenv("JOB_BANK_XML_FEED_URL", "").strip()
JOB_BANK_XML_CACHE_SECONDS = int(os.getenv("JOB_BANK_XML_CACHE_SECONDS", "900") or "900")
JOB_BANK_XML_TIMEOUT_SECONDS = int(os.getenv("JOB_BANK_XML_TIMEOUT_SECONDS", "8") or "8")
_JOB_BANK_XML_CACHE: dict[str, Any] = {
    "expires_at": 0.0,
    "postings": [],
    "status": "not_configured",
    "error": "",
}


@dataclass
class NormalizedCareerInput:
    occupation: str
    noc_code: str
    education: str
    years_of_experience: int
    language_level: int
    preferred_provinces: list[str]
    current_location: str
    work_authorization_status: str
    language: str


def normalize_language(value: Optional[str]) -> str:
    return "fr" if str(value or "").lower().startswith("fr") else "en"


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _normalize_province(value: str) -> str:
    text = _clean(value).lower()
    for province in PROVINCES:
        if text in {
            province["code"].lower(),
            province["name"].lower(),
            province["fr"].lower(),
        }:
            return province["code"]
    return _clean(value).upper()[:2]


def _profile_defaults(profile: Optional[Profile]) -> dict[str, Any]:
    if not profile:
        return {}
    preferred = []
    if profile.preferred_province:
        preferred = [profile.preferred_province]
    return {
        "occupation": profile.occupation,
        "noc_code": profile.noc_code,
        "education": profile.education,
        "years_of_experience": profile.experience_years,
        "language_level": profile.language_score,
        "preferred_provinces": preferred,
        "current_location": " ".join(
            part for part in [profile.current_city, profile.current_country] if part
        ),
        "work_authorization_status": "has_job_offer" if profile.has_job_offer else "",
    }


def normalize_input(
    payload: CareerMatchRequest,
    profile: Optional[Profile],
) -> NormalizedCareerInput:
    defaults = _profile_defaults(profile) if payload.use_profile_defaults else {}
    preferred = payload.preferred_provinces or defaults.get("preferred_provinces") or []
    preferred_codes = [
        code
        for code in (_normalize_province(item) for item in preferred)
        if code in PROVINCE_NAME_BY_CODE
    ]

    return NormalizedCareerInput(
        occupation=_clean(payload.occupation or defaults.get("occupation") or "Project Coordinator"),
        noc_code=_clean(payload.noc_code or defaults.get("noc_code") or ""),
        education=_clean(payload.education or defaults.get("education") or ""),
        years_of_experience=int(payload.years_of_experience if payload.years_of_experience is not None else defaults.get("years_of_experience") or 0),
        language_level=int(payload.language_level if payload.language_level is not None else defaults.get("language_level") or 0),
        preferred_provinces=preferred_codes,
        current_location=_clean(payload.current_location or defaults.get("current_location") or ""),
        work_authorization_status=_clean(payload.work_authorization_status or defaults.get("work_authorization_status") or ""),
        language=normalize_language(payload.language),
    )


def _occupation_categories(occupation: str, noc_title: str = "") -> set[str]:
    text = f"{occupation} {noc_title}".lower()
    categories = set()
    for category, terms in OCCUPATION_SIGNALS.items():
        if any(term in text for term in terms):
            categories.add(category)
    return categories or {"business"}


def _job_bank_url(occupation: str, province_code: str, language: str) -> str:
    base = "https://www.guichetemplois.gc.ca/rechercheemplois" if language == "fr" else "https://www.jobbank.gc.ca/jobsearch/jobsearch"
    province = PROVINCE_NAME_BY_CODE.get(province_code, {}).get("name", province_code)
    params = {"searchstring": occupation, "locationstring": province}
    return f"{base}?{urlencode(params)}"


def _occupation_url(noc_code: str, occupation: str, language: str) -> str:
    base = "https://www.guichetemplois.gc.ca/rapportmarche" if language == "fr" else "https://www.jobbank.gc.ca/marketreport"
    params = {"occupation": noc_code or occupation}
    return f"{base}?{urlencode(params)}"


def _xml_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[-1].lower()


def _find_first_text(parent: ET.Element, names: set[str]) -> str:
    for child in parent.iter():
        if _local_name(child.tag) in names:
            text = _xml_text(child)
            if text:
                return text
    return ""


def _detect_province_code(*values: str) -> str:
    text = " ".join(value or "" for value in values).lower()
    for province in PROVINCES:
        candidates = {
            province["name"].lower(),
            str(province["fr"]).lower(),
        }
        if any(candidate and re.search(rf"\b{re.escape(candidate)}\b", text) for candidate in candidates):
            return province["code"]
    return ""


def _extract_noc(*values: str) -> str:
    match = re.search(r"\b(\d{5})\b", " ".join(value or "" for value in values))
    return match.group(1) if match else ""


def _job_posting_items(root: ET.Element) -> list[ET.Element]:
    items = [element for element in root.iter() if _local_name(element.tag) in {"item", "job", "posting", "jobposting"}]
    return items or [root]


def _parse_job_bank_xml(xml_bytes: bytes) -> list[dict[str, str]]:
    root = ET.fromstring(xml_bytes)
    postings = []
    for item in _job_posting_items(root):
        title = _find_first_text(item, {"title", "jobtitle", "position", "occupation"})
        url = _find_first_text(item, {"link", "url", "joburl", "applyurl"})
        description = _find_first_text(item, {"description", "summary", "jobdescription"})
        location = _find_first_text(item, {"location", "city", "address", "region"})
        province_code = _find_first_text(item, {"provincecode", "province_code", "provincestate"})
        province_code = _normalize_province(province_code) if province_code else ""
        province_code = province_code if province_code in PROVINCE_NAME_BY_CODE else _detect_province_code(title, description, location)
        noc_code = _find_first_text(item, {"noc", "noccode", "noc_code"})
        noc_code = noc_code if re.fullmatch(r"\d{5}", noc_code or "") else _extract_noc(title, description)
        employer = _find_first_text(item, {"employer", "company", "organization"})
        if not title and not url:
            continue
        province = PROVINCE_NAME_BY_CODE.get(province_code, {}).get("name", location or "Canada")
        postings.append(
            {
                "title": title or "Job posting",
                "url": url or "https://www.jobbank.gc.ca/jobsearch/jobsearch",
                "description": description[:240] if description else "Live posting from a configured Job Bank XML feed.",
                "province": province,
                "province_code": province_code,
                "noc_code": noc_code,
                "employer": employer,
            }
        )
    return postings


def _load_job_bank_postings() -> tuple[list[dict[str, str]], str, str]:
    if not JOB_BANK_XML_FEED_URL:
        return [], "not_configured", ""

    now = time.time()
    if _JOB_BANK_XML_CACHE["expires_at"] > now:
        return (
            _JOB_BANK_XML_CACHE["postings"],
            _JOB_BANK_XML_CACHE["status"],
            _JOB_BANK_XML_CACHE["error"],
        )

    try:
        request = Request(
            JOB_BANK_XML_FEED_URL,
            headers={"User-Agent": "NorthBridgeAI-CareerMatch/1.0"},
        )
        with urlopen(request, timeout=JOB_BANK_XML_TIMEOUT_SECONDS) as response:
            postings = _parse_job_bank_xml(response.read())
        status = "live" if postings else "empty"
        error = ""
    except Exception as exc:
        postings = []
        status = "failed"
        error = str(exc)[:180]

    _JOB_BANK_XML_CACHE.update(
        {
            "expires_at": now + JOB_BANK_XML_CACHE_SECONDS,
            "postings": postings,
            "status": status,
            "error": error,
        }
    )
    return postings, status, error


def _occupation_terms(occupation: str, noc_title: str = "") -> set[str]:
    stop_words = {"and", "or", "the", "for", "with", "de", "du", "des", "la", "le", "les"}
    terms = set()
    for word in re.findall(r"[a-zA-Z][a-zA-Z+-]{2,}", f"{occupation} {noc_title}".lower()):
        if word not in stop_words:
            terms.add(word)
    return terms


def _matching_live_jobs(
    occupation: str,
    noc_title: str,
    noc_code: str,
    province_code: str,
    language: str,
) -> tuple[list[dict[str, str]], str, str]:
    postings, status, error = _load_job_bank_postings()
    if not postings:
        return [], status, error

    terms = _occupation_terms(occupation, noc_title)
    scored = []
    for posting in postings:
        if posting.get("province_code") and posting["province_code"] != province_code:
            continue

        haystack = f"{posting.get('title', '')} {posting.get('description', '')}".lower()
        score = 0
        if noc_code and posting.get("noc_code") == noc_code:
            score += 8
        score += sum(1 for term in terms if term in haystack)
        if score <= 0:
            continue
        scored.append((score, posting))

    scored.sort(key=lambda item: item[0], reverse=True)
    province = PROVINCE_NAME_BY_CODE.get(province_code, {}).get("fr" if language == "fr" else "name", province_code)
    links = []
    for _, posting in scored[:3]:
        title = posting["title"]
        if posting.get("employer"):
            title = f"{title} - {posting['employer']}"
        links.append(
            {
                "title": title,
                "province": province,
                "source": "Job Bank XML",
                "url": posting["url"],
                "description": posting["description"]
                if language == "en"
                else "Offre en direct provenant du flux XML configure.",
            }
        )
    return links, status, error


def _score_province(
    province: dict[str, Any],
    career_input: NormalizedCareerInput,
    categories: set[str],
) -> tuple[int, list[str]]:
    score = int(province["base"])
    why = []

    category_hits = categories.intersection(set(province["strengths"]))
    if category_hits:
        score += 8 + min(len(category_hits) * 3, 9)
        why.append(f"Occupation signals align with {', '.join(sorted(category_hits))}.")

    if province["code"] in career_input.preferred_provinces:
        score += 8
        why.append("This province is in your preferred locations.")

    if career_input.language_level >= 7:
        score += 6
        why.append("Your language score strengthens employability and pathway fit.")
    elif career_input.language_level >= 4:
        score += 3
        why.append("Your language level gives a workable baseline for many roles.")

    if career_input.years_of_experience >= 5:
        score += 6
        why.append("Your experience level supports stronger job-market credibility.")
    elif career_input.years_of_experience >= 2:
        score += 3
        why.append("Your experience is relevant for entry-to-intermediate opportunities.")

    if province["code"] in {"QC", "NB"} and career_input.language_level >= 7:
        score += 4
        why.append("French or bilingual capacity can be especially useful here.")

    auth = career_input.work_authorization_status.lower()
    if any(term in auth for term in ["citizen", "pr", "permanent", "work permit", "authorized"]):
        score += 5
        why.append("Work authorization can reduce hiring friction.")
    elif any(term in auth for term in ["need", "sponsor", "lmia", "outside"]):
        score -= 5
        why.append("Work authorization may require more targeted employer outreach.")

    return max(35, min(score, 98)), why[:4]


def _demand_level(score: int) -> str:
    if score >= 82:
        return "High"
    if score >= 70:
        return "Moderate"
    return "Emerging"


def _next_action(score: int, province: dict[str, Any], language: str) -> str:
    if language == "fr":
        if score >= 82:
            return f"Priorisez {province['fr']} : adaptez votre CV et vérifiez le programme {province['pathways'][0]}."
        if score >= 70:
            return f"Comparez les offres à {province['fr']} et renforcez les éléments faibles du profil."
        return f"Gardez {province['fr']} comme option secondaire pendant que vous améliorez langue, CV ou autorisation de travail."
    if score >= 82:
        return f"Prioritize {province['name']}: tailor your resume and review {province['pathways'][0]}."
    if score >= 70:
        return f"Compare active roles in {province['name']} and strengthen any weaker profile signals."
    return f"Keep {province['name']} as a secondary option while improving language, resume, or work authorization."


def _localize_demand(value: str, language: str) -> str:
    if language != "fr":
        return value
    return {"High": "Élevée", "Moderate": "Modérée", "Emerging": "Émergente"}.get(value, value)


def build_career_match(payload: CareerMatchRequest, profile: Optional[Profile]) -> dict[str, Any]:
    career_input = normalize_input(payload, profile)

    noc_record = lookup_noc_by_code(career_input.noc_code) if career_input.noc_code else None
    noc_title = noc_record.get("title") if noc_record else ""
    noc_code = career_input.noc_code

    if not noc_code:
        suggestion = suggest_noc_matches(
            occupation=career_input.occupation,
            job_description="",
            top_k=1,
            language=career_input.language,
        )
        noc_code = suggestion.get("suggested_noc") or ""
        noc_title = suggestion.get("suggested_title") or noc_title

    categories = _occupation_categories(career_input.occupation, noc_title)
    provinces = PROVINCES
    if career_input.preferred_provinces:
        preferred = [item for item in PROVINCES if item["code"] in career_input.preferred_provinces]
        others = [item for item in PROVINCES if item["code"] not in career_input.preferred_provinces]
        provinces = preferred + others

    matches = []
    for province in provinces:
        score, why = _score_province(province, career_input, categories)
        live_links, live_status, live_error = _matching_live_jobs(
            career_input.occupation,
            noc_title,
            noc_code,
            province["code"],
            career_input.language,
        )
        if live_links:
            score = min(score + min(len(live_links) * 2, 6), 98)
            why = [
                *why,
                (
                    f"Live Job Bank XML feed found {len(live_links)} matched posting(s)."
                    if career_input.language == "en"
                    else f"Le flux XML Job Bank configure a trouve {len(live_links)} offre(s) correspondante(s)."
                ),
            ][:4]
        low, high = province["wage"]
        wage_adjustment = min(career_input.years_of_experience, 8)
        wage_range = f"${low + wage_adjustment}-${high + wage_adjustment}/hr"
        province_name = province["fr"] if career_input.language == "fr" else province["name"]
        demand = _demand_level(score)
        official_links = [
            {
                "title": "Job Bank search" if career_input.language == "en" else "Recherche Guichet-Emplois",
                "province": province_name,
                "source": "Job Bank",
                "url": _job_bank_url(career_input.occupation, province["code"], career_input.language),
                "description": "Official Canadian job search by occupation and province."
                if career_input.language == "en"
                else "Recherche officielle par profession et province.",
            },
            {
                "title": "Explore occupation" if career_input.language == "en" else "Explorer la profession",
                "province": province_name,
                "source": "Job Bank",
                "url": _occupation_url(noc_code, career_input.occupation, career_input.language),
                "description": "Official labour-market information, wages, prospects, and requirements."
                if career_input.language == "en"
                else "Information officielle sur le marche du travail, salaires, perspectives et exigences.",
            },
        ]
        matches.append(
            {
                "province": province_name,
                "province_code": province["code"],
                "occupation": career_input.occupation,
                "noc_code": noc_code,
                "match_score": score,
                "demand_level": _localize_demand(demand, career_input.language),
                "estimated_wage_range": wage_range,
                "related_pathway": " / ".join(province["pathways"][:2]),
                "why": why
                or [
                    "The province has a broad labour market and related immigration pathways."
                    if career_input.language == "en"
                    else "La province offre un marché du travail diversifié et des voies d'immigration connexes."
                ],
                "suggested_next_action": _next_action(score, province, career_input.language),
                "job_links": [
                    {
                        "title": "Job Bank search" if career_input.language == "en" else "Recherche Guichet-Emplois",
                        "province": province_name,
                        "source": "Job Bank",
                        "url": _job_bank_url(career_input.occupation, province["code"], career_input.language),
                        "description": "Official Canadian job search by occupation and province."
                        if career_input.language == "en"
                        else "Recherche officielle par profession et province.",
                    },
                    {
                        "title": "Explore occupation" if career_input.language == "en" else "Explorer la profession",
                        "province": province_name,
                        "source": "Job Bank",
                        "url": _occupation_url(noc_code, career_input.occupation, career_input.language),
                        "description": "Official labour-market information, wages, prospects, and requirements."
                        if career_input.language == "en"
                        else "Information officielle sur le marché du travail, salaires, perspectives et exigences.",
                    },
                ],
                "available_jobs_count": len(live_links),
                "live_data_status": live_status if not live_error else f"{live_status}: {live_error}",
                "job_links": [*live_links, *official_links],
            }
        )

    matches = sorted(matches, key=lambda item: item["match_score"], reverse=True)[:6]

    return {
        "occupation": career_input.occupation,
        "noc_code": noc_code,
        "noc_title": noc_title,
        "profile_used": {
            "education": career_input.education,
            "years_of_experience": career_input.years_of_experience,
            "language_level": career_input.language_level,
            "preferred_provinces": career_input.preferred_provinces,
            "current_location": career_input.current_location,
            "work_authorization_status": career_input.work_authorization_status,
            "occupation_categories": sorted(categories),
        },
        "official_sources": [
            {
                "name": "Job Bank",
                "url": "https://www.jobbank.gc.ca/",
                "description": "Official Government of Canada job search and labour-market information.",
            },
            {
                "name": "Statistics Canada / Open Government",
                "url": "https://open.canada.ca/data/dataset/f0f63701-d4bd-416b-8ed2-7a09f74abc6e",
                "description": "Wage-by-occupation data source planned for the next data-ingestion layer.",
            },
            {
                "name": "Configured Job Bank XML feed",
                "url": JOB_BANK_XML_FEED_URL or "https://www.jobbank.gc.ca/network",
                "description": (
                    "Live XML feed enrichment is active when JOB_BANK_XML_FEED_URL is configured."
                    if JOB_BANK_XML_FEED_URL
                    else "Configure JOB_BANK_XML_FEED_URL to enable live Job Bank XML postings."
                ),
            },
        ],
        "matches": matches,
    }
