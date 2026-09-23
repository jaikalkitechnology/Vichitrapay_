# crud/tsp.py
import uuid
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.models import TspProvider, MerchantTspSetting, ProviderCredential, TspDirectionEnum, india_tz
from datetime import datetime

def create_provider(db: Session, name: str, code: str, description: Optional[str] = None,
                    default_direction: TspDirectionEnum = TspDirectionEnum.BOTH,
                    capabilities: Optional[dict] = None) -> TspProvider:
    prov = TspProvider(
        name=name.strip(),
        code=code.strip(),
        description=description,
        default_direction=default_direction,
        capabilities=capabilities or {}
    )
    db.add(prov)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValueError("Provider with same name or code already exists") from e
    db.refresh(prov)
    return prov

def get_provider(db: Session, provider_id: int) -> Optional[TspProvider]:
    return db.query(TspProvider).filter(TspProvider.id == provider_id).first()

def get_provider_by_code(db: Session, code: str) -> Optional[TspProvider]:
    return db.query(TspProvider).filter(TspProvider.code == code).first()

def list_providers(db: Session, skip: int = 0, limit: int = 100, q: Optional[str] = None) -> Tuple[List[TspProvider], int]:
    query = db.query(TspProvider)
    if q:
        qterm = f"%{q}%"
        query = query.filter((TspProvider.name.ilike(qterm)) | (TspProvider.code.ilike(qterm)))
    total = query.count()
    items = query.order_by(TspProvider.created_at.desc()).offset(skip).limit(limit).all()
    return items, total

def update_provider(db: Session, provider_id: int, payload: Dict[str, Any]) -> TspProvider:
    prov = get_provider(db, provider_id)
    if not prov:
        raise ValueError("Provider not found")
    # only allow certain fields
    allowed = {"name", "code", "description", "default_direction", "status", "capabilities"}
    for k, v in payload.items():
        if k in allowed:
            setattr(prov, k, v)
    prov.updated_at = datetime.now()
    db.add(prov)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValueError("Update conflict (maybe duplicate name/code)") from e
    db.refresh(prov)
    return prov

def delete_provider(db: Session, provider_id: int) -> bool:
    prov = get_provider(db, provider_id)
    if not prov:
        return False
    db.delete(prov)
    db.commit()
    return True

# ---------------- Merchant mappings (MerchantTspSetting) ----------------

# def create_merchant_tsp_setting(db: Session,
#                                 merchant_id: str,
#                                 provider_id: int,
#                                 direction: TspDirectionEnum,
#                                 enabled: bool = True,
#                                 priority: int = 100,
#                                 config: Optional[dict] = None,
#                                 min_amount: Optional[float] = None,
#                                 max_amount: Optional[float] = None) -> MerchantTspSetting:
#     # ensure uniqueness handled by DB unique constraint (merchant_id, provider_id, direction)
#     mapping = MerchantTspSetting(
#         merchant_id=merchant_id,
#         provider_id=provider_id,
#         direction=direction,
#         enabled=enabled,
#         priority=priority,
#         config=config or {},
#         min_amount=min_amount,
#         max_amount=max_amount
#     )
#     db.add(mapping)
#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise ValueError("Mapping already exists for this merchant/provider/direction") from e
#     db.refresh(mapping)
#     return mapping

def get_merchant_tsp_setting(db: Session, mapping_id: int) -> Optional[MerchantTspSetting]:
    return db.query(MerchantTspSetting).filter(MerchantTspSetting.id == mapping_id).first()

def list_merchant_tsp_settings(db: Session,
                              merchant_id: Optional[str] = None,
                              provider_id: Optional[int] = None,
                              enabled: Optional[bool] = None,
                              skip: int = 0,
                              limit: int = 100) -> Tuple[List[MerchantTspSetting], int]:
    q = db.query(MerchantTspSetting)
    if merchant_id:
        q = q.filter(MerchantTspSetting.merchant_id == merchant_id)
    if provider_id:
        q = q.filter(MerchantTspSetting.provider_id == provider_id)
    if enabled is not None:
        q = q.filter(MerchantTspSetting.enabled == enabled)
    total = q.count()
    items = q.order_by(MerchantTspSetting.priority.asc(), MerchantTspSetting.created_at.desc()).offset(skip).limit(limit).all()
    return items, total

