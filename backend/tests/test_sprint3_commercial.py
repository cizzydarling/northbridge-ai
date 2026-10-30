"""Synthetic commercial release review. No provider or production connections."""
import copy
from datetime import date, timedelta
import json
import logging
from pathlib import Path
import pytest
from pydantic import ValidationError
from app.services.official_crs import RankingFacts, evaluate_candidate, missing_evidence
from app.rules.deterministic_validation import validation_report
from app.rules.crs_versions import REGISTRY
from app.rules.registry import RuleUnavailable
from app.services.product_analytics import Activity, emit, cohort_summary
from backend.tests.test_sprint2_language_preparation import sprint_api  # noqa: F401
from backend.tests.test_billing_entitlements import env, headers, sync, webhook, assert_no_access  # noqa: F401
from backend.tests.test_sprint2_billing_reconciliation import refunds  # noqa: F401

VECTORS = json.loads((Path(__file__).parents[1]/"app/rules/fixtures/crs_vectors.json").read_text())["vectors"]
BASE = VECTORS[0]["facts"]

@pytest.fixture(autouse=True)
def analytics_logger_enabled(monkeypatch):
    # In-process Alembic CLI tests run fileConfig(disable_existing_loggers=True).
    # Isolate this module from that unrelated logging configuration.
    monkeypatch.setattr(logging.getLogger("northbridge.product"), "disabled", False)
    monkeypatch.setattr(logging.getLogger("northbridge.product"), "propagate", True)

@pytest.mark.parametrize("vector", VECTORS, ids=lambda v:v["id"])
def test_literal_official_factor_vectors(vector):
    result = evaluate_candidate(vector["facts"], as_of=date(2026,11,2))
    assert result["score"] == vector["score"]
    assert result["section_totals"] == vector["sections"]
    assert sum(x["points"] for x in result["breakdown"]) == result["score"]
    assert result["maximum_points"] == 1200
    assert result["program_eligibility"] == result["invitation_eligibility"] == "not_assessed"
    assert result["production_activation"] is False

@pytest.mark.parametrize("day", [date(2026,11,2),date(2026,11,3),date(2026,11,4)])
def test_boundary_never_activates_release(day):
    result=evaluate_candidate(BASE,as_of=day)
    assert (result["score"] is None) is (day>=date(2026,11,3))
    if day>=date(2026,11,3):
        assert result["status"]=="REVIEW_REQUIRED" and result["maximum_points"] is None
    with pytest.raises(RuleUnavailable):
        REGISTRY.select("crs","express_entry","CA",as_of=day,applicability="ranking")

@pytest.mark.parametrize("age,points", [(17,0),(18,99),(19,105),(20,110),(29,110),(30,105),(31,99),(32,94),(40,50),(44,6),(45,0)])
def test_independent_age_boundary(age,points):
    result=evaluate_candidate(BASE|{"age":age},as_of=date(2026,10,26))
    assert next(x["points"] for x in result["breakdown"] if x["factor"]=="age")==points

@pytest.mark.parametrize("status", ["none","non_accompanying","citizen_or_pr"])
def test_spouse_exemptions_use_unaccompanied_tables(status):
    assert evaluate_candidate(BASE|{"spouse_status":status},as_of=date(2026,10,26))["score"]==469

@pytest.mark.parametrize("spouse", [False,True])
def test_section_caps_and_additional_points(spouse):
    skills={k:12 for k in ("listening","reading","writing","speaking")}
    facts=BASE|{"education":"doctorate","english":skills,"french":skills,"no_second_language_test":False,
        "canadian_work_years":5,"canadian_work_qualified":True,"provincial_nomination":True,
        "canadian_education":"three_or_more_years","sibling_in_canada":True,"certificate_of_qualification":True}
    if spouse:
        facts.update(spouse_status="accompanying",spouse_education="doctorate",spouse_education_evidence_current=True,
            spouse_language=skills,spouse_language_evidence_current=True,spouse_canadian_work_years=5,spouse_work_qualified=True)
    result=evaluate_candidate(facts,as_of=date(2026,10,26))
    assert result["score"]==1200
    assert result["section_totals"]=={"core":460 if spouse else 500,"spouse":40 if spouse else 0,"transferability":100,"additional":600}

@pytest.mark.parametrize("change", [{"age":None},{"education_evidence_current":False},{"english":None},
    {"language_evidence_current":False},{"foreign_work_qualified":None},{"additional_evidence_qualified":False},
    {"spouse_status":"accompanying"},{"french":{"listening":7,"reading":7,"writing":7,"speaking":7}}])
def test_incomplete_or_conflicting_evidence_withholds_score(change):
    result=evaluate_candidate(BASE|change,as_of=date(2026,10,26))
    assert result["score"] is None and result["missing_inputs"]

@pytest.mark.parametrize("change", [{"age":True},{"age":"29"},{"english":{"listening":13,"reading":9,"writing":9,"speaking":9}},{"salary":200000}])
def test_invalid_and_invented_inputs_rejected(change):
    with pytest.raises(ValidationError):
        RankingFacts.model_validate(BASE|change)


def test_partial_workspace_preserves_forms_and_owner_and_detects_stale_save(sprint_api):
    from app.routes.commercial_workspace_routes import router
    from app.models.self_application_model import SelfApplication
    client,sessions=sprint_api
    client.app.include_router(router)
    context=client.get('/application-cases/context',headers={'x-test-user':'1'}).json()
    case_id=context['case_id']
    with sessions() as db:
        row=db.query(SelfApplication).filter_by(application_case_id=case_id,user_id=1).first()
        if row is None:
            row=SelfApplication(user_id=1,application_case_id=case_id,matter_type='permanent_residence')
            db.add(row)
        row.intake_payload={'school_name':'Preserve synthetic school','server_only':{'preserve':'exact'}}
        db.commit()
    url=f'/preparation/cases/{case_id}/crs-inputs'
    assert client.get(url).status_code==401
    assert client.get(url,headers={'x-test-user':'2'}).status_code==404
    read=client.get(url,headers={'x-test-user':'1'}).json()
    assert read['revision']==0 and read['score'] is None
    body={'revision':0,'facts':{'age':32}}
    saved=client.put(url,headers={'x-test-user':'1'},json=body)
    assert saved.status_code==200 and saved.json()['revision']==1 and saved.json()['score'] is None
    assert client.put(url,headers={'x-test-user':'1'},json=body).status_code==409
    assert client.put(url,headers={'x-test-user':'2'},json=body).status_code==404
    with sessions() as db:
        row=db.query(SelfApplication).filter_by(application_case_id=case_id,user_id=1).one()
        assert row.intake_payload['school_name']=='Preserve synthetic school'
        assert row.intake_payload['server_only']=={'preserve':'exact'}
        assert row.intake_payload['crs_preparation']['facts']['age']==32


