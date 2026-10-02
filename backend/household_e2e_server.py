"""Browser rehearsal server. Creates only a disposable loopback PostgreSQL database."""
import os
from pathlib import Path
import subprocess
import sys
import uuid
import sqlalchemy as sa
from sqlalchemy.engine import make_url

root = Path(__file__).resolve().parents[1]
url = make_url(os.environ["TEST_POSTGRES_ADMIN_URL"])
if url.get_backend_name() != "postgresql" or url.host not in {"127.0.0.1", "localhost", "::1"} or url.database != "postgres":
    raise RuntimeError("An explicitly configured disposable loopback PostgreSQL cluster is required")
name = "nbai_rehearsal_browser_" + uuid.uuid4().hex
admin = sa.create_engine(url, isolation_level="AUTOCOMMIT")
with admin.connect() as conn:
    conn.exec_driver_sql(f'CREATE DATABASE "{name}"')
os.environ.update(DATABASE_URL=url.set(database=name).render_as_string(hide_password=False), APP_ENV="test",
    SECRET_KEY="household-browser-test-only", FRONTEND_URL="http://127.0.0.1:4173", CORS_ORIGINS="http://127.0.0.1:4173",
    RESEND_API_KEY="", SMTP_HOST="", OPENAI_API_KEY="", REDIS_URL="", DOCUMENT_STORAGE_BACKEND="local")
try:
    subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"], cwd=root, check=True)
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8010)
finally:
    with admin.connect() as conn:
        conn.exec_driver_sql(f'DROP DATABASE "{name}" WITH (FORCE)')
    admin.dispose()
