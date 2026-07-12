import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Integer, Enum, DateTime
from sqlalchemy.orm import relationship

from app.db.base import Base


class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    IN_SHOP = "in_shop"
    RETIRED = "retired"


class VehicleType(str, enum.Enum):
    TRUCK = "truck"
    VAN = "van"
    MINI_TRUCK = "mini_truck"
    TRAILER = "trailer"
    BIKE = "bike"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    registration_number = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    model = Column(String(120), nullable=True)
    type = Column(Enum(VehicleType), nullable=False)

    max_load_capacity = Column(Float, nullable=False)  # in kg
    odometer = Column(Float, default=0.0, nullable=False)  # in km
    acquisition_cost = Column(Float, nullable=False)

    status = Column(Enum(VehicleStatus), default=VehicleStatus.AVAILABLE, nullable=False)
    region = Column(String(100), nullable=True)
    documents_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    trips = relationship("Trip", back_populates="vehicle", cascade="all, delete-orphan")
    maintenance_logs = relationship("MaintenanceLog", back_populates="vehicle", cascade="all, delete-orphan")
    fuel_logs = relationship("FuelLog", back_populates="vehicle", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="vehicle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Vehicle {self.registration_number} ({self.status})>"
