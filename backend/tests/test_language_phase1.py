"""Synthetic Phase 1 schema, persistence and consumer safety regressions."""
from types import SimpleNamespace

import pytest
import backend.launch_smoke_test  # registers SQLite-compatible model imports
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.data.db import Base, get_db
from app.models.user_models import User
from app.models.profile_model import Profile
from app.routes import profile_routes
from app.routes.app_routes import is_profile_complete
from app.schemas.profile_schema import ProfileCreate, ProfileUpdate, ProfileResponse
from app.services.crs_calculator import calculate_crs_breakdown
from app.services.career_match_service import normalize_input, _score_province, PROVINCES
from app.schemas.career_match_schema import CareerMatchRequest

FIELDS = ["language_score", "english_language_score", "french_language_score"]

@pytest.mark.parametrize("schema", [ProfileCreate, ProfileUpdate])
@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("value", [None, 1, 12])
def test_valid_writes(schema, field, value):
    assert getattr(schema(**{field: value}), field) == value

@pytest.mark.parametrize("schema", [ProfileCreate, ProfileUpdate])
@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("value", [0, -1, 13, 40, 1.5, True, False, "bad", "7", float("inf"), float("nan")])
def test_invalid_writes(schema, field, value):
    with pytest.raises(ValidationError):
        schema(**{field: value})

@pytest.fixture
def profile_api():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([User(id=i, email=f"language{i}@example.invalid", password="synthetic", role="individual", plan="free") for i in [1, 2, 3]])
        db.add_all([Profile(user_id=1, first_name="Original", occupation="Original role", english_language_score=40, language_score=40), Profile(user_id=2, english_language_score=7)])
        db.commit()
    identity = {"id": 1}
    app = FastAPI()
    app.include_router(profile_routes.router)
    def database():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[profile_routes.get_current_user] = lambda: SimpleNamespace(id=identity["id"])
    with TestClient(app) as client:
        yield client, sessions, identity
    engine.dispose()

@pytest.mark.parametrize("verb", ["patch", "put"])
def test_partial_updates_preserve_legacy_and_other_fields(profile_api, verb):
    client, sessions, identity = profile_api
    assert client.get("/profiles/me").json()["english_language_score"] == 40
    response = getattr(client, verb)("/profiles/me", json={"occupation": "New role"})
    assert response.status_code == 200
    assert response.json()["first_name"] == "Original"
    assert response.json()["english_language_score"] == 40
    assert response.json()["language_score"] == 40
    assert getattr(client, verb)("/profiles/me", json={"english_language_score": None}).json()["english_language_score"] is None
    assert client.get("/profiles/me").json()["language_score"] == 40
    assert getattr(client, verb)("/profiles/me", json={"french_language_score": 12}).json()["french_language_score"] == 12
    with sessions() as db:
        assert db.query(Profile).filter_by(user_id=2).one().english_language_score == 7
    identity["id"] = 2
    assert client.get("/profiles/me").json()["french_language_score"] is None
    identity["id"] = 999
    assert client.patch("/profiles/me", json={"language_score": 7}).status_code == 404

@pytest.mark.parametrize("path", ["/profiles/me", "/profiles/create"])
def test_create_and_update_reject_invalid_http_values(profile_api, path):
    client, _, _ = profile_api
    assert client.post(path, json={"english_language_score": 40}).status_code == 422
    for verb in ["put", "patch"]:
        assert getattr(client, verb)("/profiles/me", json={"english_language_score": True}).status_code == 422
    client.app.dependency_overrides.pop(profile_routes.get_current_user)
    assert client.get("/profiles/me").status_code == 401
    assert client.patch("/profiles/me", json={"english_language_score": 7}).status_code == 401

@pytest.mark.parametrize("plan", ["free", "individual_pro"])
def test_unknown_is_complete_and_capture_has_no_plan_gate(profile_api, plan):
    client, sessions, _ = profile_api
    with sessions() as db:
        user = db.get(User, 1)
        user.plan = plan
        db.commit()
    assert client.patch("/profiles/me", json={field: None for field in FIELDS}).status_code == 200
    required = dict(first_name="Test", last_name="Owner", nationality="France", current_country="France", current_city="Paris", marital_status="single", preferred_language="en", age=30, education="bachelor", experience_years=3, occupation="Admin", noc_code="13100", preferred_province="Ontario")
    assert is_profile_complete(SimpleNamespace(**required, **{field: None for field in FIELDS}))

