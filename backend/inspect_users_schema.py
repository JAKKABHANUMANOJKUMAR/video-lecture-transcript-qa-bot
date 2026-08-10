import psycopg

conn = psycopg.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='Manojkumar@c1',
    dbname='video_lecture_transcript',
    autocommit=True,
)
cur = conn.cursor()
cur.execute("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position")
print(cur.fetchall())
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
print(cur.fetchall())
conn.close()
