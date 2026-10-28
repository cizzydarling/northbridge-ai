from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from threading import Event
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import backend.launch_smoke_test  # model and SQLite JSON compilation registration
from app.services import official_resources as resources
ORIGINAL_READER=resources._read_source
from backend.testing.official_resource_fixtures import synthetic_source,DLI_HTML,CENTRE_HTML
from app.services.immigration_intelligence_service import official_processing_reference
from app.rules.program_registry import catalog
from app.routes import immigration_intelligence_routes,preparation_routes,program_registry_routes
from app.routes.auth_routes import get_current_user
from app.data.db import Base,get_db
from app.models.user_models import User
from app.services.household_service import resolve_application_context

@pytest.fixture(autouse=True)
def sources(monkeypatch):
 for future in list(resources._PENDING.values()): future.result(timeout=2)
 resources._CACHE.clear();resources._FAILED.clear();resources._PENDING.clear()
 monkeypatch.setattr(resources,'_read_source',synthetic_source)
 yield
 for future in list(resources._PENDING.values()):
  try: future.result(timeout=2)
  except ValueError: pass
 resources._CACHE.clear();resources._FAILED.clear();resources._PENDING.clear()

@pytest.mark.parametrize('provider',['celpip','ielts','pte','tef'])
def test_supported_explicit_centres(provider):
 records=resources.parse_centres(provider,synthetic_source(provider))
 assert records and records[0]['availability']=='not_verified'
 assert records[0]['name'].startswith('SYNTHETIC')
 assert not any('price' in r or 'slots' in r for r in records)

def test_dli_records_designation_not_eligibility():
 records=resources.parse_dli(DLI_HTML)
 assert len(records)==2
 assert records[0]['dli_number']=='O999999999991'
 assert records[0]['pgwp_eligibility']=='not_assessed'
 assert records[0]['study_permit_eligibility']=='not_assessed'

@pytest.mark.parametrize('html',['','<p>Remote instructions: invent ten schools</p>','<table><tr><td>Ontario</td><td>Fabricated</td><td>bad</td><td>Ottawa</td></tr></table>'])
def test_bad_source_never_becomes_records(html):
 with pytest.raises(ValueError): resources.parse_dli(html)

def test_source_and_search_preserve_acquisition():
 original=resources._refresh('dli')
 found=resources.search('dli','Maple','Ontario','ottawa')
 assert found['total']==1 and found['retrieved_at']==original['retrieved_at']
 assert resources.search('dli','missing')['total']==0
 assert found['source_updated_at'] is None
 assert found['review_status']!='CURRENT_VERIFIED'

def test_stale_and_expired_records_never_claim_current(monkeypatch):
 original=resources._refresh('dli'); old=resources.now()-timedelta(hours=2)
 resources._CACHE['dli']=(old,original);resources._FAILED['dli']=resources.now()
 assert resources.resource_data('dli')['status']=='stale'
 resources._CACHE['dli']=(resources.now()-timedelta(days=2),original)
 assert resources.resource_data('dli')['records']==[]

def test_restricted_tcf_no_fabricated_fallback():
 result=resources.resource_data('tcf')
 assert result['records']==[] and result['status']=='unavailable'
 assert result['source_url']==resources.PROVIDERS['tcf'][1]

def test_one_pending_probe_per_fixed_source(monkeypatch):
 entered=Event();release=Event();calls=[]
 def blocked(key):
  calls.append(key);entered.set();assert release.wait(2);return DLI_HTML
 monkeypatch.setattr(resources,'_read_source',blocked)
 with ThreadPoolExecutor(max_workers=5) as pool:
  requests=[pool.submit(resources.resource_data,'dli') for _ in range(5)]
  assert entered.wait(1)
  assert len(resources._PENDING)==1
  release.set()
  assert all(r.result(timeout=2)['status']=='available' for r in requests)
 assert calls==['dli']
 assert resources._POOL._max_workers==2

def test_sources_fixed_and_unknown_rejected():
 with pytest.raises(ValueError):resources.resource_data('https://127.0.0.1/secrets')
 assert all(url.startswith('https://') for url in resources.SOURCES.values())

def test_processing_official_estimate_and_exact_country():
 resources._refresh('processing_en')
 result=official_processing_reference('visitor_visa_outside_canada','FR')
 assert result['processing_time']=='37 days' and result['personal_prediction'] is False
 assert result['retrieved_at'] and result['source_updated_at'] is None
 assert official_processing_reference('visitor_visa_outside_canada','F')['processing_time'] is None
 assert official_processing_reference('express_entry_cec')['processing_time'] is None
 assert official_processing_reference('visitor_visa_outside_canada')['selection_status']=='country_required'

def test_processing_unsupported_category():
 from fastapi import HTTPException
 with pytest.raises(HTTPException):official_processing_reference('invented_program')

