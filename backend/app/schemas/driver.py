from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.driver import DriverStatus


class DriverBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    license_number: str = Field(..., min_length=2, max_length=50)
    license_category: str = Field(..., min_length=1, max_length=20)
    license_expiry_date: date
    contact_number: str = Field(..., min_length=7, max_length=20)


class DriverCreate(DriverBase):
    safety_score: float = Field(default=100.0, ge=0, le=100)


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    license_number: Optional[str] = None
    license_category: Optional[str] = None
    license_expiry_date: Optional[date] = None
    contact_number: Optional[str] = None
    safety_score: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[DriverStatus] = None


class DriverOut(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    safety_score: float
    status: DriverStatus
    is_license_expired: bool
    created_at: datetime
    updated_at: datetime