def test_analytics_minimization_and_unknown_cost(monkeypatch,caplog):
    monkeypatch.setenv('PRODUCT_ANALYTICS_ENABLED','true')
    monkeypatch.setenv('PRODUCT_ANALYTICS_KEY','synthetic-analytics-key-32-characters-only')
    with caplog.at_level(logging.INFO,logger='northbridge.product'):
        assert emit(1,'crs_engaged',plan='free')
        assert emit(1,'ai_usage',tokens=100)
        assert emit(1,'checkout_conversion',idempotency_key='synthetic-provider-reference')
        assert emit(1,'checkout_conversion',idempotency_key='synthetic-provider-reference')
    records=[json.loads(r.message) for r in caplog.records if r.name=='northbridge.product']
    assert all('user_id' not in row and len(row['actor'])==64 for row in records)
    summary=cohort_summary(records)
    assert summary['events']['checkout_conversion']==1
    assert summary['ai_events_with_unknown_cost']==1
    assert summary['contribution_margin_available'] is False
    with pytest.raises(ValidationError):
        Activity.model_validate({'event':'crs_engaged','surface':'strategy','answers':{'age':29}})
    with pytest.raises(ValueError):
        cohort_summary([records[0]|{'email':'synthetic@example.invalid'}])
    monkeypatch.delenv('PRODUCT_ANALYTICS_ENABLED')
    assert emit(1,'registration') is False


def test_inactive_fixture_validation_is_not_rule_activation():
    result=validation_report()
    assert result['status']=='FIXTURES_PASS' and result['checks']==6
    assert result['independent_human_review']=='PENDING' and result['activation']=='DISABLED'


def test_test_checkout_gate_cannot_route_to_live_or_production(env,monkeypatch):
    from app.routes import billing_routes as billing
    monkeypatch.delenv('PAID_CHECKOUT_ENABLED',raising=False)
    monkeypatch.setenv('TEST_CHECKOUT_ENABLED','true')
    assert billing.test_checkout_enabled()
    assert env.client.get('/billing/plans').json()['payment_mode']=='test'
    for key,value in [('APP_ENV','production'),('DATABASE_URL','postgresql://localhost/northbridgeai')]:
        with monkeypatch.context() as patch:
            patch.setenv(key,value)
            assert not billing.test_checkout_enabled()
            assert env.client.post('/billing/create-checkout-session',headers=headers(),json={'plan':'pro'}).status_code==403
    monkeypatch.setattr(billing.stripe,'api_key','sk_live_synthetic_not_a_credential')
    assert not billing.test_checkout_enabled()
    assert_no_access(env)


def test_existing_signed_billing_lifecycle_and_account_isolation(env):
    assert sync(env).status_code==200
    assert env.client.get('/test/pro',headers=headers()).status_code==200
    assert env.client.get('/test/pro',headers=headers(2)).status_code==403
    assert sync(env).status_code==200  # replay
    assert webhook(env,'invoice.paid',{'id':'in_1','customer':'cus_1','subscription':'sub_1','status':'paid'}).status_code==200
    env.subscription['status']='past_due'
    assert webhook(env,'invoice.payment_failed',{'id':'in_1','customer':'cus_1','subscription':'sub_1','status':'open'}).status_code==200
    assert_no_access(env)


def test_usage_scope_never_leaks_account_or_guesses_cost(monkeypatch, caplog):
    from types import SimpleNamespace
    from app.services.product_analytics import usage_scope, record_provider_usage
    monkeypatch.setenv('PRODUCT_ANALYTICS_ENABLED', 'true')
    monkeypatch.setenv('PRODUCT_ANALYTICS_KEY', 'synthetic-analytics-key-32-characters-only')
    with caplog.at_level(logging.INFO, logger='northbridge.product'):
        assert record_provider_usage(SimpleNamespace(total_tokens=12)) is False
        with usage_scope(1, 'individual_pro'):
            assert record_provider_usage(SimpleNamespace(total_tokens=12))
        assert record_provider_usage(SimpleNamespace(total_tokens=13)) is False
    rows=[json.loads(r.message) for r in caplog.records if r.name=='northbridge.product']
    assert len(rows)==1 and rows[0]['tokens']==12 and rows[0]['cost_microusd'] is None

def test_test_checkout_rejects_live_session_before_entitlement(env, monkeypatch):
    monkeypatch.setenv('TEST_CHECKOUT_ENABLED','true')
    env.session['livemode']=True
    assert sync(env).status_code==409
    assert_no_access(env)

def test_tables_are_immutable():
    from app.services.official_crs import TABLES
    with pytest.raises(TypeError):
        TABLES['education'][0][0]=99


def work_period(**changes):
    return dict(country='CA', start_date='2025-01-01', end_date='2026-01-01',
                weekly_hours=30.0, noc_code='21231', paid=True, authorized=True,
                full_time_student=False, self_employed=False, duties_match=True) | changes


def equivalence_period(*, years=1, country='CA'):
    start = date(2022, 1, 1)
    # Independent hours: 20 hours/week * 78 weeks = 1560, spanning >12 months.
    return work_period(country=country, start_date=start.isoformat(),
                       end_date=(start + timedelta(weeks=78 * years)).isoformat(), weekly_hours=20.0)


