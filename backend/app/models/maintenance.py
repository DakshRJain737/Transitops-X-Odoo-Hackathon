import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class MaintenanceStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class MaintenanceType(str, enum.Enum):
    OIL_CHANGE = "oil_change"
    BRAKE_SERVICE = "brake_service"
    TYRE_REPLACEMENT = "tyre_replacement"
    GENERAL_SERVICE = "general_service"
    REPAIR = "repair"
    OTHER = "other"


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=False)

    maintenance_type = Column(Enum(MaintenanceType), nullable=False)
    description = Column(Text, nullable=True)
    cost = Column(Float, default=0.0, nullable=False)

    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.ACTIVE, nullable=False)

    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime, nullable=True)

    vehicle = relationship("Vehicle", back_populates="maintenance_logs")

    def __repr__(self):
        return f"<MaintenanceLog {self.maintenance_type} ({self.status})>"
