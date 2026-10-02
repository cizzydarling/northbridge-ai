from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ApplicationType = Literal["permanent_residence", "study_permit", "work_permit", "visitor_visa", "spousal_sponsorship"]
class CaseParticipation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    household_member_id: int = Field(gt=0)
    participation: Literal["accompanying", "non_accompanying", "unknown"] = "unknown"

class ApplicationCaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    application_type: ApplicationType = "permanent_residence"
    case_title: str | None = Field(default=None, max_length=120)
    target_province: str | None = Field(default=None, max_length=80)
    pathway: str | None = Field(default=None, max_length=120)
    members: list[CaseParticipation] = Field(default_factory=list, max_length=50)

class ApplicationCaseUpdate(ApplicationCaseCreate):
    application_type: ApplicationType | None = None
    status: Literal["draft", "in_progress"] | None = None
    members: list[CaseParticipation] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def nonnull(self):
        for field in ("application_type", "status", "members"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
