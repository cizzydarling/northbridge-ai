from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.client_model import Client
from app.models.disclosure_acceptance_model import DisclosureAcceptance
from app.models.matter_model import Matter
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.disclosure_schema import (
    DisclosureAcceptanceCreate,
    DisclosureAcceptanceResponse,
)

router = APIRouter(prefix="/disclosures", tags=["Disclosures"])


DISCLOSURE_REGISTRY: Dict[str, Dict[str, str]] = {
    "terms_of_use": {
        "version": "v3",
        "title": "Terms of Use",
        "text": (
            "By using NorthBridgeAI, you acknowledge and agree that the platform provides "
            "administrative, educational, informational, workflow, organization, and "
            "document-preparation support only. NorthBridgeAI does not guarantee eligibility, "
            "approval, invitation, permit issuance, permanent residence, citizenship, or any "
            "immigration outcome. You remain solely responsible for reviewing all information, "
            "confirming its accuracy, and deciding whether and how to use any content, output, "
            "recommendation, checklist, template, or draft generated or displayed by the platform."
        ),
    },
    "privacy_consent": {
        "version": "v3",
        "title": "Privacy and Data Processing Consent",
        "text": (
            "You consent to the collection, storage, organization, use, and processing of the "
            "information and documents you submit for the operation of the platform, including "
            "profile analysis, workflow support, document organization, AI-assisted features, "
            "report generation, and related service delivery. You are responsible for ensuring "
            "that you have the right to provide any third-party personal information or documents "
            "uploaded to the platform."
        ),
    },
    "ai_assistance_disclaimer": {
        "version": "v3",
        "title": "AI Assistance Disclaimer",
        "text": (
            "You understand and accept that AI-generated content may contain errors, omissions, "
            "incomplete reasoning, formatting issues, or outdated information. AI outputs may "
            "misinterpret facts, fail to account for exceptions, or present information in a way "
            "that is not appropriate for your specific legal or procedural situation. All AI-generated "
            "outputs, including recommendations, explanations, drafts, checklists, probabilities, "
            "and summaries, must be independently reviewed and verified before being relied upon or used."
        ),
    },
    "no_legal_advice_acknowledgment": {
        "version": "v3",
        "title": "No Legal Advice Acknowledgment",
        "text": (
            "You acknowledge that NorthBridgeAI does not provide legal advice, legal representation, "
            "or regulated immigration representation unless such professional services are explicitly "
            "offered through a properly authorized lawyer or regulated immigration professional under "
            "a separate valid engagement. Use of this platform alone does not create a lawyer-client, "
            "consultant-client, fiduciary, or other professional advisory relationship."
        ),
    },
    "user_responsibility_acknowledgment": {
        "version": "v3",
        "title": "User Responsibility Acknowledgment",
        "text": (
            "You acknowledge that you are solely responsible for the accuracy, completeness, and "
            "truthfulness of the information you provide, the documents you upload, and the final "
            "content of any immigration-related form, application, letter, declaration, or submission. "
            "You also acknowledge that deadlines, eligibility rules, documentary requirements, and "
            "government processes may change and that it is your responsibility to confirm current "
            "official requirements before taking action."
        ),
    },
    "limitation_of_scope_acknowledgment": {
        "version": "v3",
        "title": "Platform Scope and Limitation Acknowledgment",
        "text": (
            "You understand that the platform is intended to support planning, organization, education, "
            "and workflow assistance only. NorthBridgeAI is not responsible for decisions made by "
            "immigration authorities, for user misunderstandings, for incomplete or incorrect "
            "user-provided information, or for actions taken by users without independent review. "
            "Past outputs, saved strategies, or prior guidance should not be treated as guarantees "
            "of current accuracy or future results."
        ),
    },
}


# ------------------------
# HELPERS
# ------------------------

def determine_scope(client_id: Optional[int], matter_id: Optional[int]) -> str:
    if matter_id:
        return "matter"
    if client_id:
        return "client"
    return "global"


def get_request_metadata(request: Request):
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


def validate_disclosure_type_or_400(disclosure_type: str):
    disclosure = DISCLOSURE_REGISTRY.get(disclosure_type)
    if not disclosure:
        raise HTTPException(status_code=400, detail="Invalid disclosure type.")
    return disclosure


def get_owned_client_or_404(db: Session, client_id: int, current_user: User):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.owner_user_id == current_user.id
    ).first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    return client


def get_owned_matter_or_404(db: Session, matter_id: int, current_user: User):
    matter = db.query(Matter).filter(
        Matter.id == matter_id,
        Matter.owner_user_id == current_user.id
    ).first()

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found.")

    return matter


def validate_scope_or_400(db, current_user, client_id, matter_id):
    client = None
    matter = None

    if client_id:
        client = get_owned_client_or_404(db, client_id, current_user)

    if matter_id:
        matter = get_owned_matter_or_404(db, matter_id, current_user)

    if matter and client and matter.client_id != client.id:
        raise HTTPException(
            status_code=400,
            detail="Matter does not belong to the provided client.",
        )


