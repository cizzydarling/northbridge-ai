from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from types import SimpleNamespace
from zipfile import ZipFile
import pytest
import backend.launch_smoke_test  # SQLite JSONB compiler, isolated test environment
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.data.db import Base, get_db
from app.models.user_models import User
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.routes import auth_routes, household_routes, application_case_routes, language_assessment_routes, preparation_routes, crs_assessment_routes, strategy_routes
from app.services.language_assessment_service import EXAMS, SKILLS, VERSION, convert, assessment_payload, expires_on
from app.rules.source_review import detect_change, record_human_review, activation_eligible


@pytest.mark.parametrize("exam,edition,raw,expected", [
    ("ielts_general", "general_training_original", [8, 7, 7, 7], [9, 9, 9, 9]),
    ("celpip_general", "celpip_general", [12, 11, 10, 9], [10, 10, 10, 9]),
    ("pte_core", "pte_core", [71, 69, 79, 76], [8, 8, 8, 8]),
    ("tef_canada", "previous_score_equivalency", [249, 207, 310, 310], [7, 7, 7, 7]),
    ("tcf_canada", "tcf_canada", [503, 499, 12, 12], [8, 8, 8, 8]),
])
def test_independent_literal_source_vectors(exam, edition, raw, expected):
    # Literal IRCC table vectors, independent of implementation threshold iteration.
    result = convert(exam, edition, dict(zip(SKILLS, raw)))
    assert [result[s]["benchmark"] for s in SKILLS] == expected


@pytest.fixture
def sprint_api():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([User(id=i, email=f"sprint2-{i}@example.invalid", password="synthetic", role="individual",
            plan="individual_pro" if i == 1 else "free", subscription_status="active",
            subscription_current_period_end=datetime.now(timezone.utc) + timedelta(days=30)) for i in (1, 2)])
        db.flush()
        db.add_all([Profile(user_id=i, first_name="Synthetic", english_language_score=40, language_score=9) for i in (1, 2)])
        db.commit()
    app = FastAPI()
    for module in (household_routes, application_case_routes, language_assessment_routes, preparation_routes, crs_assessment_routes, strategy_routes):
        app.include_router(module.router)
    def database():
        with sessions() as db:
            yield db
    def user(x_test_user: int | None = Header(None), db=Depends(get_db)):
        if x_test_user is None:
            raise HTTPException(401)
        return db.get(User, x_test_user)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[auth_routes.get_current_user] = user
    with TestClient(app) as client:
        yield client, sessions
    engine.dispose()


@pytest.mark.parametrize("exam", EXAMS)
@pytest.mark.parametrize("skill", SKILLS)
@pytest.mark.parametrize("level", range(4, 11))
def test_official_conversion_lower_bound_and_immediately_below(exam, skill, level):
    _, edition, _, table = EXAMS[exam]
    scores = {s: table[s][0] for s in SKILLS}
    scores[skill] = table[skill][level - 4]
    result = convert(exam, edition, scores)[skill]
    assert result["benchmark"] == level
    assert result["at_least"] is (level == 10)
    scores[skill] -= 0.5 if exam == "ielts_general" else 1
    result = convert(exam, edition, scores)[skill]
    assert result["benchmark"] == (None if level == 4 else level - 1)


@pytest.mark.parametrize("exam,edition,scores", [
    ("ielts_academic", "academic", {s: 7 for s in SKILLS}),
    ("ielts_general", "one_skill_retake", {s: 7 for s in SKILLS}),
    ("tef_canada", "score_699", {s: 450 for s in SKILLS}),
    ("pte_core", "pte_core", {s: True for s in SKILLS}),
    ("ielts_general", "general_training_original", {s: 6.25 for s in SKILLS}),
    ("pte_core", "pte_core", {s: 91 for s in SKILLS}),
    ("celpip_general", "celpip_general", {"listening": 9}),
    ("pte_core", "pte_core", {s: "NaN" for s in SKILLS}),
])
def test_unsupported_formats_fail_closed(exam, edition, scores):
    with pytest.raises(ValueError):
        convert(exam, edition, scores)


def test_expiry_anniversary_not_valid_and_history_readable():
    assert expires_on(date(2024, 2, 29)) == date(2026, 2, 28)
    record = SimpleNamespace(id=1, language="en", exam="ielts_general", edition="general_training_original",
        test_date=date(2024, 10, 18), raw_scores=dict(listening=8, reading=7, writing=7, speaking=7), mapping_version=VERSION)
    assert assessment_payload(record, as_of=date(2026, 10, 17))["usable"]
    expired = assessment_payload(record, as_of=date(2026, 10, 18))
    assert expired["status"] == "expired" and not expired["usable"]
    assert expired["raw_scores"]["reading"] == 7


def test_language_history_selection_ownership_and_legacy_preservation(sprint_api):
    c, sessions = sprint_api
    a, b = {"X-Test-User": "1"}, {"X-Test-User": "2"}
    assert c.get("/language-assessments").status_code == 401
    assert c.get("/language-assessments", headers=a).json()["unknown"] == ["en", "fr"]
    body = dict(language="en", exam="ielts_general", edition="general_training_original", test_date=date.today().isoformat(),
                raw_scores=dict(listening=8, reading=7, writing=7, speaking=7))
    result = c.post("/language-assessments", headers=a, json=body)
    assert result.status_code == 201, result.text
    item = result.json()
    assert not item["independently_verified"] and item["provenance"] == "user_reported"
    assert c.put("/language-assessments/current/en", headers=b, json={"assessment_id": item["id"]}).status_code == 404
    assert c.put("/language-assessments/current/fr", headers=a, json={"assessment_id": item["id"]}).status_code == 404
    assert c.put("/language-assessments/current/en", headers=a, json={"assessment_id": item["id"]}).status_code == 200
    assert c.put("/language-assessments/current/en", headers=a, json={"assessment_id": None}).status_code == 200
    assert len(c.get("/language-assessments", headers=a).json()["assessments"]) == 1
    assert not c.get("/language-assessments", headers=b).json()["assessments"]
    old = c.post("/language-assessments", headers=a, json={**body, "test_date": "2020-01-01"}).json()
    assert c.put("/language-assessments/current/en", headers=a, json={"assessment_id": old["id"]}).status_code == 409
    assert c.post("/language-assessments", headers=a, json={**body, "provenance": "verified"}).status_code == 422
    with sessions() as db:
        p = db.query(Profile).filter_by(user_id=1).one()
        assert p.english_language_score == 40 and p.language_score == 9


