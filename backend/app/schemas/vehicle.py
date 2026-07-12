from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.vehicle import VehicleStatus, VehicleType


class VehicleBase(BaseModel):
    registration_number: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=1, max_length=120)
    model: Optional[str] = None
    type: VehicleType
    max_load_capacity: float = Field(..., gt=0)
    acquisition_cost: float = Field(..., ge=0)
    region: Optional[str] = None

    @field_validator("registration_number")
    @classmethod
    def normalize_reg_number(cls, v: str) -> str:
        return v.strip().upper()


class VehicleCreate(VehicleBase):
    odometer: float = Field(default=0.0, ge=0)


class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    type: Optional[VehicleType] = None
    max_load_capacity: Optional[float] = Field(default=None, gt=0)
    odometer: Optional[float] = Field(default=None, ge=0)
    acquisition_cost: Optional[float] = Field(default=None, ge=0)
    status: Optional[VehicleStatus] = None
    region: Optional[str] = None


class VehicleOut(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    odometer: float
    status: VehicleStatus
    created_at: datetime
    updated_at: datetime
