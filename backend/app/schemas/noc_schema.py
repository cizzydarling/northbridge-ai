from typing import List, Optional

from pydantic import BaseModel, Field


class NocSuggestRequest(BaseModel):
    occupation: str = Field(..., min_length=2)
    job_description: Optional[str] = ""
    duties: Optional[List[str]] = None
    top_k: int = 3


class NocAlternative(BaseModel):
    noc: str
    title: str
    teer: int
    confidence: float
    broad_category: str
    immigration_category_tags: List[str]
    express_entry_skilled_work: bool


class NocSuggestResponse(BaseModel):
    occupation_input: str
    job_description_input: str
    duties_input: List[str]

    suggested_noc: str
    suggested_title: str
    teer: int
    confidence: float
    broad_category: str
    why_matched: List[str]

    alternatives: List[NocAlternative]
    matches: List[NocAlternative]

    immigration_flags: dict