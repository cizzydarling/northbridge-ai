"""Isolated public snapshot contracts; never import production data or credentials."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import json
import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import backend.launch_smoke_test  # noqa: F401 -- isolated model registration
from app.data.db import Base
from app.services import official_resources as resources
from app.services import official_resource_snapshots as snapshots
from app.services import official_resource_snapshot_cli as cli
from app.models.official_resource_snapshot_model import OfficialResourceSnapshot as Snapshot, OfficialResourceHead as Head
from backend.testing.official_resource_fixtures import synthetic_source, DLI_HTML


@pytest.fixture
def store():
    engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def foreign_keys(conn, _record):
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    yield sessions
    engine.dispose()


def bundle(key='dli', at=None, fetch=synthetic_source):
    return snapshots.build_bundle(key, {k:fetch(k) for k in snapshots.component_keys(key)}, observed_at=at)


def promote(sessions, data, expected=None, **kw):
    with sessions() as db:
        return snapshots.promote(db, data, expected_head=expected, **kw)


def test_cold_start_persists_across_sessions_without_network(store, monkeypatch):
    data=bundle();identity=promote(store,data)
    monkeypatch.setattr(resources,'_read_source',lambda *_:pytest.fail('request must not fetch'))
    for _ in range(2):
        got=snapshots.read_snapshot('dli',session_factory=store)
        assert got['status']=='available' and len(got['records'])==2
        assert got['snapshot_id']==identity and got['source_updated_at'] is None
        assert all(r['pgwp_eligibility']=='not_assessed' for r in got['records'])


def test_missing_store_snapshot_is_truthfully_unavailable(store):
    result=snapshots.read_snapshot('dli',session_factory=store)
    assert result['records']==[] and result['status']=='unavailable'


def test_freshness_boundaries_and_outage_preserve_previous_good(store):
    at=snapshots.utcnow()-timedelta(hours=2);data=bundle(at=at);identity=promote(store,data)
    assert snapshots.read_snapshot('dli',session_factory=store)['status']=='stale'
    assert snapshots.read_snapshot('dli',session_factory=store,observed_at=at+timedelta(days=1))['records']==[]
    assert snapshots.read_snapshot('dli',session_factory=store,observed_at=at-timedelta(seconds=1))['status']=='unavailable'
    assert snapshots.read_snapshot('dli',session_factory=store,observed_at=at+timedelta(seconds=3599))['status']=='available'
    assert snapshots.read_snapshot('dli',session_factory=store,observed_at=at+timedelta(seconds=3600))['status']=='stale'
    with pytest.raises(snapshots.SnapshotRejected):promote(store,{'manifest':{},'payloads':{}},expected=identity)
    assert snapshots.read_snapshot('dli',session_factory=store)['snapshot_id']==identity


@pytest.mark.parametrize('mutation',[
    lambda b:b.update(extra='private'),
    lambda b:b['manifest'].update(source_id='arbitrary'),
    lambda b:b['manifest'].update(official_url='https://127.0.0.1/private'),
    lambda b:b['manifest'].update(schema_version=True),
    lambda b:b['manifest'].update(schema_version=999),
    lambda b:b['manifest'].update(record_count=0),
    lambda b:b['manifest'].update(records_sha256='0'*64),
    lambda b:b['manifest'].update(published_at={'dli':'2026-01-01'}),
    lambda b:b['manifest'].update(source_language='fr'),
    lambda b:b['manifest'].update(retrieved_at='2026-01-01'),
    lambda b:b['manifest'].update(fresh_until=b['manifest']['unavailable_after']),
    lambda b:b['manifest']['components']['dli'].update(content_sha256='0'*64),
    lambda b:b['manifest']['components']['dli'].update(content_type='text/plain'),
    lambda b:b['manifest']['components']['dli'].update(official_url='https://example.invalid'),
    lambda b:b['payloads'].update(extra='private data'),
    lambda b:b['payloads'].update(dli=''),
])
def test_strict_manifest_mutation_rejection(mutation):
    data=bundle();mutation(data)
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(data)


@pytest.mark.parametrize('raw',['','<p>Access Denied</p>','<p>not a DLI table</p>',DLI_HTML+DLI_HTML])
def test_malformed_empty_duplicate_source_rejected(raw):
    with pytest.raises(ValueError):bundle(fetch=lambda _key:raw)


def test_future_expired_or_naive_acquisition_rejected():
    for at in (snapshots.utcnow()+timedelta(minutes=1),snapshots.utcnow()-timedelta(days=2)):
        with pytest.raises(snapshots.SnapshotRejected):
            data=bundle(at=at);snapshots.validate_bundle(data)
    data=bundle();data['manifest']['retrieved_at']='2026-10-29T00:00:00'
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(data)


@pytest.mark.parametrize('language',['en','fr'])
def test_processing_locale_category_country_and_unknown_values(language):
    data=bundle('processing_'+language);manifest,rows=snapshots.validate_bundle(data)
    assert len(manifest['components'])==3 and manifest['source_language']==language
    assert next(r for r in rows if r['application_type']=='visitor_visa_outside_canada' and r['country_code']=='FR')['processing_time']=='37 days'
    assert next(r for r in rows if r['application_type']=='express_entry_cec')['processing_time'] is None
    assert manifest['published_at']['json_non_country_'+language]=='October 21, 2026'


def test_processing_bundle_requires_all_components_and_no_duplicate_keys():
    data=bundle('processing_en');data['payloads'].pop('json_names_en')
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(data)
    with pytest.raises(snapshots.SnapshotRejected):snapshots.loads('{"a":1,"a":2}')
    with pytest.raises(snapshots.SnapshotRejected):snapshots.loads('{"a":NaN}')


def test_sensitive_source_rejected_without_exposure(caplog):
    secret='sk_test_'+'synthetic_not_a_real_key'
    with pytest.raises(snapshots.SnapshotRejected):bundle(fetch=lambda _k:DLI_HTML+'<!-- '+secret+' -->')
    assert secret not in caplog.text


def test_atomic_failure_rolls_back_pointer_and_candidate(store):
    at=snapshots.utcnow()-timedelta(minutes=2);old=promote(store,bundle(at=at))
    with store() as db:
        def fail(_session):raise RuntimeError('synthetic failure after flush')
        event.listen(db,'before_commit',fail)
        with pytest.raises(RuntimeError):snapshots.promote(db,bundle(),expected_head=old)
    with store() as db:
        assert db.get(Head,'dli').snapshot_id==old
        assert len(db.scalars(select(Snapshot)).all())==1


def test_cas_replay_and_retention(store):
    at=snapshots.utcnow()-timedelta(minutes=5);old=None
    for i in range(3):old=promote(store,bundle(at=at+timedelta(minutes=i)),expected=old)
    with store() as db:assert len(db.scalars(select(Snapshot)).all())==2
    with pytest.raises(snapshots.PromotionConflict):promote(store,bundle(),expected='0'*32)
    with pytest.raises(snapshots.PromotionConflict):promote(store,bundle(at=at),expected=old)
    assert snapshots.read_snapshot('dli',session_factory=store)['snapshot_id']==old


def test_large_record_drop_requires_review(store):
    old=promote(store,bundle(at=snapshots.utcnow()-timedelta(minutes=1)))
    raw=DLI_HTML.split('<tr><td>Quebec')[0]+'</table>'
    with pytest.raises(snapshots.SnapshotRejected,match='large_record_drop'):promote(store,bundle(fetch=lambda _:raw),expected=old)


def test_read_integrity_failure_returns_no_corrupt_records(store):
    identity=promote(store,bundle())
    with store.begin() as db:
        item=db.get(Snapshot,identity);item.records=[{'name':'not trusted'}]
    assert snapshots.read_snapshot('dli',session_factory=store)['records']==[]


def test_reads_do_not_write(store):
    promote(store,bundle());statements=[]
    engine=store.kw['bind']
    def track(_conn,_cursor,statement,*_):statements.append(statement)
    event.listen(engine,'before_cursor_execute',track)
    assert snapshots.read_snapshot('dli',session_factory=store)['status']=='available'
    assert all(not sql.lstrip().upper().startswith(('INSERT','UPDATE','DELETE')) for sql in statements)


def test_cli_requires_environment_and_isolated_routing(monkeypatch):
    from sqlalchemy.engine import make_url
    args=SimpleNamespace(production_host=None,production_database=None,ack_production_public_write=False)
    monkeypatch.delenv('APP_ENV',raising=False)
    with pytest.raises(snapshots.SnapshotRejected):cli.environment()
    monkeypatch.setenv('APP_ENV','test')
    assert cli.import_database('postgresql://localhost/nbai_fixture',args)==make_url('postgresql://localhost/nbai_fixture')
    for url in ('postgresql://example.invalid/northbridgeai','postgresql://localhost/nbai_fixture?host=example.invalid','sqlite:///file:other?uri=true'):
        with pytest.raises(snapshots.SnapshotRejected):cli.import_database(url,args)
    monkeypatch.setenv('APP_ENV','production')
    with pytest.raises(snapshots.SnapshotRejected):cli.import_database('postgresql://example.invalid/northbridgeai',args)


def test_cli_validates_bounded_private_artifact_without_database(tmp_path,monkeypatch,capsys):
    monkeypatch.setenv('APP_ENV','test');path=tmp_path/'source.json';data=bundle()
    cli.write_bundle(path,data)
    with pytest.raises(FileExistsError):cli.write_bundle(path,data)
    assert cli.main(['validate','--file',str(path)])==0
    output=capsys.readouterr().out
    assert 'PASS' in output and 'SYNTHETIC Maple' not in output
    path.write_bytes(b'x'*(snapshots.MAX_BUNDLE_BYTES+1))
    with pytest.raises(snapshots.SnapshotRejected):cli.load_bundle(path)


def test_collector_denied_robots_never_requests_source(monkeypatch):
    monkeypatch.setenv('APP_ENV','test');calls=[]
    def fetch(session,url,**kw):
        calls.append(url);return ('User-agent: *\nDisallow: /','text/plain')
    monkeypatch.setattr(cli,'_fetch',fetch)
    with pytest.raises(snapshots.SnapshotRejected):cli.collect('dli')
    assert len(calls)==1 and calls[0].endswith('/robots.txt')


def test_collector_outage_never_returns_partial_processing_bundle(monkeypatch):
    monkeypatch.setenv('APP_ENV','test')
    def fetch(session,url,**kw):
        if kw.get('robots'):return '', 'text/plain'
        raise TimeoutError('synthetic source outage')
    monkeypatch.setattr(cli,'_fetch',fetch)
    with pytest.raises(TimeoutError):cli.collect('processing_en')


def test_official_distinct_variants_preserve_supported_identity_and_disclose_counts():
    original='<tr><td>Ontario</td><td>SYNTHETIC Variant College</td><td>O999999999993</td><td>Ottawa</td><td>Public</td><td>Variant A</td><td>Unknown</td><td>Not assessed</td></tr>'
    other=original.replace('Variant A','Variant B')
    data=bundle(fetch=lambda _:'<table>'+original+other+'</table>')
    m,rows=snapshots.validate_bundle(data)
    assert len(rows)==1 and m['record_count']==1
    assert m['normalization']=={'source_record_count':2,'collapsed_source_variants':1}
    assert rows[0]['pgwp_eligibility']=='not_assessed'
    with pytest.raises(snapshots.SnapshotRejected):bundle(fetch=lambda _:'<table>'+original+original+'</table>')
    with pytest.raises(snapshots.SnapshotRejected):bundle(fetch=lambda _:'<table>'+original+other.replace('Ontario','Quebec')+'</table>')


def test_normalization_count_cannot_be_forged():
    data=bundle();data['manifest']['normalization']['source_record_count']=999
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(data)


def e2e_seed_function():
    """Load only the actual seeder definition, not the server's destructive setup."""
    import ast
    import os
    from pathlib import Path
    path=Path(__file__).resolve().parents[1]/'e2e_server.py'
    tree=ast.parse(path.read_text(encoding='utf-8'))
    node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='seed_resource_snapshots')
    namespace={'__file__':str(path),'os':os,'Path':Path,'datetime':datetime,'timezone':timezone}
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),namespace)
    return namespace['seed_resource_snapshots']


