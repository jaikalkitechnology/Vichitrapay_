from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from utils.authenticate import authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from utils.database import get_db
from utils.features import PARTNER_DISABLED_MSG, PARTNER_PANEL_ENABLED

router = APIRouter()




@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if user.role == 1 and not PARTNER_PANEL_ENABLED:
        raise HTTPException(status_code=403, detail=PARTNER_DISABLED_MSG)

    access_token = create_access_token(data={"sub": user.username, "role": user.role})

    expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "expires_in": expires_in,
        "expires_at": expires_at.isoformat(),
    }