@pytest.mark.parametrize("value", [None, 0, 40, -1, True])
def test_retained_crs_fails_closed_on_unknown_or_invalid(value):
    result = calculate_crs_breakdown(SimpleNamespace(age=30, experience_years=3, english_language_score=value, language_score=9))
    assert result["total_crs"] is None
    assert result["breakdown"]["language"] is None

def test_ambiguous_combined_career_data_does_not_supply_language_evidence():
    profile = SimpleNamespace(occupation="Admin", noc_code="13100", education="bachelor", experience_years=3, language_score=40, current_city="Paris", current_country="France", has_job_offer=False, preferred_province=None)
    item = normalize_input(CareerMatchRequest(), profile)
    assert item.language_level is None
    assert item.french_language_level is None
    for province in PROVINCES:
        _, reasons = _score_province(province, item, set())
        assert not any("language" in reason.lower() or "bilingual" in reason.lower() for reason in reasons)

def test_profile_update_cannot_target_another_user(profile_api):
    client, sessions, _ = profile_api
    assert client.patch("/profiles/me", json={"user_id": 2, "english_language_score": 1}).status_code == 200
    with sessions() as db:
        assert db.query(Profile).filter_by(user_id=1).one().english_language_score == 1
        assert db.query(Profile).filter_by(user_id=2).one().english_language_score == 7

@pytest.mark.parametrize("path", ["/profiles/me", "/profiles/create"])
@pytest.mark.parametrize("value", [None, 1, 12])
def test_create_persists_nullable_benchmarks(profile_api, path, value):
    client, sessions, identity = profile_api
    identity["id"] = 3
    response = client.post(path, json={field: value for field in FIELDS})
    assert response.status_code == 200
    with sessions() as db:
        created = db.query(Profile).filter_by(user_id=3).one()
        assert all(getattr(created, field) == value for field in FIELDS)

def test_retained_crs_wrappers_do_not_coerce_unknown_to_zero_or_raise():
    from app.services.crs_calculator import calculate_crs, build_recommendation_result
    profile = SimpleNamespace(age=30, experience_years=3, language_score=40)
    assert calculate_crs(profile) is None
    result = build_recommendation_result(profile, None)
    assert result["crs_score"] is None
    assert result["eligible_pathways"] == []


def legacy_frontend_put(saved, **edits):
    """Synthetic mirror of c7147f7 ProfilePage hydrate/submit and api normalize.
    All profile fields are sent; combined is rebuilt, missing English falls back.
    Browser contract test also executes the original source to pin this shape.
    """
    from app.schemas.profile_schema import ProfileBase
    form = {key: saved.get(key, field.default) for key, field in ProfileBase.model_fields.items()}
    for key, value in list(form.items()):
        if value is None:
            form[key] = ""
    if not form["english_language_score"] and form["language_score"]:
        form["english_language_score"] = form["language_score"]
    form.update(edits)
    for field in FIELDS:
        if form[field] in ("", None):
            form[field] = None
        else:
            parsed = float(form[field])
            form[field] = int(parsed) if parsed.is_integer() else parsed
    form["language_score"] = max(form["english_language_score"] or 0, form["french_language_score"] or 0) or None
    for key, value in list(form.items()):
        if value == "":
            form[key] = None
    form["preferred_language"] = form["preferred_language"] or "en"
    return form


@pytest.mark.parametrize("scores,edits,expected,status", [
    ((9, 9, 7), {"occupation": "New role"}, (9, 9, 7), 200),
    ((40, 40, None), {"occupation": "New role"}, (40, 40, None), 200),
    ((None, 40, None), {"occupation": "New role"}, (None, 40, None), 200),
    ((40, None, None), {"occupation": "New role"}, (40, None, None), 200),
    ((9, None, None), {"occupation": "New role"}, (9, None, None), 200),
    ((9, 0, None), {"occupation": "New role"}, (9, 0, None), 200),
    ((None, None, None), {"occupation": "New role"}, (None, None, None), 200),
    ((0, 0, None), {"occupation": "New role"}, (0, 0, None), 200),
    ((9, 9, 7), {"english_language_score": None}, (9, None, 7), 200),
    ((9, 9, 7), {"english_language_score": 12}, (9, 12, 7), 200),
    ((9, None, None), {"english_language_score": 8}, (9, 8, None), 200),
    ((9, None, None), {"french_language_score": 7}, (9, None, 7), 200),
    ((None, None, None), {"english_language_score": 40}, None, 422),
    ((40, 40, None), {"english_language_score": 41}, None, 422),
    ((40, 40, None), {"french_language_score": 40}, None, 422),
    ((None, None, None), {"english_language_score": 0}, None, 422),
    ((None, None, None), {"english_language_score": 1.5}, None, 422),
    ((9, 9, 7), {"english_language_score": "12"}, (9, 12, 7), 200),
])
def test_exact_old_frontend_put(profile_api, scores, edits, expected, status):
    client, sessions, _ = profile_api
    with sessions() as db:
        profile = db.query(Profile).filter_by(user_id=1).one()
        for field, value in zip(FIELDS, scores):
            setattr(profile, field, value)
        db.commit()
    before = client.get("/profiles/me").json()
    payload = legacy_frontend_put(before, **edits)
    response = client.put("/profiles/me", json=payload)
    assert response.status_code == status
    after = client.get("/profiles/me").json()
    if status == 200:
        assert tuple(after[field] for field in FIELDS) == expected
        assert after["occupation"] == edits.get("occupation", before["occupation"])
        assert after["first_name"] == before["first_name"]
    else:
        assert after == before
    with sessions() as db:
        assert db.query(Profile).filter_by(user_id=2).one().english_language_score == 7