@pytest.mark.parametrize('url',[
    'postgresql://production.example.invalid/northbridgeai',
    'postgresql://127.0.0.1/northbridgeai',
    'postgresql://127.0.0.1/nbai_rehearsal_bad?host=production.example.invalid',
    'sqlite://', 'sqlite:///unknown.sqlite3',
])
def test_e2e_seed_rejects_unknown_or_production_identity_before_queries(url,monkeypatch):
    from sqlalchemy.engine import make_url
    monkeypatch.setenv('APP_ENV','test')
    monkeypatch.setenv('TEST_POSTGRES_ADMIN_URL','postgresql://127.0.0.1/postgres')
    with pytest.raises(RuntimeError,match='disposable'):
        e2e_seed_function()(SimpleNamespace(url=make_url(url)))


def test_e2e_seed_rejects_production_mode_before_queries(monkeypatch):
    from sqlalchemy.engine import make_url
    monkeypatch.setenv('APP_ENV','production')
    with pytest.raises(RuntimeError,match='disposable'):
        e2e_seed_function()(SimpleNamespace(url=make_url('postgresql://127.0.0.1/nbai_rehearsal_'+'a'*32)))


def test_utf8_bom_is_preserved_in_source_checksum():
    data=bundle('processing_fr',fetch=lambda key:'\ufeff'+synthetic_source(key))
    manifest,rows=snapshots.validate_bundle(data)
    key='json_non_country_fr'
    assert manifest['components'][key]['content_sha256']==snapshots.checksum('\ufeff'+synthetic_source(key))
    assert rows


