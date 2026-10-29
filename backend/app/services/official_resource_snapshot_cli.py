"""Operator-only bounded collection/validation/import. Never imported at startup.

No public endpoint. Commands require an explicit environment. Collection has no
DB dependency. Import opens a dedicated transaction and writes only public
snapshot tables. Production execution requires separate explicit authorization.
"""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import socket
import sys
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
import requests
from app.services import official_resource_snapshots as snapshots

AGENT = 'NorthBridgeAI-OfficialResources/1.0'
ROOT = Path(__file__).resolve().parents[3]


def environment():
    value = os.environ.get('APP_ENV', '')
    if value not in {'local','development','test','production'}:
        raise snapshots.SnapshotRejected('explicit_environment_required')
    return value


def _fetch(session, url, *, robots=False):
    host = urlsplit(url).hostname
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise snapshots.SnapshotRejected('non_public_source')
    started = time.monotonic()
    session.cookies.clear()  # never carry server cookies between robots/feed requests
    with session.get(url, stream=True, timeout=(2,3), allow_redirects=False) as response:
        if robots and response.status_code == 404:
            return '', 'text/plain'
        if response.status_code != 200:
            raise snapshots.SnapshotRejected('source_http_' + str(response.status_code))
        media = response.headers.get('Content-Type', '').lower().split(';')[0].strip()
        allowed = {'text/plain','text/html'} if robots else {'application/json','text/html'}
        if media not in allowed:
            raise snapshots.SnapshotRejected('source_content_type')
        data = bytearray()
        for chunk in response.iter_content(16384):
            if time.monotonic() - started > 12:
                raise snapshots.SnapshotRejected('source_total_deadline')
            data.extend(chunk)
            if len(data) > (64_000 if robots else snapshots.MAX_BYTES):
                raise snapshots.SnapshotRejected('source_size')
        return bytes(data).decode('utf-8', errors='strict'), media


def collect(source_id):
    environment()
    from app.services.official_resources import SOURCES
    keys = snapshots.component_keys(source_id)
    payloads, types, times = {}, {}, {}
    started = time.monotonic()
    with requests.Session() as session:
        session.trust_env = False
        session.headers.update({'User-Agent':AGENT})
        # A single robots request per official host per bounded collection.
        policies = {}
        for key in keys:
            url = SOURCES[key]; parsed = urlsplit(url)
            if parsed.netloc not in policies:
                raw, _ = _fetch(session, 'https://' + parsed.netloc + '/robots.txt', robots=True)
                policy = RobotFileParser(); policy.parse(raw.splitlines())
                policies[parsed.netloc] = policy
            policy = policies[parsed.netloc]
            if not policy.can_fetch(AGENT, url) or policy.crawl_delay(AGENT) or policy.crawl_delay('*') or policy.request_rate(AGENT) or policy.request_rate('*'):
                raise snapshots.SnapshotRejected('source_schedule_or_access_restricted')
            if time.monotonic() - started > 45:
                raise snapshots.SnapshotRejected('collection_deadline')
            payloads[key], types[key] = _fetch(session, url)
            times[key] = snapshots.stamp(snapshots.utcnow())
    return snapshots.build_bundle(source_id, payloads, content_types=types, component_times=times)


def load_bundle(path):
    # Read bounded bytes, not an unbounded stat/read race. No credentials/records in output.
    with path.open('rb') as stream:
        raw = stream.read(snapshots.MAX_BUNDLE_BYTES + 1)
    if len(raw) > snapshots.MAX_BUNDLE_BYTES:
        raise snapshots.SnapshotRejected('bundle_size')
    return snapshots.loads(raw.decode('utf-8'))


def write_bundle(path, bundle):
    # Exclusive creation; no overwrites, symlink following or accidentally tracked data.
    path = path.resolve()
    if path.is_relative_to(ROOT):
        raise snapshots.SnapshotRejected('bundle_must_be_outside_repository')
    raw = snapshots.canonical(bundle).encode('utf-8')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)


def import_database(raw, args):
    from sqlalchemy.engine import make_url
    from app.rules.monitor_cli import safe_local_database
    env = environment()
    try:
        url = make_url(raw)
    except Exception:
        raise snapshots.SnapshotRejected('explicit_database_required') from None
    if url.query or url.get_backend_name() not in {'sqlite','postgresql'}:
        raise snapshots.SnapshotRejected('database_routing_not_allowed')
    if env != 'production':
        # Same established local-only routing policy as Rules Intelligence.
        if not safe_local_database(url, ROOT):
            raise snapshots.SnapshotRejected('isolated_database_required')
        if args.production_host or args.production_database or args.ack_production_public_write:
            raise snapshots.SnapshotRejected('production_ack_in_local_environment')
    elif not (args.ack_production_public_write and args.production_host and args.production_database
              and url.get_backend_name() == 'postgresql' and url.host == args.production_host and url.database == args.production_database):
        raise snapshots.SnapshotRejected('separate_production_import_authorization_required')
    return url


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    fetch = commands.add_parser('collect'); fetch.add_argument('--source', choices=sorted(snapshots.SOURCE_IDS), required=True); fetch.add_argument('--output', type=Path, required=True)
    check = commands.add_parser('validate'); check.add_argument('--file', type=Path, required=True)
    load = commands.add_parser('import'); load.add_argument('--file', type=Path, required=True)
    load.add_argument('--expected-head', required=True, help='Exact previous ID, or NONE for first import')
    load.add_argument('--production-host'); load.add_argument('--production-database')
    load.add_argument('--ack-production-public-write', action='store_true')
    args = parser.parse_args(argv)
    try:
        environment()
        if args.command == 'collect':
            bundle = collect(args.source); write_bundle(args.output, bundle)
            m = bundle['manifest']; identity = None
        else:
            bundle = load_bundle(args.file); m, _ = snapshots.validate_bundle(bundle)
            identity = None
            if args.command == 'import':
                import_database(os.environ.get('DATABASE_URL', ''), args)  # before any dotenv/database import
                from app.data.db import SessionLocal
                expected = None if args.expected_head == 'NONE' else args.expected_head
                if expected is not None and not __import__('re').fullmatch(r'[a-f0-9]{32}', expected):
                    raise snapshots.SnapshotRejected('invalid_expected_head')
                with SessionLocal() as db:
                    identity = snapshots.promote(db, bundle, expected_head=expected)
        print(json.dumps({'result':'PASS','source_id':m['source_id'],'record_count':m['record_count'],'records_sha256':m['records_sha256'],'snapshot_id':identity}))
        return 0
    except Exception as exc:
        # Fixed codes only. Never echo external exceptions, URLs with secrets or raw payloads.
        code = str(exc) if type(exc) in {snapshots.SnapshotRejected, snapshots.PromotionConflict} else 'collection_validation_or_store_failed'
        print(json.dumps({'result':'FAIL','classification':code}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
