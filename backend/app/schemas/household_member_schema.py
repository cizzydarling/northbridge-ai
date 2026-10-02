from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Relationship = Literal["spouse", "common_law_partner", "child"]

class MemberInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    relationship_to_primary: Relationship
    date_of_birth: date | None = None
    nationality: str | None = Field(default=None, max_length=100)
    current_country: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=254)

    @field_validator("date_of_birth")
    @classmethod
    def past_date(cls, value):
        if value and value > date.today():
            raise ValueError("Birth date cannot be in the future")
        return value

class HouseholdMemberCreate(MemberInput):
    pass

class HouseholdMemberUpdate(MemberInput):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    relationship_to_primary: Relationship | None = None

    @model_validator(mode="after")
    def nonnull(self):
        for field in ("first_name", "relationship_to_primary"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

class HouseholdMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    household_id: int
    first_name: str | None
    last_name: str | None
    relationship_to_primary: str
    date_of_birth: date | None
    nationality: str | None
    current_country: str | None
    email: str | None
    is_primary_applicant: bool
    archived_at: datetime | None
