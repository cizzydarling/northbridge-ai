from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


# -----------------------------
# Base Models
# -----------------------------

class SelfApplicationBase(BaseModel):
    matter_type: str
    intake_payload: Dict[str, Any] = {}
    eligibility_result: Dict[str, Any] = {}
    forms_result: Dict[str, Any] = {}
    checklist_result: List[Dict[str, Any]] = []


# -----------------------------
# Request Schemas
# -----------------------------

class SelfApplicationUpsertRequest(BaseModel):
    matter_type: str
    intake: Optional[Dict[str, Any]] = {}


# -----------------------------
# Response Schemas
# -----------------------------

class SelfApplicationResponse(SelfApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


# -----------------------------
# NEW: Strategy + PR Extensions
# -----------------------------

class FrenchAdvantageSchema(BaseModel):
    strategic_value: Optional[str] = None
    signals: List[str] = []
    recommendations: List[str] = []


class StrategySummarySchema(BaseModel):
    crs_score: Optional[int] = None
    recommended_programs: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    next_steps: List[str] = []
    advisor_summary: Optional[str] = None
    french_advantage: Optional[FrenchAdvantageSchema] = None


# -----------------------------
# Workspace Response
# -----------------------------

class SelfWorkspaceResponse(BaseModel):
    application: SelfApplicationResponse
    eligibility: Dict[str, Any]
    forms_assistant: Dict[str, Any]
    checklist: List[Dict[str, Any]]

    # ✅ NEW FIELDS (for PR flow)
    strategy: Optional[StrategySummarySchema] = None
    pathways: Optional[List[str]] = []
    french_advantage: Optional[FrenchAdvantageSchema] = None