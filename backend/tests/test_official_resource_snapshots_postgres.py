"""Real loopback PostgreSQL migration/locking proof; no production fallback."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
import time
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from backend.tests.test_individual_launch_postgres import pg_database_factory, pg_database, migrate  # noqa: F401
from backend.tests.test_official_resource_snapshots import bundle, promote
from app.services import official_resource_snapshots as snapshots
from app.models.official_resource_snapshot_model import OfficialResourceSnapshot as Snapshot, OfficialResourceHead as Head


def test_additive_migration_preserves_legacy_tables_and_records(pg_database,monkeypatch):
    engine,url=pg_database
    monkeypatch.setenv('PGOPTIONS','-c lock_timeout=2000 -c statement_timeout=10000')
    migrate(url,'c4f8a2d6e901')
    tables=set(sa.inspect(engine).get_table_names())
    with engine.begin() as c:
        c.exec_driver_sql("INSERT INTO users(id,email,password,role,plan) VALUES(27,'snapshots@example.invalid','synthetic','individual','free')")
        c.exec_driver_sql("INSERT INTO profiles(user_id,occupation) VALUES(27,'SYNTHETIC preserve exact profile')")
        c.exec_driver_sql("INSERT INTO generated_documents(user_id,document_type,title,language,content) VALUES(27,'letter','SYNTHETIC preserve','fr','SYNTHETIC exact content')")
    def fingerprints():
        with engine.connect() as c:
            return {name:c.exec_driver_sql('SELECT md5(COALESCE(json_agg(x ORDER BY x::text)::text,\'[]\')) FROM (SELECT row_to_json(t) AS x FROM "'+name+'" t) q').scalar() for name in tables-{'alembic_version'}}
    before=fingerprints();started=time.monotonic();migrate(url)
    assert time.monotonic()-started<30
    assert set(sa.inspect(engine).get_table_names())==tables|{'official_resource_snapshots','official_resource_heads'}
    assert fingerprints()==before
    with engine.connect() as c:
        assert c.exec_driver_sql('SELECT version_num FROM alembic_version').scalar()=='d9a7e3b2f610'
    migrate(url);assert fingerprints()==before
    result=migrate(url,'c4f8a2d6e901',success=False,action='downgrade')
    assert 'destructive downgrade is not supported' in result.stderr
    assert fingerprints()==before


@pytest.mark.parametrize('initial',[False,True])
def test_concurrent_cas_allows_exactly_one_promotion(pg_database,initial):
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    now=snapshots.utcnow();old=None
    if not initial:old=promote(sessions,bundle(at=now-timedelta(minutes=3)))
    candidates=[bundle(at=now-timedelta(minutes=1)),bundle(at=now)]
    gate=Barrier(2)
    def run(data):
        gate.wait(timeout=3)
        try:return ('promoted',promote(sessions,data,expected=old))
        except snapshots.PromotionConflict:return ('conflict',None)
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,candidates))
    assert sorted(r[0] for r in results)==['conflict','promoted']
    with sessions() as db:
        assert db.get(Head,'dli').snapshot_id==next(r[1] for r in results if r[0]=='promoted')
        assert len(db.scalars(sa.select(Snapshot)).all())==(1 if initial else 2)


def test_transaction_failure_preserves_old_head_and_recovery(pg_database):
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    old=promote(sessions,bundle(at=snapshots.utcnow()-timedelta(minutes=1)))
    with sessions() as db:
        def abort(_db):raise RuntimeError('synthetic commit failure')
        sa.event.listen(db,'before_commit',abort)
        with pytest.raises(RuntimeError):snapshots.promote(db,bundle(),expected_head=old)
    with sessions() as db:
        assert db.get(Head,'dli').snapshot_id==old
        assert len(db.scalars(sa.select(Snapshot)).all())==1
    new=promote(sessions,bundle(),expected=old)
    assert snapshots.read_snapshot('dli',session_factory=sessions)['snapshot_id']==new


def test_bounded_lock_timeout_leaves_integrity_unchanged(pg_database):
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    old=promote(sessions,bundle(at=snapshots.utcnow()-timedelta(minutes=1)))
    with engine.begin() as blocker:
        blocker.exec_driver_sql("SELECT * FROM official_resource_heads WHERE source_id='dli' FOR UPDATE")
        started=time.monotonic()
        with pytest.raises(sa.exc.OperationalError):promote(sessions,bundle(),expected=old)
        elapsed=time.monotonic()-started
        assert 1.5<elapsed<5
        assert snapshots.read_snapshot('dli',session_factory=sessions)['snapshot_id']==old
    with sessions() as db:assert len(db.scalars(sa.select(Snapshot)).all())==1


def test_head_cannot_reference_other_source_and_retention_is_bounded(pg_database):
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    at=snapshots.utcnow()-timedelta(minutes=5);old=None
    for index in range(4):old=promote(sessions,bundle(at=at+timedelta(minutes=index)),expected=old)
    other=promote(sessions,bundle('processing_fr'))
    with sessions() as db:
        assert len(db.scalars(sa.select(Snapshot).where(Snapshot.source_id=='dli')).all())==2
        db.get(Head,'dli').snapshot_id=other
        with pytest.raises(sa.exc.IntegrityError):db.commit()
    assert snapshots.read_snapshot('dli',session_factory=sessions)['snapshot_id']==old
    assert snapshots.read_snapshot('processing_fr',session_factory=sessions)['snapshot_id']==other


def test_disposable_e2e_seeding_is_validated_idempotent_and_snapshot_backed(pg_database,monkeypatch):
    from backend.tests.test_official_resource_snapshots import e2e_seed_function
    from app.services import official_resources as resources
    engine,url=pg_database;migrate(url)
    monkeypatch.setenv('APP_ENV','test')
    # The isolated test hook is restored after this test, including on failure.
    monkeypatch.setattr(resources,'_snapshot_reader',resources._snapshot_reader)
    monkeypatch.setattr(resources,'_read_source',resources._read_source)
    seed=e2e_seed_function();first=seed(engine);second=seed(engine)
    assert set(first)=={'dli','processing_en','processing_fr'} and first==second
    with sessionmaker(bind=engine)() as db:
        assert len(db.scalars(sa.select(Snapshot)).all())==3
        assert len(db.scalars(sa.select(Head)).all())==3
        assert {x.envelope['retrieved_at'] for x in db.scalars(sa.select(Snapshot))}=={'2026-10-29T00:00:00+00:00'}
    with pytest.raises(RuntimeError,match='must read snapshots'):resources._read_source('dli')
    assert resources.search('dli','Maple')['total']==1
    assert all(resources.resource_data(key)['status']=='available' for key in first)


def test_operator_cli_imports_only_explicit_disposable_database(pg_database,tmp_path,monkeypatch,capsys):
    from app.services import official_resource_snapshot_cli as cli
    from app.data import db as database
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    monkeypatch.setenv('APP_ENV','test');monkeypatch.setenv('DATABASE_URL',url.render_as_string(hide_password=False))
    monkeypatch.setattr(database,'SessionLocal',sessions)
    path=tmp_path/'bundle.json';cli.write_bundle(path,bundle())
    assert cli.main(['import','--file',str(path),'--expected-head','NONE'])==0
    assert cli.main(['import','--file',str(path),'--expected-head','NONE'])==1
    with sessions() as db:assert len(db.scalars(sa.select(Snapshot)).all())==1
    output=capsys.readouterr()
    assert 'PASS' in output.out and 'active_head_changed' in output.err
    assert 'SYNTHETIC Maple' not in output.out



@pytest.mark.parametrize('language',['en','fr'])
@pytest.mark.parametrize('case',['country_schema','non_country_schema','country_name_object'])
def test_postgres_invalid_processing_preserves_two_good_versions_and_freshness(pg_database,language,case):
    from backend.tests.test_official_resource_snapshots import malformed_processing_bundle
    engine,url=pg_database;migrate(url);sessions=sessionmaker(bind=engine)
    at=snapshots.utcnow()-timedelta(minutes=4);key='processing_'+language
    previous=promote(sessions,bundle(key,at=at));active=promote(sessions,bundle(key,at=at+timedelta(minutes=1)),expected=previous)
    before=snapshots.read_snapshot(key,session_factory=sessions)
    candidate=malformed_processing_bundle(language,case,at+timedelta(minutes=2))
    assert candidate['manifest']['record_count']==len(before['records'])==19
    writes=[]
    def track(_conn,_cursor,statement,*_args):
        if statement.lstrip().upper().startswith(('INSERT','UPDATE','DELETE')):writes.append(statement)
    sa.event.listen(engine,'before_cursor_execute',track)
    try:
        with pytest.raises(snapshots.SnapshotRejected):promote(sessions,candidate,expected=active)
        assert snapshots.read_snapshot(key,session_factory=sessions)==before
        assert not writes
    finally:sa.event.remove(engine,'before_cursor_execute',track)
    with sessions() as db:
        assert db.get(Head,key).snapshot_id==active
        assert set(db.scalars(sa.select(Snapshot.id)))=={previous,active}
