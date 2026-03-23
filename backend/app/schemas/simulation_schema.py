from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class SavedScenarioBase(BaseModel):
    name: str
    notes: Optional[str] = None
    current_profile_snapshot: Dict[str, Any]
    simulated_changes: Dict[str, Any]
    result_payload: Dict[str, Any]


class SavedScenarioCreate(SavedScenarioBase):
    client_id: int


class SavedScenarioUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


class SavedScenarioResponse(SavedScenarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    created_at: datetime


class SimulationCompareRequest(BaseModel):
    first_simulation_id: int
    second_simulation_id: int


class SimulationComparisonPayload(BaseModel):
    crs: Dict[str, Any]
    pathways: Dict[str, List[str]]
    simulated_changes: Dict[str, Dict[str, Any]]


class SimulationCompareResponse(BaseModel):
    first_simulation: SavedScenarioResponse
    second_simulation: SavedScenarioResponse
    comparison: SimulationComparisonPayload