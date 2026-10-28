"""Bounded local fixture validation. Passing is not human approval or activation."""
from datetime import date
import hashlib
import json
from pathlib import Path
from app.services.official_crs import evaluate_candidate, TABLE_DIGEST


def validation_report():
    raw = (Path(__file__).parent / "fixtures" / "crs_vectors.json").read_bytes()
    vectors = json.loads(raw)["vectors"]
    checks = []
    for vector in vectors:
        result = evaluate_candidate(vector["facts"], as_of=date(2026, 11, 2))
        checks.append(result["score"] == vector["score"] and result["section_totals"] == vector["sections"])
        checks.append(evaluate_candidate(vector["facts"], as_of=date(2026, 11, 3))["score"] is None)
    return {"status": "FIXTURES_PASS" if all(checks) else "FIXTURES_FAIL", "checks": len(checks),
            "fixture_digest": hashlib.sha256(raw).hexdigest(), "table_digest": TABLE_DIGEST,
            "independent_human_review": "PENDING", "activation": "DISABLED",
            "november_transition": "REVIEW_REQUIRED"}
