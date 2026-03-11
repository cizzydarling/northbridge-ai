from typing import Optional
from pydantic import BaseModel


class ProfileBase(BaseModel):
    age: int
    education: str
    language_score: int
    experience_years: int
    has_job_offer: bool = False
    has_canadian_experience: bool = False
    studied_in_canada: bool = False
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


class ProfileCreate(ProfileBase):
    pass


class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True