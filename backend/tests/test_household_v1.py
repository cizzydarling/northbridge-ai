"""Household contract exercised against migrated disposable PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import json
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.testclient import TestClient
from backend.tests.test_individual_launch_postgres import pg_database_factory, pg_database, migrate
from app.data.db import get_db
from app.models.user_models import User
from app.models.profile_model import Profile
from app.models.household_model import Household
from app.models.household_member_model import HouseholdMember
from app.models.application_case_model import ApplicationCase, ApplicationCaseMember
from app.models.self_application_model import SelfApplication
from app.routes import auth_routes, household_routes, application_case_routes, self_document_routes, strategy_routes, forms_routes
from app.services.household_service import resolve_application_context, context_snapshot
from app.services.strategy_service import build_household_strategy_context

@pytest.fixture
def household_db(pg_database):
    engine, url = pg_database
    migrate(url)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([User(id=i,email=f"household{i}@example.invalid",password="unused",role="individual" if i<3 else "agent",plan="free") for i in (1,2,3)])
        db.flush()
        db.add_all([Profile(user_id=i,first_name=f"Owner{i}",age=30,education="bachelor",language_score=9,experience_years=3) for i in (1,2)])
        db.commit()
    return engine, sessions

@pytest.fixture
def api(household_db):
    engine, sessions = household_db
    app=FastAPI()
    for router in (household_routes.router, application_case_routes.router, self_document_routes.router, strategy_routes.router, forms_routes.router):
        app.include_router(router)
    def database():
        with sessions() as db: yield db
    def user(x_test_user: int | None=Header(default=None), db=Depends(get_db)):
        if not x_test_user: raise HTTPException(401,"Authentication required")
        return db.get(User,x_test_user)
    app.dependency_overrides[get_db]=database
    app.dependency_overrides[auth_routes.get_current_user]=user
    with TestClient(app) as client: yield client, sessions

A={"X-Test-User":"1"}
B={"X-Test-User":"2"}

def add(client, relationship="child", name="Child", headers=A):
    response=client.post("/households/members",headers=headers,json={"first_name":name,"relationship_to_primary":relationship})
    assert response.status_code==200,response.text
    return response.json()

def test_concurrent_initialization_and_database_invariants(household_db):
    engine,sessions=household_db
    def initialize(_):
        with sessions() as db:
            context=resolve_application_context(db,db.get(User,1))
            return context.household.id,context.members[0].id,context.case.id
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(initialize,range(16)))
    assert len(set(results))==1
    with sessions() as db:
        assert db.query(Household).count()==1
        assert db.query(HouseholdMember).count()==1
        assert db.query(ApplicationCase).count()==1
    hid,mid,cid=results[0]
    statements=[
        "INSERT INTO households(owner_user_id,name) VALUES (2,'empty')",
        f"DELETE FROM household_members WHERE id={mid}",
        f"UPDATE household_members SET relationship_to_primary='child',owner_user_id=NULL,is_primary_applicant=false WHERE id={mid}",
        f"UPDATE application_cases SET owner_user_id=2 WHERE id={cid}",
        f"INSERT INTO household_members(household_id,relationship_to_primary,owner_user_id,is_primary_applicant) VALUES ({hid},'self',1,true)",
    ]
    for statement in statements:
        with pytest.raises(sa.exc.IntegrityError):
            with engine.begin() as connection: connection.exec_driver_sql(statement)


def test_family_lifecycle_validation_authorization_and_documents(api):
    client,sessions=api
    # Every exposed operation authenticates; agent access remains rejected.
    for method,path,payload in [("get","/households/me",None),("post","/households",{}),("get","/households/members",None),
        ("post","/households/members",{}),("put","/households/members/1",{}),("delete","/households/members/1",None),
        ("get","/application-cases",None),("post","/application-cases",{}),("get","/application-cases/1",None),
        ("put","/application-cases/1",{}),("delete","/application-cases/1",None),("post","/application-cases/1/activate",{})]:
        assert client.request(method,path,json=payload).status_code==401
    assert client.get("/households/me",headers={"X-Test-User":"3"}).status_code==403
    ha=client.get("/households/me",headers=A).json();hb=client.get("/households/me",headers=B).json()
    assert ha["id"]!=hb["id"]
    assert client.get(f"/households/{hb['id']}",headers=A).status_code==404
    self_member=client.get("/households/members",headers=A).json()[0]
    assert self_member["relationship_to_primary"]=="self" and self_member["is_primary_applicant"]
    assert client.delete(f"/households/members/{self_member['id']}",headers=A).status_code==409
    assert client.put(f"/households/members/{self_member['id']}",headers=A,json={"first_name":"changed"}).status_code==409
    for payload in [{"relationship_to_primary":"parent","first_name":"x"},{"relationship_to_primary":"child","first_name":""},
        {"relationship_to_primary":"child","first_name":"x","date_of_birth":"2999-01-01"},
        {"relationship_to_primary":"child","first_name":"x","date_of_birth":"2020-02-31"},
        {"relationship_to_primary":"child","first_name":"x","email":"not email"},
        {"relationship_to_primary":"child","first_name":"x","is_primary_applicant":True},
        {"relationship_to_primary":"child","first_name":"x"*101}]:
        assert client.post("/households/members",headers=A,json=payload).status_code==422
    spouse=add(client,"spouse","Spouse")
    assert client.post("/households/members",headers=A,json={"first_name":"Partner","relationship_to_primary":"common_law_partner"}).status_code==409
    assert client.delete(f"/households/members/{spouse['id']}",headers=A).status_code==200
    partner=add(client,"common_law_partner","Partner")
    one=add(client,name="First child");two=add(client,name="Second child");foreign=add(client,name="Foreign child",headers=B)
    assert foreign["id"] not in {m["id"] for m in client.get("/households/members",headers=A).json()}
    for method in ("put","delete"):
        assert client.request(method,f"/households/members/{foreign['id']}",headers=A,json={"first_name":"stolen"}).status_code==404
    for payload in ({"first_name":None},{"relationship_to_primary":None},{"is_primary_applicant":True}):
        assert client.put(f"/households/members/{one['id']}",headers=A,json=payload).status_code==422
    ac=client.get("/application-cases/context",headers=A).json();bc=client.get("/application-cases/context",headers=B).json()
    case=ac["case_id"]; other=bc["case_id"]
    for method in ("get","put","delete"):
        assert client.request(method,f"/application-cases/{other}",headers=A,json={} if method=="put" else None).status_code==404
    assert client.post(f"/application-cases/{other}/activate",headers=A).status_code==404
    for payload in ({"members":[{"household_member_id":foreign["id"],"participation":"accompanying"}]},):
        assert client.put(f"/application-cases/{case}",headers=A,json=payload).status_code==404
    for payload in ({"primary_applicant_member_id":one["id"]},{"members":None},{"application_type":None},
        {"status":"invalid"},{"members":[{"household_member_id":0}]},
        {"members":[{"household_member_id":one["id"],"participation":"yes"}]},
        {"members":[{"household_member_id":one["id"]},{"household_member_id":one["id"]}]}):
        assert client.put(f"/application-cases/{case}",headers=A,json=payload).status_code==422
    participants=[{"household_member_id":m["id"],"participation":state} for m,state in [(partner,"accompanying"),(one,"non_accompanying"),(two,"unknown")]]
    assert client.put(f"/application-cases/{case}",headers=A,json={"members":participants}).status_code==200
    context=client.get("/application-cases/context",headers=A).json()
    assert context["family_size"]==4
    assert {m["participation"] for m in context["members"]}=={"not_applicable","accompanying","non_accompanying","unknown"}
    assert not any(key in json.dumps(context["members"]) for key in ["first_name","email","date_of_birth","nationality"])
    docs=client.get("/self-documents/family-context",headers=A).json()["requirements"]
    assert len(docs)==3 and len({d["id"] for d in docs})==3
    saved=[]
    for doc in docs:
        payload={"matter_type":f"case_{case}","document_key":doc["id"],"document_name":"Identity review","required":True}
        response=client.post("/self-documents/",headers=A,json=payload)
        assert response.status_code==200,response.text
        assert response.json()["required"] is False
        saved.append(response.json())
        assert client.post("/self-documents/",headers=B,json=payload).status_code==404
    assert client.put(f"/self-documents/{saved[1]['id']}",headers=A,json={"completed":True}).status_code==200
    assert client.put(f"/self-documents/{saved[1]['id']}",headers=B,json={"completed":True}).status_code==404
    assert client.get(f"/self-documents/{saved[1]['id']}/file",headers=B).status_code==404
    docs=client.get("/self-documents/family-context",headers=A).json()["requirements"]
    assert docs[1]["document"]["completed"] is True and docs[2]["document"]["completed"] is False
    assert client.delete(f"/households/members/{two['id']}",headers=A).status_code==200
    assert client.get("/application-cases/context",headers=A).json()["family_size"]==3
    assert len(client.get("/self-documents/",headers=A).json())==3  # archival preserves records
    assert client.get("/application-cases/context?case_id=999999",headers=A).status_code==404
    assert client.get("/application-cases/context?case_id=0",headers=A).status_code==422
    created=client.post("/application-cases",headers=A,json={"application_type":"study_permit"}).json()
    assert client.get("/application-cases/context",headers=A).json()["case_id"]==created["id"]
    assert client.get("/application-cases/context",headers=B).json()["case_id"]==other
    assert client.delete(f"/application-cases/{created['id']}",headers=A).status_code==200
    assert client.get("/application-cases/context",headers=A).json()["case_id"]==case
    assert client.get(f"/application-cases/{created['id']}",headers=A).status_code==404


def test_consumer_context_and_legacy_adoption(api, monkeypatch):
    client,sessions=api
    with sessions() as db:
        db.add(SelfApplication(user_id=1,matter_type="study_permit",intake_payload={"school_name":"Preserved"}))
        db.commit()
    context=client.get("/application-cases/context",headers=A).json()
    case=context["case_id"]
    with sessions() as db:
        legacy=db.query(SelfApplication).one()
        assert legacy.application_case_id==case and legacy.intake_payload=={"school_name":"Preserved"}
    child=add(client,name="Private name")
    assert client.put(f"/application-cases/{case}",headers=A,json={"members":[{"household_member_id":child["id"],"participation":"unknown"}]}).status_code==200
    captured=[]
    def strategy(profile, **kwargs):
        captured.append(kwargs)
        family=build_household_strategy_context(kwargs.get("household_members"),application_case=kwargs.get("application_case"))
        return {"household_context":{k:v for k,v in family.items() if k in {"family_size","has_spouse","participation_counts","calculation_status"}},"family_document_requirements":family["required_family_documents"]}
    monkeypatch.setattr(strategy_routes,"build_strategy",strategy)
    response=client.get("/self/strategy",headers=A)
    assert response.status_code==200,response.text
    assert response.json()["household_context"]["family_size"]==2  # free tier retains identity
    assert captured[-1]["household_members"][1].participation=="unknown"
    response=client.post("/forms/package/preview",headers=A,json={"application_type":"study_permit"})
    assert response.status_code==200,response.text
    assert response.json()["family_context"]["family_size"]==2
    assert "Private name" not in json.dumps(response.json()["family_context"])
    from app.services import ai_orchestrator as ai
    monkeypatch.setattr(ai,"build_strategy",strategy)
    monkeypatch.setattr(ai,"build_user_decision_context",lambda **kwargs:{})
    monkeypatch.setattr(ai,"_build_feature_context",lambda **kwargs:{})
    with sessions() as db:
        result=ai.build_self_user_ai_context(db=db,current_user=db.get(User,1))
        snapshot=result["ai_context"]["application"]["family_context"]
        assert snapshot["family_size"]==2 and snapshot["members"][1]["participation"]=="unknown"
        assert "Private name" not in json.dumps(snapshot)
    assert client.post("/self/workspace",headers=A,json={"matter_type":"work_permit"}).status_code==409
    assert client.post("/self/workspace",headers=A,json={"matter_type":"study_permit"}).status_code==200
    with sessions() as db:
        assert db.query(SelfApplication).count()==1


@pytest.mark.parametrize("relationship", ["spouse", "common_law_partner", "child"])
@pytest.mark.parametrize("participation", ["accompanying", "non_accompanying", "unknown"])
def test_family_summary_preserves_relationship_and_unknown(relationship, participation):
    owner=SimpleNamespace(id=1,relationship_to_primary="self",participation="not_applicable")
    member=SimpleNamespace(id=2,relationship_to_primary=relationship,participation=participation)
    family=build_household_strategy_context([owner,member],application_case=SimpleNamespace(id=5,application_type="permanent_residence"))
    assert family["family_size"]==2
    assert family["participation_counts"][participation]==1
    assert family["has_spouse"]==(relationship!="child")
    assert family["dependent_count"] is None
    assert family["calculation_status"]=="REQUIRES RULE VERIFICATION"
    assert family["required_family_documents"][0]["required"] is False


def test_real_strategy_preserves_formula_and_labels_family_limit(monkeypatch):
    from app.services import strategy_service as strategy
    from app.services.ai_advisor import _extract_strategy_context, _extract_application_context
    monkeypatch.setattr(strategy,"suggest_noc_matches",lambda *a,**k:[])
    sent=[]
    monkeypatch.setattr(strategy,"generate_ai_strategy",lambda **kwargs:sent.append(kwargs) or {})
    profile=Profile(age=28,education="bachelor",language_score=9,experience_years=3,
        has_job_offer=False,has_canadian_experience=False,studied_in_canada=False,preferred_province="Ontario")
    owner=SimpleNamespace(id=1,relationship_to_primary="self",participation="not_applicable")
    child=SimpleNamespace(id=2,relationship_to_primary="child",participation="unknown")
    case=SimpleNamespace(id=1,application_type="permanent_residence",family_size=2)
    single=strategy.build_strategy(profile,household_members=[owner],application_case=case,include_immigration_intelligence=False)
    family=strategy.build_strategy(profile,household_members=[owner,child],application_case=case,include_immigration_intelligence=False)
    assert single["crs_score"]==family["crs_score"]
    assert family["household_context"]["calculation_status"]=="REQUIRES RULE VERIFICATION"
    assert sent[-1]["strategy_data"]["family_context"]["members"][1]["participation"]=="unknown"
    assert "family_calculation_status" in _extract_strategy_context(family,"en")
    assert "unknown" in _extract_application_context({"family_context":family["family_context"]},"fr")


@pytest.mark.parametrize("language", ["en", "fr"])
def test_document_ai_prompts_include_unknown_family_facts(language):
    from app.services.document_review_service import build_strategy_context
    from app.services.document_generator_service import build_application_context
    snapshot={"members":[{"member_id":2,"relationship":"child","participation":"unknown"}],"instruction":"Do not infer missing facts"}
    assert "unknown" in build_strategy_context({"family_context":snapshot},{},language)
    assert "member_id" in build_strategy_context({"family_context":snapshot},{},language)
    assert "unknown" in build_application_context({"family_context":snapshot},language)
