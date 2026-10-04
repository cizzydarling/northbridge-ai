import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.launch_smoke_test  # register models under the test isolation boundary
from app.main import register_routers
from app.data.db import get_db
from app.routes import strategy_routes
from app.services import strategy_service, ai_advisor
from app.services.content_scope import CRS_URL, AI_SCOPE, guard_generated_text
from app.services.forms_package_service import build_forms_package
from app.schemas.self_application_schema import SelfApplicationResponse


@pytest.mark.parametrize("language", ["en", "fr"])
def test_strategy_never_executes_analytical_engines(monkeypatch, language):
    forbidden = Mock(side_effect=AssertionError("Unverified engine executed"))
    for name in ("calculate_crs", "estimate_immigration_probabilities", "predict_express_entry_draw",
                 "simulate_crs_improvements", "generate_ai_strategy"):
        monkeypatch.setattr(strategy_service, name, forbidden)
    case = SimpleNamespace(id=3, application_type="permanent_residence")
    member = SimpleNamespace(id=7, relationship_to_primary="spouse", participation="unknown")
    result = strategy_service.build_strategy(SimpleNamespace(), language, [member], case)
    assert result["official_crs_url"] == CRS_URL
    assert result["family_context"]["members"][0]["participation"] == "unknown"
    assert result["family_document_requirements"][0]["required"] is False
    assert not set(result) & {"crs_score", "probabilities", "draw_prediction", "roadmap", "province_recommendations"}
    forbidden.assert_not_called()


@pytest.mark.parametrize("path", ["/crs/calculate", "/recommendations/simulate", "/recommendations/generate",
    "/recommendations/me", "/recommendations/crs-breakdown", "/recommendations/1",
    "/programs/recommend/from-profile", "/express-entry/express-entry/evaluate",
    "/clients/1/simulations", "/simulation-scenarios/"])
def test_legacy_bypass_unmounted_before_database(path):
    app = FastAPI(); register_routers(app)
    def forbidden():
        raise AssertionError("Disabled route accessed database")
    app.dependency_overrides[get_db] = forbidden
    with TestClient(app) as client:
        for method in ("GET", "POST"):
            assert client.request(method, path, json={}).status_code == 404


def test_analytical_pdf_unavailable():
    app = FastAPI(); register_routers(app)
    app.dependency_overrides[get_db] = lambda: Mock()
    app.dependency_overrides[strategy_routes.require_self_user] = lambda: SimpleNamespace(id=1)
    with TestClient(app) as client:
        assert client.get("/self/strategy/export-pdf").status_code == 410


@pytest.mark.parametrize("language", ["en", "fr"])
def test_historical_analysis_cannot_enter_ai(language):
    poisoned = {"crs_score": 999, "advisor_summary": "LEGACY_ANALYSIS_SENTINEL", "probability": 99,
                "family_context": {"members": [{"participation": "unknown"}]}}
    text = ai_advisor._extract_strategy_context(poisoned, language)
    assert "999" not in text and "SENTINEL" not in text and '"probability"' not in text
    assert "unknown" in text
    assert AI_SCOPE in ai_advisor._build_chat_system_prompt(language)
    assert ai_advisor._extract_chat_history([{"role":"assistant", "content":"Your CRS is 999"}]) == []
    assert "999" not in guard_generated_text("Your CRS is 999", language)


def test_saved_application_serialization_is_nonmutating():
    now = datetime.now(timezone.utc)
    data = dict(id=1, user_id=2, matter_type="study_permit", created_at=now, updated_at=now,
                eligibility_result={"score":99,"summary":"OLD_ANALYSIS"}, forms_result={"ready":True},
                checklist_result=[{"required":True}])
    result = SelfApplicationResponse(**data).model_dump()
    assert result["eligibility_result"] == {} and result["forms_result"] == {}
    assert result["checklist_result"] == []
    assert data["eligibility_result"]["score"] == 99


@pytest.mark.parametrize("language", ["en", "fr"])
def test_forms_are_unverified_drafts(language):
    package = build_forms_package("express_entry", {"first_name":"A", "last_name":"B"}, language)
    for form in package["forms"]:
        assert form["ready"] is False
        if form["code"] != "IMM5476":
            assert form["required"] is False
            assert form["applicability"] == "unverified"