@pytest.mark.parametrize("language", ["en", "fr"])
def test_case_answers_edit_review_export_return_and_revision_isolation(sprint_api, language):
    c, sessions = sprint_api
    a, b = {"X-Test-User": "1"}, {"X-Test-User": "2"}
    case = c.get("/application-cases/context", headers=a).json()["case_id"]
    other = c.get("/application-cases/context", headers=b).json()["case_id"]
    save = c.post("/self/workspace", headers=a, json={"case_id": case, "matter_type": "permanent_residence", "intake": {"occupation": "Synthetic developer", "target_province": "Ontario", "server_only": "preserve"}})
    assert save.status_code == 200, save.text
    assert c.post(f"/preparation/cases/{case}/drafts", headers=b, json={"language": language}).status_code == 404
    assert c.post(f"/preparation/cases/{other}/drafts", headers=b, json={"language": language}).status_code == 403
    response = c.post(f"/preparation/cases/{case}/drafts", headers=a, json={"language": language})
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["official"] is False and "Synthetic developer" in draft["content"]
    edit = {"revision": draft["revision"], "title": "Synthetic draft", "content": draft["content"] + "\n\nChecked synthetic chronology."}
    updated = c.patch(f"/preparation/drafts/{draft['id']}", headers=a, json=edit)
    assert updated.status_code == 200, updated.text
    assert c.patch(f"/preparation/drafts/{draft['id']}", headers=a, json=edit).status_code == 409
    assert c.patch(f"/preparation/drafts/{draft['id']}", headers=b, json=edit).status_code == 404
    review = c.post(f"/preparation/drafts/{draft['id']}/review", headers=a).json()
    assert review["official_completeness"] == "not_assessed" and review["actions"]
    exported = c.get(f"/preparation/drafts/{draft['id']}/export.docx", headers=a)
    assert exported.status_code == 200
    assert c.get(f"/preparation/drafts/{draft['id']}/export.docx", headers=b).status_code == 404
    with ZipFile(BytesIO(exported.content)) as archive:
        xml = archive.read("word/document.xml").decode()
        assert "Synthetic draft" in xml and "Checked synthetic chronology" in xml
        assert "BROUILLON" in xml if language == "fr" else "DRAFT" in xml
        assert not any("vbaProject" in name for name in archive.namelist())
    assert c.get(f"/preparation/cases/{other}/drafts", headers=b).json() == []
    returned = c.get(f"/preparation/cases/{case}/drafts", headers=a).json()[0]
    assert returned["content"] == edit["content"] and returned["revision"] == 2
    with sessions() as db:
        saved = db.query(SelfApplication).filter_by(user_id=1, application_case_id=case).one()
        assert saved.intake_payload["server_only"] == "preserve"


def test_crs_incomplete_scenario_isolation_and_future_rules_not_activated(sprint_api):
    c, sessions = sprint_api
    body = {"baseline": {"age": 30}, "scenario": {"age": 29}, "as_of": "2026-11-03"}
    response = c.post("/assessments/crs", headers={"X-Test-User": "1"}, json=body)
    assert response.status_code == 200
    result = response.json()
    assert result["baseline"]["score"] is None and result["score_difference"] is None
    assert result["baseline"]["ruleset_version"] == "crs-2026-11-03.pending"
    assert result["baseline"]["snapshot_hash"] != result["scenario"]["snapshot_hash"]
    assert body["baseline"]["age"] == 30 and not result["writes"]
    with sessions() as db:
        assert db.query(Profile).filter_by(user_id=1).one().english_language_score == 40


def test_source_change_requires_human_review_fixture_and_explicit_release():
    proposal = detect_change(source_url="https://www.canada.ca/official", previous_hash="0" * 64,
        content=b"new official text", observed_on=date(2026, 10, 18), effective_from=date(2026, 11, 3),
        version="future.v1", impacted_features=("crs",))
    assert not activation_eligible(proposal, as_of=date(2026, 11, 3), released_versions={"future.v1"}, accepted_fixture_digests={"1" * 64})
    with pytest.raises(ValueError):
        record_human_review(proposal, reviewer="ai", authorized_reviewers={"human"}, reviewed_on=date(2026, 10, 18), fixture_digest="1" * 64)
    reviewed = record_human_review(proposal, reviewer="human", authorized_reviewers={"human"}, reviewed_on=date(2026, 10, 18), fixture_digest="1" * 64)
    assert not activation_eligible(reviewed, as_of=date(2026, 11, 2), released_versions={"future.v1"}, accepted_fixture_digests={"1" * 64})
    assert not activation_eligible(reviewed, as_of=date(2026, 11, 3), released_versions=set(), accepted_fixture_digests={"1" * 64})
    assert activation_eligible(reviewed, as_of=date(2026, 11, 3), released_versions={"future.v1"}, accepted_fixture_digests={"1" * 64})
