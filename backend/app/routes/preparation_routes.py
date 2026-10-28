"""Durable, owned preparation work. No generated official forms or legal findings."""
from app.services.product_analytics import emit as emit_product_event
from io import BytesIO
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from app.core.access_control import ensure_document_generator_full
from app.data.db import get_db
from app.models.generated_document_model import GeneratedDocument
from app.models.self_application_model import SelfApplication
from app.routes.self_document_routes import require_self_user
from app.services.household_service import owned_case
from app.services.docx_export_service import build_generated_document_docx

router = APIRouter(prefix="/preparation", tags=["Saved preparation"])
NOTICE = {
    "en": "DRAFT — user-reported preparation notes. Not an official form, legal opinion, eligibility finding or submission-ready document. Verify facts and current IRCC instructions before use.",
    "fr": "BROUILLON — notes de préparation déclarées par l’utilisateur. Ni formulaire officiel, ni avis juridique, ni décision d’admissibilité, ni document prêt à soumettre. Vérifiez les faits et les instructions actuelles d’IRCC avant utilisation.",
}


class DraftCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["en", "fr"] = "en"


class DraftEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(strict=True, ge=1)
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=50000)

    @field_validator("title", "content")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Draft fields cannot be blank")
        return value


def payload(draft):
    return {"id": draft.id, "case_id": draft.application_case_id, "revision": draft.revision,
            "title": draft.title, "content": draft.content, "language": draft.language,
            "updated_at": draft.updated_at, "status": "draft", "official": False,
            "notice": NOTICE.get(draft.language, NOTICE["en"])}


def owned_draft(db, user, draft_id, *, write=False):
    query = db.query(GeneratedDocument).filter_by(id=draft_id, user_id=user.id)
    if write:
        query = query.populate_existing().with_for_update()
    draft = query.first()
    if draft is None or draft.application_case_id is None:
        raise HTTPException(404, "Case draft not found")
    owned_case(db, user, draft.application_case_id, include_archived=not write)
    return draft


@router.get("/cases/{case_id}/drafts")
def list_drafts(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    owned_case(db, user, case_id, include_archived=True)
    rows = db.query(GeneratedDocument).filter_by(user_id=user.id, application_case_id=case_id).order_by(GeneratedDocument.id.desc()).all()
    return [payload(r) for r in rows]


@router.post("/cases/{case_id}/drafts", status_code=201)
def draft_from_saved_answers(case_id: int, body: DraftCreate, db: Session = Depends(get_db), user=Depends(require_self_user)):
    owned_case(db, user, case_id)
    ensure_document_generator_full(user)
    saved = db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=case_id).order_by(SelfApplication.updated_at.desc(), SelfApplication.id.desc()).first()
    if saved is None:
        raise HTTPException(409, "Save Forms answers for this case before creating a draft")
    fr = body.language == "fr"
    fields = [("occupation", "Occupation", "Profession"), ("noc_code", "NOC (user-reported)", "CNP (déclarée)"),
              ("target_province", "Target province", "Province visée"), ("school_name", "School", "Établissement"),
              ("purpose_of_travel", "Purpose of travel", "Objet du voyage")]
    intake = saved.intake_payload or {}
    facts = [f"{french if fr else english}: {str(intake[key])[:1000]}" for key, english, french in fields
             if isinstance(intake.get(key), (str, int, float)) and not isinstance(intake.get(key), bool) and str(intake[key]).strip()]
    title = "Notes de préparation" if fr else "Preparation notes"
    content = NOTICE[body.language] + "\n\n" + ("Renseignements enregistrés\n" if fr else "Saved information\n")
    content += "\n".join(facts) if facts else ("[À COMPLÉTER : ajoutez vos faits vérifiés]" if fr else "[TO COMPLETE: add your checked facts]")
    content += "\n\n" + ("[À COMPLÉTER : objet, chronologie, explication et sources des preuves]" if fr else "[TO COMPLETE: purpose, chronology, explanation and evidence sources]")
    draft = GeneratedDocument(user_id=user.id, application_case_id=case_id, revision=1,
                              document_type="preparation_note", title=title, language=body.language, content=content)
    db.add(draft)
    db.commit()
    db.refresh(draft)
    emit_product_event(user.id, "document_created", plan=user.plan, idempotency_key=f"case-draft:{draft.id}")
    return payload(draft)


@router.patch("/drafts/{draft_id}")
def save_draft(draft_id: int, body: DraftEdit, db: Session = Depends(get_db), user=Depends(require_self_user)):
    draft = owned_draft(db, user, draft_id, write=True)
    ensure_document_generator_full(user)
    if body.revision != draft.revision:
        raise HTTPException(409, "Draft changed in another session; reload before saving")
    if any(ord(c) < 32 and c not in "\n\r\t" for c in body.title + body.content):
        raise HTTPException(422, "Unsupported control characters")
    draft.title, draft.content = body.title, body.content
    draft.revision += 1
    db.commit()
    db.refresh(draft)
    return payload(draft)


