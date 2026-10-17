"""Local synthetic journey; PostgreSQL invariants remain in test_household_v1."""
import pytest
import backend.launch_smoke_test  # SQLite JSONB compilation
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.data.db import Base, get_db
from app.models.user_models import User
from app.models.profile_model import Profile
from app.routes import auth_routes, household_routes, application_case_routes, self_document_routes, strategy_routes, forms_routes
from app.services import document_storage


@pytest.fixture
def documents_api(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([User(id=i,email=f"sprint{i}@example.invalid",password="synthetic",role="agent" if i == 3 else "individual",plan="free") for i in (1,2,3)])
        db.add_all([Profile(user_id=i,first_name="Synthetic",education="bachelor") for i in (1,2)])
        db.commit()
    app = FastAPI()
    for module in (household_routes, application_case_routes, self_document_routes, strategy_routes, forms_routes): app.include_router(module.router)
    def database():
        with sessions() as db: yield db
    def user(x_test_user: int | None = Header(None), db=Depends(get_db)):
        if x_test_user is None: raise HTTPException(401, "Authentication required")
        return db.get(User, x_test_user)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[auth_routes.get_current_user] = user
    monkeypatch.setattr(document_storage, "LOCAL_UPLOAD_ROOT", tmp_path)
    monkeypatch.setattr(self_document_routes, "UPLOAD_DIR", tmp_path)
    with TestClient(app) as client: yield client
    engine.dispose()

A = {"X-Test-User":"1"}
B = {"X-Test-User":"2"}

def test_canonical_list_empty_query_and_authorization(documents_api):
    c = documents_api
    assert c.get("/self-documents/").status_code == 401
    assert c.get("/self-documents/", headers={"X-Test-User":"3"}).status_code == 403
    assert c.get("/self-documents/", headers=A).json() == []
    redirect = c.get("/self-documents?matter_type=case_1", headers=A, follow_redirects=False)
    assert redirect.status_code == 307
    assert redirect.headers["location"].endswith("/self-documents/?matter_type=case_1")
    assert c.get(redirect.headers["location"], headers=A).json() == []

def test_owned_case_documents_upload_return_and_forms_persistence(documents_api):
    c = documents_api
    ctx = c.get("/application-cases/context",headers=A).json()
    case_id = ctx["case_id"]
    member = c.post("/households/members",headers=A,json={"first_name":"Synthetic child","relationship_to_primary":"child"}).json()
    assert c.put(f"/application-cases/{case_id}",headers=A,json={"members":[{"household_member_id":member["id"],"participation":"unknown"}]}).status_code == 200
    family = c.get(f"/self-documents/family-context?case_id={case_id}",headers=A)
    assert family.status_code == 200
    requirement = family.json()["requirements"][0]
    payload = {"matter_type":f"case_{case_id}","document_key":requirement["id"],"document_name":"Synthetic identity review","required":False}
    record = c.post("/self-documents/",headers=A,json=payload)
    assert record.status_code == 200
    doc_id = record.json()["id"]
    content = b"%PDF-1.4\nSynthetic preparation evidence only\n%%EOF"
    uploaded = c.post(f"/self-documents/{doc_id}/upload",headers=A,files={"file":("synthetic.pdf",content,"application/pdf")})
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["completed"] is True
    retrieved = c.get(f"/self-documents/{doc_id}/file",headers=A)
    assert retrieved.status_code == 200 and retrieved.content == content
    assert c.get(f"/self-documents/{doc_id}/file",headers=B).status_code == 404
    assert c.put(f"/self-documents/{doc_id}",headers=B,json={"completed":False}).status_code == 404
    assert c.get("/self-documents/",headers=B).json() == []
    assert c.get(f"/self-documents/family-context?case_id={case_id}",headers=B).status_code == 404
    assert c.post("/self-documents/",headers=B,json=payload).status_code == 404
    assert c.get(f"/self-documents/?matter_type=case_{case_id}",headers=A).json()[0]["id"] == doc_id
    saved = c.post("/self/workspace",headers=A,json={"case_id":case_id,"matter_type":"permanent_residence","intake":{"preparation_note":"Keep this draft","representative_used":False}})
    assert saved.status_code == 200, saved.text
    returned = c.get(f"/self/application/saved?case_id={case_id}",headers=A)
    assert returned.status_code == 200
    assert returned.json()["intake_payload"]["preparation_note"] == "Keep this draft"
    assert returned.json()["intake_payload"]["representative_used"] is False
    assert c.get(f"/self/application/saved?case_id={case_id}",headers=B).status_code == 404
    preview = c.post("/forms/package/preview",headers=A,json={"application_type":"express_entry","case_id":case_id})
    assert preview.status_code == 200, preview.text
    # Selecting another owned case cannot mix its family/document state.
    other = c.post("/application-cases",headers=A,json={"application_type":"study_permit"}).json()
    assert c.get(f"/self-documents/family-context?case_id={case_id}",headers=A).json()["context"]["case_id"] == case_id
    assert c.get(f"/self-documents/?matter_type=case_{other['id']}",headers=A).json() == []
    assert c.get(f"/self-documents/?matter_type=case_{case_id}",headers=A).json()[0]["file_name"] == "synthetic.pdf"


def test_forms_intake_patch_preserves_omissions_and_owner_case_isolation(documents_api):
    c = documents_api
    case_id = c.get("/application-cases/context", headers=A).json()["case_id"]
    base = {"case_id": case_id, "matter_type": "permanent_residence"}
    def save(intake, **extra):
        return c.post("/self/workspace", headers=A, json={**base, "intake": intake, **extra})
    assert save({"server_only": {"original": "keep"}, "clearable": "value", "representative_used": True}).status_code == 200
    patched = save({"school_name": "Synthetic school", "clearable": None, "representative_used": False}, preserve_omitted_intake=True)
    assert patched.status_code == 200
    intake = patched.json()["application"]["intake_payload"]
    assert intake["server_only"] == {"original": "keep"}
    assert intake["clearable"] is None and intake["representative_used"] is False
    assert intake["school_name"] == "Synthetic school"
    assert c.post("/self/workspace", headers=B, json={**base, "intake": {"server_only": "attack"}, "preserve_omitted_intake": True}).status_code == 404
    assert c.post("/self/workspace", headers=A, json={"matter_type": "permanent_residence", "intake": {}, "preserve_omitted_intake": True}).status_code == 422
    assert save({}, preserve_omitted_intake="true").status_code == 422
    other = c.post("/application-cases", headers=A, json={"application_type": "study_permit"}).json()
    response = c.post("/self/workspace", headers=A, json={"case_id": other["id"], "matter_type": "study_permit", "intake": {"school_name": "Separate"}, "preserve_omitted_intake": True})
    assert response.status_code == 200
    assert "server_only" not in response.json()["application"]["intake_payload"]
    assert c.get(f"/self/application/saved?case_id={case_id}", headers=A).json()["intake_payload"]["server_only"] == {"original": "keep"}
    # The new mode is opt-in: existing workspace replacement behavior is unchanged.
    assert "server_only" not in save({"replacement": True}).json()["application"]["intake_payload"]
