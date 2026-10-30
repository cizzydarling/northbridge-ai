from __future__ import annotations

import html
import json
import os
from app.services.computation_context import reuse, scoped_computation
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
    return reuse("public_json", url, lambda: _retrieve_json(url), cache_failure=True)


def _retrieve_json(url: str) -> Any:
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
        draw_date = item.get("date") or item.get("draw_date") or item.get("drawDate") or item.get("drawDateISO")
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

    if not all(isinstance(value, dict) and value for value in
               (country_times, non_country_times, country_names)):
        raise ValueError("Invalid IRCC processing-time data")

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


@scoped_computation
def _build_unverified_immigration_intelligence(
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
    from app.services.content_scope import notice, SCOPE
    return {"content_scope": SCOPE, "locked": True, "premium_feature": True,
            "required_plan": "premium", "source_url": EXPRESS_ENTRY_ROUNDS_URL,
            "upgrade_title": _t("Official information", "Information officielle", language),
            "upgrade_reason": notice(language), "teaser_cards": []}
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


def build_immigration_intelligence(*, profile=None, crs_score=None, province_recommendations=None, language="en", include_live=True):
    from app.services.content_scope import notice, SCOPE
    return {"content_scope": SCOPE, "locked": False, "generated_at": _now_iso(),
            "latest_draws": get_latest_ircc_draws(language=language) if include_live else {},
            "processing_times": get_processing_time_catalog(language),
            "disclaimer": notice(language),
            "sources": [{"label": "IRCC", "url": EXPRESS_ENTRY_ROUNDS_URL},
                        {"label": "PNP / PCP", "url": PNP_URL}]}


# Explicit informational mode: independent of configurable Premium analysis feeds.
def normalize_official_processing(feeds, language):
    country=feeds['country']; other=feeds['non_country']; names=feeds['names'].get('country-name')
    if not all(isinstance(x,dict) and x for x in (country,other,names)):
        raise ValueError('official_processing_schema')
    updated=other.get('default-update',{}).get('lastupdated')
    country_updated=country.get('default-update',{}).get('lastupdated')
    rows=[]
    for app in _processing_applications(language):
        key=app['key']
        if key in COUNTRY_PROCESSING_APPLICATIONS:
            section=country.get(COUNTRY_PROCESSING_APPLICATIONS[key],{})
            if not isinstance(section,dict): raise ValueError('official_country_schema')
            for code,name in names.items():
                value=section.get(code)
                rows.append({'application_type':key,'country_code':code,'country_name':html.unescape(str(name)),
                             'processing_time':value if isinstance(value,str) and len(value)<160 and '<' not in value else None,
                             'source_updated_at':country_updated})
        elif key in NON_COUNTRY_PROCESSING_APPLICATIONS:
            section_key,value_key=NON_COUNTRY_PROCESSING_APPLICATIONS[key]
            section=other.get(section_key,{})
            value=section.get(value_key) if isinstance(section,dict) else None
            rows.append({'application_type':key,'country_code':None,'country_name':None,
                         'processing_time':value if isinstance(value,str) and len(value)<160 and '<' not in value else None,
                         'source_updated_at':updated})
    return rows


def official_processing_reference(application_type=None, country=None, language='en'):
    from app.services.official_resources import resource_data
    language=_normalize_language(language)
    applications=_processing_applications(language)
    if application_type and application_type not in {a['key'] for a in applications}:
        from fastapi import HTTPException
        raise HTTPException(422,'Unsupported application category')
    data=resource_data('processing_'+language)
    records=data.pop('records')
    countries={r['country_code']:r['country_name'] for r in records if r['country_code']}
    result={**data,'applications':applications,'countries':[{'code':k,'name':v} for k,v in sorted(countries.items(),key=lambda x:x[1])],
            'official_page_url':PROCESSING_TIMES_URL if language=='en' else 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/verifier-delais-traitement.html',
            'processing_time':None,'personal_prediction':False,'application_type':application_type,
            'source_updated_at':next((r['source_updated_at'] for r in records if r['source_updated_at']),None)}
    if application_type in COUNTRY_PROCESSING_APPLICATIONS:
        result['source_url']=PROCESSING_TIMES_COUNTRY_JSON_URLS[language]
        result['source_updated_at']=next((r['source_updated_at'] for r in records if r['application_type']==application_type),None)
    result['source_references']=[PROCESSING_TIMES_COUNTRY_JSON_URLS[language],PROCESSING_TIMES_NON_COUNTRY_JSON_URLS[language],COUNTRY_NAMES_JSON_URLS[language]]
    published_date=None
    raw_date=result['source_updated_at']
    if isinstance(raw_date,str):
        # IRCC's French feed uses localized month names; avoid host-locale dependence.
        french_months={'janvier':1,'février':2,'mars':3,'avril':4,'mai':5,'juin':6,
                       'juillet':7,'août':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12}
        localized=re.fullmatch(r'(\d{1,2})\s+([^\s]+)\s+(\d{4})',raw_date.strip().lower())
        if localized and localized[2] in french_months:
            try: published_date=datetime(int(localized[3]),french_months[localized[2]],int(localized[1]),tzinfo=timezone.utc)
            except ValueError: pass
        for pattern in ('%B %d, %Y','%Y-%m-%d'):
            try: published_date=datetime.strptime(raw_date,pattern).replace(tzinfo=timezone.utc);break
            except ValueError: pass
    if published_date and (datetime.now(timezone.utc)-published_date).total_seconds()>14*86400:
        result['status']='stale'
    if not application_type: return result
    if application_type in COUNTRY_PROCESSING_APPLICATIONS and not country:
        return {**result,'selection_status':'country_required'}
    row=next((r for r in records if r['application_type']==application_type and (r['country_code']==(country or '').upper() if r['country_code'] else True)),None)
    value=row.get('processing_time') if row else None
    published=isinstance(value,str) and bool(re.search(r'\d.*\b(?:days?|weeks?|months?|minutes?|hours?|years?|jours?|semaines?|mois|heures?|ans?|années?)\b',value,re.I))
    return {**result,'processing_time':value if published else None,'published_message':value,
            'selection_status':'published_estimate' if published else 'unavailable','country_code':country}



def normalize_official_draws(payload, language, *, acquired_at=None):
    """Validate the complete official feed before normalization or promotion.

    Source labels are preserved, not translated or converted to predictions.
    Missing timezone on historical timestamps stays explicitly unknown.
    """
    from datetime import date
    from urllib.parse import urlsplit, parse_qs
    from app.services.official_resource_snapshots import SnapshotRejected, _publisher_date
    if language not in {'en', 'fr'} or not isinstance(payload, dict) or not set(payload) <= {'classes', 'rounds'}:
        raise SnapshotRejected('draw_component_schema')
    if 'classes' in payload and (not isinstance(payload['classes'], str) or len(payload['classes']) > 100):
        raise SnapshotRejected('draw_metadata_schema')
    source_rows = payload.get('rounds')
    if not isinstance(source_rows, list) or not 0 < len(source_rows) <= 10000:
        raise SnapshotRejected('draw_nonempty_history_required')
    fields = {'drawNumber','drawNumberURL','drawDate','drawDateISO','drawDateFull','drawName','drawSize','drawCRS','mitext','DrawText1','drawText2','drawDateTime','drawCutOff','drawDistributionAsOn'} | {'dd'+str(i) for i in range(1,19)}
    required = {'drawNumber','drawName','drawSize','drawCRS'}
    seen, records = set(), []
    def clean(value, *, optional=False, limit=500):
        if optional and value is None: return None
        if not isinstance(value, str) or not value.strip() or len(value) > limit or any(ord(c) < 32 for c in value):
            raise SnapshotRejected('draw_field_type')
        return value.strip()
    def integer(value, maximum, *, allow_zero=False):
        value = clean(value, limit=20)
        if not re.fullmatch(r'(?:0|[1-9]\d*|[1-9]\d{0,2}(?:[, \u00a0\u202f]\d{3})+)', value):
            raise SnapshotRejected('draw_integer_format')
        number = int(re.sub(r'[, \u00a0\u202f]', '', value))
        if not (0 if allow_zero else 1) <= number <= maximum: raise SnapshotRejected('draw_integer_range')
        return number
    def timestamp(value):
        if value in (None, ''): return None
        value = clean(value, limit=100)
        # Official feeds use localized month text. An explicit UTC suffix is
        # required before assigning any timezone; absent suffix is not inferred.
        match = re.fullmatch(r'(.+?) (?:at|à) (\d{2}:\d{2}:\d{2})( UTC)?', value)
        if not match: raise SnapshotRejected('draw_timestamp_format')
        day = _publisher_date(match[1])
        if day is None: raise SnapshotRejected('draw_timestamp_format')
        try:
            clock = datetime.strptime(match[2], '%H:%M:%S').time()
        except ValueError: raise SnapshotRejected('draw_timestamp_format') from None
        instant = day.replace(hour=clock.hour, minute=clock.minute, second=clock.second)
        if acquired_at is not None and instant > acquired_at: raise SnapshotRejected('draw_future_timestamp')
        return instant.isoformat() if match[3] else None
    for raw in source_rows:
        if not isinstance(raw, dict) or not required <= set(raw) or not set(raw) <= fields:
            raise SnapshotRejected('draw_row_schema')
        for key,value in raw.items():
            if key not in {'drawDateTime','drawCutOff','drawDistributionAsOn'}:
                clean(value, limit=2000 if key in {'DrawText1','mitext','drawNumberURL'} else 500)
            elif value is not None and not isinstance(value,str): raise SnapshotRejected('draw_field_type')
        round_id = str(integer(raw['drawNumber'], 100000))
        if round_id in seen: raise SnapshotRejected('duplicate_source_record')
        seen.add(round_id)
        iso = raw.get('drawDateISO') or raw.get('drawDate')
        try:
            event_day = date.fromisoformat(clean(iso, limit=10))
        except (ValueError, TypeError): raise SnapshotRejected('draw_date_format') from None
        if raw.get('drawDateISO') and raw.get('drawDate') and raw['drawDate'] != raw['drawDateISO']:
            raise SnapshotRejected('draw_date_disagreement')
        if acquired_at is not None and event_day > acquired_at.date(): raise SnapshotRejected('draw_future_date')
        if raw.get('drawDateFull') and _publisher_date(raw['drawDateFull']).date() != event_day:
            raise SnapshotRejected('draw_date_disagreement')
        draw_at, tie_at = timestamp(raw.get('drawDateTime')), timestamp(raw.get('drawCutOff'))
        if draw_at and datetime.fromisoformat(draw_at).date() != event_day: raise SnapshotRejected('draw_date_disagreement')
        if draw_at and tie_at and tie_at > draw_at: raise SnapshotRejected('draw_tie_break_after_round')
        if raw.get('drawDistributionAsOn'):
            distribution_date = _publisher_date(raw['drawDistributionAsOn'])
            if acquired_at is not None and distribution_date > acquired_at: raise SnapshotRejected('draw_future_distribution_date')
        for key,value in raw.items():
            if key.startswith('dd'): integer(value, 100000000, allow_zero=True)
        link = None
        for key in ('DrawText1','mitext','drawNumberURL'):
            if key not in raw: continue
            href = _extract_href(raw[key])
            if not href: raise SnapshotRejected('draw_detail_link')
            candidate = _absolute_canada_url(href)
            parts = urlsplit(candidate)
            if parts.scheme != 'https' or parts.netloc != 'www.canada.ca' or parts.fragment or not parts.path.startswith(('/en/immigration-refugees-citizenship/','/fr/immigration-refugies-citoyennete/','/content/canadasite/en/immigration-refugees-citizenship/','/content/canadasite/fr/immigration-refugies-citoyennete/')):
                raise SnapshotRejected('draw_detail_link')
            query = parse_qs(parts.query)
            if set(query) - {'q'} or (query and query.get('q') != [round_id]): raise SnapshotRejected('draw_detail_identity')
            if not any(segment in parts.path for segment in ('/express-entry-rounds/', '/entree-express-rondes/')):
                raise SnapshotRejected('draw_detail_link')
            if query and not parts.path.endswith('/invitations.html'):
                raise SnapshotRejected('draw_detail_identity')
            if not query and not parts.path.endswith('/invitations-'+round_id+'.html'):
                raise SnapshotRejected('draw_detail_identity')
            if link is not None and link != candidate: raise SnapshotRejected('draw_detail_disagreement')
            link = candidate
        if link is None: raise SnapshotRejected('draw_detail_link')
        parsed = _parse_draws_from_json({'rounds':[raw]}, 1)[0]
        if any(c in clean(raw['drawName']) for c in '<>'): raise SnapshotRejected('draw_category_text')
        records.append({**parsed,'round':round_id,'date':event_day.isoformat(),
                        'round_type':raw['drawName'].strip(),'invitations_issued':integer(raw['drawSize'],1000000),
                        'crs_cutoff':integer(raw['drawCRS'],1200 if event_day < date(2026,11,3) else 1000000),'draw_at_utc':draw_at,
                        'tie_break_at_utc':tie_at,'source_url':link,'source_language':language,
                        'rule_version':'crs-2025-03-25' if date(2025,3,25) <= event_day < date(2026,11,3) else 'unverified_historical_rules',
                        'prediction':False})
    return sorted(records, key=lambda row:(row['date'],int(row['round'])), reverse=True)


def official_draw_reference(limit=6, language='en', offset=0, category=''):
    """Historical public reference only. No remote fetch or snapshot mutation."""
    from app.services.official_resources import resource_data
    language = _normalize_language(language)
    payload = resource_data('draws_'+language)
    rows = payload['records']
    if category:
        rows = [r for r in rows if category.casefold() in r['round_type'].casefold()]
    return {**{k:v for k,v in payload.items() if k != 'records'},
            'available':payload['status'] in {'available','stale'},'draws':rows[offset:offset+limit],
            'total':len(rows),'offset':offset,'limit':limit,'historical_only':True,
            'notice':_t('Historical rounds are not future invitation predictions. Compare cutoffs only within their rule and category context.',
                        'Les rondes historiques ne prédisent pas les invitations futures. Comparez les seuils uniquement selon leurs règles et catégories.', language)}
