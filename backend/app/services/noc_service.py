import json
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set


DATA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "noc_2021_seed.json",
)


@dataclass
class NocMatch:
    noc: str
    title: str
    teer: int
    score: float
    confidence: float
    broad_category: str
    immigration_category_tags: List[str]
    express_entry_skilled_work: bool
    why_matched: List[str]


STOPWORDS = {
    "and",
    "or",
    "the",
    "a",
    "an",
    "for",
    "of",
    "to",
    "in",
    "with",
    "on",
    "at",
    "by",
}

SENIORITY_WORDS = {
    "junior",
    "jr",
    "senior",
    "sr",
    "lead",
    "principal",
    "assistant",
    "associate",
    "intermediate",
    "entry",
    "level",
    "specialist",
}


def _normalize_text(value: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("&", " and ")
    text = text.replace("/", " ")
    text = text.replace("\\", " ")
    text = text.replace("-", " ")
    text = re.sub(r"[^a-z0-9\s\+]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _normalize_phrase(value: Optional[str]) -> str:
    return _normalize_text(value)


def _normalize_token(token: str) -> str:
    token = str(token or "").strip()
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith("ches") or token.endswith("shes"):
        return token[:-2]
    if token.endswith("ses") and not token.endswith("sses"):
        return token[:-2]
    if token.endswith("es") and token[-3:-2] in {"x", "s", "z"}:
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us", "ics")):
        return token[:-1]
    return token


def _tokenize(value: Optional[str]) -> List[str]:
    text = _normalize_text(value)
    if not text:
        return []
    return [
        _normalize_token(part)
        for part in text.split(" ")
        if part and part not in STOPWORDS
    ]


def _token_set(value: Optional[str]) -> Set[str]:
    return set(_tokenize(value))


def _deduplicate_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    output: List[str] = []
    for item in items:
        normalized = _normalize_text(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(item)
    return output


def _extract_numeric_noc(value: Optional[str]) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _strip_seniority_tokens(value: Optional[str]) -> str:
    tokens = [token for token in _tokenize(value) if token not in SENIORITY_WORDS]
    return " ".join(tokens).strip()


def _title_similarity(left: str, right: str) -> float:
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)

    if not left_tokens or not right_tokens:
        return 0.0

    overlap = left_tokens.intersection(right_tokens)
    union = left_tokens.union(right_tokens)

    if not union:
        return 0.0

    return round(len(overlap) / len(union), 4)


def _contains_phrase(blob: str, phrase: str) -> bool:
    phrase_norm = _normalize_phrase(phrase)
    if not blob or not phrase_norm:
        return False
    return phrase_norm in blob


def _expand_occupation_variants(value: Optional[str]) -> List[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return []

    simplified = _strip_seniority_tokens(normalized)

    variants = {
        normalized,
        simplified,
    }

    synonym_groups = {
        "software developer": [
            "software engineer",
            "developer",
            "programmer",
            "computer programmer",
            "application developer",
            "applications developer",
            "full stack developer",
            "full stack engineer",
            "fullstack developer",
            "web developer",
            "backend developer",
            "back end developer",
            "frontend developer",
            "front end developer",
        ],
        "software engineer": [
            "software developer",
            "developer",
            "programmer",
            "computer programmer",
            "application developer",
            "applications developer",
            "full stack developer",
            "full stack engineer",
            "backend developer",
            "frontend developer",
        ],
        "developer": [
            "software developer",
            "software engineer",
            "programmer",
            "computer programmer",
            "web developer",
            "application developer",
            "backend developer",
            "frontend developer",
        ],
        "programmer": [
            "software developer",
            "software engineer",
            "developer",
            "computer programmer",
        ],
        "web developer": [
            "developer",
            "software developer",
            "software engineer",
            "front end developer",
            "frontend developer",
            "back end developer",
            "backend developer",
        ],
        "data analyst": [
            "analyst",
            "business analyst",
            "data specialist",
            "reporting analyst",
            "bi analyst",
            "business intelligence analyst",
            "data reporting analyst",
        ],
        "business analyst": [
            "analyst",
            "data analyst",
            "systems analyst",
            "business systems analyst",
            "process analyst",
        ],
        "systems analyst": [
            "business analyst",
            "business systems analyst",
            "analyst",
            "it analyst",
        ],
        "project manager": [
            "program manager",
            "project coordinator",
            "implementation manager",
            "delivery manager",
            "operations manager",
        ],
        "project coordinator": [
            "project manager",
            "coordinator",
            "program coordinator",
            "implementation coordinator",
        ],
        "product manager": [
            "program manager",
            "project manager",
            "digital product manager",
            "technical product manager",
        ],
        "nurse": [
            "registered nurse",
            "licensed practical nurse",
            "registered psychiatric nurse",
            "nursing",
        ],
        "accountant": [
            "financial accountant",
            "accounting analyst",
            "auditor",
            "accounting",
        ],
        "administrative assistant": [
            "office assistant",
            "admin assistant",
            "administrative officer",
            "office administrator",
        ],
        "customer service representative": [
            "customer service agent",
            "client service representative",
            "call center agent",
            "support representative",
        ],
        "teacher": [
            "secondary school teacher",
            "elementary school teacher",
            "kindergarten teacher",
            "college instructor",
            "vocational instructor",
            "university professor",
            "lecturer",
        ],
        "school teacher": [
            "secondary school teacher",
            "elementary school teacher",
            "kindergarten teacher",
            "teacher",
        ],
        "secondary teacher": [
            "secondary school teacher",
            "high school teacher",
            "teacher",
        ],
        "high school teacher": [
            "secondary school teacher",
            "secondary teacher",
            "teacher",
        ],
        "elementary teacher": [
            "elementary school teacher",
            "kindergarten teacher",
            "primary school teacher",
            "teacher",
        ],
        "kindergarten teacher": [
            "elementary school teacher",
            "kindergarten teacher",
            "early childhood educator",
            "teacher",
        ],
        "college teacher": [
            "college instructor",
            "vocational instructor",
            "post-secondary instructor",
            "teacher",
        ],
        "university teacher": [
            "university professor",
            "lecturer",
            "teacher",
        ],
        "instructor": [
            "college instructor",
            "vocational instructor",
            "trainer",
            "teacher",
        ],
    }

    for key, extra in synonym_groups.items():
        key_norm = _normalize_text(key)
        if key_norm == "teacher" and normalized != key_norm:
            continue
        if normalized == key_norm or key_norm in normalized or key_norm in simplified:
            variants.update(_normalize_text(item) for item in extra)

    base_tokens = simplified.split()
    if len(base_tokens) > 1:
        variants.add(" ".join(base_tokens[:-1]))
        variants.add(base_tokens[-1])

    if len(base_tokens) >= 2:
        variants.add(" ".join(base_tokens[:2]))

    return [item for item in variants if item]


@lru_cache(maxsize=1)
def load_noc_dataset() -> List[Dict[str, Any]]:
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _build_search_blob(record: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append(record.get("title", ""))
    parts.extend(record.get("example_titles", []) or [])
    parts.extend(record.get("keywords", []) or [])
    parts.extend(record.get("main_duties", []) or [])
    parts.extend(record.get("employment_requirements", []) or [])
    return _normalize_text(" ".join(parts))


def _starts_with_same_core(occupation_variants: List[str], record_title: str) -> bool:
    title_tokens = _tokenize(record_title)
    if not title_tokens:
        return False

    for variant in occupation_variants:
        variant_tokens = _tokenize(variant)
        if not variant_tokens:
            continue
        if variant_tokens[0] == title_tokens[0]:
            return True

    return False


def _is_weakly_related(
    *,
    occupation_tokens: set[str],
    variant_tokens: set[str],
    blob_tokens: set[str],
    title: str,
    score: float,
) -> bool:
    overlap = occupation_tokens.intersection(blob_tokens)
    variant_overlap = variant_tokens.intersection(blob_tokens)

    if score >= 36:
        return False

    if len(overlap) >= 2 or len(variant_overlap) >= 3:
        return False

    if _starts_with_same_core(list(variant_tokens), title):
        return False

    return True


def _duty_alignment_score(duties: List[str], main_duties: List[str], combined_user_text: str) -> tuple[float, List[str]]:
    if not duties or not main_duties:
        return 0.0, []

    score = 0.0
    reasons: List[str] = []

    normalized_user_duties = [_normalize_text(item) for item in duties if _normalize_text(item)]
    normalized_main_duties = [_normalize_text(item) for item in main_duties if _normalize_text(item)]

    matched_count = 0

    for user_duty in normalized_user_duties:
        user_tokens = _token_set(user_duty)
        if not user_tokens:
            continue

        best_similarity = 0.0
        for noc_duty in normalized_main_duties:
            noc_tokens = _token_set(noc_duty)
            if not noc_tokens:
                continue

            overlap = user_tokens.intersection(noc_tokens)
            union = user_tokens.union(noc_tokens)
            similarity = len(overlap) / len(union) if union else 0.0

            if similarity > best_similarity:
                best_similarity = similarity

        if best_similarity >= 0.45:
            score += 8
            matched_count += 1
        elif best_similarity >= 0.28:
            score += 4
            matched_count += 1

    if matched_count:
        reasons.append("User responsibilities align with main duties.")

    compact_tokens = []
    for duty in normalized_main_duties[:8]:
        compact_tokens.extend(_tokenize(duty)[:5])

    compact_tokens = _deduplicate_preserve_order(compact_tokens)
    fragment_hits = sum(1 for token in compact_tokens if token in combined_user_text)
    if fragment_hits:
        score += min(fragment_hits * 1.2, 10)
        reasons.append("Duty-related keywords appear in the user profile.")

    return min(score, 26), _deduplicate_preserve_order(reasons)


def _score_record(
    record: Dict[str, Any],
    *,
    occupation: str,
    job_description: str,
    duties: List[str],
) -> NocMatch:
    occupation_norm = _normalize_text(occupation)
    occupation_core = _strip_seniority_tokens(occupation)
    occupation_variants = _expand_occupation_variants(occupation)
    job_description_norm = _normalize_text(job_description)
    duties_text = _normalize_text(" ".join(duties))
    combined_user_text = _normalize_text(
        " ".join([occupation_norm, occupation_core, job_description_norm, duties_text])
    )

    blob = _build_search_blob(record)

    title_raw = record.get("title", "")
    title = _normalize_text(title_raw)
    title_core = _strip_seniority_tokens(title_raw)
    example_titles = [_normalize_text(x) for x in (record.get("example_titles") or [])]
    example_title_cores = [_strip_seniority_tokens(x) for x in (record.get("example_titles") or [])]
    keywords = [_normalize_text(x) for x in (record.get("keywords") or [])]
    main_duties = [_normalize_text(x) for x in (record.get("main_duties") or [])]

    score = 0.0
    why: List[str] = []

    if occupation_norm and occupation_norm == title:
        score += 58
        why.append("Exact occupation title match.")
    elif occupation_core and occupation_core == title_core:
        score += 50
        why.append("Exact core occupation title match.")

    if occupation_norm and occupation_norm in example_titles:
        score += 48
        why.append("Exact example title match.")
    elif occupation_core and occupation_core in example_title_cores:
        score += 42
        why.append("Exact core example title match.")

    best_title_similarity = max(
        [_title_similarity(occupation_norm, title), _title_similarity(occupation_core, title_core)] +
        [_title_similarity(variant, title) for variant in occupation_variants],
        default=0.0,
    )

    if best_title_similarity >= 0.8:
        score += 28
        why.append("Strong title similarity.")
    elif best_title_similarity >= 0.55:
        score += 18
        why.append("Moderate title similarity.")

    for variant in occupation_variants:
        if variant and variant == title and variant != occupation_norm:
            score += 30
            why.append("Close occupation title match.")
            break

    for variant in occupation_variants:
        if variant and variant in example_titles and variant != occupation_norm:
            score += 28
            why.append("Close example title match.")
            break

    if occupation_norm and _contains_phrase(blob, occupation_norm):
        score += 18
        why.append("Occupation title appears in NOC profile.")
    elif occupation_core and _contains_phrase(blob, occupation_core):
        score += 15
        why.append("Core occupation wording appears in NOC profile.")

    for variant in occupation_variants:
        if variant and _contains_phrase(blob, variant) and variant not in {occupation_norm, occupation_core}:
            score += 11
            why.append("Related occupation wording appears in NOC profile.")
            break

    occupation_tokens = set(_tokenize(occupation_norm))
    core_tokens = set(_tokenize(occupation_core))
    variant_tokens = set()
    for variant in occupation_variants:
        variant_tokens.update(_tokenize(variant))

    blob_tokens = set(_tokenize(blob))
    overlap = occupation_tokens.intersection(blob_tokens)
    core_overlap = core_tokens.intersection(blob_tokens)
    variant_overlap = variant_tokens.intersection(blob_tokens)

    if overlap:
        token_points = min(len(overlap) * 5.5, 26)
        score += token_points
        why.append(f"Occupation keywords overlap: {', '.join(sorted(overlap)[:5])}.")
    elif core_overlap:
        token_points = min(len(core_overlap) * 4.5, 22)
        score += token_points
        why.append(f"Core occupation keywords overlap: {', '.join(sorted(core_overlap)[:5])}.")
    elif variant_overlap:
        token_points = min(len(variant_overlap) * 3.5, 18)
        score += token_points
        why.append(f"Related keywords overlap: {', '.join(sorted(variant_overlap)[:5])}.")

    keyword_hits = 0
    for keyword in keywords:
        if keyword and _contains_phrase(combined_user_text, keyword):
            keyword_hits += 1

    if keyword_hits:
        score += min(keyword_hits * 4, 16)
        why.append("Matched NOC keyword signals.")

    duty_score, duty_reasons = _duty_alignment_score(
        duties=duties,
        main_duties=main_duties,
        combined_user_text=combined_user_text,
    )
    score += duty_score
    why.extend(duty_reasons)

    if job_description_norm:
        jd_tokens = set(_tokenize(job_description_norm))
        jd_overlap = jd_tokens.intersection(blob_tokens)
        if jd_overlap:
            score += min(len(jd_overlap) * 1.7, 14)
            why.append("Job description aligns with NOC keywords.")

    if _is_weakly_related(
        occupation_tokens=occupation_tokens or core_tokens,
        variant_tokens=variant_tokens,
        blob_tokens=blob_tokens,
        title=title,
        score=score,
    ):
        score -= 18
        why.append("Weak overall occupation alignment penalty.")

    score = round(max(score, 0), 2)

    confidence = 0.12
    if score >= 100:
        confidence = 0.98
    elif score >= 85:
        confidence = 0.95
    elif score >= 70:
        confidence = 0.90
    elif score >= 55:
        confidence = 0.82
    elif score >= 40:
        confidence = 0.70
    elif score >= 28:
        confidence = 0.56
    elif score >= 18:
        confidence = 0.40

    if best_title_similarity >= 0.8 and confidence < 0.9:
        confidence = max(confidence, 0.9)
    elif best_title_similarity >= 0.55 and confidence < 0.76:
        confidence = max(confidence, 0.76)

    if not why:
        why.append("General keyword alignment.")

    return NocMatch(
        noc=str(record["noc"]),
        title=record["title"],
        teer=int(record["teer"]),
        score=score,
        confidence=round(confidence, 2),
        broad_category=record.get("broad_category", ""),
        immigration_category_tags=list(record.get("immigration_category_tags") or []),
        express_entry_skilled_work=bool(record.get("express_entry_skilled_work", False)),
        why_matched=_deduplicate_preserve_order(why)[:4],
    )


def _build_noc_summary(best: Optional[NocMatch], occupation: str) -> Dict[str, Any]:
    if not best:
        return {
            "occupation": occupation,
            "noc_code": "",
            "noc_title": "",
            "teer": None,
            "confidence": 0.0,
            "broad_category": "",
            "express_entry_skilled_work": False,
            "category_tags": [],
        }

    return {
        "occupation": occupation,
        "noc_code": best.noc,
        "noc_title": best.title,
        "teer": best.teer,
        "confidence": best.confidence,
        "broad_category": best.broad_category,
        "express_entry_skilled_work": best.express_entry_skilled_work,
        "category_tags": list(best.immigration_category_tags or []),
    }


def suggest_noc_matches(
    *,
    occupation: str,
    job_description: str = "",
    duties: Optional[List[str]] = None,
    top_k: int = 3,
) -> Dict[str, Any]:
    duties = [item.strip() for item in (duties or []) if str(item or "").strip()]
    occupation = str(occupation or "").strip()
    job_description = str(job_description or "").strip()
    top_k = max(1, min(int(top_k or 3), 10))

    dataset = load_noc_dataset()

    matches = [
        _score_record(
            record,
            occupation=occupation,
            job_description=job_description,
            duties=duties,
        )
        for record in dataset
    ]

    ranked = sorted(
        matches,
        key=lambda x: (x.score, x.confidence),
        reverse=True,
    )

    if not ranked:
        empty_summary = _build_noc_summary(None, occupation)
        return {
            "occupation_input": occupation,
            "job_description_input": job_description,
            "duties_input": duties,
            "suggested_noc": "",
            "suggested_title": "",
            "teer": 0,
            "confidence": 0.0,
            "broad_category": "",
            "why_matched": ["No match available."],
            "alternatives": [],
            "matches": [],
            "immigration_flags": {
                "express_entry_skilled_work": False,
                "category_tags": [],
            },
            "noc_summary": empty_summary,
        }

    best = ranked[0]

    min_score_threshold = 24
    relative_threshold = max(best.score * 0.45, min_score_threshold)

    filtered = [item for item in ranked if item.score >= relative_threshold]
    top = filtered[: max(1, top_k)]
    if not top:
        top = [best]

    serialized_top = [
        {
            "noc": item.noc,
            "title": item.title,
            "teer": item.teer,
            "score": item.score,
            "confidence": item.confidence,
            "broad_category": item.broad_category,
            "immigration_category_tags": item.immigration_category_tags,
            "express_entry_skilled_work": item.express_entry_skilled_work,
            "why_matched": item.why_matched,
        }
        for item in top
    ]

    alternatives = serialized_top[1:]
    noc_summary = _build_noc_summary(best, occupation)

    match_quality = "low"
    if best.confidence >= 0.9:
        match_quality = "high"
    elif best.confidence >= 0.7:
        match_quality = "medium"

    return {
        "occupation_input": occupation,
        "job_description_input": job_description,
        "duties_input": duties,
        "suggested_noc": best.noc,
        "suggested_title": best.title,
        "teer": best.teer,
        "confidence": best.confidence,
        "score": best.score,
        "match_quality": match_quality,
        "broad_category": best.broad_category,
        "why_matched": best.why_matched,
        "alternatives": alternatives,
        "matches": serialized_top,
        "immigration_flags": {
            "express_entry_skilled_work": best.express_entry_skilled_work,
            "category_tags": best.immigration_category_tags,
        },
        "noc_summary": noc_summary,
    }


def lookup_noc_by_code(code: str) -> Optional[Dict[str, Any]]:
    normalized = _extract_numeric_noc(code)
    if not normalized:
        return None

    for record in load_noc_dataset():
        record_noc = _extract_numeric_noc(record.get("noc"))
        if record_noc == normalized:
            return record
    return None