@pytest.mark.parametrize('country', ['CA', 'FR'])
@pytest.mark.parametrize('years', [1, 2])
def test_equivalence_exact_part_time_years(country, years):
    from app.services.official_crs import normalize_work_periods
    result = normalize_work_periods([equivalence_period(years=years, country=country)], as_of=date(2026, 11, 2))
    key = 'canadian' if country == 'CA' else 'foreign'
    assert result['blockers'] == []
    assert result['work'][key] == {'credited_hours': 1560 * years, 'completed_years': years}


@pytest.mark.parametrize('years,score,core', [(1, 459, 409), (2, 472, 422)])
def test_equivalence_part_time_candidate_breakdown(years, score, core):
    result = evaluate_candidate(BASE | {'canadian_work_years': None, 'foreign_work_years': 0,
        'canadian_work_qualified': True, 'work_periods': [equivalence_period(years=years)]}, as_of=date(2026, 11, 2))
    # 110 age +135 education +124 language +40/53 work +50 transferability.
    assert result['missing_inputs'] == []
    assert result['score'] == score
    assert result['section_totals'] == {'core': core, 'spouse': 0, 'transferability': 50, 'additional': 0}
    assert sum(row['points'] for row in result['breakdown']) == score
    assert result['production_activation'] is False


def test_equivalence_preparation_has_no_false_conflict_or_numerical_output():
    from app.services.crs_assessment_service import review_crs_inputs
    facts = copy.deepcopy(BASE | {'canadian_work_years': 1, 'foreign_work_years': 0,
        'canadian_work_qualified': True, 'work_periods': [equivalence_period()]})
    original = copy.deepcopy(facts)
    language = {'en': {'usable': True, 'skills': {k: {'benchmark': v} for k, v in facts['english'].items()}}, 'fr': None}
    result = review_crs_inputs({'ranking_facts': facts}, language, as_of=date(2026, 11, 2))
    assert result['missing_inputs'] == []
    assert result['status'] == 'verification_required'
    assert result['work_normalization']['work']['canadian']['completed_years'] == 1
    assert result['score'] is None and result['numerical_activation'] is False
    assert all(row['points'] is None for row in result['breakdown'])
    assert facts == original


@pytest.mark.parametrize('country', ['CA', 'FR'])
@pytest.mark.parametrize('years', [1, 2])
def test_equivalence_hours_do_not_replace_calendar_anniversaries(country, years):
    from app.services.official_crs import normalize_work_periods
    start = date(2022, 1, 1)
    period = work_period(country=country, start_date=start.isoformat(),
                         end_date=(start + timedelta(weeks=52 * years)).isoformat())
    result = normalize_work_periods([period], as_of=date(2026, 11, 2))
    key = 'canadian' if country == 'CA' else 'foreign'
    assert result['work'][key] == {'credited_hours': 1560 * years, 'completed_years': years - 1}


def test_equivalence_weekly_cap_prevents_compressed_year():
    from app.services.official_crs import normalize_work_periods
    start = date(2022, 1, 1)
    period = work_period(start_date=start.isoformat(), end_date=(start + timedelta(weeks=26)).isoformat(), weekly_hours=60.0)
    result = normalize_work_periods([period], as_of=date(2026, 11, 2))
    assert result['hours_per_week_cap'] == 30
    assert result['work']['canadian'] == {'credited_hours': 780, 'completed_years': 0}


def test_equivalence_overlapping_hours_do_not_create_second_year():
    from app.services.official_crs import normalize_work_periods
    period = equivalence_period()
    result = normalize_work_periods([period, copy.deepcopy(period)], as_of=date(2026, 11, 2))
    # Two concurrent 20h/week jobs are capped at30, not40: 78*30=2340, not3120.
    assert result['work']['canadian'] == {'credited_hours': 2340, 'completed_years': 1}


@pytest.mark.parametrize('changes', [
    {'paid': False}, {'authorized': False}, {'full_time_student': True},
    {'self_employed': True}, {'duties_match': False}, {'noc_code': '65201'},
])
def test_equivalence_unqualified_hours_remain_excluded(changes):
    from app.services.official_crs import normalize_work_periods
    result = normalize_work_periods([equivalence_period() | changes], as_of=date(2026, 11, 2))
    assert result['work']['canadian'] == {'credited_hours': 0, 'completed_years': 0}


@pytest.mark.parametrize('country', ['CA', 'FR'])
def test_equivalence_mixed_full_time_and_part_time(country):
    from app.services.official_crs import normalize_work_periods
    start = date(2022, 1, 1)
    split = start + timedelta(weeks=26)
    periods = [work_period(country=country, start_date=start.isoformat(), end_date=split.isoformat()),
               work_period(country=country, start_date=split.isoformat(),
                           end_date=(split + timedelta(weeks=52)).isoformat(), weekly_hours=15.0)]
    result = normalize_work_periods(periods, as_of=date(2026, 11, 2))
    key = 'canadian' if country == 'CA' else 'foreign'
    # Nonoverlapping 26*30 +52*15 =1560, with >12 calendar months elapsed.
    assert result['blockers'] == []
    assert result['work'][key] == {'credited_hours': 1560, 'completed_years': 1}


@pytest.mark.parametrize('changes,missing', [
    ({'canadian_work_qualified': None}, 'canadian_work_qualification'),
    ({'work_periods': [equivalence_period() | {'paid': None}]}, 'work_qualification_incomplete'),
])
def test_equivalence_hours_do_not_replace_missing_evidence(changes, missing):
    result = evaluate_candidate(BASE | {'canadian_work_years': None, 'foreign_work_years': 0,
        'canadian_work_qualified': True, 'work_periods': [equivalence_period()]} | changes, as_of=date(2026, 11, 2))
    assert result['score'] is None and missing in result['missing_inputs']


