from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProfileBase(BaseModel):
    age: int
    education: str
    language_score: int
    experience_years: int
    has_job_offer: Optional[bool] = False
    has_canadian_experience: Optional[bool] = False
    studied_in_canada: Optional[bool] = False
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[int] = None
    experience_years: Optional[int] = None
    has_job_offer: Optional[bool] = None
    has_canadian_experience: Optional[bool] = None
    studied_in_canada: Optional[bool] = None
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


class ProfileResponse(ProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    client_id: Optional[int] = None