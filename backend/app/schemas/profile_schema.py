from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field


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
    english_language_score: Optional[int] = None
    french_language_score: Optional[int] = None
    experience_years: Optional[int] = None
    has_job_offer: Optional[bool] = False
    has_canadian_experience: Optional[bool] = False
    studied_in_canada: Optional[bool] = False
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    job_description: Optional[str] = None
    job_duties: Optional[str] = None
    preferred_province: Optional[str] = None


Benchmark = Annotated[int, Field(strict=True, ge=1, le=12)]


class ProfileWrite(ProfileBase):
    # Read responses deliberately retain legacy integer values unchanged.
    language_score: Optional[Benchmark] = None
    english_language_score: Optional[Benchmark] = None
    french_language_score: Optional[Benchmark] = None


class ProfileCreate(ProfileWrite):
    pass


class ProfileUpdate(ProfileWrite):
    pass


class LegacyProfilePut(ProfileBase):
    # Transport only: owner-aware route validation must precede assignment.
    language_score: Optional[Annotated[int, Field(strict=True)]] = None
    english_language_score: Optional[Annotated[int, Field(strict=True)]] = None
    french_language_score: Optional[Annotated[int, Field(strict=True)]] = None


class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)