# def update_merchant_tsp_setting(db: Session, mapping_id: int, payload: Dict[str, Any]) -> MerchantTspSetting:
#     mapping = get_merchant_tsp_setting(db, mapping_id)
#     if not mapping:
#         raise ValueError("Mapping not found")
#     allowed = {"enabled", "priority", "config", "min_amount", "max_amount", "direction"}
#     for k, v in payload.items():
#         if k in allowed:
#             setattr(mapping, k, v)
#     mapping.updated_at = datetime.now()
#     db.add(mapping)
#     db.commit()
#     db.refresh(mapping)
#     return mapping

def delete_merchant_tsp_setting(db: Session, mapping_id: int) -> bool:
    mapping = get_merchant_tsp_setting(db, mapping_id)
    if not mapping:
        return False

    # Find provider credentials linked to this mapping
    existing = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == mapping.merchant_id,
            ProviderCredential.provider_id == mapping.provider_id,
        )
        .first()
    )

    # Delete the mapping
    db.delete(mapping)

    # Delete provider credentials ONLY if they exist
    if existing:
        db.delete(existing)

    db.commit()
    return True

# ProviderCredentials helpers (optional)
def list_provider_credentials(db: Session, merchant_id: Optional[str] = None, provider_id: Optional[int] = None):
    q = db.query(ProviderCredential)
    if merchant_id:
        q = q.filter(ProviderCredential.merchant_id == merchant_id)
    if provider_id:
        q = q.filter(ProviderCredential.provider_id == provider_id)
    return q.order_by(ProviderCredential.created_at.desc()).all()

def get_provider_credential(db: Session, credential_id: int):
    return db.query(ProviderCredential).filter(ProviderCredential.id == credential_id).first()

def upsert_provider_credentials(
    db: Session,
    merchant_id: str,
    provider_id: int,
    cfg: Optional[Dict[str, Any]] = None,
) -> ProviderCredential:
    """
    Upsert provider credentials for given merchant+provider.
    cfg keys consumed:
      - payIn_mid (str)
      - payOut_mid (str)
      - is_active_payIn (bool)
      - is_active_payOut (bool)

    If credential row exists (by merchant_id+provider_id) update fields.
    If not exists, create with generated client_id/secret_key/salt keys and
    use provided mids or auto-generated placeholders (to satisfy not-null/unique).
    """
    cfg = cfg or {}
    payIn_mid = cfg.get("payIn_mid") or None
    payOut_mid = cfg.get("payOut_mid") or None
    is_active_payIn = bool(cfg.get("is_active_payIn", False))
    is_active_payOut = bool(cfg.get("is_active_payOut", False))

    # validation: if marked active, MID must be provided
    if is_active_payIn and not payIn_mid:
        raise ValueError("payIn_mid is required when is_active_payIn is true")
    if is_active_payOut and not payOut_mid:
        raise ValueError("payOut_mid is required when is_active_payOut is true")

    # find existing by merchant_id + provider_id
    existing = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            ProviderCredential.provider_id == provider_id,
        )
        .first()
    )

    try:
        if existing:
            # Update only relevant fields. Keep unique generated keys unchanged.
            if payIn_mid:
                existing.payIn_mid = payIn_mid
            if payOut_mid:
                existing.payOut_mid = payOut_mid
            existing.is_active_payIn = is_active_payIn
            existing.is_active_payOut = is_active_payOut
            existing.credential_meta = cfg.get("credential_meta", existing.credential_meta)
            existing.secret_store_key = cfg.get("secret_store_key", existing.secret_store_key)
            existing.updated_at = datetime.now(india_tz)
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # generate placeholders ensuring unique not-NULL values for payIn/payOut mids
            # prefer provided MID; else generate unique placeholder
            new_payIn_mid = payIn_mid or f"auto-payin-{uuid.uuid4().hex[:12]}"
            new_payOut_mid = payOut_mid or f"auto-payout-{uuid.uuid4().hex[:12]}"

            cred = ProviderCredential(
                merchant_id=merchant_id,
                provider_id=provider_id,

                # Add your prefix here
                client_id=f"liveID_{uuid.uuid4().hex}",
                secret_key=f"livePASS_{uuid.uuid4().hex}",

                salt_key1=str(uuid.uuid4()),
                salt_key2=str(uuid.uuid4()),
                salt_key3=str(uuid.uuid4()),

                payIn_mid=new_payIn_mid,
                payOut_mid=new_payOut_mid,

                secret_store_key=cfg.get("secret_store_key"),
                credential_meta=cfg.get("credential_meta"),
                is_active_payIn=is_active_payIn,
                is_active_payOut=is_active_payOut,
                created_at=datetime.now(india_tz),
                updated_at=datetime.now(india_tz),
            )

            db.add(cred)
            db.commit()
            db.refresh(cred)
            return cred

    except IntegrityError as ie:
        db.rollback()
        # common cause - unique constraint violation on payIn_mid / payOut_mid or client id collision
        raise ValueError(f"Failed to create/update provider credentials: {str(ie.orig)}")


