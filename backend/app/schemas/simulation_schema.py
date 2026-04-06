from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# =========================
# BASE PROFILE (for simulation)
# =========================

class SimulationBaseProfile(BaseModel):
    age: Optional[int] = None
    education: Optional[str] = None
    language_score: Optional[int] = None
    experience_years: Optional[int] = None
    has_job_offer: Optional[bool] = None
    has_canadian_experience: Optional[bool] = None
    studied_in_canada: Optional[bool] = None
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


# =========================
# DIRECT PROFILE COMPARISON (legacy support)
# =========================

class SimulationComparisonRequest(BaseModel):
    current_profile: SimulationBaseProfile
    simulated_changes: SimulationBaseProfile


# =========================
# SCENARIO CRUD
# =========================

class SavedSimulationScenarioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = None
    current_profile_snapshot: Dict[str, Any] = Field(default_factory=dict)
    simulated_changes: Dict[str, Any] = Field(default_factory=dict)
    result_payload: Dict[str, Any] = Field(default_factory=dict)


class SavedSimulationScenarioCreate(SavedSimulationScenarioBase):
    client_id: Optional[int] = None


class SavedSimulationScenarioUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    notes: Optional[str] = None
    current_profile_snapshot: Optional[Dict[str, Any]] = None
    simulated_changes: Optional[Dict[str, Any]] = None
    result_payload: Optional[Dict[str, Any]] = None


class SavedSimulationScenarioResponse(SavedSimulationScenarioBase):
    id: int
    client_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SimulationScenarioListResponse(BaseModel):
    scenarios: List[SavedSimulationScenarioResponse] = Field(default_factory=list)


# =========================
# COMPARE TWO SAVED SCENARIOS
# =========================

class SimulationCompareRequest(BaseModel):
    first_simulation_id: int
    second_simulation_id: int


class SimulationCompareResponse(BaseModel):
    first_simulation: Dict[str, Any]
    second_simulation: Dict[str, Any]
    comparison: Dict[str, Any]


# =========================
# 🔥 BACKWARD COMPATIBILITY ALIASES
# =========================

# Used by client_simulation_routes.py
SavedScenarioCreate = SavedSimulationScenarioCreate
SavedScenarioUpdate = SavedSimulationScenarioUpdate
SavedScenarioResponse = SavedSimulationScenarioResponse
SavedScenarioListResponse = SimulationScenarioListResponse