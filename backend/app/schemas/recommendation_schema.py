from pydantic import BaseModel
from typing import Optional


class RecommendationSimulationRequest(BaseModel):
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[float] = None
    experience_years: Optional[int] = None
    has_job_offer: Optional[bool] = None
    has_canadian_experience: Optional[bool] = None
    studied_in_canada: Optional[bool] = None
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None