@pytest.mark.parametrize("language", ["en", "fr"])
def test_provider_cannot_replay_analytical_context(monkeypatch, language):
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(
        message=SimpleNamespace(content=json.dumps({"reply":"Your CRS is 999 and your chance is 88%", "suggested_next_actions":[]})))])
    monkeypatch.setattr(ai_advisor, "_get_openai_client", lambda: client)
    result = ai_advisor.generate_ai_chat_reply(message="Help organize my documents", language=language,
        profile=SimpleNamespace(noc_code="13100"), strategy={"crs_score":999,"advisor_summary":"POISON"},
        application_context={"eligibility_result":{"summary":"POISON"},"family_context":{"participation":"unknown"}},
        chat_history=[{"role":"assistant","content":"POISON"}])
    sent = json.dumps(client.chat.completions.create.call_args.kwargs["messages"])
    assert "POISON" not in sent and "999" not in sent
    assert "unknown" in sent and "suggestion_requires_duties_review" in sent
    assert "999" not in result["reply"] and "88%" not in result["reply"]


def test_noc_suggestion_retains_match_but_not_immigration_flags():
    from app.schemas.noc_schema import NocSuggestResponse
    from app.services.noc_service import suggest_noc_matches
    raw = suggest_noc_matches(occupation="Administrative officer", top_k=2)
    output = NocSuggestResponse(**raw).model_dump()
    assert output["suggested_noc"] == raw["suggested_noc"]
    assert output["confidence"] == raw["confidence"]
    assert output["classification_status"] == "suggested_match_requires_duties_review"
    assert "immigration_flags" not in output
    assert "express_entry_skilled_work" not in json.dumps(output)
    assert "immigration_category_tags" not in json.dumps(output)


def test_saved_generated_analysis_is_withheld_without_database_changes():
    from app.schemas.generated_document_schema import GeneratedDocumentResponse
    now = datetime.now(timezone.utc)
    original = dict(id=1, document_type="strategy", title="Old analysis", language="en",
                    content="Your strongest pathway is PNP", created_at=now, updated_at=now)
    result = GeneratedDocumentResponse(**original).model_dump()
    assert "strongest pathway" not in result["content"]
    assert original["content"] == "Your strongest pathway is PNP"


@pytest.mark.parametrize("mode", ["confidence", "officer_ready"])
def test_document_assessment_modes_unavailable(mode):
    from app.routes import ai_routes
    from app.core.access_control import get_current_user
    app = FastAPI(); register_routers(app)
    app.dependency_overrides[get_db] = lambda: Mock()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, role="individual", plan="free")
    with TestClient(app) as client:
        result = client.post("/ai/generate-document", json={"document_type":"letter_of_explanation", "language":"en", "tone":"professional", "mode":mode})
        assert result.status_code == 410, result.text


def test_application_context_preserves_intake_but_discards_analysis():
    from app.services.content_scope import application_context_text
    result = json.loads(application_context_text({
        "matter_type": "study_permit",
        "intake_payload": {"school_name": "Example College", "crs_score": 999,
                           "sds_result": "POISON"},
        "eligibility_result": {"summary": "POISON"},
        "family_context": {"participation": "unknown"},
    }))
    assert result["user_entered_draft_facts"]["school_name"] == "Example College"
    assert result["family_context"]["participation"] == "unknown"
    assert "POISON" not in json.dumps(result) and "999" not in json.dumps(result)


@pytest.mark.parametrize("text", ["Apply through SDS", "Use Student Direct Stream",
                                   "Utilisez le Volet direct pour les études"])
def test_obsolete_sds_guidance_withheld(text):
    assert guard_generated_text(text) != text


@pytest.mark.parametrize("language", ["en", "fr"])
def test_locked_intelligence_does_not_advertise_disabled_analysis(language):
    from app.services.immigration_intelligence_service import build_locked_immigration_intelligence_preview
    result = build_locked_immigration_intelligence_preview(language)
    assert result["locked"] is True
    assert result["teaser_cards"] == []
    assert "category fit" not in json.dumps(result) and "ciblage" not in json.dumps(result)


@pytest.mark.parametrize("language", ["en", "fr"])
def test_forms_pdf_contains_draft_labels_not_readiness(monkeypatch, language):
    from app.routes import forms_routes
    captured = []
    original_paragraph = forms_routes.Paragraph
    original_table = forms_routes.Table
    def paragraph(text, *args, **kwargs):
        captured.append(str(text))
        return original_paragraph(text, *args, **kwargs)
    def table(rows, *args, **kwargs):
        captured.append(str(rows))
        return original_table(rows, *args, **kwargs)
    monkeypatch.setattr(forms_routes, "Paragraph", paragraph)
    monkeypatch.setattr(forms_routes, "Table", table)
    package = build_forms_package("study_permit", {"first_name": "A", "last_name": "B"}, language)
    output = forms_routes._build_forms_package_pdf(package, language)
    assert output.startswith(b"%PDF")
    text = " ".join(captured)
    assert ("NorthBridgeAI intake progress" if language == "en" else "Progression de la collecte NorthBridgeAI") in text
    assert ("verify applicability" if language == "en" else "applicabilité à vérifier") in text
    assert "Submission ready" not in text and "Your CRS" not in text
