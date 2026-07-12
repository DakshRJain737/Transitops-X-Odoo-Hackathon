from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.trip import TripStatus


class TripBase(BaseModel):
    source: str = Field(..., min_length=1, max_length=150)
    destination: str = Field(..., min_length=1, max_length=150)
    vehicle_id: str
    driver_id: str
    cargo_weight: float = Field(..., gt=0)
    planned_distance: float = Field(..., gt=0)


class TripCreate(TripBase):
    pass


class TripCompleteRequest(BaseModel):
    actual_distance: float = Field(..., gt=0)
    fuel_consumed: float = Field(..., gt=0)


class TripOut(TripBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: TripStatus
    actual_distance: Optional[float] = None
    fuel_consumed: Optional[float] = None
    created_at: datetime
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
