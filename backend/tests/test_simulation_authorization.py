import pytest
import backend.launch_smoke_test  # noqa: F401 -- register models and SQLite JSONB support
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.data.db import Base, get_db
from app.models.client_model import Client
from app.models.simulation_model import SavedSimulationScenario
from app.models.user_models import User
from app.routes.auth_routes import create_access_token


@pytest.fixture
def simulation_app(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("ENVIRONMENT", "test")
    from app.main import register_routers

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    sessions = sessionmaker(bind=engine)
    Base.metadata.create_all(engine, tables=[
        User.__table__, Client.__table__, SavedSimulationScenario.__table__
    ])
    with sessions() as db:
        for user_id, role, plan in (
            (1, "agent", "agent_pro"), (2, "agent", "agent_pro"),
            (3, "individual", "individual_pro"),
        ):
            db.add(User(id=user_id, email=f"user{user_id}@example.com", password="unused",
                        role=role, plan=plan, subscription_status="active"))
            db.add(Client(id=user_id, owner_user_id=user_id, full_name=f"Client {user_id}"))
            db.add(SavedSimulationScenario(
                id=user_id, client_id=user_id, name=f"Scenario {user_id}",
                current_profile_snapshot={"private": user_id}, simulated_changes={}, result_payload={}
            ))
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app = FastAPI()
    register_routers(app)
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client, sessions
    engine.dispose()


def headers(user_id):
    if user_id is None:
        return {}
    token = create_access_token({"sub": f"user{user_id}@example.com", "token_version": 0})
    return {"Authorization": f"Bearer {token}"}


def payload(client_id=1):
    return {"client_id": client_id, "name": "New scenario", "current_profile_snapshot": {},
            "simulated_changes": {}, "result_payload": {}}


OPERATIONS = [
    ("GET", "/clients/{client}/simulations"),
    ("GET", "/clients/{client}/simulations/{scenario}"),
    ("POST", "/clients/{client}/simulations"),
    ("PUT", "/clients/{client}/simulations/{scenario}"),
    ("DELETE", "/clients/{client}/simulations/{scenario}"),
    ("POST", "/clients/{client}/simulations/compare"),
    ("GET", "/clients/{client}/simulations/{scenario}/report"),
    ("POST", "/clients/{client}/simulations/compare/report"),
    ("POST", "/client-simulations/{client}/run"),
]


def request(client, method, path, *, user_id, client_id=1, scenario_id=1):
    body = {**payload(client_id), "first_simulation_id": scenario_id,
            "second_simulation_id": scenario_id}
    return client.request(method, path.format(client=client_id, scenario=scenario_id),
                          headers=headers(user_id), json=body)


@pytest.mark.parametrize("method,path", [
    ("GET", "/simulation-scenarios/2"), ("POST", "/simulation-scenarios/"),
    ("DELETE", "/simulation-scenarios/2"),
])
@pytest.mark.parametrize("user_id", [None, 1, 3])
def test_legacy_routes_are_unmounted(simulation_app, method, path, user_id):
    client, sessions = simulation_app
    assert client.request(method, path, headers=headers(user_id), json=payload(2)).status_code == 404
    assert not any(getattr(route, "path", "").startswith("/simulation-scenarios")
                   for route in client.app.routes)
    with sessions() as db:
        assert db.query(SavedSimulationScenario).count() == 3
        assert db.get(SavedSimulationScenario, 2).name == "Scenario 2"


@pytest.mark.parametrize("method,path", OPERATIONS)
def test_modern_operations_require_authentication(simulation_app, method, path):
    client, _ = simulation_app
    assert request(client, method, path, user_id=None).status_code == 401


@pytest.mark.parametrize("method,path", OPERATIONS)
def test_agent_cannot_access_another_agents_client(simulation_app, method, path):
    client, sessions = simulation_app
    assert request(client, method, path, user_id=1, client_id=2, scenario_id=2).status_code == 404
    with sessions() as db:
        assert db.query(SavedSimulationScenario).count() == 3
        assert db.get(SavedSimulationScenario, 2).name == "Scenario 2"


@pytest.mark.parametrize("method,path", [OPERATIONS[1], OPERATIONS[3], OPERATIONS[4],
                                       OPERATIONS[5], OPERATIONS[6], OPERATIONS[7]])
def test_foreign_scenario_under_owned_client_is_rejected(simulation_app, method, path):
    client, _ = simulation_app
    assert request(client, method, path, user_id=1, client_id=1, scenario_id=2).status_code == 404


@pytest.mark.parametrize("plan", ["free", "individual_pro", "individual_premium", "agent_pro"])
@pytest.mark.parametrize("method,path", OPERATIONS)
def test_individual_cannot_use_agent_simulations_even_with_owned_client(simulation_app, plan, method, path):
    client, sessions = simulation_app
    with sessions() as db:
        db.get(User, 3).plan = plan
        db.commit()
    assert request(client, method, path, user_id=3, client_id=3, scenario_id=3).status_code == 403


@pytest.mark.parametrize("plan,status", [("free", "active"), ("agent_pro", "canceled")])
def test_agent_requires_agent_entitlement(simulation_app, plan, status):
    client, sessions = simulation_app
    with sessions() as db:
        user = db.get(User, 1)
        user.plan, user.subscription_status = plan, status
        db.commit()
    assert client.get("/clients/1/simulations", headers=headers(1)).status_code == 403


def test_valid_owner_can_manage_scenarios_and_cannot_forge_client_id(simulation_app):
    client, sessions = simulation_app
    auth = headers(1)
    assert client.post("/clients/1/simulations", headers=auth, json=payload(2)).status_code == 400
    created = client.post("/clients/1/simulations", headers=auth, json=payload())
    assert created.status_code == 200, created.text
    scenario_id = created.json()["id"]
    url = f"/clients/1/simulations/{scenario_id}"
    assert client.get(url, headers=auth).json()["client_id"] == 1
    listed = client.get("/clients/1/simulations", headers=auth)
    assert listed.status_code == 200
    assert {item["client_id"] for item in listed.json()} == {1}
    assert client.put(url, headers=auth, json={"name": "Renamed"}).json()["name"] == "Renamed"
    assert client.delete(url, headers=auth).status_code == 200
    assert client.get(url, headers=auth).status_code == 404
    with sessions() as db:
        assert db.get(SavedSimulationScenario, 2).name == "Scenario 2"