def update_merchant_tsp_setting(db: Session, mapping_id: int, payload: Dict[str, Any]) -> MerchantTspSetting:
    mapping = get_merchant_tsp_setting(db, mapping_id)
    if not mapping:
        raise ValueError("Mapping not found")

    allowed = {"enabled", "priority", "config", "min_amount", "max_amount", "direction"}
    changed = False
    for k, v in payload.items():
        if k in allowed:
            setattr(mapping, k, v)
            changed = True

    mapping.updated_at = datetime.now(india_tz)
    try:
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
    except IntegrityError as ie:
        db.rollback()
        raise ValueError(f"Failed to update mapping: {str(ie.orig)}")

    # If config was supplied, upsert provider credentials
    if "config" in payload:
        cfg = payload.get("config") or {}
        try:
            upsert_provider_credentials(db, mapping.merchant_id, mapping.provider_id, cfg)
        except ValueError as e:
            # optionally rollback mapping update if credentials error is fatal for you
            # If you prefer not to rollback mapping, just surface the error
            raise ValueError(f"Mapping updated but provider credential upsert failed: {str(e)}")

    return mapping
def create_merchant_tsp_setting(
    db: Session,
    merchant_id: str,
    provider_id: int,
    direction: str,
    enabled: bool = True,
    priority: int = 100,
    config: Optional[Dict[str, Any]] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
) -> MerchantTspSetting:
    # basic duplication check (optional) - prevent creating multiple identical mapping rows
    existing = (
        db.query(MerchantTspSetting)
        .filter(
            MerchantTspSetting.merchant_id == merchant_id,
            MerchantTspSetting.provider_id == provider_id,
            MerchantTspSetting.direction == direction,
        )
        .first()
    )
    if existing:
        raise ValueError("Mapping already exists for this merchant/provider/direction")

    mapping = MerchantTspSetting(
        merchant_id=merchant_id,
        provider_id=provider_id,
        direction=direction,
        enabled=enabled,
        priority=priority,
        config=config or {},
        min_amount=min_amount,
        max_amount=max_amount,

    )
    try:
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
    except IntegrityError as ie:
        db.rollback()
        raise ValueError(f"Failed to create mapping: {str(ie.orig)}")

    # Upsert provider credentials using config (if config present or to create placeholders)
    try:
        upsert_provider_credentials(db, merchant_id, provider_id, config)
    except ValueError as e:
        # If credentials fail (validation or unique constraint), you may want to:
        #  - rollback mapping creation (already committed above) OR
        #  - keep mapping and report credentials failure.
        # Here we choose to rollback mapping to keep system consistent.
        db.delete(mapping)
        db.commit()
        raise ValueError(f"Mapping created but provider credential upsert failed: {str(e)}")

    # return the mapping object (fresh)
    return mapping
