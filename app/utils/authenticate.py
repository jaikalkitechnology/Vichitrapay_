import hashlib
from datetime import datetime, timedelta, timezone
from math import floor
from pathlib import Path

from jose import JWTError, jwt, ExpiredSignatureError
from fastapi import HTTPException, Depends, Request, UploadFile
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import or_, insert
from sqlalchemy.orm import Session
from starlette import status
from starlette.responses import RedirectResponse
import logging
from models.models import User
#from app.crud.authenticate import get_user
from .database import get_db

import pytz
from passlib.context import CryptContext
# Set India time zone (IST)
india_tz = pytz.timezone('Asia/Kolkata')

# ✅ JWT Config
SECRET_KEY = "youggigigi867564secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 180

# ✅ OAuth2 Password Bearer (For Token Auth)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
log = logging.getLogger(__name__)

# ✅ Hash password
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# ✅ Verify password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def save_file(file: UploadFile, folder: str):
    folder_path = Path(folder)
    folder_path.mkdir(parents=True, exist_ok=True)

    file_path = folder_path / file.filename
    with file_path.open("wb") as buffer:
        buffer.write(file.file.read())

    return str(file_path)

def flash(request: Request, message: str, category: str = "info"):
    if "_messages" not in request.session:
        request.session["_messages"] = []
    request.session["_messages"].append({"message": message, "category": category})

def get_messages(request: Request):
    messages = request.session.pop("_messages", [])
    return [(msg["message"], msg["category"]) for msg in messages]


def get_user(db: Session, username: str = None):
    query = db.query(User)

    if username:
        query = query.filter(
            or_(
                User.username == username,
                User.email == username
            )
        )

    user = query.first()
    #print(f"User found: {user}")  # ✅ Add this for debugging
    return user


def credentials_exception(detail: str = "Could not validate credentials"):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )

# --- Create token: ensure 'sub' is present (username or id) ---
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    # IMPORTANT: ensure caller sets "sub" in `data` (username or id). Example: {"sub": user.username}
    log.debug("Creating token with payload: %s", to_encode)
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Authenticate user (unchanged) ---
def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username=username)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

# --- Decode token and return User ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise credentials_exception("Missing authentication token")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise credentials_exception("Token expired. Please login again.")
    except JWTError as e:
        log.warning("Invalid token decode: %s", e)
        raise credentials_exception("Invalid token")

    # Debug/log the payload (temporary while debugging)
    log.debug("Decoded token payload: %s", payload)

    sub = payload.get("sub")
    if not sub:
        raise credentials_exception("Token payload missing 'sub' claim")

    # Try int id then fallback to username — makes tokens flexible
    user = None
    try:
        user_id = int(sub)
        user = get_user(db, id=user_id)
    except (ValueError, TypeError):
        user = get_user(db, username=sub)

    log.debug("Token sub=%s -> user found=%s", sub, bool(user))
    if not user:
        raise credentials_exception("User not found for token")

    return user

# --- Role check helpers with clear messages and constants ---
# Set these constants to match your DB values
ROLE_ADMIN = 3   # <-- adjust if your admin role is 1 or "admin"
ROLE_USER = 2    # <-- adjust if needed

def user_required(user: User = Depends(get_current_user)) -> User:
    if getattr(user, "role", None) != ROLE_USER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Users only")
    return user

def admin_required(user: User = Depends(get_current_user)) -> User:
    if getattr(user, "role", None) != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Admins only")
    return user

def check_user_role(required_role: int):
    def role_checker(user: User = Depends(get_current_user)):
        if getattr(user, "role", None) != required_role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Insufficient permissions")
        return user
    return role_checker