@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("value", [True, False, 1.5, "7", "bad", -1, 13])
def test_legacy_full_put_cannot_bypass_validation(profile_api, field, value):
    client, _, _ = profile_api
    before = client.get("/profiles/me").json()
    payload = legacy_frontend_put(before, occupation="Must not persist")
    payload[field] = value
    assert client.put("/profiles/me", json=payload).status_code == 422
    assert client.get("/profiles/me").json() == before


def test_legacy_policy_is_owner_scoped_and_partial_put_remains_strict(profile_api):
    client, _, identity = profile_api
    owner_payload = legacy_frontend_put(client.get("/profiles/me").json(), occupation="Other")
    identity["id"] = 2
    owner_payload["user_id"] = 1
    assert client.put("/profiles/me", json=owner_payload).status_code == 422
    assert client.get("/profiles/me").json()["english_language_score"] == 7
    identity["id"] = 999
    assert client.put("/profiles/me", json=owner_payload).status_code == 404
    identity["id"] = 1
    assert client.put("/profiles/me", json={"english_language_score": 40}).status_code == 422
    assert client.patch("/profiles/me", json=owner_payload).status_code == 422
    client.app.dependency_overrides.pop(profile_routes.get_current_user)
    assert client.put("/profiles/me", json=owner_payload).status_code == 401


def test_ambiguous_echo_does_not_prevent_explicit_patch_correction(profile_api):
    client, sessions, _ = profile_api
    with sessions() as db:
        profile = db.query(Profile).filter_by(user_id=1).one()
        profile.language_score = 9
        profile.english_language_score = None
        db.commit()
    before = client.get("/profiles/me").json()
    # Even if the operator meant English=9, this full request cannot prove that.
    response = client.put("/profiles/me", json=legacy_frontend_put(before, english_language_score=9))
    assert response.status_code == 200
    assert response.json()["english_language_score"] is None
    assert client.patch("/profiles/me", json={"english_language_score": 9}).json()["english_language_score"] == 9
    assert client.patch("/profiles/me", json={"english_language_score": None}).json()["english_language_score"] is None
    assert client.get("/profiles/me").json()["language_score"] == 9



def test_legacy_normalizer_defaults_do_not_clear_unrelated_data(profile_api):
    client, sessions, _ = profile_api
    with sessions() as db:
        profile = db.query(Profile).filter_by(user_id=1).one()
        profile.phone_number = "synthetic-phone"
        profile.job_description = "Synthetic existing description"
        profile.has_job_offer = True
        profile.has_canadian_experience = None
        profile.studied_in_canada = True
        db.commit()
    before = client.get("/profiles/me").json()
    body = legacy_frontend_put(before, occupation="New role")
    # Old modal omits these fields; old api.js manufactures these values.
    for field in ["phone_number", "job_description"]:
        body[field] = None
    for field in ["has_job_offer", "has_canadian_experience", "studied_in_canada"]:
        body[field] = False
    response = client.put("/profiles/me", json=body)
    assert response.status_code == 200
    after = response.json()
    for field in ["phone_number", "job_description", "has_job_offer",
                  "has_canadian_experience", "studied_in_canada"]:
        assert after[field] == before[field]
    assert after["occupation"] == "New role"
    cleared = client.patch("/profiles/me", json={"phone_number": None, "has_job_offer": False})
    assert cleared.status_code == 200
    assert cleared.json()["phone_number"] is None
    assert cleared.json()["has_job_offer"] is False
