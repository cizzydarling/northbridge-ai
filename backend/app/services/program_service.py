# backend/app/services/program_service.py
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data/program_data.json"

def load_programs():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
    
def evaluate_programs(user_data: dict):
    programs = load_programs()
    eligible_programs = []

    for program in programs:
        # Simple rule-based eligibility
        if (user_data["age"] <= program.get("max_age", 99) and
            user_data["work_experience_years"] >= program.get("min_experience", 0)):
            eligible_programs.append(program["name"])

    return {"eligible_programs": eligible_programs}