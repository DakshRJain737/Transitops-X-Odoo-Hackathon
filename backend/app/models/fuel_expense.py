import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Date, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ExpenseType(str, enum.Enum):
    TOLL = "toll"
    REPAIR = "repair"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=False)
    trip_id = Column(String(36), ForeignKey("trips.id"), nullable=True)

    liters = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vehicle = relationship("Vehicle", back_populates="fuel_logs")
    trip = relationship("Trip", back_populates="fuel_logs")

    def __repr__(self):
        return f"<FuelLog {self.liters}L (${self.cost})>"


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=False)

    expense_type = Column(Enum(ExpenseType), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vehicle = relationship("Vehicle", back_populates="expenses")

    def __repr__(self):
        return f"<Expense {self.expense_type} (${self.amount})>"
