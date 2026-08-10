from app.database import SessionLocal
from app.models import User
from app.security import verify_password
from app.routers.auth import login
from app.schemas import UserLogin
from datetime import datetime, timezone


db = SessionLocal()
try:
    user = db.query(User).filter(User.email == 'user@example.com').first()
    print('USER', user)
    if user:
        print('PASSWORD_OK', verify_password('password', user.hashed_password))
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        print('COMMIT_OK')
finally:
    db.close()
