import json
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional


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


def _normalize_text(value: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s\-\+/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _tokenize(value: Optional[str]) -> List[str]:
    text = _normalize_text(value)
    if not text:
        return []
    return [part for part in text.split(" ") if part]


def _expand_occupation_variants(value: Optional[str]) -> List[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return []

    variants = {normalized}

    replacements = {
        "software developer": [
            "software engineer",
            "developer",
            "programmer",
            "computer programmer",
            "application developer",
            "applications developer",
            "full stack developer",
            "full-stack developer",
            "web developer",
        ],
        "software engineer": [
            "software developer",
            "developer",
            "programmer",
            "computer programmer",
            "application developer",
            "applications developer",
            "full stack developer",
            "full-stack developer",
        ],
        "developer": [
            "software developer",
            "software engineer",
            "programmer",
            "computer programmer",
            "web developer",
            "application developer",
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
        "nurse": [
            "registered nurse",
            "licensed practical nurse",
            "registered psychiatric nurse",
            "nursing",
        ],
    }

    for key, extra in replacements.items():
        if normalized == key or key in normalized:
            variants.update(_normalize_text(item) for item in extra)

    tokens = normalized.split()
    if len(tokens) > 1:
        variants.add(" ".join(tokens[:-1]))
        variants.add(tokens[-1])

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

    if score >= 35:
        return False

    if len(overlap) >= 2 or len(variant_overlap) >= 3:
        return False

    if _starts_with_same_core(list(variant_tokens), title):
        return False

    return True


def _score_record(
    record: Dict[str, Any],
    *,
    occupation: str,
    job_description: str,
    duties: List[str],
) -> NocMatch:
    occupation_norm = _normalize_text(occupation)
    occupation_variants = _expand_occupation_variants(occupation)
    job_description_norm = _normalize_text(job_description)
    duties_text = _normalize_text(" ".join(duties))
    combined_user_text = _normalize_text(
        " ".join([occupation_norm, job_description_norm, duties_text])
    )

    blob = _build_search_blob(record)

    title = _normalize_text(record.get("title"))
    example_titles = [_normalize_text(x) for x in (record.get("example_titles") or [])]
    keywords = [_normalize_text(x) for x in (record.get("keywords") or [])]
    main_duties = [_normalize_text(x) for x in (record.get("main_duties") or [])]

    score = 0.0
    why: List[str] = []

    if occupation_norm and occupation_norm == title:
        score += 55
        why.append("Exact occupation title match.")

    if occupation_norm and occupation_norm in example_titles:
        score += 48
        why.append("Exact example title match.")

    for variant in occupation_variants:
        if variant and variant == title and variant != occupation_norm:
            score += 34
            why.append("Close occupation title match.")
            break

    for variant in occupation_variants:
        if variant and variant in example_titles and variant != occupation_norm:
            score += 30
            why.append("Close example title match.")
            break

    if occupation_norm and occupation_norm in blob:
        score += 18
        why.append("Occupation title appears in NOC profile.")

    for variant in occupation_variants:
        if variant and variant in blob and variant != occupation_norm:
            score += 12
            why.append("Related occupation wording appears in NOC profile.")
            break

    occupation_tokens = set(_tokenize(occupation_norm))
    variant_tokens = set()
    for variant in occupation_variants:
        variant_tokens.update(_tokenize(variant))

    blob_tokens = set(_tokenize(blob))
    overlap = occupation_tokens.intersection(blob_tokens)
    variant_overlap = variant_tokens.intersection(blob_tokens)

    if overlap:
        token_points = min(len(overlap) * 5, 24)
        score += token_points
        why.append(f"Occupation keywords overlap: {', '.join(sorted(overlap)[:5])}.")
    elif variant_overlap:
        token_points = min(len(variant_overlap) * 3.5, 18)
        score += token_points
        why.append(
            f"Related keywords overlap: {', '.join(sorted(variant_overlap)[:5])}."
        )

    for keyword in keywords:
        if keyword and keyword in combined_user_text:
            score += 4

    duty_hits = 0
    for duty in main_duties:
        duty_tokens = _tokenize(duty)[:4]
        if duty and any(fragment in combined_user_text for fragment in duty_tokens):
            duty_hits += 1

    if duty_hits:
        score += min(duty_hits * 6, 24)
        why.append("User responsibilities align with main duties.")

    if job_description_norm:
        jd_tokens = set(_tokenize(job_description_norm))
        jd_overlap = jd_tokens.intersection(blob_tokens)
        if jd_overlap:
            score += min(len(jd_overlap) * 1.5, 12)
            why.append("Job description aligns with NOC keywords.")

    if _is_weakly_related(
        occupation_tokens=occupation_tokens,
        variant_tokens=variant_tokens,
        blob_tokens=blob_tokens,
        title=title,
        score=score,
    ):
        score -= 18
        why.append("Weak overall occupation alignment penalty.")

    score = round(max(score, 0), 2)

    confidence = 0.12
    if score >= 85:
        confidence = 0.97
    elif score >= 70:
        confidence = 0.92
    elif score >= 55:
        confidence = 0.84
    elif score >= 40:
        confidence = 0.72
    elif score >= 28:
        confidence = 0.58
    elif score >= 18:
        confidence = 0.42

    if not why:
        why.append("General keyword alignment.")

    return NocMatch(
        noc=record["noc"],
        title=record["title"],
        teer=int(record["teer"]),
        score=score,
        confidence=round(confidence, 2),
        broad_category=record.get("broad_category", ""),
        immigration_category_tags=list(record.get("immigration_category_tags") or []),
        express_entry_skilled_work=bool(record.get("express_entry_skilled_work", False)),
        why_matched=why[:3],
    )


def suggest_noc_matches(
    *,
    occupation: str,
    job_description: str = "",
    duties: Optional[List[str]] = None,
    top_k: int = 3,
) -> Dict[str, Any]:
    duties = duties or []
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
        }

    best = ranked[0]

    min_score_threshold = 24
    relative_threshold = max(best.score * 0.45, min_score_threshold)

    filtered = [
        item
        for item in ranked
        if item.score >= relative_threshold
    ]

    top = filtered[: max(1, top_k)]
    if not top:
        top = [best]

    serialized_top = [
        {
            "noc": item.noc,
            "title": item.title,
            "teer": item.teer,
            "confidence": item.confidence,
            "broad_category": item.broad_category,
            "immigration_category_tags": item.immigration_category_tags,
            "express_entry_skilled_work": item.express_entry_skilled_work,
        }
        for item in top
    ]

    alternatives = serialized_top[1:]

    return {
        "occupation_input": occupation,
        "job_description_input": job_description,
        "duties_input": duties,
        "suggested_noc": best.noc,
        "suggested_title": best.title,
        "teer": best.teer,
        "confidence": best.confidence,
        "broad_category": best.broad_category,
        "why_matched": best.why_matched,
        "alternatives": alternatives,
        "matches": serialized_top,
        "immigration_flags": {
            "express_entry_skilled_work": best.express_entry_skilled_work,
            "category_tags": best.immigration_category_tags,
        },
    }


def lookup_noc_by_code(code: str) -> Optional[Dict[str, Any]]:
    normalized = str(code or "").strip()
    for record in load_noc_dataset():
        if record.get("noc") == normalized:
            return record
    return None