@pytest.mark.parametrize('periods,years', [
    ([work_period()], 1),
    ([work_period(), work_period()], 1),
    ([work_period(weekly_hours=15.0), work_period(weekly_hours=15.0)], 1),
    ([work_period(weekly_hours=15.0)], 0),
    ([work_period(end_date='2025-12-31')], 0),
    ([work_period(start_date='2024-01-01', end_date='2024-12-31')], 0),
    ([work_period(start_date='2024-01-01', end_date='2025-01-01')], 1),
    ([work_period(paid=False)], 0),
    ([work_period(authorized=False)], 0),
    ([work_period(full_time_student=True)], 0),
    ([work_period(self_employed=True)], 0),
    ([work_period(noc_code='65201')], 0),
    ([work_period(start_date='2010-01-01', end_date='2011-01-01')], 0),
])
def test_work_period_literal_boundaries(periods, years):
    from app.services.official_crs import normalize_work_periods
    result = normalize_work_periods(periods, as_of=date(2026, 11, 2))
    assert result['work']['canadian']['completed_years'] == years
    assert result['work']['foreign']['completed_years'] == 0
    assert result['hours_per_week_cap'] == 30
    assert result['blockers'] == []


@pytest.mark.parametrize('changes,blocker', [
    ({'paid': None}, 'work_qualification_incomplete'),
    ({'duties_match': None}, 'work_qualification_incomplete'),
    ({'authorized': None}, 'work_qualification_incomplete'),
    ({'exception_claimed': True}, 'work_exception_requires_review'),
    ({'noc_code': '99999'}, 'unknown_work_noc'),
    ({'country': 'ZZ'}, 'unsupported_work_country'),
    ({'end_date': '2027-01-01'}, 'work_period_after_evaluation_date'),
])
def test_unsupported_work_period_withholds_offline_score(changes, blocker):
    result = evaluate_candidate(BASE | {'canadian_work_years': None, 'foreign_work_years': 0,
        'canadian_work_qualified': True, 'work_periods': [work_period(**changes)]}, as_of=date(2026,11,2))
    assert result['score'] is None and blocker in result['missing_inputs']


def test_work_evidence_is_detached_and_cannot_overwrite_declared_years():
    facts = copy.deepcopy(BASE | {'canadian_work_years': 5, 'foreign_work_years': 0,
        'canadian_work_qualified': True, 'work_periods': [work_period()]})
    original = copy.deepcopy(facts)
    result = evaluate_candidate(facts, as_of=date(2026,11,2))
    assert result['score'] is None and 'canadian_work_years_period_conflict' in result['missing_inputs']
    assert facts == original
    result = evaluate_candidate(facts | {'canadian_work_years': None}, as_of=date(2026,11,2))
    # Independent arithmetic: 110 age +135 education +124 language +40 work
    # +50 education transferability =459; no foreign/offer/additional points.
    assert result['score'] == 459
    assert result['section_totals'] == {'core':409, 'spouse':0, 'transferability':50, 'additional':0}


@pytest.mark.parametrize('vector', json.loads((Path(__file__).parents[1]/"app/rules/fixtures/crs_vectors.json").read_text(encoding='utf-8'))['acceleration_validation']['vectors'], ids=lambda v:v['id'])
def test_acceleration_hand_derived_period_vectors(vector):
    base=next(v['facts'] for v in VECTORS if v['id']==vector['base_vector'])
    result=evaluate_candidate(base | vector['patch'],as_of=date(2026,11,2))
    assert result['score']==vector['expected_score']
    assert result['section_totals']==vector['expected_sections']
    assert sum(v['points'] for v in result['breakdown'])==vector['expected_score']
    assert result['production_activation'] is False


def test_simultaneous_cross_country_periods_are_not_favourably_guessed():
    from app.services.official_crs import normalize_work_periods
    result = normalize_work_periods([work_period(), work_period(country='FR')], as_of=date(2026,11,2))
    assert result['blockers'] == ['simultaneous_cross_country_work_requires_review']


@pytest.mark.parametrize('field', ['canadian_work_years','foreign_work_years'])
def test_declared_work_cannot_exceed_ten_year_crs_window(field):
    result=evaluate_candidate(BASE | {field:11},as_of=date(2026,11,2))
    assert result['score'] is None
    assert field.replace('_years','')+'_exceeds_supported_window' in result['missing_inputs']


@pytest.mark.parametrize('changes', [
    {'weekly_hours': True}, {'weekly_hours': float('nan')}, {'weekly_hours': 0},
    {'start_date':'2025-02-30'}, {'end_date':'2024-12-31'},
    {'noc_code':'２１２３１'}, {'country':'Canada'}, {'salary':200000},
])
def test_work_period_types_are_strict(changes):
    from app.services.official_crs import WorkPeriod
    with pytest.raises(ValidationError):
        WorkPeriod.model_validate(work_period(**changes))


def test_public_review_uses_owned_selected_language_not_client_benchmarks(sprint_api):
    from app.models.language_assessment_model import LanguageAssessment, LanguageSelection
    from app.services.language_assessment_service import VERSION, today
    client, sessions = sprint_api
    with sessions() as db:
        record = LanguageAssessment(user_id=1, language='en', exam='celpip_general',
            edition='celpip_general', test_date=today(), raw_scores=dict.fromkeys(['listening','reading','writing','speaking'],7), mapping_version=VERSION)
        db.add(record); db.flush()
        db.add(LanguageSelection(user_id=1, language='en', assessment_id=record.id)); db.commit()
        selected_id=record.id
    facts=BASE | {'english':dict.fromkeys(['listening','reading','writing','speaking'],12)}
    result=client.post('/assessments/crs',headers={'x-test-user':'1'},json={'baseline':{'ranking_facts':facts},'as_of':'2026-11-02'}).json()['baseline']
    assert result['score'] is None and all(x['points'] is None for x in result['breakdown'])
    assert result['selected_language_evidence']['en']['id'] == selected_id
    assert result['numerical_activation'] is False
    foreign=client.post('/assessments/crs',headers={'x-test-user':'2'},json={'baseline':{'ranking_facts':facts}}).json()['baseline']
    assert foreign['selected_language_evidence'] == {}
    assert 'first_language_four_skills' in foreign['missing_inputs']


