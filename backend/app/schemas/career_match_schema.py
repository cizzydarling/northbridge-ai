from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CareerMatchRequest(BaseModel):
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    education: Optional[str] = None
    years_of_experience: Optional[int] = Field(default=None, ge=0, le=60)
    language_level: Optional[int] = Field(default=None, ge=0, le=10)
    preferred_provinces: list[str] = []
    current_location: Optional[str] = None
    work_authorization_status: Optional[str] = None
    use_profile_defaults: bool = True
    language: str = "en"


class CareerMatchJobLink(BaseModel):
    title: str
    province: str
    source: str
    url: str
    description: str


class CareerMatchProvince(BaseModel):
    province: str
    province_code: str
    occupation: str
    noc_code: str
    match_score: int
    demand_level: str
    estimated_wage_range: str
    related_pathway: str
    why: list[str]
    suggested_next_action: str
    available_jobs_count: int = 0
    live_data_status: str = "not_configured"
    job_links: list[CareerMatchJobLink]


class CareerMatchResponse(BaseModel):
    occupation: str
    noc_code: str
    noc_title: Optional[str] = None
    profile_used: dict
    official_sources: list[dict]
    matches: list[CareerMatchProvince]
    access: dict = {}


class SavedCareerJobCreate(BaseModel):
    title: str
    province: str
    noc_code: Optional[str] = None
    occupation: Optional[str] = None
    company: Optional[str] = None
    job_url: str
    source: str = "Job Bank"
    notes: Optional[str] = None


class SavedCareerJobResponse(SavedCareerJobCreate):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
