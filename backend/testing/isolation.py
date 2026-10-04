"""Fail-closed network/environment boundary used only by test entry points."""
import os
import socket
import sys
from pathlib import Path
from urllib.parse import urlsplit

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}
VIOLATIONS = []
_installed = False


def check_address(address):
    host = address[0] if isinstance(address, tuple) else address
    if host not in ALLOWED_HOSTS:
        VIOLATIONS.append(str(host))
        raise RuntimeError("TEST isolation blocked an external destination")


def configure_environment():
    # Never read production dotenv values, even to discover variable names.
    for key in list(os.environ):
        if key.startswith(("STRIPE_", "SMTP_", "AWS_", "RESEND_", "OPENAI_", "DOCUMENT_STORAGE_")) or key in {"DATABASE_URL", "REDIS_URL", "SENTRY_DSN"}:
            os.environ.pop(key, None)
    admin = os.environ.get("TEST_POSTGRES_ADMIN_URL")
    if admin:
        url = urlsplit(admin)
        if url.scheme not in {"postgresql", "postgresql+psycopg2"} or url.hostname not in ALLOWED_HOSTS or url.path != "/postgres":
            raise RuntimeError("TEST_POSTGRES_ADMIN_URL must explicitly target loopback /postgres")
    os.environ.update(APP_ENV="test", PYTHON_DOTENV_DISABLED="1", NBAI_TEST_ISOLATION="1",
        DATABASE_URL="sqlite://", SECRET_KEY="isolated-test-key-not-for-deployment",
        DOCUMENT_STORAGE_BACKEND="local", OPENAI_API_KEY="", RESEND_API_KEY="", SMTP_HOST="",
        STRIPE_SECRET_KEY="sk_test_placeholder", AWS_EC2_METADATA_DISABLED="true",
        FRONTEND_URL="http://127.0.0.1:4173", CORS_ORIGINS="http://127.0.0.1:4173")
    sys.path.insert(0, str(Path(__file__).parents[1]))
    guard_dir = str(Path(__file__).parent)
    os.environ["PYTHONPATH"] = os.pathsep.join([guard_dir, str(Path(__file__).parents[1]), str(Path(__file__).parents[2]), os.environ.get("PYTHONPATH", "")])


def install_network_guard():
    global _installed
    if _installed:
        return
    _installed = True
    original_connect, original_connect_ex = socket.socket.connect, socket.socket.connect_ex
    original_getaddrinfo = socket.getaddrinfo
    def connect(sock, address):
        check_address(address)
        return original_connect(sock, address)
    def connect_ex(sock, address):
        check_address(address)
        return original_connect_ex(sock, address)
    def getaddrinfo(host, *args, **kwargs):
        check_address(host)
        return original_getaddrinfo(host, *args, **kwargs)
    socket.socket.connect, socket.socket.connect_ex, socket.getaddrinfo = connect, connect_ex, getaddrinfo
    # libpq does not use Python sockets, so PostgreSQL needs its own boundary.
    import psycopg2
    from psycopg2.extensions import parse_dsn
    original_pg_connect = psycopg2.connect
    def pg_connect(dsn=None, *args, **kwargs):
        options = {**parse_dsn(dsn or ""), **kwargs}
        check_address(options.get("host", ""))
        if options.get("hostaddr"):
            check_address(options["hostaddr"])
        database = options.get("dbname", options.get("database", ""))
        if database != "postgres" and not database.startswith(("nbai_rehearsal_", "nbai_perf_")):
            VIOLATIONS.append("unapproved database")
            raise RuntimeError("TEST isolation blocked a non-disposable database")
        return original_pg_connect(dsn, *args, **kwargs)
    psycopg2.connect = pg_connect
