from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.fuel_expense import ExpenseType


# ---------- Fuel Log ----------

class FuelLogBase(BaseModel):
    vehicle_id: str
    trip_id: Optional[str] = None
    liters: float = Field(..., gt=0)
    cost: float = Field(..., ge=0)
    date: date


class FuelLogCreate(FuelLogBase):
    pass


class FuelLogOut(FuelLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


# ---------- Expense ----------

class ExpenseBase(BaseModel):
    vehicle_id: str
    expense_type: ExpenseType
    amount: float = Field(..., ge=0)
    description: Optional[str] = None
    date: date


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseOut(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