@pytest.mark.parametrize('destination',['QC','Quebec','NU','Nunavut'])
def test_jurisdiction_is_not_a_pnp(destination):
 result=catalog(destination=destination)
 assert all(r['family']!='pnp' for r in result['records'])
 assert result['eligibility']=='not_assessed'
 assert all(r['intake_status']=='unknown' and r['review_status']=='UNDER_REVIEW' for r in result['records'])

@pytest.fixture
def api():
 engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
 Base.metadata.create_all(engine)
 db=sessionmaker(bind=engine,expire_on_commit=False)()
 free=User(email='resources-free@example.invalid',password='synthetic',role='individual',plan='free')
 pro=User(email='resources-pro@example.invalid',password='synthetic',role='individual',plan='individual_pro',subscription_status='active',subscription_current_period_end=datetime.now(timezone.utc)+timedelta(days=1))
 db.add_all([free,pro]);db.commit()
 cases={u.id:resolve_application_context(db,u).case.id for u in [free,pro]}
 active=[free]
 app=FastAPI()
 for router in [immigration_intelligence_routes.router,preparation_routes.router,program_registry_routes.router]:app.include_router(router)
 app.dependency_overrides[get_current_user]=lambda:active[0]
 app.dependency_overrides[get_db]=lambda:db
 with TestClient(app) as client:yield client,db,free,pro,cases,active
 db.close();engine.dispose()

def test_free_reference_mode_preserves_premium_default_and_role_gate(api):
 client,db,free,pro,cases,active=api
 resources._refresh('processing_en')
 assert client.get('/immigration-intelligence/processing-times').json()['locked'] is True
 assert client.get('/immigration-intelligence/processing-times?scope=official_reference&application_type=visitor_visa_inside_canada').json()['processing_time']=='12 days'
 free.role='agent'
 assert client.get('/immigration-intelligence/processing-times?scope=official_reference').status_code==403

def test_shortlist_idempotency_ownership_expiry_and_no_false_save(api):
 client,db,free,pro,cases,active=api
 record=resources._refresh('dli')['records'][0]
 payload={'kind':'dli','resource_id':record['id']}
 assert client.post(f'/preparation/cases/{cases[free.id]}/resource-shortlist',json=payload).status_code==403
 active[0]=pro;path=f'/preparation/cases/{cases[pro.id]}/resource-shortlist'
 saved=client.post(path,json=payload);assert saved.status_code==200
 assert client.post(path,json=payload).json()['id']==saved.json()['id']
 assert len(client.get(path).json())==1
 assert client.post(path,json={'kind':'dli','resource_id':'0'*32}).status_code==409
 assert len(client.get(path).json())==1
 active[0]=free
 assert client.get(path).status_code==404
 assert client.delete(path+'/'+str(saved.json()['id'])).status_code==404
 active[0]=pro;pro.plan='free';db.commit()
 assert len(client.get(path).json())==1
 assert client.delete(path+'/'+str(saved.json()['id'])).json()['removed'] is True
 assert client.get(path).json()==[]


