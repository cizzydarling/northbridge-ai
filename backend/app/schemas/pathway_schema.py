from pydantic import BaseModel
from typing import List

class MatchedPathway(BaseModel):
    id: str
    name: str
    category: str
    province: str
    status: str
    score: int
    reasons: List[str]
    next_steps: List[str]
    description: str

    class PathwayMatchResponse(BaseModel):
        crs_score: int
        eligible: List[MatchedPathway]
        borderline: List[MatchedPathway]
        not_eligible: List[MatchedPathway]