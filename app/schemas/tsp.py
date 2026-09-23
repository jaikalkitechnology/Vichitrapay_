from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models.models import TspDirectionEnum, TspStatusEnum


class ProviderCreate(BaseModel):
    name: str = Field(..., max_length=120)
    code: str = Field(..., max_length=60)
    description: Optional[str] = None
    default_direction: Optional[TspDirectionEnum] = TspDirectionEnum.BOTH
    capabilities: Optional[dict] = None

class ProviderOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str]
    default_direction: TspDirectionEnum
    status: Optional[TspStatusEnum]
    capabilities: Optional[dict]
    created_at: Optional[datetime]  # ⬅️ yaha change
    updated_at: Optional[datetime]  # ⬅️ yaha change

    class Config:
        from_attribute = True

class ProviderUpdate(BaseModel):
    name: Optional[str]
    code: Optional[str]
    description: Optional[str]
    default_direction: Optional[TspDirectionEnum]
    status: Optional[TspStatusEnum]
    capabilities: Optional[dict]

class MappingCreate(BaseModel):
    merchant_id: str
    provider_id: int
    direction: TspDirectionEnum
    enabled: Optional[bool] = True
    priority: Optional[int] = 100
    config: Optional[dict] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None

class MappingOut(BaseModel):
    id: int
    merchant_id: str
    provider_id: int
    direction: TspDirectionEnum
    enabled: bool
    priority: int
    config: Optional[dict]
    min_amount: Optional[float]
    max_amount: Optional[float]
    #provider: Optional[dict]  # provider info (joined relationship)
    provider: Optional[ProviderOut]
    #created_at: Optional[str]
    #updated_at: Optional[str]
    created_at: Optional[datetime]  # FIXED
    updated_at: Optional[datetime]  # FIXED

    class Config:
        from_attribute = True

class MappingUpdate(BaseModel):
    enabled: Optional[bool]
    priority: Optional[int]
    config: Optional[dict]
    min_amount: Optional[float]
    max_amount: Optional[float]
    direction: Optional[TspDirectionEnum]
