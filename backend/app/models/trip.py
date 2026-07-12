import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class TripStatus(str, enum.Enum):
    DRAFT = "draft"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    source = Column(String(150), nullable=False)
    destination = Column(String(150), nullable=False)

    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=False)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False)

    cargo_weight = Column(Float, nullable=False)  # in kg
    planned_distance = Column(Float, nullable=False)  # in km
    actual_distance = Column(Float, nullable=True)  # filled on completion
    fuel_consumed = Column(Float, nullable=True)  # in liters, filled on completion

    status = Column(Enum(TripStatus), default=TripStatus.DRAFT, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    dispatched_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    vehicle = relationship("Vehicle", back_populates="trips")
    driver = relationship("Driver", back_populates="trips")
    fuel_logs = relationship("FuelLog", back_populates="trip")

    def __repr__(self):
        return f"<Trip {self.source} -> {self.destination} ({self.status})>"