def test_e2e_entry_point_orders_schema_seed_then_server():
    import ast
    from pathlib import Path
    tree=ast.parse((Path(__file__).resolve().parents[1]/'e2e_server.py').read_text(encoding='utf-8'))
    entry=next(node for node in tree.body if isinstance(node,ast.If) and ast.unparse(node.test)=="__name__ == '__main__'")
    calls=[ast.unparse(node.value.func) for node in entry.body if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call)]
    assert calls==['Base.metadata.create_all','seed_resource_snapshots','uvicorn.run']


def test_source_row_limit_rejects_instead_of_silently_truncating(monkeypatch):
    monkeypatch.setattr(snapshots,'MAX_RECORDS',1)
    with pytest.raises(snapshots.SnapshotRejected,match='source_row_limit'):bundle()


def test_normalization_integer_metadata_rejects_booleans():
    raw=DLI_HTML.split('<tr><td>Quebec')[0]+'</table>'
    data=bundle(fetch=lambda _:raw)
    data['manifest']['normalization']['source_record_count']=True
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(data)


def test_cli_production_import_refuses_before_session_or_output_leak(tmp_path,monkeypatch,capsys):
    from app.data import db as database
    path=tmp_path/'bundle.json';cli.write_bundle(path,bundle())
    monkeypatch.setenv('APP_ENV','production')
    monkeypatch.setenv('DATABASE_URL','postgresql://production.example.invalid/northbridgeai')
    monkeypatch.setattr(database,'SessionLocal',lambda:pytest.fail('production session must not open'))
    assert cli.main(['import','--file',str(path),'--expected-head','NONE'])==1
    output=capsys.readouterr()
    assert 'separate_production_import_authorization_required' in output.err
    assert 'production.example.invalid' not in output.err and 'SYNTHETIC' not in output.err