def test_scenario_implementation_is_inert_and_free_facts_stay_available(sprint_api):
    from app.routes.commercial_workspace_routes import router
    client, _ = sprint_api
    client.app.include_router(router)
    for user in ('1','2'):
        headers={'x-test-user':user}
        case_id=client.get('/application-cases/context',headers=headers).json()['case_id']
        url=f'/preparation/cases/{case_id}'
        assert client.get(url+'/crs-scenarios',headers=headers).status_code == 403
        assert client.put(url+'/crs-scenarios',headers=headers,json={'revision':0,'items':[]}).status_code == 403
        assert client.put(url+'/crs-inputs',headers=headers,json={'revision':0,'facts':{'age':29}}).status_code == 200


@pytest.mark.parametrize('patch_mode', [False, True])
def test_owned_scenario_service_preserves_forms_and_fact_revisions(sprint_api, patch_mode):
    from fastapi import HTTPException
    from app.models.user_models import User
    from app.models.self_application_model import SelfApplication
    from app.routes.commercial_workspace_routes import router, SavedScenarios, save_scenario_preparation
    client, sessions = sprint_api
    client.app.include_router(router)
    headers={'x-test-user':'1'}
    case_id=client.get('/application-cases/context',headers=headers).json()['case_id']
    assert client.put(f'/preparation/cases/{case_id}/crs-inputs',headers=headers,json={'revision':0,'facts':{'age':29}}).status_code == 200
    body=SavedScenarios(revision=0,items=[{'identifier':'scenario-a','title':'Synthetic preparation','facts':{'age':30}}])
    with sessions() as db:
        result=save_scenario_preparation(db,db.get(User,1),case_id,body)
        assert result['revision']==1 and result['items'][0]['score'] is None
        expected=copy.deepcopy(db.query(SelfApplication).filter_by(application_case_id=case_id,user_id=1).one().intake_payload['crs_preparation']['scenario_preparation'])
        with pytest.raises(HTTPException) as exc:
            save_scenario_preparation(db,db.get(User,1),case_id,body)
        assert exc.value.status_code==409
        db.rollback()
        with pytest.raises(HTTPException) as exc:
            save_scenario_preparation(db,db.get(User,2),case_id,body)
        assert exc.value.status_code==404
    assert client.post('/self/workspace',headers=headers,json={'case_id':case_id,'matter_type':'permanent_residence','preserve_omitted_intake':patch_mode,'intake':{'occupation':'Synthetic','crs_preparation':{'scenario_preparation':{'revision':999}}}}).status_code==200
    assert client.put(f'/preparation/cases/{case_id}/crs-inputs',headers=headers,json={'revision':1,'facts':{'age':31}}).status_code == 200
    with sessions() as db:
        row=db.query(SelfApplication).filter_by(application_case_id=case_id,user_id=1).one()
        assert row.intake_payload['crs_preparation']['scenario_preparation']==expected
        assert row.intake_payload['crs_preparation']['facts']['age']==31
        assert row.intake_payload['occupation']=='Synthetic'


def test_admin_validation_report_is_not_activation(sprint_api):
    from app.routes.rule_review_routes import router
    from app.models.user_models import User
    from app.models.rule_monitor_model import RuleSourceChange
    from app.rules.source_monitor import run_due
    from backend.tests.test_sprint2_rule_monitor import PAGE
    from datetime import datetime, timezone
    client, sessions=sprint_api
    client.app.include_router(router)
    with sessions() as db:
        db.get(User,2).role='admin'; db.commit()
        run_due(db,now=datetime(2026,10,26,tzinfo=timezone.utc),fetch=lambda _:PAGE,limit=1)
        change_id=db.query(RuleSourceChange).first().id
    assert client.get('/admin/rules-review/validation-report').status_code==401
    assert client.get('/admin/rules-review/validation-report',headers={'x-test-user':'1'}).status_code==403
    admin={'x-test-user':'2'}
    report=client.get('/admin/rules-review/validation-report',headers=admin).json()
    assert report['activation']=='DISABLED'
    result=client.post(f'/admin/rules-review/{change_id}/decisions',headers=admin,json={'decision':'VALIDATED_INACTIVE','note':'Synthetic fixture baseline checked; proposal remains inactive'})
    assert result.status_code==201 and result.json()['activation']=='DISABLED'
    assert client.post(f'/admin/rules-review/{change_id}/decisions',headers=admin,json={'decision':'ACTIVE','note':'Activate'}).status_code==422


def test_local_checkout_and_signed_test_webhook(env, monkeypatch):
    import time, hmac, hashlib
    from types import SimpleNamespace
    from unittest.mock import Mock
    from app.routes import billing_routes as billing
    monkeypatch.setenv('TEST_CHECKOUT_ENABLED','true')
    # Disclosure authorization is covered by its integration suite; this fixture isolates Stripe transport.
    monkeypatch.setattr(billing,'require_global_disclosures_accepted',lambda *args:None)
    monkeypatch.setattr(billing.stripe.Customer,'modify',Mock(return_value={'id':'cus_1'}))
    create=Mock(return_value=SimpleNamespace(id='cs_1',url='https://checkout.stripe.com/synthetic-test-only',livemode=False))
    monkeypatch.setattr(billing.stripe.checkout.Session,'create',create)
    response=env.client.post('/billing/create-checkout-session',headers=headers(),json={'plan':'pro'})
    assert response.status_code==200
    assert create.call_args.kwargs['mode']=='subscription'
    assert create.call_args.kwargs['client_reference_id']=='1'
    env.session['livemode']=False
    assert sync(env).status_code==200
    for live, expected in [(True,400),(False,200)]:
        body=json.dumps({'id':'evt_synthetic_test','livemode':live,'type':'invoice.paid','data':{'object':{'id':'in_1','customer':'cus_1','subscription':'sub_1','status':'paid'}}})
        timestamp=int(time.time())
        signature=hmac.new(b'whsec_test_local_only',f'{timestamp}.{body}'.encode(),hashlib.sha256).hexdigest()
        result=env.client.post('/billing/webhook',content=body,headers={'stripe-signature':f't={timestamp},v1={signature}'})
        assert result.status_code==expected


