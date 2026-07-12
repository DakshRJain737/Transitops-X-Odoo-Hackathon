from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.maintenance import MaintenanceStatus, MaintenanceType


class MaintenanceBase(BaseModel):
    vehicle_id: str
    maintenance_type: MaintenanceType
    description: Optional[str] = None
    cost: float = Field(default=0.0, ge=0)


class MaintenanceCreate(MaintenanceBase):
    pass


class MaintenanceUpdate(BaseModel):
    description: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)


class MaintenanceOut(MaintenanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: MaintenanceStatus
    started_at: datetime
    closed_at: Optional[datetime] = None
