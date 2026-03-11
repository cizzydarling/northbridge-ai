# backend/app/models/user_models.py
from pydantic import BaseModel
from typing import Optional

class UserProfile(BaseModel):
    age: int
    education_level: str
    work_experience_years: int
    language_proficiency: str
    province_preference: Optional[str] = None

    class Config:
        orm_mode = True