import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60