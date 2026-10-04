import json
import socket
import time
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
from backend.testing.isolation import VIOLATIONS, check_address
from backend.tests.performance_cases import strategy_case
from app.services import ai_advisor, strategy_service

@pytest.mark.parametrize('mode', ['success','timeout','error','malformed','missing','partial'])
def test_ai_state_and_deterministic_parity(monkeypatch, mode):
    monkeypatch.setattr(ai_advisor, '_get_openai_client', lambda: None)
    expected = strategy_service.build_strategy(*strategy_case(0))
    client = Mock()
    completion = client.with_options.return_value.chat.completions.create
    if mode in {'timeout','error'}:
        completion.side_effect = TimeoutError('private provider details') if mode=='timeout' else RuntimeError('private provider details')
    else:
        text = 'not json' if mode=='malformed' else json.dumps({'advisor_summary':'Personalized summary','ai_strategy':'Personalized analysis'} if mode=='success' else {'advisor_summary':'partial'})
        completion.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])
    monkeypatch.setattr(ai_advisor, '_get_openai_client', lambda: None if mode=='missing' else client)
    actual = strategy_service.build_strategy(*strategy_case(0))
    assert actual.pop('ai_status') == ('available' if mode=='success' else 'unavailable')
    narrative = actual.pop('ai_strategy')
    assert bool(narrative) == (mode=='success')
    expected.pop('ai_status'); expected.pop('ai_strategy')
    assert actual == expected
    if mode!='missing':
        client.with_options.assert_called_once_with(timeout=15.0,max_retries=0)
        completion.assert_called_once()

@pytest.mark.parametrize('host', ['northbridge-ai-2.onrender.com','www.northbridgeia.com','api.stripe.com','api.resend.com','smtp.example.com','192.0.2.1'])
def test_external_network_rejected_before_transport(host):
    try:
        with pytest.raises(RuntimeError, match='TEST isolation'):
            socket.socket().connect((host,443))
        assert VIOLATIONS
    finally:
        VIOLATIONS.clear()  # this test deliberately exercises the boundary


def test_libpq_cannot_bypass_socket_guard():
    import psycopg2
    try:
        with pytest.raises(RuntimeError,match='TEST isolation'):
            psycopg2.connect(host='db.production.invalid',dbname='production')
        with pytest.raises(RuntimeError,match='non-disposable'):
            psycopg2.connect(host='127.0.0.1',dbname='production')
    finally: VIOLATIONS.clear()


def test_readiness_dependency_failure_redacted(monkeypatch):
    from app import main
    app = main.create_app()
    monkeypatch.setattr(main,'prepare_noc_data',lambda: None)
    monkeypatch.setattr(main,'document_storage_healthcheck',Mock(side_effect=RuntimeError('secret bucket credential')))
    with TestClient(app) as client:
        response=client.get('/health/ready')
        assert response.status_code==503
        assert response.json()['components']['document_storage']=='unavailable'
        assert 'secret' not in response.text
        assert client.get('/health/live').status_code==200


def test_readiness_slow_probe_bounded_and_not_duplicated(monkeypatch):
    from app import main
    app=main.create_app()
    monkeypatch.setattr(main,'prepare_noc_data',lambda:None)
    slow=Mock(side_effect=lambda:time.sleep(3))
    monkeypatch.setattr(main,'document_storage_healthcheck',slow)
    with TestClient(app) as client:
        start=time.monotonic();response=client.get('/health/ready')
        assert response.status_code==503 and time.monotonic()-start<4.5
        response=client.get('/health/ready')
        assert response.status_code==200
        assert slow.call_count==1