# The six independent review failures, plus fully checksummed adversarial bundles
# to prove rejection is semantic, not an incidental hash/row-count mismatch.
PROCESSING_REVIEW_CASES = ('country_schema', 'non_country_schema', 'country_name_object')


def processing_payloads(language, case=None):
    key='processing_'+language
    payloads={part:synthetic_source(part) for part in snapshots.component_keys(key)}
    if case in ('country_schema','non_country_schema'):
        part='country' if case=='country_schema' else 'non_country'
        payloads['json_'+part+'_'+language]=json.dumps({'unexpected_schema':'SYNTHETIC incompatible feed'})
    elif case=='country_name_object':
        payloads['json_names_'+language]=json.dumps({'country-name':{'FR':{'unexpected':'SYNTHETIC object'},'CA':'Canada'}})
    return payloads


def malformed_processing_bundle(language, case, at=None):
    from app.services.immigration_intelligence_service import normalize_official_processing
    data=bundle('processing_'+language,at=at);payloads=processing_payloads(language,case)
    data['payloads']=payloads;feeds={part:snapshots.loads(payloads['json_'+part+'_'+language]) for part in ('country','non_country','names')}
    # Reproduce the old lossy normalizer, without invoking or mocking validation.
    rows=normalize_official_processing(feeds,language);m=data['manifest']
    for part,raw in payloads.items():
        m['components'][part]['content_sha256']=snapshots.checksum(raw)
        m['published_at'][part]=snapshots.loads(raw).get('default-update',{}).get('lastupdated')
    m['records_sha256']=snapshots.checksum(snapshots.canonical(rows));m['record_count']=len(rows)
    m['normalization']={'source_record_count':len(rows),'collapsed_source_variants':0}
    return data


