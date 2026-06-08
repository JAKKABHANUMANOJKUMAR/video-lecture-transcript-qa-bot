"""Create the PostgreSQL database if it does not already exist.

Usage:
    python create_db.py
"""

import sys

import psycopg
from psycopg import sql

from app.config import settings


def main() -> None:
    # Connect to the default 'postgres' maintenance database
    try:
        conn = psycopg.connect(
            host=settings.POSTGRES_SERVER,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname="postgres",
            autocommit=True,
        )
    except psycopg.OperationalError as exc:
        print(f"Could not connect to PostgreSQL: {exc}")
        sys.exit(1)

    with conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (settings.POSTGRES_DB,))
        exists = cur.fetchone()
        if exists:
            print(f"Database '{settings.POSTGRES_DB}' already exists.")
        else:
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(settings.POSTGRES_DB)))
            print(f"Database '{settings.POSTGRES_DB}' created.")
    conn.close()


if __name__ == "__main__":
    main()
