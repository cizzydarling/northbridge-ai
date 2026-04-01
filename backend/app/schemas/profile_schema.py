from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProfileBase(BaseModel):
    # Personal identity / background
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nationality: Optional[str] = None
    current_country: Optional[str] = None
    current_city: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    marital_status: Optional[str] = None
    preferred_language: Optional[str] = "en"

    # Immigration / eligibility profile
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[int] = None
    experience_years: Optional[int] = None
    has_job_offer: Optional[bool] = False
    has_canadian_experience: Optional[bool] = False
    studied_in_canada: Optional[bool] = False
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(ProfileBase):
    pass


class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)