@pytest.mark.parametrize('language',['en','fr'])
@pytest.mark.parametrize('case',PROCESSING_REVIEW_CASES)
def test_six_independent_processing_review_failures_are_rejected(language,case):
    with pytest.raises(snapshots.SnapshotRejected):
        snapshots.build_bundle('processing_'+language,processing_payloads(language,case))


@pytest.mark.parametrize('language',['en','fr'])
@pytest.mark.parametrize('case',PROCESSING_REVIEW_CASES)
def test_invalid_same_count_candidate_preserves_head_previous_values_and_freshness(store,language,case):
    at=snapshots.utcnow()-timedelta(minutes=4);key='processing_'+language
    previous=promote(store,bundle(key,at=at))
    active=promote(store,bundle(key,at=at+timedelta(minutes=1)),expected=previous)
    before=snapshots.read_snapshot(key,session_factory=store)
    candidate=malformed_processing_bundle(language,case,at+timedelta(minutes=2))
    assert candidate['manifest']['record_count']==len(before['records'])==19
    with pytest.raises(snapshots.SnapshotRejected):promote(store,candidate,expected=active)
    assert snapshots.read_snapshot(key,session_factory=store)==before
    assert next(r['processing_time'] for r in before['records'] if r['application_type']=='visitor_visa_outside_canada' and r['country_code']=='FR')=='37 days'
    with store() as db:
        assert db.get(Head,key).snapshot_id==active
        assert set(db.scalars(select(Snapshot.id)))=={previous,active}


@pytest.mark.parametrize('part,section,field,value',[
    ('country','visitor-outside-canada','FR',{'value':'37 days'}),
    ('country','visitor-outside-canada','FR',37),
    ('country','visitor-outside-canada','FR',True),
    ('country','visitor-outside-canada','FRA','37 days'),
    ('country','visitor-outside-canada','ZZ','37 days'),
    ('country','visitor-outside-canada','FR','<b>37 days</b>'),
    ('non_country','visitor_inside_canada','visitor_inside_canada',{'value':'12 days'}),
    ('non_country','visitor_inside_canada','visitor_inside_canada',['12 days']),
    ('non_country','visitor_inside_canada','wrong_field','12 days'),
    ('names','country-name','FR',None),
    ('names','country-name','FR',''),
    ('names','country-name','FRA','France'),
])
def test_nested_processing_values_rejected_before_normalization(part,section,field,value):
    payloads=processing_payloads('en');key='json_'+part+'_en';data=snapshots.loads(payloads[key])
    if field=='wrong_field':data[section]={field:value}
    else:data[section][field]=value
    payloads[key]=json.dumps(data)
    with pytest.raises(snapshots.SnapshotRejected):snapshots.build_bundle('processing_en',payloads)