@router.post("/drafts/{draft_id}/review")
def review_preparation(draft_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    draft = owned_draft(db, user, draft_id)
    ensure_document_generator_full(user)
    fr = draft.language == "fr"
    actions = []
    if "[" in draft.content or "TO COMPLETE" in draft.content or "À COMPLÉTER" in draft.content:
        actions.append("Remplacez les espaces réservés par vos faits vérifiés." if fr else "Replace placeholders with your checked facts.")
    if len(draft.content.split()) < 100:
        actions.append("Ajoutez une chronologie et les sources des faits pertinents." if fr else "Add a chronology and sources for relevant facts.")
    actions.append("Vérifiez chaque affirmation et les instructions officielles applicables." if fr else "Check each factual claim against your evidence and applicable official instructions.")
    return {"draft_id": draft.id, "revision": draft.revision, "status": "needs_human_review",
            "review_type": "deterministic_preparation_checks", "actions": actions,
            "official_completeness": "not_assessed", "eligibility": "not_assessed", "notice": NOTICE.get(draft.language, NOTICE["en"])}


@router.get("/drafts/{draft_id}/export.docx")
def export_draft(draft_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    draft = owned_draft(db, user, draft_id)
    ensure_document_generator_full(user)
    data = build_generated_document_docx(title=("BROUILLON — " if draft.language == "fr" else "DRAFT — ") + draft.title,
        content=draft.content, language=draft.language, disclaimer=NOTICE.get(draft.language, NOTICE["en"]))
    emit_product_event(user.id, "export_used", plan=user.plan)
    return StreamingResponse(BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="preparation-draft-{draft.id}.docx"', "Cache-Control": "no-store"})


# Public resource bookmarks are distinct from generated drafts and Forms answers.
from sqlalchemy.exc import IntegrityError
from app.core.access_control import ensure_individual_pro
from app.models.resource_shortlist_model import ResourceShortlist
from app.schemas.official_resource_schema import ShortlistCreate
from app.services.official_resources import find_record
from app.services.security_controls import enforce_rate_limit
from app.services.household_service import lock_owner


def shortlist_payload(row):
 return {'id':row.id,'case_id':row.application_case_id,'resource':row.source_snapshot,'created_at':row.created_at,'current_status':'saved_snapshot_not_current_verification'}


@router.get('/cases/{case_id}/resource-shortlist')
def resource_shortlist(case_id:int,db:Session=Depends(get_db),user=Depends(require_self_user)):
 owned_case(db,user,case_id,include_archived=True)
 return [shortlist_payload(r) for r in db.query(ResourceShortlist).filter_by(application_case_id=case_id,owner_user_id=user.id).order_by(ResourceShortlist.id).all()]


@router.post('/cases/{case_id}/resource-shortlist')
def save_resource(case_id:int,body:ShortlistCreate,db:Session=Depends(get_db),user=Depends(require_self_user)):
 owned_case(db,user,case_id)
 ensure_individual_pro(user)
 enforce_rate_limit('resource_saves',identifiers=[str(user.id)],limit=30,window_seconds=60)
 lock_owner(db,user)
 existing=db.query(ResourceShortlist).filter_by(application_case_id=case_id,owner_user_id=user.id,kind=body.kind,resource_id=body.resource_id).first()
 if existing: return shortlist_payload(existing)
 if db.query(ResourceShortlist).filter_by(application_case_id=case_id,owner_user_id=user.id).count()>=100:
  raise HTTPException(409,'Case resource shortlist limit reached')
 item=find_record(body.kind,body.resource_id,body.provider)
 if item is None: raise HTTPException(409,'Refresh the official resource before saving; no save was made')
 row=ResourceShortlist(application_case_id=case_id,owner_user_id=user.id,kind=body.kind,resource_id=body.resource_id,source_snapshot=item)
 db.add(row)
 try: db.commit()
 except IntegrityError:
  db.rollback()
  row=db.query(ResourceShortlist).filter_by(application_case_id=case_id,owner_user_id=user.id,kind=body.kind,resource_id=body.resource_id).first()
  if row is None: raise HTTPException(409,'Resource was not saved')
 db.refresh(row)
 return shortlist_payload(row)


@router.delete('/cases/{case_id}/resource-shortlist/{bookmark_id}')
def remove_resource(case_id:int,bookmark_id:int,db:Session=Depends(get_db),user=Depends(require_self_user)):
 owned_case(db,user,case_id,include_archived=True)
 row=db.query(ResourceShortlist).filter_by(id=bookmark_id,application_case_id=case_id,owner_user_id=user.id).first()
 if row is None: raise HTTPException(404,'Saved resource not found')
 db.delete(row);db.commit()
 return {'removed':True}