@pytest.mark.parametrize('benchmark,first,second',[(3,0,0),(4,6,0),(5,6,4),(6,9,4),(7,17,12),(8,23,12),(9,31,24),(10,34,24),(12,34,24)])
def test_independent_language_factor_rows(benchmark,first,second):
    skills=dict.fromkeys(['listening','reading','writing','speaking'],benchmark)
    result=evaluate_candidate(BASE|{'english':skills,'french':skills,'no_second_language_test':False},as_of=date(2026,11,2))
    points={x['factor']:x['points'] for x in result['breakdown']}
    assert points['first_language']==first*4 and points['second_language']==second

@pytest.mark.parametrize('english,french,expected',[(4,7,25),(5,7,50),(9,6,0),(9,7,50)])
def test_independent_french_additional_thresholds(english,french,expected):
    skills=lambda level:dict.fromkeys(['listening','reading','writing','speaking'],level)
    result=evaluate_candidate(BASE|{'english':skills(english),'french':skills(french),'no_second_language_test':False},as_of=date(2026,11,2))
    assert next(x['points'] for x in result['breakdown'] if x['factor']=='french')==expected


def test_incomplete_save_creates_workspace_only_on_explicit_write(sprint_api):
    from app.routes.commercial_workspace_routes import router
    from app.models.self_application_model import SelfApplication
    client,sessions=sprint_api
    client.app.include_router(router)
    headers={'x-test-user':'2'}
    context=client.get('/application-cases/context',headers=headers).json()
    url=f"/preparation/cases/{context['case_id']}/crs-inputs"
    with sessions() as db:
        before=db.query(SelfApplication).filter_by(user_id=2).count()
    assert client.get(url,headers=headers).status_code==200
    with sessions() as db:
        assert db.query(SelfApplication).filter_by(user_id=2).count()==before
    response=client.put(url,headers=headers,json={'revision':0,'facts':{}})
    assert response.status_code==200 and response.json()['score'] is None
    assert response.json()['revision']==1


def test_partial_language_can_save_but_never_score(sprint_api):
    facts=RankingFacts.model_validate(BASE|{'english':{'listening':9}})
    result=evaluate_candidate(facts,as_of=date(2026,11,2))
    assert result['score'] is None and 'first_language_four_skills' in result['missing_inputs']


def test_zero_is_not_a_language_benchmark():
    with pytest.raises(ValidationError):
        RankingFacts.model_validate(BASE|{'english':{'listening':0}})


@pytest.mark.parametrize('patch_mode',[False,True])
def test_forms_cannot_replace_revisioned_crs_preparation(sprint_api,patch_mode):
    from app.routes.commercial_workspace_routes import router
    client,_=sprint_api
    client.app.include_router(router)
    headers={'x-test-user':'2'}
    case_id=client.get('/application-cases/context',headers=headers).json()['case_id']
    url=f'/preparation/cases/{case_id}/crs-inputs'
    assert client.put(url,headers=headers,json={'revision':0,'facts':{'age':31}}).status_code==200
    response=client.post('/self/workspace',headers=headers,json={'case_id':case_id,'matter_type':'permanent_residence','preserve_omitted_intake':patch_mode,'intake':{'occupation':'Synthetic editor','crs_preparation':{'revision':999,'facts':{'age':99}}}})
    assert response.status_code==200
    saved=client.get(url,headers=headers).json()
    assert saved['revision']==1 and saved['facts']['age']==31


def test_test_runtime_discards_inherited_analytics_secrets():
    import os, subprocess, sys
    environment=dict(os.environ, PRODUCT_ANALYTICS_KEY='synthetic-inherited-key-not-for-use',PRODUCT_ANALYTICS_ENABLED='true')
    script="from backend.testing.isolation import configure_environment; import os; configure_environment(); assert 'PRODUCT_ANALYTICS_KEY' not in os.environ; assert 'PRODUCT_ANALYTICS_ENABLED' not in os.environ"
    subprocess.run([sys.executable,'-c',script],env=environment,check=True,capture_output=True,timeout=30)


INDEPENDENT = json.loads((Path(__file__).parents[1]/"app/rules/fixtures/crs_vectors.json").read_text())["independent_validation"]["vectors"]
@pytest.mark.parametrize('vector', INDEPENDENT, ids=lambda v:v['id'])
def test_independent_published_scoring_rows(vector):
    result=evaluate_candidate(vector['facts'],as_of=date(2026,11,2))
    assert result['score']==vector['expected_score']
    assert {row['factor']:row['points'] for row in result['breakdown']}==vector['expected_breakdown']
    assert result['program_eligibility']==result['invitation_eligibility']=='not_assessed'
    assert result['production_activation'] is False

def test_independent_historical_dates_and_thresholds():
    from datetime import datetime
    for day in [date(2025,3,24),datetime(2026,11,2)]:
        with pytest.raises(ValueError): evaluate_candidate(BASE,as_of=day)
    for value in [8.5,'9',True]:
        with pytest.raises(ValidationError): RankingFacts.model_validate(BASE|{'english':{'listening':value}})


def test_analytics_retention_and_event_privacy():
    actor='a'*64
    rows=[{'event':'document_created','actor':actor,'plan':'free','day':day} for day in ['2026-09-27','2026-09-28','2026-10-27','2026-10-28']]
    summary=cohort_summary(rows,as_of=date(2026,10,27))
    assert summary['events']['document_created']==2
    assert summary['returning_accounts']==1
    for days in [0,31,True]:
        with pytest.raises(ValueError):cohort_summary(rows,retention_days=days)
    for forbidden in ['email','answers','object_key','prompt','ip','user_id']:
        with pytest.raises(ValueError):cohort_summary([rows[1]|{forbidden:'synthetic'}])


