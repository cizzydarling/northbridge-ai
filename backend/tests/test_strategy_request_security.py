"""Real JWT + migrated PostgreSQL: computation reuse cannot bypass fresh guards."""
from datetime import datetime, timedelta, timezone
from backend.tests.test_household_v1 import api, household_db
from backend.tests.test_individual_launch_postgres import pg_database, pg_database_factory
from app.models.user_models import User
from app.models.profile_model import Profile
from app.routes import auth_routes as auth
from app.services import strategy_service


def test_strategy_context_auth_entitlements_and_ownership_are_fresh(api, monkeypatch):
    client, sessions = api
    client.app.dependency_overrides.pop(auth.get_current_user)
    monkeypatch.setattr(strategy_service, "generate_ai_strategy", lambda **kwargs: {})
    with sessions() as db:
        for i, occupation in [(1, "Administrative officer"), (2, "Software developer")]:
            profile = db.query(Profile).filter_by(user_id=i).one()
            profile.occupation = occupation
        db.commit()
    def headers(i, version=0):
        return {"Authorization": "Bearer " + auth.create_access_token(
            {"sub": f"household{i}@example.invalid", "token_version": version})}
    assert client.get("/self/strategy").status_code == 401
    first = client.get("/self/strategy", headers=headers(1))
    assert first.status_code == 200
    other = client.get("/self/strategy", headers=headers(2))
    assert other.status_code == 200
    a, b = first.json(), other.json()
    assert a["case_context"]["case_id"] != b["case_context"]["case_id"]
    assert a["noc_profile"] != b["noc_profile"]
    foreign_case = b["case_context"]["case_id"]
    assert client.get(f"/self/strategy?case_id={foreign_case}", headers=headers(1)).status_code == 404
    assert a["access"]["is_pro"] is False
    with sessions() as db:
        user = db.get(User, 1)
        user.plan = "individual_pro"
        user.subscription_status = "active"
        user.subscription_current_period_end = datetime.now(timezone.utc) + timedelta(days=1)
        db.commit()
    assert client.get("/self/strategy", headers=headers(1)).json()["access"]["is_pro"] is True
    with sessions() as db:
        user = db.get(User, 1)
        user.subscription_status = "unpaid"
        db.commit()
    assert client.get("/self/strategy", headers=headers(1)).json()["access"]["is_pro"] is False
    with sessions() as db:
        db.get(User, 1).token_version = 1
        db.commit()
    assert client.get("/self/strategy", headers=headers(1)).status_code == 401
    assert client.get("/self/strategy", headers=headers(1, 1)).status_code == 200
    assert client.get("/self/strategy", headers=headers(3)).status_code == 403
