from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


class NocSuggestRequest(BaseModel):
    occupation: str = Field(..., min_length=2)
    job_description: Optional[str] = ""
    duties: Optional[List[str]] = None
    top_k: int = 3
    language: Optional[str] = "en"


class NocAlternative(BaseModel):
    noc: str
    title: str
    teer: int
    score: Optional[float] = None
    confidence: float
    broad_category: str
    immigration_category_tags: List[str]
    express_entry_skilled_work: bool
    why_matched: Optional[List[str]] = []


class NocSummary(BaseModel):
    occupation: str
    noc_code: str
    noc_title: str
    teer: Optional[int]
    confidence: float
    broad_category: str
    express_entry_skilled_work: bool
    category_tags: List[str]


class NocSuggestResponse(BaseModel):
    occupation_input: str
    job_description_input: str
    duties_input: List[str]

    suggested_noc: str
    suggested_title: str
    teer: int
    confidence: float
    score: Optional[float] = None
    match_quality: Optional[str] = None
    broad_category: str
    why_matched: List[str]

    alternatives: List[NocAlternative]
    matches: List[NocAlternative]

    immigration_flags: Dict[str, Any]

    # 🔥 NEW — used across strategy + frontend
    noc_summary: Optional[NocSummary] = None
