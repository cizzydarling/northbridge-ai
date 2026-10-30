"""Verified public-source snapshots. No background job, rule activation or public writer.

Checksums establish integrity, not origin: only a trusted operator collector may
supply bundles. Import reparses all source bytes; normalized caller rows are never
accepted. Public request reads never fetch remotely or promote a snapshot.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import re
import uuid
from sqlalchemy import select, delete, text

SCHEMA_VERSION = 1
PARSER_VERSION = 'official-resources-v2'
SOURCE_IDS = frozenset(('dli', 'processing_en', 'processing_fr', 'draws_en', 'draws_fr'))
MAX_BYTES = 2_000_000
MAX_RECORDS = 10_000
MAX_BUNDLE_BYTES = 6_100_000
FRESH_SECONDS = 3600
STALE_SECONDS = 86400
_LOG = logging.getLogger(__name__)


class SnapshotRejected(ValueError):
    """Only fixed classifications, never source contents or exception messages."""


class PromotionConflict(SnapshotRejected):
    pass


def utcnow():
    return datetime.now(timezone.utc)


def stamp(value):
    return value.astimezone(timezone.utc).isoformat()


def date_value(value):
    try:
        if not isinstance(value, str) or len(value) > 40:
            raise ValueError
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
            raise ValueError
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        raise SnapshotRejected('invalid_timestamp') from None


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def checksum(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise SnapshotRejected('duplicate_json_key')
        result[key] = value
    return result


def loads(raw):
    def invalid(_value):
        raise SnapshotRejected('invalid_json_number')
    try:
        return json.loads(raw.removeprefix('\ufeff') if isinstance(raw, str) else raw, object_pairs_hook=_pairs, parse_constant=invalid)
    except (TypeError, ValueError, RecursionError):
        raise SnapshotRejected('invalid_json') from None


def component_keys(source_id):
    if source_id == 'dli':
        return ('dli',)
    if source_id in {'draws_en', 'draws_fr'}:
        return (source_id,)
    if source_id in SOURCE_IDS:
        return tuple('json_' + part + '_' + source_id[-2:] for part in ('country', 'non_country', 'names'))
    raise SnapshotRejected('unsupported_source')


def _publisher_date(value):
    if value is None:
        return None
    months = {name: i + 1 for i, name in enumerate(('january','february','march','april','may','june','july','august','september','october','november','december'))}
    months.update({name: i + 1 for i, name in enumerate(('janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'))})
    try:
        if not isinstance(value, str) or len(value) > 80:
            raise ValueError
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        en = re.fullmatch(r'([A-Za-z]+) (\d{1,2}), (\d{4})', value)
        fr = re.fullmatch(r'(\d{1,2}) ([^\s]+) (\d{4})', value)
        if en:
            month, day, year = en.groups()
        elif fr:
            day, month, year = fr.groups()
        else:
            raise ValueError
        return datetime(int(year), months[month.lower()], int(day), tzinfo=timezone.utc)
    except (KeyError, ValueError):
        raise SnapshotRejected('invalid_publisher_date') from None


def _validate_processing_feeds(feeds, language, acquired_at=None):
    """Validate each required source independently, before lossy normalization.

    Missing individual categories/estimates remain unknown. A replacement feed
    must still have a recognized, typed structure of its own. Explicit extra
    sections below are observed IRCC contracts, not additional offered features.
    """
    from app.services.immigration_intelligence_service import COUNTRY_PROCESSING_APPLICATIONS, NON_COUNTRY_PROCESSING_APPLICATIONS
    if language not in {'en', 'fr'} or set(feeds) != {'country', 'non_country', 'names'}:
        raise SnapshotRejected('processing_component_identity')
    supported_country = set(COUNTRY_PROCESSING_APPLICATIONS.values())
    extra_country = {'child_dependent', 'child_adopted', 'refugees_gov', 'refugees_private'}
    supported_other = {section: {field} for section, field in NON_COUNTRY_PROCESSING_APPLICATIONS.values()}
    supported_other['iec'].add('iec_past')
    extra_other = {'fed_skilled_trades': {'skilled_trades_ee'},
                   'citizenship': {'cit_resumption', 'cit_renunciation', 'cit_search', 'cit_adoption_part1'},
                   'pr_card': {'new_pr', 'existing_pr'},
                   'rep_documents': {'vos', 'replacement', 'amend_imm', 'amend_tr'},
                   'sawp': {'sawp_current'}}

    def source_date(value):
        parsed = _publisher_date(value)
        if parsed and acquired_at is not None and parsed > acquired_at:
            raise SnapshotRejected('future_publisher_date')

    def metadata(value):
        if not isinstance(value, dict) or set(value) != {'lastupdated'}:
            raise SnapshotRejected('processing_metadata_schema')
        source_date(value['lastupdated'])

    def estimate(value):
        if value is not None and (not isinstance(value, str) or len(value) >= 160
                                  or any(c in value for c in '<>\x00')
                                  or any(ord(c) < 32 and c not in '\t\n\r' for c in value)):
            raise SnapshotRejected('processing_estimate_type')

    def geography(code):
        if not isinstance(code, str) or not re.fullmatch(r'[A-Z]{2}', code):
            raise SnapshotRejected('processing_geography')

    for part in ('country', 'non_country', 'names'):
        value = feeds[part]
        if not isinstance(value, dict) or not value:
            raise SnapshotRejected('invalid_processing_component')
        if 'default-update' in value:
            metadata(value['default-update'])

    names = feeds['names']
    if not set(names) <= {'country-name', 'default-update'} or not isinstance(names.get('country-name'), dict) or not names['country-name']:
        raise SnapshotRejected('processing_names_schema')
    for code, name in names['country-name'].items():
        geography(code)
        if not isinstance(name, str) or not name.strip() or len(name) > 200 or any(c in name for c in '<>\x00') or any(ord(c) < 32 for c in name):
            raise SnapshotRejected('processing_country_name_type')

    country = feeds['country']
    if not set(country) <= supported_country | extra_country | {'default-update'} or not set(country) & supported_country:
        raise SnapshotRejected('processing_country_schema')
    geographic_values = 0
    for section, values in country.items():
        if section == 'default-update':
            continue
        if not isinstance(values, dict):
            raise SnapshotRejected('processing_country_section_type')
        for code, value in values.items():
            if code == 'lastupdated':
                source_date(value)
                continue
            geography(code)
            if code not in names['country-name'] and code != 'GL':
                raise SnapshotRejected('processing_unknown_geography')
            if section in supported_country:
                geographic_values += 1
            # IRCC includes GL although its country-name feed omits it; do not
            # invent a label or demand identical geography sets across feeds.
            if section == 'refugees_private' and isinstance(value, dict):
                if set(value) != {'sponsor', 'refugee'}:
                    raise SnapshotRejected('processing_refugee_variant_schema')
                for leaf in value.values():
                    estimate(leaf)
            else:
                estimate(value)
    if not geographic_values:
        raise SnapshotRejected('empty_processing_country_values')

    other = feeds['non_country']
    contracts = supported_other | extra_other
    if not set(other) <= set(contracts) | {'default-update'} or not set(other) & set(supported_other):
        raise SnapshotRejected('processing_non_country_schema')
    for section, values in other.items():
        if section == 'default-update':
            continue
        if not isinstance(values, dict) or not values or not set(values) <= contracts[section] | {'lastupdated'}:
            raise SnapshotRejected('processing_non_country_section_schema')
        if section in supported_other:
            required = next(field for name, field in NON_COUNTRY_PROCESSING_APPLICATIONS.values() if name == section)
            if required not in values:
                raise SnapshotRejected('processing_non_country_value_missing')
        elif not set(values) & contracts[section]:
            raise SnapshotRejected('processing_non_country_value_missing')
        for field, value in values.items():
            if field == 'lastupdated':
                source_date(value)
            else:
                estimate(value)


def _parse(source_id, payloads, acquired_at=None):
    from app.services import official_resources as resources
    dates = {}
    if source_id == 'dli':
        class SnapshotRows(resources.Rows):
            def handle_endtag(self, tag):
                if tag == 'tr' and self.row is not None and len(self.rows) >= MAX_RECORDS:
                    raise SnapshotRejected('source_row_limit')
                super().handle_endtag(tag)
        parser = SnapshotRows()
        parser.feed(payloads['dli'])
        valid = [r for r in parser.rows if len(r) >= 4 and re.fullmatch(r'O\d{8,15}', r[2]) and all(r[:4])]
        rows = resources.parse_dli(payloads['dli'])
        seen_rows, identities = set(), {}
        for raw in valid:
            complete, supported = tuple(raw), tuple(raw[:4])
            identity = resources.record('dli', raw[1], resources.DLI, dli_number=raw[2], city=raw[3])['id']
            if complete in seen_rows:
                raise SnapshotRejected('duplicate_source_record')
            seen_rows.add(complete)
            if identity in identities and (identities[identity] != (supported, 8) or len(raw) != 8):
                raise SnapshotRejected('conflicting_source_identity')
            identities[identity] = (supported, len(raw))
        # IRCC legitimately has distinct eight-column variants (e.g. programme
        # detail) with identical supported institution fields. Preserve the
        # existing institution identity, disclose the collapse, and never infer
        # eligibility from those unexposed columns. Exact/conflicting duplicates
        # above still fail; normalized snapshot identities must remain unique.
        normalization = {'source_record_count':len(valid), 'collapsed_source_variants':len(valid)-len(rows)}
        dates['dli'] = None  # Do not infer publication dates from retrieval or footer dates.
    elif source_id in {'draws_en', 'draws_fr'}:
        from app.services.immigration_intelligence_service import normalize_official_draws
        rows = normalize_official_draws(loads(payloads[source_id]), source_id[-2:], acquired_at=acquired_at)
        dates[source_id] = None  # Draw dates are event dates, never feed publication dates.
        normalization = {'source_record_count': len(rows), 'collapsed_source_variants': 0}
    else:
        from app.services.immigration_intelligence_service import normalize_official_processing
        feeds = {}
        for part in ('country', 'non_country', 'names'):
            key = 'json_' + part + '_' + source_id[-2:]
            feeds[part] = loads(payloads[key])
            value = feeds[part]
            if not isinstance(value, dict) or not value:
                raise SnapshotRejected('invalid_processing_component')
            dates[key] = value.get('default-update', {}).get('lastupdated') if isinstance(value.get('default-update', {}), dict) else None
        _validate_processing_feeds(feeds, source_id[-2:], acquired_at)
        rows = normalize_official_processing(feeds, source_id[-2:])
        normalization = {'source_record_count':len(rows), 'collapsed_source_variants':0}
        if not any(r.get('processing_time') for r in rows):
            raise SnapshotRejected('empty_processing_estimates')
    if not rows or len(rows) > MAX_RECORDS or len(canonical(rows).encode()) > MAX_BYTES:
        raise SnapshotRejected('record_count_or_size')
    identities = ([r['id'] for r in rows] if source_id == 'dli' else
                  [r['round'] for r in rows] if source_id.startswith('draws_') else
                  [(r['application_type'], r['country_code']) for r in rows])
    if len(set(identities)) != len(identities):
        raise SnapshotRejected('duplicate_source_record')
    return rows, dates, normalization


def build_bundle(source_id, payloads, *, observed_at=None, content_types=None, component_times=None):
    """Trusted collector/test helper; caller input is still revalidated at import."""
    from app.services.official_resources import SOURCES
    keys = component_keys(source_id)
    if set(payloads) != set(keys):
        raise SnapshotRejected('missing_or_extra_components')
    observed_at = observed_at or utcnow()
    types = content_types or {k: 'text/html' if k == 'dli' else 'application/json' for k in keys}
    times = component_times or {k: stamp(observed_at) for k in keys}
    if set(types) != set(keys) or set(times) != set(keys):
        raise SnapshotRejected('component_metadata')
    acquired = min(date_value(times[k]) for k in keys)
    rows, dates, normalization = _parse(source_id, payloads, acquired)
    manifest = {
        'source_id': source_id, 'official_url': SOURCES[source_id],
        'source_language': 'en' if source_id == 'dli' else source_id[-2:],
        'retrieved_at': stamp(acquired), 'published_at': dates,
        'schema_version': SCHEMA_VERSION, 'parser_version': PARSER_VERSION,
        'normalization': normalization, 'record_count': len(rows), 'records_sha256': checksum(canonical(rows)),
        'validation_result': 'SCHEMA_VALID_NOT_ELIGIBILITY_REVIEW',
        'fresh_until': stamp(acquired + timedelta(seconds=FRESH_SECONDS)),
        'unavailable_after': stamp(acquired + timedelta(seconds=STALE_SECONDS)),
        'components': {k: {'official_url': SOURCES[k], 'retrieved_at': times[k], 'content_type': types[k], 'content_sha256': checksum(payloads[k])} for k in keys},
    }
    bundle = {'manifest': manifest, 'payloads': deepcopy(payloads)}
    validate_bundle(bundle, observed_at=observed_at)
    return bundle


def validate_bundle(bundle, *, observed_at=None):
    from app.services.official_resources import SOURCES
    observed_at = observed_at or utcnow()
    try:
        if not isinstance(bundle, dict) or set(bundle) != {'manifest', 'payloads'} or len(canonical(bundle).encode()) > MAX_BUNDLE_BYTES:
            raise SnapshotRejected('invalid_bundle')
        m, payloads = bundle['manifest'], bundle['payloads']
        fields = {'source_id','official_url','source_language','retrieved_at','published_at','schema_version','parser_version','record_count','normalization','records_sha256','validation_result','fresh_until','unavailable_after','components'}
        if not isinstance(m, dict) or set(m) != fields or not isinstance(payloads, dict):
            raise SnapshotRejected('manifest_fields')
        key = m['source_id']; keys = component_keys(key)
        if set(payloads) != set(keys) or not isinstance(m['components'], dict) or set(m['components']) != set(keys):
            raise SnapshotRejected('missing_or_extra_components')
        if type(m['schema_version']) is not int or m['schema_version'] != SCHEMA_VERSION or m['parser_version'] != PARSER_VERSION:
            raise SnapshotRejected('unsupported_schema')
        if m['official_url'] != SOURCES[key] or m['source_language'] != ('en' if key == 'dli' else key[-2:]):
            raise SnapshotRejected('source_identity')
        acquired = date_value(m['retrieved_at']); times = []
        if acquired > observed_at or observed_at >= acquired + timedelta(seconds=STALE_SECONDS):
            raise SnapshotRejected('future_or_expired_acquisition')
        if date_value(m['fresh_until']) != acquired + timedelta(seconds=FRESH_SECONDS) or date_value(m['unavailable_after']) != acquired + timedelta(seconds=STALE_SECONDS):
            raise SnapshotRejected('freshness_policy')
        for k in keys:
            part = m['components'][k]; raw = payloads[k]
            if not isinstance(part, dict) or set(part) != {'official_url','retrieved_at','content_type','content_sha256'} or part['official_url'] != SOURCES[k]:
                raise SnapshotRejected('component_identity')
            dt = date_value(part['retrieved_at']); times.append(dt)
            if dt > observed_at or dt < acquired or dt - acquired > timedelta(minutes=5):
                raise SnapshotRejected('component_acquisition')
            if not isinstance(raw, str) or not 0 < len(raw.encode('utf-8')) <= MAX_BYTES or checksum(raw) != part['content_sha256']:
                raise SnapshotRejected('component_checksum_or_size')
            media = part['content_type'].lower().split(';')[0].strip() if isinstance(part['content_type'], str) else ''
            if media not in ({'text/html'} if k == 'dli' else {'application/json'}):
                raise SnapshotRejected('content_type')
            if re.search(r'ERR-BOT-403|Access Denied|(?:sk_(?:live|test)_[a-zA-Z0-9]+)|(?:Bearer\s+[a-zA-Z0-9._-]{15,})|(?:password\s*[:=])', raw, re.I):
                raise SnapshotRejected('restricted_or_sensitive_source')
        if min(times) != acquired:
            raise SnapshotRejected('acquisition_mismatch')
        rows, dates, normalization = _parse(key, payloads, acquired)
        if (not isinstance(m['normalization'], dict) or set(m['normalization']) != set(normalization)
                or any(type(v) is not int or v < 0 for v in m['normalization'].values())
                or m['normalization'] != normalization):
            raise SnapshotRejected('normalization_count_mismatch')
        if m['published_at'] != dates:
            raise SnapshotRejected('publisher_date_mismatch')
        for value in dates.values():
            date = _publisher_date(value)
            if date and date > acquired:
                raise SnapshotRejected('future_publisher_date')
        if type(m['record_count']) is not int or m['record_count'] != len(rows) or m['records_sha256'] != checksum(canonical(rows)):
            raise SnapshotRejected('normalized_checksum_or_count')
        if m['validation_result'] != 'SCHEMA_VALID_NOT_ELIGIBILITY_REVIEW':
            raise SnapshotRejected('validation_status')
        return deepcopy(m), rows
    except SnapshotRejected:
        raise
    except (KeyError, TypeError, ValueError, AttributeError, OverflowError, RecursionError, UnicodeError):
        raise SnapshotRejected('invalid_source_schema') from None


def promote(db, bundle, *, expected_head, observed_at=None):
    """New dedicated Session required. No caller transaction/implicit commit."""
    from app.models.official_resource_snapshot_model import OfficialResourceSnapshot as Snapshot, OfficialResourceHead as Head
    m, rows = validate_bundle(bundle, observed_at=observed_at)
    key = m['source_id']; new_id = uuid.uuid4().hex
    dialect = db.get_bind().dialect.name
    if dialect not in {'postgresql', 'sqlite'} or db.in_transaction():
        raise SnapshotRejected('dedicated_supported_session_required')
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    with db.begin():
        if dialect == 'postgresql':
            db.execute(text("SET LOCAL lock_timeout = '2s'"))
            db.execute(text("SET LOCAL statement_timeout = '10s'"))
        insert = pg_insert if dialect == 'postgresql' else sqlite_insert
        db.execute(insert(Head).values(source_id=key, snapshot_id=None).on_conflict_do_nothing(index_elements=['source_id']))
        head = db.execute(select(Head).where(Head.source_id == key).with_for_update()).scalar_one()
        if head.snapshot_id != expected_head:
            raise PromotionConflict('active_head_changed')
        if head.snapshot_id:
            old = db.get(Snapshot, head.snapshot_id)
            old_time = old.retrieved_at.replace(tzinfo=timezone.utc) if old.retrieved_at.tzinfo is None else old.retrieved_at
            if date_value(m['retrieved_at']) <= old_time:
                raise PromotionConflict('older_or_replayed_acquisition')
            if len(rows) < old.record_count * 0.8:
                raise SnapshotRejected('large_record_drop_requires_review')
        db.add(Snapshot(id=new_id, source_id=key, retrieved_at=date_value(m['retrieved_at']), record_count=len(rows), records_sha256=m['records_sha256'], envelope=m, records=rows))
        db.flush()
        head.snapshot_id = new_id
        db.flush()
        # Retain active and previous-good; never delete any referenced head.
        keep = db.scalars(select(Snapshot.id).where(Snapshot.source_id == key).order_by(Snapshot.retrieved_at.desc()).limit(2)).all()
        db.execute(delete(Snapshot).where(Snapshot.source_id == key, Snapshot.id.not_in(keep), Snapshot.id.not_in(select(Head.snapshot_id).where(Head.snapshot_id.is_not(None)))))
    _LOG.info('official_resource_snapshot_promoted', extra={'source_id': key, 'snapshot_id': new_id, 'record_count': len(rows)})
    return new_id


def read_snapshot(source_id, *, session_factory=None, observed_at=None):
    """Read-only, consistent head join. No network or source writes on failure."""
    if source_id not in SOURCE_IDS:
        raise SnapshotRejected('unsupported_source')
    from app.services.official_resources import SOURCES
    result = {'status':'unavailable', 'records':[], 'retrieved_at':None, 'expires_at':None,
              'source_updated_at':None, 'source_url':SOURCES[source_id],
              'reason':'source_not_reliably_available', 'review_status':'NOT_VERIFIED'}
    try:
        from app.models.official_resource_snapshot_model import OfficialResourceSnapshot as Snapshot, OfficialResourceHead as Head
        if session_factory is None:
            from app.data.db import SessionLocal
            session_factory = SessionLocal
        with session_factory() as db:
            if db.get_bind().dialect.name == 'postgresql':
                db.execute(text("SET LOCAL statement_timeout = '2s'"))
                db.execute(text('SET TRANSACTION READ ONLY'))
            item = db.execute(select(Snapshot).join(Head, (Head.source_id == Snapshot.source_id) & (Head.snapshot_id == Snapshot.id)).where(Head.source_id == source_id)).scalar_one_or_none()
            if item is None:
                return result
            m, rows = deepcopy(item.envelope), deepcopy(item.records)
        age = ((observed_at or utcnow()) - date_value(m['retrieved_at'])).total_seconds()
        if (age < 0 or age >= STALE_SECONDS or m['source_id'] != source_id
                or type(m['schema_version']) is not int or m['schema_version'] != SCHEMA_VERSION
                or m['parser_version'] != PARSER_VERSION or m['validation_result'] != 'SCHEMA_VALID_NOT_ELIGIBILITY_REVIEW'
                or not 0 < len(rows) <= MAX_RECORDS or len(rows) != m['record_count']
                or len(canonical(rows).encode()) > MAX_BYTES or checksum(canonical(rows)) != m['records_sha256']):
            return result
        result.pop('reason', None)
        return {**result, 'status':'available' if age < FRESH_SECONDS else 'stale', 'records':rows,
                'retrieved_at':m['retrieved_at'], 'expires_at':m['fresh_until'],
                'review_status':'SOURCE_RECORD_NOT_ELIGIBILITY_REVIEW', 'coverage':'supported_source_subset',
                'content_sha256':m['components']['dli']['content_sha256'] if source_id == 'dli' else checksum(canonical({k:v['content_sha256'] for k,v in m['components'].items()})),
                'snapshot_id':item.id}
    except Exception:
        _LOG.warning('official_resource_snapshot_read_unavailable', extra={'source_id':source_id, 'failure_class':'snapshot_store_or_integrity'})
        return result
