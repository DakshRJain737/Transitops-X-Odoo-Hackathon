import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Date, Enum, DateTime
from sqlalchemy.orm import relationship

from app.db.base import Base


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"
    SUSPENDED = "suspended"


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(120), nullable=False)
    license_number = Column(String(50), unique=True, index=True, nullable=False)
    license_category = Column(String(20), nullable=False)  # e.g. LMV, HMV
    license_expiry_date = Column(Date, nullable=False)

    contact_number = Column(String(20), nullable=False)
    safety_score = Column(Float, default=100.0, nullable=False)  # 0-100 scale
    status = Column(Enum(DriverStatus), default=DriverStatus.AVAILABLE, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    trips = relationship("Trip", back_populates="driver", cascade="all, delete-orphan")

    @property
    def is_license_expired(self) -> bool:
        return self.license_expiry_date < datetime.now(timezone.utc).date()

    def __repr__(self):
        return f"<Driver {self.name} ({self.status})>"
