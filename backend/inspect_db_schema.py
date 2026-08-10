from app.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(settings.database_url, future=True)
with engine.connect() as conn:
    print('DATABASE_URL', settings.database_url)
    print('CURRENT', conn.execute(text("SELECT current_database(), current_user")).fetchone())
    print('USERS_COLUMNS')
    for row in conn.execute(text("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position")):
        print(row)
    print('USERS_ROWS')
    for row in conn.execute(text("SELECT id, email, last_login FROM users ORDER BY created_at DESC LIMIT 5")):
        print(row)