def test_saved_document_analytics_is_content_free(sprint_api,monkeypatch,caplog):
    from app.routes.generated_document_routes import router
    client,_=sprint_api
    client.app.include_router(router)
    monkeypatch.setenv('PRODUCT_ANALYTICS_ENABLED','true')
    monkeypatch.setenv('PRODUCT_ANALYTICS_KEY','synthetic-analytics-key-32-characters-only')
    with caplog.at_level(logging.INFO,logger='northbridge.product'):
        result=client.post('/documents/',headers={'x-test-user':'1'},json={'document_type':'letter','title':'Private synthetic title','language':'en','content':'Private synthetic immigration answers'})
    assert result.status_code==200
    rows=[json.loads(r.message) for r in caplog.records if r.name=='northbridge.product']
    assert len(rows)==1 and rows[0]['event']=='document_created'
    assert 'Private synthetic' not in json.dumps(rows)
    assert set(rows[0])=={'event','day','actor','plan','deduplication_id'}


LANGUAGE_REFERENCE = json.loads((Path(__file__).parents[1]/"app/rules/fixtures/crs_vectors.json").read_text())["independent_validation"]["language_vectors"]
@pytest.mark.parametrize('vector',LANGUAGE_REFERENCE,ids=lambda v:v['id'])
def test_fresh_official_language_reference(vector):
    from decimal import Decimal
    from app.services.language_assessment_service import convert
    scores=vector['raw_scores']
    mapped=convert(vector['exam'],vector['edition'],scores)
    assert all(row['benchmark']==vector['expected_benchmark'] for row in mapped.values())
    assert all(row['at_least']==(vector['expected_benchmark']==10) for row in mapped.values())
    for skill in ['listening','reading','writing','speaking']:
        changed={**scores,skill:str(Decimal(str(scores[skill]))-Decimal(str(vector['immediately_below_step'])))}
        assert convert(vector['exam'],vector['edition'],changed)[skill]['benchmark']==vector['expected_immediately_below']


@pytest.mark.parametrize('currency', ['cad', 'CAD'])
def test_real_provider_shape_invoice_refund_audit_matches(refunds, monkeypatch, currency):
    from app.routes import billing_routes as billing
    from app.models.billing_review_model import BillingReviewEvent
    from app.models.billing_transaction_model import BillingTransaction
    from app.models.user_models import User
    invoice = {'id':'in_current_api','customer':'cus_1','status':'paid','amount_paid':3900,
        'currency':currency,'created':1793100000,'parent':{'subscription_details':{'subscription':'sub_1'}},
        'payments':{'has_more':False,'data':[{'invoice':'in_current_api','status':'paid',
            'amount_paid':3900,'currency':'cad','payment':{'type':'payment_intent','payment_intent':'pi_synthetic'}}]}}
    with refunds.db() as db:
        db.query(BillingTransaction).delete();db.commit()
        transaction=billing._record_invoice_transaction(db,user=db.get(User,1),invoice=invoice)
        assert transaction.currency=='CAD'
        assert transaction.stripe_subscription_id=='sub_1'
        assert transaction.stripe_payment_intent_id=='pi_synthetic'
    assert webhook(refunds,'charge.refunded',{'id':'ch_synthetic'}).status_code==200
    with refunds.db() as db:
        row=db.query(BillingReviewEvent).one()
        assert row.transaction_id is not None and row.status=='pending_human_review'


@pytest.mark.parametrize('change', [
    {'has_more':True}, {'data':[]},
    {'data':[{'invoice':'in_wrong','status':'paid','amount_paid':3900,'currency':'cad','payment':{'type':'payment_intent','payment_intent':'pi_other'}}]},
    {'data':[{'invoice':'in_1','status':'open','amount_paid':3900,'currency':'cad','payment':{'type':'payment_intent','payment_intent':'pi_other'}}]},
    {'data':[{'invoice':'in_1','status':'paid','amount_paid':1,'currency':'cad','payment':{'type':'payment_intent','payment_intent':'pi_other'}}]},
])
def test_ambiguous_invoice_payments_never_invent_audit_identity(change):
    from app.routes import billing_routes as billing
    invoice={'id':'in_1','customer':'cus_1','amount_paid':3900,'currency':'cad','payments':{'has_more':False,'data':[]}|change}
    assert billing._invoice_payment_intent(invoice) is None


def test_current_invoice_payment_expansion_checks_identity(monkeypatch):
    from app.routes import billing_routes as billing
    invoice={'id':'in_1','customer':'cus_1','amount_paid':3900,'currency':'cad'}
    payment={'has_more':False,'data':[{'invoice':'in_1','status':'paid','amount_paid':3900,'currency':'cad','payment':{'type':'payment_intent','payment_intent':'pi_current'}}]}
    monkeypatch.setattr(billing.stripe.Invoice,'retrieve',lambda *a,**kw:invoice|{'payments':payment})
    assert billing._invoice_payment_intent(invoice)=='pi_current'
    monkeypatch.setattr(billing.stripe.Invoice,'retrieve',lambda *a,**kw:invoice|{'customer':'cus_other','payments':payment})
    assert billing._invoice_payment_intent(invoice) is None



