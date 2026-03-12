from pydantic import BaseModel
from typing import Optional


class ProfileCreate(BaseModel):
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[int] = None
    work_experience: Optional[int] = None
    marital_status: Optional[str] = None
    province: Optional[str] = None


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[int] = None
    work_experience: Optional[int] = None
    marital_status: Optional[str] = None
    province: Optional[str] = None

    class Config:
        from_attributes = True