@pytest.mark.parametrize('metadata',[None,[],{'unknown':'October 21, 2026'},{'lastupdated':{'date':'2026-10-21'}},{'lastupdated':'not a date'}])
def test_processing_metadata_must_have_supported_shape(metadata):
    payloads=processing_payloads('en');part='json_non_country_en';data=snapshots.loads(payloads[part]);data['default-update']=metadata;payloads[part]=json.dumps(data)
    with pytest.raises(snapshots.SnapshotRejected):snapshots.build_bundle('processing_en',payloads)


@pytest.mark.parametrize('language,published',[('en','October 21, 2026'),('fr','21 octobre 2026')])
def test_observed_official_variants_remain_compatible(language,published):
    payloads=processing_payloads(language)
    country=snapshots.loads(payloads['json_country_'+language]);country['study']['GL']=None
    country['study']['lastupdated']=published
    country['refugees_private']={'GL':{'sponsor':'Not available','refugee':'Unknown'}}
    payloads['json_country_'+language]=json.dumps(country)
    other=snapshots.loads(payloads['json_non_country_'+language]);other['default-update']['lastupdated']=published
    other['iec']={'iec':None,'iec_past':'5 weeks'};other['citizenship']={'cit_search':'Unknown'}
    other['visitor_inside_canada']['visitor_inside_canada']=''
    payloads['json_non_country_'+language]=json.dumps(other)
    m,rows=snapshots.validate_bundle(snapshots.build_bundle('processing_'+language,payloads))
    assert m['published_at']['json_non_country_'+language]==published
    assert next(r['processing_time'] for r in rows if r['application_type']=='visitor_visa_outside_canada' and r['country_code']=='FR')=='37 days'
    assert all(r['country_code']!='GL' for r in rows)  # no fabricated missing country name
    assert next(r['processing_time'] for r in rows if r['application_type']=='express_entry_cec') is None



def draw_payload(language='en'):
    identity='9002'
    link=f"<a href='https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds/invitations.html?q={identity}'>SYNTHETIC</a>"
    return {'classes':'wb-tables','rounds':[{'drawNumber':identity,'drawDate':'2026-10-28',
             'drawName':'SYNTHETIC catégorie' if language=='fr' else 'SYNTHETIC category',
             'drawSize':'1,500','drawCRS':'450','DrawText1':link,
             'drawDateTime':'28 octobre 2026 à 10:00:00 UTC' if language=='fr' else 'October 28, 2026 at 10:00:00 UTC',
             'drawCutOff':'1 octobre 2026 à 09:00:00 UTC' if language=='fr' else 'October 1, 2026 at 09:00:00 UTC'}]}


def draw_bundle(language='en', at=None, payload=None):
    key='draws_'+language
    return snapshots.build_bundle(key,{key:json.dumps(payload or draw_payload(language),ensure_ascii=False)},observed_at=at)


@pytest.mark.parametrize('language',['en','fr'])
def test_draw_full_schema_locale_source_and_unknown_timezone(language):
    data=draw_bundle(language);manifest,rows=snapshots.validate_bundle(data)
    assert manifest['source_language']==language and manifest['published_at']=={'draws_'+language:None}
    assert rows[0]['round']=='9002' and rows[0]['invitations_issued']==1500 and rows[0]['crs_cutoff']==450
    assert rows[0]['draw_at_utc']=='2026-10-28T10:00:00+00:00'
    assert rows[0]['tie_break_at_utc']=='2026-10-01T09:00:00+00:00'
    payload=draw_payload(language);payload['rounds'][0]['drawDateTime']=payload['rounds'][0]['drawDateTime'].removesuffix(' UTC')
    assert snapshots.validate_bundle(draw_bundle(language,payload=payload))[1][0]['draw_at_utc'] is None


