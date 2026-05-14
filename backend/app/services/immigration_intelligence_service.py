from __future__ import annotations

import html
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests


EXPRESS_ENTRY_ROUNDS_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "immigrate-canada/express-entry/rounds-invitations.html"
)
EXPRESS_ENTRY_MINISTERIAL_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/"
    "mandate/policies-operational-instructions-agreements/ministerial-instructions/"
    "express-entry-rounds.html"
)
CATEGORY_SELECTION_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "immigrate-canada/express-entry/rounds-invitations/category-based-selection.html"
)
PROCESSING_TIMES_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "application/check-processing-times.html"
)
IRCC_JSON_BASE_URL = "https://www.canada.ca/content/dam/ircc/documents/json"
EXPRESS_ENTRY_DRAWS_JSON_URLS = {
    "en": f"{IRCC_JSON_BASE_URL}/ee_rounds_123_en.json",
    "fr": f"{IRCC_JSON_BASE_URL}/ee_rounds_123_fr.json",
}
PROCESSING_TIMES_COUNTRY_JSON_URLS = {
    "en": f"{IRCC_JSON_BASE_URL}/data-ptime-en.json",
    "fr": f"{IRCC_JSON_BASE_URL}/data-ptime-fr.json",
}
PROCESSING_TIMES_NON_COUNTRY_JSON_URLS = {
    "en": f"{IRCC_JSON_BASE_URL}/data-ptime-non-country-en.json",
    "fr": f"{IRCC_JSON_BASE_URL}/data-ptime-non-country-fr.json",
}
COUNTRY_NAMES_JSON_URLS = {
    "en": f"{IRCC_JSON_BASE_URL}/data-country-name-en.json",
    "fr": f"{IRCC_JSON_BASE_URL}/data-country-name-fr.json",
}
PNP_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "immigrate-canada/provincial-nominees/works.html"
)
JOB_BANK_URL = "https://www.jobbank.gc.ca/jobsearch/jobsearch"
EXPRESS_ENTRY_JOB_OFFER_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "immigrate-canada/express-entry/documents/job-offer.html"
)

REQUEST_TIMEOUT_SECONDS = 6
CACHE_TTL_SECONDS = 60 * 60

_CACHE: Dict[str, tuple[float, Any]] = {}

COUNTRY_PROCESSING_APPLICATIONS = {
    "visitor_visa_outside_canada": "visitor-outside-canada",
    "super_visa": "supervisa",
    "study_permit_outside_canada": "study",
    "work_permit_outside_canada": "work",
}

NON_COUNTRY_PROCESSING_APPLICATIONS = {
    "visitor_visa_inside_canada": ("visitor_inside_canada", "visitor_inside_canada"),
    "visitor_record": ("visitor_extension", "visitor_extension"),
    "study_permit_inside_canada": ("study_extension", "study_extension"),
    "work_permit_inside_canada": ("work_extension", "work_extension"),
    "iec": ("iec", "iec"),
    "eta": ("eta", "eta"),
    "express_entry_cec": ("cec_flpt", "cec_flpt"),
    "express_entry_fsw": ("fsw_ee_flpt", "fsw_ee_flpt"),
    "express_entry_pnp": ("pnp_ee_flpt", "pnp_ee_flpt"),
    "pnp_non_express_entry": ("pnp_flpt", "pnp_flpt"),
    "atlantic_immigration_program": (
        "atlantic-immigration-program",
        "atlantic-immigration-program",
    ),
}


def _normalize_language(language: Optional[str]) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_get(key: str) -> Any:
    item = _CACHE.get(key)
    if not item:
        return None

    created_at, value = item
    if time.time() - created_at > CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None

    return value


def _cache_set(key: str, value: Any) -> Any:
    _CACHE[key] = (time.time(), value)
    return value


def _safe_get(profile: Any, field: str, default: Any = None) -> Any:
    if isinstance(profile, dict):
        return profile.get(field, default)
    return getattr(profile, field, default)


def _fetch_text(url: str) -> str:
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={
            "User-Agent": "NorthBridgeAI/1.0 (+https://www.northbridgeia.com)",
            "Accept": "text/html,application/json",
        },
    )
    response.raise_for_status()
    return response.text


