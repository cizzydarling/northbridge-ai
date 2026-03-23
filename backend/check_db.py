from app.data.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
        )
    )
    tables = result.fetchall()

print("Tables in DB:")
for t in tables:
    print(t[0])