"""Seed default demo accounts so the frontend works out of the box."""

from sqlalchemy.orm import Session

from app.models import User
from app.security import hash_password

DEMO_ACCOUNTS = [
    {
        "full_name": "Admin User",
        "email": "admin@example.com",
        "password": "password",
        "role": "admin",
    },
    {
        "full_name": "Demo User",
        "email": "user@example.com",
        "password": "password",
        "role": "user",
    },
    {
        "full_name": "Load Test User",
        "email": "loadtest@example.com",
        "password": "LoadTest123!",
        "role": "user",
    },
]


def seed_demo_accounts(db: Session) -> None:
    for account in DEMO_ACCOUNTS:
        exists = db.query(User).filter(User.email == account["email"]).first()
        if exists:
            continue
        db.add(
            User(
                full_name=account["full_name"],
                email=account["email"],
                hashed_password=hash_password(account["password"]),
                role=account["role"],
                status="active",
                auth_provider="local",
            )
        )
    db.commit()