@pytest.mark.parametrize('language',['en','fr'])
@pytest.mark.parametrize('case',['structure','empty','duplicate','number_object','negative','date','timestamp','link','unknown','date_disagreement'])
def test_invalid_draw_candidates_preserve_active_head_estimates_and_freshness(store,language,case):
    at=snapshots.utcnow()-timedelta(minutes=3)
    previous=promote(store,draw_bundle(language,at=at))
    active=promote(store,draw_bundle(language,at=at+timedelta(minutes=1)),expected=previous)
    before=snapshots.read_snapshot('draws_'+language,session_factory=store)
    payload=draw_payload(language);row=payload['rounds'][0]
    if case=='structure':payload={'items':payload['rounds']}
    elif case=='empty':payload['rounds']=[]
    elif case=='duplicate':payload['rounds'].append(deepcopy(row))
    elif case=='number_object':row['drawSize']={'value':1500}
    elif case=='negative':row['drawCRS']='-1'
    elif case=='date':row['drawDate']='2026-02-30'
    elif case=='timestamp':row['drawDateTime']='yesterday'
    elif case=='link':row['DrawText1']="<a href='https://evil.example.invalid/'>SYNTHETIC</a>"
    elif case=='unknown':row['unknown_structure']={'number':450}
    elif case=='date_disagreement':row['drawDateISO']='2026-10-27'
    with pytest.raises(snapshots.SnapshotRejected):
        candidate=draw_bundle(language,at=at+timedelta(minutes=2),payload=payload)
        promote(store,candidate,expected=active)
    assert snapshots.read_snapshot('draws_'+language,session_factory=store)==before
    with store() as db:
        assert db.get(Head,'draws_'+language).snapshot_id==active
        assert set(db.scalars(select(Snapshot.id)))=={previous,active}


def test_draw_checksum_and_source_language_rejected():
    candidate=draw_bundle();candidate['manifest']['records_sha256']='0'*64
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(candidate)
    candidate=draw_bundle();candidate['manifest']['source_language']='fr'
    with pytest.raises(snapshots.SnapshotRejected):snapshots.validate_bundle(candidate)


def test_draw_replay_stale_and_concurrent_source_identity(store):
    at=snapshots.utcnow()-timedelta(hours=2)
    identity=promote(store,draw_bundle(at=at))
    assert snapshots.read_snapshot('draws_en',session_factory=store)['status']=='stale'
    with pytest.raises(snapshots.PromotionConflict):promote(store,draw_bundle(at=at),expected=identity)
    assert snapshots.read_snapshot('draws_fr',session_factory=store)['records']==[]
    assert snapshots.read_snapshot('draws_en',session_factory=store,observed_at=at+timedelta(days=1))['records']==[]


def test_production_import_also_requires_explicit_source_rights(monkeypatch):
    monkeypatch.setenv('APP_ENV','production')
    args=SimpleNamespace(production_host='example.invalid',production_database='northbridgeai',ack_production_public_write=True,ack_source_reuse_rights=False)
    with pytest.raises(snapshots.SnapshotRejected,match='source_reuse_authorization_required'):
        cli.import_database('postgresql://example.invalid/northbridgeai',args)


@pytest.mark.parametrize('language',['en','fr'])
def test_official_historical_distribution_zero_is_valid_metadata(language):
    payload=draw_payload(language)
    payload['rounds'][0].update(dd1='0',dd18='120,000')
    _,rows=snapshots.validate_bundle(draw_bundle(language,payload=payload))
    assert rows[0]['crs_cutoff']==450 and rows[0]['invitations_issued']==1500
