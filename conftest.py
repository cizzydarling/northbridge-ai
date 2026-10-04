"""Repository-wide pytest safety boundary, installed before test collection."""
import pytest
from backend.testing.isolation import configure_environment, install_network_guard, VIOLATIONS

configure_environment()
install_network_guard()


@pytest.fixture(autouse=True)
def isolated_provider_boundary(monkeypatch):
    from app.services import immigration_intelligence_service as intelligence
    def unavailable(_url):
        raise ConnectionError("Synthetic test provider unavailable")
    monkeypatch.setattr(intelligence, "_retrieve_json", unavailable)
    VIOLATIONS.clear()
    yield
    attempted = list(VIOLATIONS)
    VIOLATIONS.clear()
    assert not attempted, "Test attempted unexpected external network access"