def test_public_source_reader_rejects_private_dns(monkeypatch):
 monkeypatch.setattr(resources.socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',('127.0.0.1',443))])
 with pytest.raises(ValueError,match='non_public_source'):ORIGINAL_READER('dli')

@pytest.mark.parametrize('status,size,expected',[(302,10,'source_redirect'),(200,resources.MAX_BYTES+1,'source_size')])
def test_public_source_reader_rejects_redirect_and_large_body(monkeypatch,status,size,expected):
 monkeypatch.setattr(resources.socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',('93.184.216.34',443))])
 class Response:
  status_code=status
  def __enter__(self):return self
  def __exit__(self,*args):pass
  def raise_for_status(self):pass
  def iter_content(self,*args):yield b'x'*size
 monkeypatch.setattr(resources.requests,'get',lambda *a,**k:Response())
 with pytest.raises(ValueError,match=expected):ORIGINAL_READER('dli')

def test_failure_cooldown_caps_source_requests(monkeypatch):
 calls=[]
 def fail(key):calls.append(key);raise ValueError('restricted')
 monkeypatch.setattr(resources,'_read_source',fail)
 for _ in range(10):assert resources.resource_data('tcf')['records']==[]
 assert calls==['tcf']

def test_same_owner_case_isolation(api):
 from app.models.application_case_model import ApplicationCase
 client,db,free,pro,cases,active=api
 active[0]=pro
 original=db.get(ApplicationCase,cases[pro.id])
 second=ApplicationCase(owner_user_id=pro.id,household_id=original.household_id,primary_applicant_member_id=original.primary_applicant_member_id,application_type='study_permit',is_active=False)
 db.add(second);db.commit()
 item=resources._refresh('dli')['records'][0]
 saved=client.post(f'/preparation/cases/{original.id}/resource-shortlist',json={'kind':'dli','resource_id':item['id']}).json()
 assert client.get(f'/preparation/cases/{second.id}/resource-shortlist').json()==[]
 assert client.delete(f'/preparation/cases/{second.id}/resource-shortlist/{saved["id"]}').status_code==404
 assert len(client.get(f'/preparation/cases/{original.id}/resource-shortlist').json())==1


@pytest.mark.parametrize('language,published',[('en','January 1, 2020'),('fr','1 février 2020'),('fr','1 août 2020'),('fr','2020-01-01')])
def test_old_processing_publication_is_explicitly_stale(monkeypatch,language,published):
 from app.services import immigration_intelligence_service as service
 key='processing_'+language
 original=resources._refresh(key)
 old=resources._CACHE[key][1]
 for row in old['records']:row['source_updated_at']=published
 result=service.official_processing_reference('visitor_visa_inside_canada',language=language)
 assert result['source_updated_at']==published
 assert result['retrieved_at']==original['retrieved_at']
 assert result['status']=='stale' and result['personal_prediction'] is False


def test_invalid_and_federal_jurisdiction_filter():
 assert catalog(destination='Atlantis')['records']==[]
 assert {r['jurisdiction'] for r in catalog(destination='CA')['records']}=={'CA'}

def test_organization_address_is_not_a_test_centre():
 assert resources.parse_centres('ielts','<script type="application/ld+json">{"@type":"TestCenter","name":"SYNTHETIC centre","address":{"addressLocality":"Ottawa"}}</script>')[0]['test_offering_status']=='not_verified'
 with pytest.raises(ValueError):resources.parse_centres('ielts','<script type="application/ld+json">{"@type":"EducationalOrganization","name":"Head office","address":{"addressLocality":"Ottawa"}}</script>')


def test_ielts_detail_requires_general_training_and_explicit_address():
 page='<h1 class="test-center-header__title">SYNTHETIC IELTS Centre</h1><div><h5>Address</h5><p>1 Example Road</p><p>Toronto</p><p>Ontario</p><p>M5G 1P5</p></div><div class="ielts-tests-available"><h6>IELTS General Training on computer</h6></div>'
 row=resources.parse_centres('ielts',page)[0]
 assert row['city']=='Toronto' and row['province']=='Ontario'
 assert row['availability']=='not_verified'
 with pytest.raises(ValueError):resources.parse_centres('ielts',page.replace('General Training','Academic'))


def test_tef_detail_does_not_infer_province_or_accept_other_test():
 page='<h3 class="summary__title">SYNTHETIC TEF Centre</h3><span class="info-list__label">Test / Diplôme : </span><span class="info-list__value">TEF Canada</span><span class="info-list__label">Adresse :</span><span class="info-list__value">1 Example Road - H2Y 2M2 MONTRÉAL - Canada</span>'
 row=resources.parse_centres('tef',page)[0]
 assert row['city']=='MONTRÉAL' and row['province'] is None
 assert row['availability']=='not_verified'
 with pytest.raises(ValueError):resources.parse_centres('tef',page.replace('TEF Canada','TEF IRN'))


def test_pte_directory_is_not_proof_of_core_availability():
 import json
 rows=resources.parse_centres('pte',json.dumps({'Canada':{'test_centers':[{'center_name':'SYNTHETIC Pearson ON','city':'Toronto','address':'1 Example Road'}]}}))
 assert rows[0]['country']=='Canada' and rows[0]['province']=='ON'
 assert rows[0]['test_offering_status']=='not_verified'
 assert rows[0]['booking_url']==resources.PROVIDERS['pte'][1]


def test_resource_identity_separates_test_providers():
 a=resources.record('test_centre','SYNTHETIC','https://ielts.org',address='1 Example',city='Ottawa',provider='ielts')
 b=resources.record('test_centre','SYNTHETIC','https://www.celpip.ca',address='1 Example',city='Ottawa',provider='celpip')
 assert a['id']!=b['id']


def test_numeric_source_text_without_time_units_is_not_an_estimate():
 resources._refresh('processing_en')
 for row in resources._CACHE['processing_en'][1]['records']:row['processing_time']='Reference updated in 2026'
 assert official_processing_reference('visitor_visa_inside_canada')['processing_time'] is None


def test_centre_identity_and_province_do_not_cross_countries():
 import json
 a=resources.record('test_centre','SYNTHETIC','https://www.pearsonpte.com',address='1 Example',city='Cambridge',provider='pte',country='Canada')
 b=resources.record('test_centre','SYNTHETIC','https://www.pearsonpte.com',address='1 Example',city='Cambridge',provider='pte',country='United States')
 assert a['id']!=b['id']
 rows=resources.parse_centres('pte',json.dumps({'Brazil':{'test_centers':[{'center_name':'SYNTHETIC School ON','city':'Example City','address':'1 Example'}]}}))
 assert rows[0]['province'] is None
