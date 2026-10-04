from types import SimpleNamespace
import pytest
import sqlalchemy as sa
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.data.db import get_db
from app.models.user_models import User
from app.models.beta_feedback_model import BetaFeedback
from app.routes import auth_routes, feedback_routes
from app.services import security_controls
from backend.tests.test_individual_launch_postgres import pg_database_factory, pg_database, migrate, production_shape, rows
from backend.tests.test_password_reset_sessions import auth_client, login

PAYLOAD = dict(category='bug', message='The button does not work.', page_path='/strategy', language='en')


@pytest.fixture
def feedback_api(monkeypatch):
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    User.__table__.create(engine)
    BetaFeedback.__table__.create(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([User(id=i, email=f'test{i}@example.invalid', password='unused', role=role, plan='free')
                    for i, role in [(1, 'individual'), (2, 'individual'), (3, 'admin'), (4, 'agent')]])
        db.commit()
    app = FastAPI()
    app.include_router(feedback_routes.router)
    def database():
        with sessions() as db:
            yield db
    def user(x_test_user: int | None = Header(None), db=Depends(get_db)):
        if not x_test_user:
            raise HTTPException(401, 'Authentication required')
        return db.get(User, x_test_user)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[auth_routes.get_current_user] = user
    security_controls.reset_local_rate_limits()
    monkeypatch.setenv('REDIS_URL', '')
    monkeypatch.setenv('APP_VERSION', '88cd07f')
    with TestClient(app) as client:
        yield client, sessions
    engine.dispose()


def post(client, payload=None, user=1, **kwargs):
    return client.post('/feedback', headers={'X-Test-User': str(user), **kwargs}, json=payload or PAYLOAD)


def test_auth_privacy_and_admin_review(feedback_api):
    client, sessions = feedback_api
    assert client.post('/feedback', json=PAYLOAD).status_code == 401
    assert post(client, user=4).status_code == 403
    assert post(client, user=3).status_code == 403
    result = post(client, {**PAYLOAD, 'page_path': '/strategy?jwt=secret#passport', 'application_version': '88cd07f'},
                  Authorization='Bearer never-persist-this', Cookie='private=secret', **{'User-Agent': 'sensitive arbitrary agent'})
    assert result.status_code == 201
    assert set(result.json()) == {'success', 'feedback_id'}
    feedback_id = result.json()['feedback_id']
    with sessions() as db:
        row = db.get(BetaFeedback, feedback_id)
        assert row.user_id == 1 and row.user_role == 'individual' and row.user_plan == 'free'
        assert row.page_path == '/strategy' and row.backend_version == row.application_version == '88cd07f'
        assert row.status == 'new' and not row.allow_follow_up
        stored = str({c.name: getattr(row, c.name) for c in row.__table__.columns})
        for secret in ['never-persist-this', 'passport', 'private=secret', 'sensitive arbitrary agent']:
            assert secret not in stored
    for user in [1, 2, 4]:
        headers = {'X-Test-User': str(user)}
        assert client.get('/admin/feedback', headers=headers).status_code == 403
        assert client.patch(f'/admin/feedback/{feedback_id}/status', headers=headers, json={'status':'resolved'}).status_code == 403
        assert client.get(f'/feedback/{feedback_id}', headers=headers).status_code == 404
    admin = {'X-Test-User':'3'}
    listed = client.get('/admin/feedback?category=bug&language=en&plan=free&page=/strategy&limit=1', headers=admin).json()
    assert listed['total'] == 1 and len(listed['items']) == 1
    assert 'email' not in listed['items'][0] and 'password' not in listed['items'][0]
    assert client.get('/admin/feedback?offset=1',headers=admin).json()['items'] == []
    assert client.patch(f'/admin/feedback/{feedback_id}/status', headers=admin, json={'status':'resolved'}).status_code == 200
    assert client.get('/admin/feedback?status=new',headers=admin).json()['total'] == 0
    assert client.get('/admin/feedback?date_from=2026-01-01T00:00:00',headers=admin).status_code == 422


@pytest.mark.parametrize('change', [
    {'user_id':2}, {'user_role':'admin'}, {'user_plan':'premium'}, {'plan':'premium'}, {'role':'admin'},
    {'context':{'passport':'secret'}}, {'chat_history':['private']}, {'ai_response':'private'},
    {'active_case_id':2}, {'authorization':'Bearer private'}, {'status':'resolved'},
    {'category':'invalid'}, {'message':'x'*4001}, {'message':' '*20}, {'rating':0}, {'rating':6},
    {'rating':True}, {'rating':'5'}, {'language':'de'}, {'allow_follow_up':'yes'},
    {'device_context':'passport'}, {'application_version':'https://secret/?jwt=private'}])
def test_invalid_input_cannot_spoof_or_capture_context(feedback_api, change):
    client, sessions = feedback_api
    response = post(client, {**PAYLOAD, **change})
    assert response.status_code == 422
    assert response.json() == {'detail':'Invalid feedback fields'}
    with sessions() as db:
        assert db.query(BetaFeedback).count() == 0


def test_unknown_path_and_unpaid_account_are_safe(feedback_api):
    client, sessions = feedback_api
    with sessions() as db:
        db.get(User,1).plan='individual_pro'
        db.commit()
    assert post(client,{**PAYLOAD,'page_path':'/customers/private-name/document/secret'}).status_code == 201
    with sessions() as db:
        row=db.query(BetaFeedback).one()
        assert row.user_plan == 'free' and row.page_path == '/other'


def test_size_and_real_rate_limits(feedback_api):
    client, sessions = feedback_api
    response=client.post('/feedback',headers={'X-Test-User':'1'},content=b'x'*24577)
    assert response.status_code == 413
    security_controls.reset_local_rate_limits()
    for _ in range(5):
        assert post(client).status_code == 201
    blocked=post(client, **{'X-Forwarded-For':'random'})
    assert blocked.status_code == 429 and int(blocked.headers['Retry-After'])>0
    assert post(client,user=2).status_code == 201


def test_hourly_rate_limit_is_per_account(feedback_api, monkeypatch):
    client, _ = feedback_api
    now = [10000.0]
    monkeypatch.setattr(security_controls, 'time', SimpleNamespace(monotonic=lambda: now[0]))
    for _ in range(6):
        for _ in range(5):
            assert post(client).status_code == 201
        now[0] += 61
    assert post(client).status_code == 429
    assert post(client, user=2).status_code == 201


@pytest.mark.parametrize('status', ['available', 'unavailable', 'not_requested'])
def test_only_allowlisted_ai_state_is_saved(feedback_api, status):
    client, sessions = feedback_api
    assert post(client, {**PAYLOAD, 'category':'ai', 'page_path':'/chat', 'ai_status':status}).status_code == 201
    with sessions() as db:
        assert db.query(BetaFeedback).one().ai_status == status
    assert post(client, {**PAYLOAD, 'ai_status':'private AI conversation'}).status_code == 422


def test_real_jwt_authentication_and_revocation(auth_client):
    client, sessions = auth_client
    with sessions() as db:
        BetaFeedback.__table__.create(db.get_bind())
    client.app.include_router(feedback_routes.router)
    token = login(client)
    headers = {'Authorization': 'Bearer '+token}
    assert client.post('/feedback', headers=headers, json=PAYLOAD).status_code == 201
    with sessions() as db:
        db.query(User).filter_by(email='victim@example.com').one().token_version += 1
        db.commit()
    assert client.post('/feedback', headers=headers, json=PAYLOAD).status_code == 401


def test_postgres_feedback_constraints_and_preservation(pg_database):
    engine,url=pg_database
    production_shape(engine,url)
    before=rows(engine)
    migrate(url)
    assert rows(engine)==before
    migrate(url)
    assert rows(engine)==before
    inspector=sa.inspect(engine)
    assert {i['name'] for i in inspector.get_indexes('beta_feedback')} == {'ix_feedback_status_created','ix_feedback_user_created'}
    assert inspector.get_foreign_keys('beta_feedback')[0]['options']['ondelete']=='SET NULL'
    assert len(inspector.get_check_constraints('beta_feedback'))==6
    sql="INSERT INTO beta_feedback(user_id,category,message,page_path,language,user_role,user_plan) VALUES (1,'bug','A synthetic report','/profile','en','individual','free') RETURNING id,status,created_at,updated_at,allow_follow_up"
    with engine.begin() as connection:
        row=connection.exec_driver_sql(sql).one()
        assert row.status=='new' and row.created_at and row.updated_at and not row.allow_follow_up
    for update in ["rating=6", "category='wrong'", "language='xx'", "status='wrong'", "message='tiny'", "user_id=99999"]:
        with pytest.raises(sa.exc.IntegrityError), engine.begin() as connection:
            connection.exec_driver_sql('UPDATE beta_feedback SET '+update)