def get_latest_acceptance_record(
    db: Session,
    current_user: User,
    disclosure_type: str,
    client_id: Optional[int],
    matter_id: Optional[int],
):
    query = db.query(DisclosureAcceptance).filter(
        DisclosureAcceptance.user_id == current_user.id,
        DisclosureAcceptance.disclosure_type == disclosure_type,
    )

    if client_id is None:
        query = query.filter(DisclosureAcceptance.client_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.client_id == client_id)

    if matter_id is None:
        query = query.filter(DisclosureAcceptance.matter_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.matter_id == matter_id)

    return query.order_by(DisclosureAcceptance.accepted_at.desc()).first()


def required_disclosure_items() -> list[dict]:
    return [
        {
            "disclosure_type": key,
            "disclosure_version": val["version"],
            "title": val["title"],
            "accepted_text_snapshot": val["text"],
        }
        for key, val in DISCLOSURE_REGISTRY.items()
    ]


def get_missing_required_disclosures(
    db: Session,
    current_user: User,
    *,
    client_id: Optional[int] = None,
    matter_id: Optional[int] = None,
) -> list[dict]:
    missing = []

    for item in required_disclosure_items():
        latest = get_latest_acceptance_record(
            db,
            current_user,
            item["disclosure_type"],
            client_id,
            matter_id,
        )
        if not latest or latest.disclosure_version != item["disclosure_version"]:
            missing.append(item)

    return missing


def require_global_disclosures_accepted(db: Session, current_user: User) -> None:
    missing = get_missing_required_disclosures(db, current_user)
    if missing:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "disclosures_required",
                "message": "Required disclosures must be accepted before continuing.",
                "redirect": "/legal/disclosure",
                "missing_disclosures": [
                    {
                        "disclosure_type": item["disclosure_type"],
                        "disclosure_version": item["disclosure_version"],
                    }
                    for item in missing
                ],
            },
        )


# ------------------------
# ROUTES
# ------------------------

@router.get("/requirements")
def get_disclosure_requirements():
    return {
        "required_disclosures": required_disclosure_items()
    }


@router.get("/status")
def get_disclosure_status(
    client_id: Optional[int] = None,
    matter_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_scope_or_400(db, current_user, client_id, matter_id)
    missing = get_missing_required_disclosures(
        db,
        current_user,
        client_id=client_id,
        matter_id=matter_id,
    )
    return {
        "required": required_disclosure_items(),
        "accepted": not missing,
        "missing_disclosures": missing,
    }


@router.get("/mine", response_model=list[DisclosureAcceptanceResponse])
def get_my_disclosures(
    client_id: Optional[int] = None,
    matter_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_scope_or_400(db, current_user, client_id, matter_id)
    query = db.query(DisclosureAcceptance).filter(
        DisclosureAcceptance.user_id == current_user.id,
    )

    if client_id is None:
        query = query.filter(DisclosureAcceptance.client_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.client_id == client_id)

    if matter_id is None:
        query = query.filter(DisclosureAcceptance.matter_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.matter_id == matter_id)

    return query.order_by(DisclosureAcceptance.accepted_at.desc()).all()


@router.get("/latest", response_model=Optional[DisclosureAcceptanceResponse])
def get_latest_disclosure_acceptance(
    disclosure_type: str,
    client_id: Optional[int] = None,
    matter_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_disclosure_type_or_400(disclosure_type)
    validate_scope_or_400(db, current_user, client_id, matter_id)
    return get_latest_acceptance_record(
        db,
        current_user,
        disclosure_type,
        client_id,
        matter_id,
    )


@router.post("/accept", response_model=DisclosureAcceptanceResponse)
def accept_disclosure(
    payload: DisclosureAcceptanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disclosure = validate_disclosure_type_or_400(payload.disclosure_type)

    validate_scope_or_400(
        db, current_user, payload.client_id, payload.matter_id
    )

    required_version = disclosure["version"]

    if payload.disclosure_version != required_version:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid disclosure version. Required: {required_version}",
        )

    latest = get_latest_acceptance_record(
        db,
        current_user,
        payload.disclosure_type,
        payload.client_id,
        payload.matter_id,
    )

    if latest and latest.disclosure_version == required_version:
        return latest

    metadata = get_request_metadata(request)

    acceptance = DisclosureAcceptance(
        user_id=current_user.id,
        client_id=payload.client_id,
        matter_id=payload.matter_id,
        disclosure_type=payload.disclosure_type,
        disclosure_version=required_version,
        accepted_text_snapshot=disclosure["text"],
        accepted_by_email_snapshot=current_user.email,
        acceptance_scope=determine_scope(payload.client_id, payload.matter_id),
        ip_address=metadata["ip_address"],
        user_agent=metadata["user_agent"],
    )

    db.add(acceptance)
    db.commit()
    db.refresh(acceptance)

    return acceptance