def test_analytics_intake_real_session_isolation_and_no_export(env, monkeypatch, caplog):
    from app.routes.product_analytics_routes import router
    env.client.app.include_router(router)
    monkeypatch.setenv('PRODUCT_ANALYTICS_ENABLED','true')
    monkeypatch.setenv('PRODUCT_ANALYTICS_KEY','synthetic-analytics-key-32-characters-only')
    body={'event':'upgrade_interest','surface':'pricing'}
    assert env.client.post('/product/activity',json=body).status_code==401
    with caplog.at_level(logging.INFO,logger='northbridge.product'):
        for user_id in (1,2):
            response=env.client.post('/product/activity',headers=headers(user_id),json=body)
            assert response.status_code==200 and response.json()=={'accepted':True}
        for forbidden in ('user_id','actor','answers','profile','payment_credentials','token'):
            assert env.client.post('/product/activity',headers=headers(),json=body|{forbidden:'private-synthetic-value'}).status_code==422
    rows=[json.loads(r.message) for r in caplog.records if r.name=='northbridge.product']
    assert len(rows)==2 and rows[0]['actor']!=rows[1]['actor']
    assert all(set(r)=={'event','day','actor','plan'} for r in rows)
    assert 'private-synthetic-value' not in json.dumps(rows)
    for path in ('/product/analytics','/product/cohorts','/product/users/2','/product/events'):
        assert env.client.get(path,headers=headers()).status_code==404
    assert env.client.get('/product/activity',headers=headers()).status_code==405


def test_disabled_analytics_retains_no_new_event(env, monkeypatch, caplog):
    from app.routes.product_analytics_routes import router
    env.client.app.include_router(router)
    monkeypatch.delenv('PRODUCT_ANALYTICS_ENABLED',raising=False)
    monkeypatch.setenv('PRODUCT_ANALYTICS_KEY','synthetic-analytics-key-32-characters-only')
    with caplog.at_level(logging.INFO,logger='northbridge.product'):
        response=env.client.post('/product/activity',headers=headers(),json={'event':'workspace_return','surface':'dashboard'})
    assert response.status_code==200 and response.json()=={'accepted':False}
    assert not [r for r in caplog.records if r.name=='northbridge.product']


def test_analytics_reporting_window_is_not_physical_log_deletion():
    rows=[{'event':'workspace_return','actor':'a'*64,'plan':'free','day':'2026-09-27'}]
    before=copy.deepcopy(rows)
    assert cohort_summary(rows,as_of=date(2026,10,27))['events']=={}
    assert rows==before  # Never represent report exclusion as sink deletion.



def test_premium_sale_is_deferred_without_revoking_existing_entitlements(env,monkeypatch):
    from app.routes import billing_routes as billing
    from unittest.mock import Mock
    monkeypatch.setenv('TEST_CHECKOUT_ENABLED','true')
    create=Mock()
    monkeypatch.setattr(billing.stripe.checkout.Session,'create',create)
    response=env.client.post('/billing/create-checkout-session',headers=headers(),json={'plan':'premium'})
    assert response.status_code==403 and response.json()['detail']['code']=='premium_offer_unavailable'
    create.assert_not_called()
    offers={r['plan']:r for r in env.client.get('/billing/plans').json()['offers']}
    assert offers['individual_pro']['available_for_purchase'] is True
    assert offers['individual_pro']['period_days']==30 and offers['individual_pro']['amount_cad_cents']==3900
    assert offers['individual_premium']['available_for_purchase'] is False
    env.session['metadata']['plan']='individual_premium'
    env.subscription['metadata']['plan']='individual_premium'
    env.subscription['items']['data'][0]['price']['id']='price_premium'
    env.session['amount_total']=9900
    assert sync(env).status_code==409  # Missing test-mode identity must still fail closed.
    env.session['livemode']=False
    assert sync(env).status_code==200
    assert env.client.get('/test/pro',headers=headers()).status_code==200


@pytest.mark.parametrize('provider_status,expected',[('active',409),('past_due',409),('canceled',200),('incomplete_expired',200),('provider_unavailable',503),('foreign_customer',409)])
def test_new_checkout_does_not_charge_an_existing_nonterminal_subscription(env,monkeypatch,provider_status,expected):
    from app.routes import billing_routes as billing
    from app.models.user_models import User
    from types import SimpleNamespace
    from unittest.mock import Mock
    monkeypatch.setenv('TEST_CHECKOUT_ENABLED','true')
    monkeypatch.setattr(billing,'require_global_disclosures_accepted',lambda *args:None)
    monkeypatch.setattr(billing.stripe.Customer,'modify',Mock(return_value={'id':'cus_1'}))
    create=Mock(return_value=SimpleNamespace(id='cs_synthetic_existing',url='https://checkout.stripe.com/synthetic-only',livemode=False))
    monkeypatch.setattr(billing.stripe.checkout.Session,'create',create)
    with env.db() as db:
        db.get(User,1).stripe_subscription_id='sub_1';db.commit()
    if provider_status=='provider_unavailable':
        monkeypatch.setattr(billing.stripe.Subscription,'retrieve',Mock(side_effect=ConnectionError('synthetic-provider-detail-not-for-client')))
    elif provider_status=='foreign_customer':
        env.subscription['customer']='cus_2'
    else:
        env.subscription['status']=provider_status
    response=env.client.post('/billing/create-checkout-session',headers=headers(),json={'plan':'pro'})
    assert response.status_code==expected
    assert create.call_count==(1 if expected==200 else 0)
    assert 'synthetic-provider-detail-not-for-client' not in response.text
    with env.db() as db:
        assert db.get(User,1).plan=='free'
        assert db.get(User,1).stripe_subscription_id=='sub_1'


@pytest.mark.parametrize('language',['en','fr'])
def test_document_review_preview_copy_preserves_response_contract(language):
    from app.routes.document_review_routes import _build_preview
    original={'summary':'Synthetic preparation review','concerns':['one','two','three'],
        'missing_support':['one','two','three'],'improvement_actions':['one','two','three'],
        'strengths':['preserved'],'language':language,'ai_status':'unavailable'}
    before=copy.deepcopy(original)
    result=_build_preview(original,language)
    assert original==before
    assert set(result)==set(original)|{'is_premium','locked','upgrade_reason'}
    assert result['locked'] is True and result['is_premium'] is False
    assert result['concerns']==result['missing_support']==result['improvement_actions']==['one','two']
    assert result['strengths']==original['strengths'] and result['ai_status']=='unavailable'
    assert 'Pro' in result['upgrade_reason'] and 'Premium' not in result['upgrade_reason']
    assert ('admissibilité' if language=='fr' else 'eligibility') in result['upgrade_reason']