def _fetch_json(url: str) -> Any:
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={
            "User-Agent": "NorthBridgeAI/1.0 (+https://www.northbridgeia.com)",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    response.raise_for_status()
    return json.loads(response.content.decode("utf-8-sig"))


def _clean_html(raw: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", raw, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_digits(value: Any) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _extract_href(value: Any) -> str:
    match = re.search(r"href=['\"]([^'\"]+)['\"]", str(value or ""), flags=re.IGNORECASE)
    return match.group(1) if match else ""


def _absolute_canada_url(path: str) -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    if path.startswith("/content/canadasite"):
        path = path.replace("/content/canadasite", "", 1)
    if not path.startswith("/"):
        path = f"/{path}"
    return f"https://www.canada.ca{path}"


def _normalize_province(value: Any) -> str:
    return str(value or "").strip()


def _profile_occupation(profile: Any) -> str:
    return str(_safe_get(profile, "occupation", "") or "").strip()


def _profile_noc(profile: Any) -> str:
    return str(_safe_get(profile, "noc_code", "") or "").strip()


def _profile_country(profile: Any) -> str:
    current_country = str(_safe_get(profile, "current_country", "") or "").strip()
    nationality = str(_safe_get(profile, "nationality", "") or "").strip()

    if current_country.lower() in {"canada", "ca"} and nationality:
        return nationality

    return current_country or nationality


def _build_official_status(language: str) -> Dict[str, str]:
    return {
        "source": "IRCC",
        "status": "official_source",
        "label": _t("Official IRCC source", "Source officielle IRCC", language),
    }


def _parse_draws_from_json(data: Any, limit: int) -> List[Dict[str, Any]]:
    rows = data
    if isinstance(data, dict):
        for key in ("rounds", "draws", "data", "items", "results"):
            if isinstance(data.get(key), list):
                rows = data[key]
                break

    if not isinstance(rows, list):
        return []

    parsed: List[Dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue

        round_number = (
            item.get("round")
            or item.get("round_number")
            or item.get("draw_number")
            or item.get("drawNumber")
            or item.get("number")
            or item.get("id")
        )
        draw_date = item.get("date") or item.get("draw_date") or item.get("drawDate")
        draw_date_full = item.get("drawDateFull") or draw_date
        draw_type = (
            item.get("round_type")
            or item.get("type")
            or item.get("category")
            or item.get("drawName")
        )
        invitations = (
            item.get("invitations_issued")
            or item.get("invitations")
            or item.get("itas")
            or item.get("drawSize")
        )
        crs_cutoff = (
            item.get("crs_cutoff")
            or item.get("crs_score")
            or item.get("lowest_crs")
            or item.get("cutoff")
            or item.get("drawCRS")
        )
        detail_path = _extract_href(item.get("DrawText1") or item.get("mitext"))
        detail_url = _absolute_canada_url(detail_path) if detail_path else None

        parsed.append(
            {
                "round": str(round_number or "").strip() or None,
                "date": str(draw_date or "").strip() or None,
                "date_full": str(draw_date_full or "").strip() or None,
                "round_type": str(draw_type or "").strip() or None,
                "invitations_issued": invitations,
                "crs_cutoff": crs_cutoff,
                "draw_time": item.get("drawDateTime"),
                "tie_breaking_rule": item.get("drawCutOff"),
                "pool_distribution_as_of": item.get("drawDistributionAsOn"),
                "programs": item.get("drawText2"),
                "source_url": detail_url
                or item.get("source_url")
                or EXPRESS_ENTRY_MINISTERIAL_URL,
            }
        )

        if len(parsed) >= limit:
            break

    return parsed


def _parse_draws_from_text(text: str, limit: int) -> List[Dict[str, Any]]:
    cleaned = _clean_html(text)
    draws: List[Dict[str, Any]] = []

    date_pattern = (
        r"(January|February|March|April|May|June|July|August|September|October|"
        r"November|December)\s+\d{1,2},\s+20\d{2}"
    )

    chunks = re.split(r"(?:Ministerial Instructions|Results: Rounds of invitations|Round\s+#)", cleaned)
    for chunk in chunks:
        if "CRS" not in chunk and "Invitations" not in chunk:
            continue

        date_match = re.search(date_pattern, chunk)
        crs_match = re.search(
            r"CRS score of lowest-ranked candidate invited[:\s]+([0-9,]+)",
            chunk,
            flags=re.IGNORECASE,
        )
        invitation_match = re.search(
            r"(?:Invitations issued|Number of invitations issued)[:\s]+([0-9,]+)",
            chunk,
            flags=re.IGNORECASE,
        )
        round_match = re.search(r"(?:round|#)\s*([0-9]{2,4})", chunk, flags=re.IGNORECASE)
        type_match = re.search(
            r"(?:Round type|Type of round)[:\s]+([^:]{3,90}?)(?:Invitations|CRS|Date|$)",
            chunk,
            flags=re.IGNORECASE,
        )

        if not (date_match or crs_match or invitation_match):
            continue

        draws.append(
            {
                "round": round_match.group(1) if round_match else None,
                "date": date_match.group(0) if date_match else None,
                "round_type": type_match.group(1).strip() if type_match else None,
                "invitations_issued": (
                    invitation_match.group(1).replace(",", "")
                    if invitation_match
                    else None
                ),
                "crs_cutoff": (
                    crs_match.group(1).replace(",", "") if crs_match else None
                ),
                "source_url": EXPRESS_ENTRY_MINISTERIAL_URL,
            }
        )

        if len(draws) >= limit:
            break

    return draws


def get_latest_ircc_draws(limit: int = 6, language: str = "en") -> Dict[str, Any]:
    language = _normalize_language(language)
    cache_key = f"latest_ircc_draws:{language}:{limit}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    checked_at = _now_iso()
    configured_json_url = os.getenv("IRCC_EXPRESS_ENTRY_DRAWS_JSON_URL", "").strip()
    draw_json_url = configured_json_url or EXPRESS_ENTRY_DRAWS_JSON_URLS[language]

    try:
        draw_payload = _fetch_json(draw_json_url)
        draws = _parse_draws_from_json(draw_payload, limit)
        if draws:
            latest = draws[0]
            return _cache_set(
                cache_key,
                {
                    **_build_official_status(language),
                    "status": "live",
                    "last_checked_at": checked_at,
                    "draws": draws,
                    "total_rounds_loaded": len((draw_payload or {}).get("rounds", []))
                    if isinstance(draw_payload, dict)
                    else len(draws),
                    "source_url": draw_json_url,
                    "official_fallback_url": EXPRESS_ENTRY_MINISTERIAL_URL,
                    "summary": _t(
                        f"Latest Express Entry round: #{latest.get('round')} on {latest.get('date_full') or latest.get('date')} for {latest.get('round_type')}, CRS {latest.get('crs_cutoff')}, {latest.get('invitations_issued')} invitations.",
                        f"Derniere ronde Entree express : no {latest.get('round')} le {latest.get('date_full') or latest.get('date')} pour {latest.get('round_type')}, CRS {latest.get('crs_cutoff')}, {latest.get('invitations_issued')} invitations.",
                        language,
                    ),
                },
            )

        html_text = _fetch_text(EXPRESS_ENTRY_MINISTERIAL_URL)
        draws = _parse_draws_from_text(html_text, limit)
        if draws:
            return _cache_set(
                cache_key,
                {
                    **_build_official_status(language),
                    "status": "live",
                    "last_checked_at": checked_at,
                    "draws": draws,
                    "source_url": EXPRESS_ENTRY_MINISTERIAL_URL,
                    "official_fallback_url": EXPRESS_ENTRY_ROUNDS_URL,
                    "summary": _t(
                        "Latest rounds were read from the official IRCC ministerial instructions page.",
                        "Les dernieres rondes ont ete lues depuis la page officielle des instructions ministerielles d'IRCC.",
                        language,
                    ),
                },
            )

        status = "official_page_requires_browser"
        summary = _t(
            "IRCC publishes the rounds publicly, but the table currently requires browser-side JavaScript. Open the official source for the live list.",
            "IRCC publie les rondes publiquement, mais le tableau necessite actuellement JavaScript cote navigateur. Ouvrez la source officielle pour la liste en direct.",
            language,
        )
    except Exception:
        status = "source_unavailable"
        summary = _t(
            "The official IRCC draw page could not be refreshed from this server. Use the official source link for the live rounds.",
            "La page officielle des rondes IRCC n'a pas pu etre rafraichie depuis ce serveur. Utilisez le lien officiel pour les rondes en direct.",
            language,
        )

    return _cache_set(
        cache_key,
        {
            **_build_official_status(language),
            "status": status,
            "last_checked_at": checked_at,
            "draws": [],
            "source_url": EXPRESS_ENTRY_MINISTERIAL_URL,
            "official_fallback_url": EXPRESS_ENTRY_ROUNDS_URL,
            "summary": summary,
        },
    )


def _category_definitions(language: str) -> List[Dict[str, str]]:
    return [
        {
            "key": "french_language",
            "label": _t("French-language proficiency", "Competence en francais", language),
        },
        {
            "key": "healthcare_social_services",
            "label": _t(
                "Healthcare and social services occupations",
                "Professions de la sante et des services sociaux",
                language,
            ),
        },
        {
            "key": "stem",
            "label": _t("STEM occupations", "Professions STIM", language),
        },
        {
            "key": "trades",
            "label": _t("Trade occupations", "Metiers specialises", language),
        },
        {
            "key": "education",
            "label": _t("Education occupations", "Professions en education", language),
        },
        {
            "key": "transport",
            "label": _t("Transport occupations", "Professions du transport", language),
        },
        {
            "key": "canadian_experience_targeted",
            "label": _t(
                "Canadian-experience targeted categories",
                "Categories ciblees avec experience canadienne",
                language,
            ),
        },
    ]


def _build_category_profile_fit(profile: Any, language: str) -> List[Dict[str, Any]]:
    if not profile:
        return []

    occupation = _profile_occupation(profile).lower()
    noc_digits = _extract_digits(_profile_noc(profile))
    language_score = int(_safe_get(profile, "language_score", 0) or 0)
    has_canadian_experience = bool(_safe_get(profile, "has_canadian_experience", False))

    checks = [
        (
            "french_language",
            language_score >= 7,
            _t(
                "If this score reflects French at NCLC 7+ in all abilities, category-based selection may matter.",
                "Si ce score reflete un francais NCLC 7+ dans toutes les competences, la selection par categorie peut compter.",
                language,
            ),
        ),
        (
            "healthcare_social_services",
            noc_digits.startswith(("31", "32", "33", "41", "42"))
            or any(word in occupation for word in ["nurse", "doctor", "health", "social", "care"]),
            _t(
                "Your occupation should be compared against the official healthcare and social services list.",
                "Votre profession devrait etre comparee a la liste officielle sante et services sociaux.",
                language,
            ),
        ),
        (
            "stem",
            noc_digits.startswith(("21", "212", "213"))
            or any(word in occupation for word in ["software", "data", "engineer", "developer", "scientist"]),
            _t(
                "Your NOC or job title may fit a STEM-style category screen.",
                "Votre CNP ou titre pourrait correspondre a une categorie de type STIM.",
                language,
            ),
        ),
        (
            "trades",
            noc_digits.startswith(("72", "73"))
            or any(word in occupation for word in ["electrician", "plumber", "welder", "carpenter", "mechanic"]),
            _t(
                "Trades draws and provincial streams can be relevant if duties match the official NOC.",
                "Les rondes metiers et volets provinciaux peuvent etre pertinents si les taches correspondent au CNP officiel.",
                language,
            ),
        ),
        (
            "education",
            any(word in occupation for word in ["teacher", "instructor", "educator", "professor"]),
            _t(
                "Education occupations should be checked against the official category list.",
                "Les professions en education devraient etre verifiees avec la liste officielle.",
                language,
            ),
        ),
        (
            "canadian_experience_targeted",
            has_canadian_experience,
            _t(
                "Canadian work experience can matter for targeted categories and provincial streams.",
                "L'experience de travail canadienne peut compter pour certaines categories et certains volets provinciaux.",
                language,
            ),
        ),
    ]

    results = []
    for key, matched, reason in checks:
        if matched:
            label = next(
                (item["label"] for item in _category_definitions(language) if item["key"] == key),
                key,
            )
            results.append(
                {
                    "key": key,
                    "label": label,
                    "fit": "possible",
                    "reason": reason,
                    "source_url": CATEGORY_SELECTION_URL,
                }
            )

    return results[:5]


def _get_processing_data(language: str) -> Dict[str, Any]:
    language = _normalize_language(language)
    cache_key = f"ircc_processing_data:{language}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    country_times = _fetch_json(PROCESSING_TIMES_COUNTRY_JSON_URLS[language])
    non_country_times = _fetch_json(PROCESSING_TIMES_NON_COUNTRY_JSON_URLS[language])
    country_names_payload = _fetch_json(COUNTRY_NAMES_JSON_URLS[language])
    country_names = country_names_payload.get("country-name", {})

    return _cache_set(
        cache_key,
        {
            "country_times": country_times,
            "non_country_times": non_country_times,
            "country_names": country_names,
        },
    )


def _normalize_lookup(value: Any) -> str:
    return html.unescape(str(value or "")).strip().lower().replace("&rsquo;", "'")


def _resolve_country_code(country: Optional[str], country_names: Dict[str, str]) -> Optional[str]:
    if not country:
        return None

    raw = str(country).strip()
    if len(raw) == 2 and raw.upper() in country_names:
        return raw.upper()

    normalized = _normalize_lookup(raw)
    aliases = {
        "usa": "US",
        "u.s.": "US",
        "u.s.a.": "US",
        "united states": "US",
        "united states of america": "US",
        "uk": "GB",
        "united kingdom": "GB",
        "great britain": "GB",
        "uae": "AE",
        "emirates": "AE",
    }
    if normalized in aliases:
        return aliases[normalized]

    for code, name in country_names.items():
        if _normalize_lookup(name) == normalized:
            return code

    for code, name in country_names.items():
        name_lookup = _normalize_lookup(name)
        if normalized in name_lookup or name_lookup in normalized:
            return code

    return None


def _processing_applications(language: str) -> List[Dict[str, Any]]:
    return [
        {
            "key": "visitor_visa_outside_canada",
            "label": _t("Visitor visa from outside Canada", "Visa de visiteur depuis l'exterieur du Canada", language),
            "requires_country": True,
            "category": _t("Temporary residence", "Residence temporaire", language),
        },
        {
            "key": "visitor_visa_inside_canada",
            "label": _t("Visitor visa from inside Canada", "Visa de visiteur depuis le Canada", language),
            "requires_country": False,
            "category": _t("Temporary residence", "Residence temporaire", language),
        },
        {
            "key": "visitor_record",
            "label": _t("Visitor record / extension", "Fiche de visiteur / prolongation", language),
            "requires_country": False,
            "category": _t("Temporary residence", "Residence temporaire", language),
        },
        {
            "key": "super_visa",
            "label": _t("Super visa", "Super visa", language),
            "requires_country": True,
            "category": _t("Temporary residence", "Residence temporaire", language),
        },
        {
            "key": "study_permit_outside_canada",
            "label": _t("Study permit from outside Canada", "Permis d'etudes depuis l'exterieur du Canada", language),
            "requires_country": True,
            "category": _t("Study", "Etudes", language),
        },
        {
            "key": "study_permit_inside_canada",
            "label": _t("Study permit extension", "Prolongation de permis d'etudes", language),
            "requires_country": False,
            "category": _t("Study", "Etudes", language),
        },
        {
            "key": "work_permit_outside_canada",
            "label": _t("Work permit from outside Canada", "Permis de travail depuis l'exterieur du Canada", language),
            "requires_country": True,
            "category": _t("Work", "Travail", language),
        },
        {
            "key": "work_permit_inside_canada",
            "label": _t("Work permit extension", "Prolongation de permis de travail", language),
            "requires_country": False,
            "category": _t("Work", "Travail", language),
        },
        {
            "key": "iec",
            "label": _t("International Experience Canada", "Experience internationale Canada", language),
            "requires_country": False,
            "category": _t("Work", "Travail", language),
        },
        {
            "key": "eta",
            "label": _t("Electronic Travel Authorization", "Autorisation de voyage electronique", language),
            "requires_country": False,
            "category": _t("Travel", "Voyage", language),
        },
        {
            "key": "express_entry_cec",
            "label": _t("Express Entry - Canadian Experience Class", "Entree express - categorie de l'experience canadienne", language),
            "requires_country": False,
            "category": _t("Permanent residence", "Residence permanente", language),
        },
        {
            "key": "express_entry_fsw",
            "label": _t("Express Entry - Federal Skilled Worker", "Entree express - travailleurs qualifies federal", language),
            "requires_country": False,
            "category": _t("Permanent residence", "Residence permanente", language),
        },
        {
            "key": "express_entry_pnp",
            "label": _t("Express Entry - Provincial nominee", "Entree express - candidat provincial", language),
            "requires_country": False,
            "category": _t("Permanent residence", "Residence permanente", language),
        },
        {
            "key": "pnp_non_express_entry",
            "label": _t("Provincial nominee - non Express Entry", "Candidat provincial - hors Entree express", language),
            "requires_country": False,
            "category": _t("Permanent residence", "Residence permanente", language),
        },
        {
            "key": "atlantic_immigration_program",
            "label": _t("Atlantic Immigration Program", "Programme d'immigration au Canada atlantique", language),
            "requires_country": False,
            "category": _t("Permanent residence", "Residence permanente", language),
        },
    ]


def get_processing_time_catalog(language: str = "en") -> Dict[str, Any]:
    language = _normalize_language(language)
    try:
        processing_data = _get_processing_data(language)
        country_names = processing_data["country_names"]
        default_update = (
            processing_data["non_country_times"].get("default-update", {})
            if isinstance(processing_data.get("non_country_times"), dict)
            else {}
        )
        countries_available = len(country_names)
        country_options_preview = [
            {"code": code, "name": html.unescape(name)}
            for code, name in list(country_names.items())[:40]
        ]
        status = "live"
        summary = _t(
            f"IRCC processing-time data loaded in-app. Last updated: {default_update.get('lastupdated', 'unknown')}.",
            f"Les delais IRCC sont charges dans l'application. Derniere mise a jour : {default_update.get('lastupdated', 'inconnue')}.",
            language,
        )
    except Exception:
        default_update = {}
        countries_available = 0
        country_options_preview = []
        status = "source_unavailable"
        summary = _t(
            "IRCC processing-time data could not be refreshed from this server.",
            "Les delais IRCC n'ont pas pu etre rafraichis depuis ce serveur.",
            language,
        )

    return {
        **_build_official_status(language),
        "status": status,
        "source_url": PROCESSING_TIMES_URL,
        "country_data_url": PROCESSING_TIMES_COUNTRY_JSON_URLS[language],
        "non_country_data_url": PROCESSING_TIMES_NON_COUNTRY_JSON_URLS[language],
        "last_checked_at": _now_iso(),
        "last_updated": default_update.get("lastupdated"),
        "flpt_last_updated": default_update.get("flpt_lastupdated"),
        "applications": _processing_applications(language),
        "countries_available": countries_available,
        "country_options_preview": country_options_preview,
        "summary": summary,
    }


def get_processing_time_snapshot(
    *,
    application_type: str,
    country: Optional[str] = None,
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)
    catalog = get_processing_time_catalog(language)
    application = next(
        (item for item in catalog["applications"] if item["key"] == application_type),
        None,
    )

    configured_api = os.getenv("IRCC_PROCESSING_TIME_API_URL", "").strip()
    if configured_api:
        try:
            response = requests.get(
                configured_api,
                params={"application_type": application_type, "country": country or ""},
                timeout=REQUEST_TIMEOUT_SECONDS,
                headers={"User-Agent": "NorthBridgeAI/1.0"},
            )
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, dict):
                return {
                    **payload,
                    "status": payload.get("status") or "live",
                    "source_url": payload.get("source_url") or configured_api,
                    "official_fallback_url": PROCESSING_TIMES_URL,
                    "last_checked_at": _now_iso(),
                }
        except Exception:
            pass

    try:
        processing_data = _get_processing_data(language)
        country_times = processing_data["country_times"]
        non_country_times = processing_data["non_country_times"]
        country_names = processing_data["country_names"]
        default_update = non_country_times.get("default-update", {})

        if application_type in COUNTRY_PROCESSING_APPLICATIONS:
            country_code = _resolve_country_code(country, country_names)
            source_key = COUNTRY_PROCESSING_APPLICATIONS[application_type]
            processing_time = (
                country_times.get(source_key, {}).get(country_code)
                if country_code
                else None
            )
            country_name = html.unescape(country_names.get(country_code, country or ""))
            status = "live" if processing_time else "country_required"

            return {
                **_build_official_status(language),
                "status": status,
                "application_type": application_type,
                "application_label": (application or {}).get("label") or application_type,
                "category": (application or {}).get("category"),
                "requires_country": True,
                "country": country_name or country,
                "country_code": country_code,
                "processing_time": processing_time,
                "last_updated": default_update.get("lastupdated"),
                "source_key": source_key,
                "source_url": PROCESSING_TIMES_COUNTRY_JSON_URLS[language],
                "official_page_url": PROCESSING_TIMES_URL,
                "summary": _t(
                    f"{(application or {}).get('label') or application_type}: {processing_time or 'country required'}"
                    + (f" ({country_name})" if country_name else ""),
                    f"{(application or {}).get('label') or application_type} : {processing_time or 'pays requis'}"
                    + (f" ({country_name})" if country_name else ""),
                    language,
                ),
            }

        if application_type in NON_COUNTRY_PROCESSING_APPLICATIONS:
            section_key, value_key = NON_COUNTRY_PROCESSING_APPLICATIONS[application_type]
            section = non_country_times.get(section_key, {})
            processing_time = section.get(value_key) if isinstance(section, dict) else None
            last_updated = (
                default_update.get("flpt_lastupdated")
                if value_key.endswith("_flpt")
                else default_update.get("lastupdated")
            )

            return {
                **_build_official_status(language),
                "status": "live" if processing_time else "not_available",
                "application_type": application_type,
                "application_label": (application or {}).get("label") or application_type,
                "category": (application or {}).get("category"),
                "requires_country": False,
                "country": None,
                "country_code": None,
                "processing_time": processing_time,
                "last_updated": last_updated,
                "source_key": section_key,
                "source_url": PROCESSING_TIMES_NON_COUNTRY_JSON_URLS[language],
                "official_page_url": PROCESSING_TIMES_URL,
                "summary": _t(
                    f"{(application or {}).get('label') or application_type}: {processing_time or 'not available'}",
                    f"{(application or {}).get('label') or application_type} : {processing_time or 'non disponible'}",
                    language,
                ),
            }
    except Exception:
        pass

    return {
        **_build_official_status(language),
        "status": "source_unavailable",
        "application_type": application_type,
        "application_label": (application or {}).get("label") or application_type,
        "country": country,
        "processing_time": None,
        "source_url": PROCESSING_TIMES_URL,
        "last_checked_at": _now_iso(),
        "summary": _t(
            "Open the official IRCC checker to get the current processing time for this application.",
            "Ouvrez le verificateur officiel d'IRCC pour obtenir le delai actuel de cette demande.",
            language,
        ),
    }


def _job_bank_link(keyword: str, province: Optional[str] = None) -> str:
    params = {"searchstring": keyword or "skilled worker"}
    if province:
        params["locationstring"] = province
    return f"{JOB_BANK_URL}?{urlencode(params)}"


def build_job_opportunity_matches(
    *,
    profile: Any = None,
    province_recommendations: Optional[List[Dict[str, Any]]] = None,
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)
    occupation = _profile_occupation(profile)
    noc_code = _profile_noc(profile)
    preferred_province = _normalize_province(_safe_get(profile, "preferred_province", ""))
    province_recommendations = province_recommendations or []

    keyword = occupation or (f"NOC {noc_code}" if noc_code else "skilled worker")
    links: List[Dict[str, Any]] = []

    target_provinces = []
    if preferred_province:
        target_provinces.append(preferred_province)
    for item in province_recommendations[:4]:
        province = _normalize_province(item.get("province"))
        if province and province not in target_provinces:
            target_provinces.append(province)

    if not target_provinces:
        target_provinces = ["Canada"]

    for province in target_provinces[:4]:
        links.append(
            {
                "label": _t(
                    f"Search {keyword} jobs in {province}",
                    f"Rechercher {keyword} a {province}",
                    language,
                ),
                "province": province,
                "url": _job_bank_link(keyword, province if province != "Canada" else None),
                "reason": _t(
                    "Use Job Bank to validate real labour-market demand before committing to a province.",
                    "Utilisez Job Bank pour valider la demande du marche du travail avant de cibler une province.",
                    language,
                ),
            }
        )

    notes = [
        _t(
            "Review the official Express Entry job-offer rules before relying on a job offer for CRS or eligibility planning.",
            "Verifiez les regles officielles Entree express sur les offres d'emploi avant de compter sur une offre pour le CRS ou l'admissibilite.",
            language,
        ),
        _t(
            "A provincial match is a targeting signal, not a nomination guarantee.",
            "Une correspondance provinciale est un signal de ciblage, pas une garantie de nomination.",
            language,
        ),
    ]

    return {
        "status": "ready",
        "source_url": JOB_BANK_URL,
        "pnp_source_url": PNP_URL,
        "job_offer_source_url": EXPRESS_ENTRY_JOB_OFFER_URL,
        "profile_occupation": occupation,
        "profile_noc": noc_code,
        "target_provinces": target_provinces[:4],
        "links": links,
        "pnp_matches": province_recommendations[:5],
        "notes": notes,
    }


def build_profile_processing_targets(profile: Any, language: str = "en") -> List[Dict[str, Any]]:
    language = _normalize_language(language)
    country = _profile_country(profile)
    targets = [
        get_processing_time_snapshot(
            application_type="visitor_visa_outside_canada",
            country=country,
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="visitor_visa_inside_canada",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="visitor_record",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="study_permit_outside_canada",
            country=country,
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="study_permit_inside_canada",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="work_permit_outside_canada",
            country=country,
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="work_permit_inside_canada",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="express_entry_cec",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="express_entry_fsw",
            language=language,
        ),
        get_processing_time_snapshot(
            application_type="express_entry_pnp",
            language=language,
        ),
    ]
    return targets


def build_immigration_intelligence(
    *,
    profile: Any = None,
    crs_score: Optional[int] = None,
    province_recommendations: Optional[List[Dict[str, Any]]] = None,
    language: str = "en",
    include_live: bool = True,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    draws = get_latest_ircc_draws(language=language) if include_live else {
        **_build_official_status(language),
        "status": "not_refreshed",
        "draws": [],
        "source_url": EXPRESS_ENTRY_MINISTERIAL_URL,
        "last_checked_at": _now_iso(),
        "summary": _t(
            "Live draw refresh is reserved for Premium intelligence.",
            "Le rafraichissement des rondes en direct est reserve a l'intelligence Premium.",
            language,
        ),
    }
    processing_catalog = get_processing_time_catalog(language)
    processing_targets = build_profile_processing_targets(profile, language)
    category_fit = _build_category_profile_fit(profile, language)
    job_matches = build_job_opportunity_matches(
        profile=profile,
        province_recommendations=province_recommendations or [],
        language=language,
    )

    score = int(crs_score or 0)
    if score >= 500:
        draw_fit = _t(
            "Your CRS is in a strong range, but draw type and category fit still matter.",
            "Votre CRS est fort, mais le type de ronde et la categorie restent importants.",
            language,
        )
    elif score >= 470:
        draw_fit = _t(
            "Your CRS is competitive; monitor general, program-specific, and category rounds closely.",
            "Votre CRS est competitif; surveillez les rondes generales, par programme et par categorie.",
            language,
        )
    elif province_recommendations:
        draw_fit = _t(
            "Your CRS may benefit from province targeting and category-based strategy.",
            "Votre CRS peut beneficier d'un ciblage provincial et d'une strategie par categorie.",
            language,
        )
    else:
        draw_fit = _t(
            "Build CRS strength first while monitoring categories and processing timelines.",
            "Renforcez d'abord le CRS tout en surveillant les categories et les delais.",
            language,
        )

    return {
        "locked": False,
        "premium_feature": True,
        "generated_at": _now_iso(),
        "source_status": draws.get("status"),
        "latest_draws": draws,
        "category_selection": {
            **_build_official_status(language),
            "source_url": CATEGORY_SELECTION_URL,
            "current_categories": _category_definitions(language),
            "profile_fit": category_fit,
        },
        "processing_times": {
            **processing_catalog,
            "profile_relevant": processing_targets,
        },
        "job_opportunities": job_matches,
        "profile_draw_fit": {
            "crs_score": score,
            "summary": draw_fit,
            "category_fit_count": len(category_fit),
            "province_target_count": len(province_recommendations or []),
        },
        "ai_summary": _t(
            "Use official draws, processing-time checks, category fit, and Job Bank/PNP signals to guide the next move.",
            "Utilisez les rondes officielles, les delais, les categories et les signaux Job Bank/PNP pour guider la prochaine action.",
            language,
        ),
        "disclaimer": _t(
            "Official IRCC and provincial sources govern. NorthBridgeAI summarizes signals and does not guarantee an outcome.",
            "Les sources officielles d'IRCC et des provinces font foi. NorthBridgeAI resume les signaux et ne garantit aucun resultat.",
            language,
        ),
        "sources": [
            {"label": "IRCC Express Entry rounds", "url": EXPRESS_ENTRY_ROUNDS_URL},
            {"label": "IRCC ministerial instructions", "url": EXPRESS_ENTRY_MINISTERIAL_URL},
            {"label": "IRCC category-based selection", "url": CATEGORY_SELECTION_URL},
            {"label": "IRCC processing times", "url": PROCESSING_TIMES_URL},
            {"label": "Provincial Nominee Program", "url": PNP_URL},
            {"label": "Job Bank", "url": JOB_BANK_URL},
        ],
    }


def build_locked_immigration_intelligence_preview(language: str = "en") -> Dict[str, Any]:
    language = _normalize_language(language)
    return {
        "locked": True,
        "premium_feature": True,
        "required_plan": "premium",
        "source_url": EXPRESS_ENTRY_ROUNDS_URL,
        "upgrade_title": _t(
            "Unlock Premium immigration intelligence",
            "Debloquez l'intelligence immigration Premium",
            language,
        ),
        "upgrade_reason": _t(
            "Premium adds official IRCC draw monitoring, processing-time tracking, category fit, and Job Bank/PNP targeting.",
            "Premium ajoute la veille des rondes IRCC, le suivi des delais, les categories et le ciblage Job Bank/PNP.",
            language,
        ),
        "teaser_cards": [
            {
                "title": _t("Latest IRCC draws", "Dernieres rondes IRCC", language),
                "body": _t(
                    "Monitor official Express Entry rounds and compare them to your CRS/category profile.",
                    "Surveillez les rondes officielles Entree express et comparez-les a votre profil CRS/categorie.",
                    language,
                ),
            },
            {
                "title": _t("Processing-time tracker", "Suivi des delais", language),
                "body": _t(
                    "Track visitor visa, study permit, and work permit checker links by country and application type.",
                    "Suivez les visas visiteurs, permis d'etudes et permis de travail par pays et type de demande.",
                    language,
                ),
            },
            {
                "title": _t("Job and province signals", "Signaux emplois et provinces", language),
                "body": _t(
                    "Use Job Bank and provincial signals to prioritize practical pathways.",
                    "Utilisez Job Bank et les signaux provinciaux pour prioriser les parcours pratiques.",
                    language,
                ),
            },
        ],
    }
