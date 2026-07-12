from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.fuel_expense import FuelLog, Expense
from app.schemas.fuel_expense import FuelLogCreate, ExpenseCreate


def get_fuel_logs(db: Session, vehicle_id: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[FuelLog]:
    query = db.query(FuelLog)
    if vehicle_id:
        query = query.filter(FuelLog.vehicle_id == vehicle_id)
    return query.order_by(FuelLog.date.desc()).offset(skip).limit(limit).all()


def create_fuel_log(db: Session, fuel_in: FuelLogCreate) -> FuelLog:
    log = FuelLog(**fuel_in.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_expenses(db: Session, vehicle_id: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[Expense]:
    query = db.query(Expense)
    if vehicle_id:
        query = query.filter(Expense.vehicle_id == vehicle_id)
    return query.order_by(Expense.date.desc()).offset(skip).limit(limit).all()


def create_expense(db: Session, expense_in: ExpenseCreate) -> Expense:
    expense = Expense(**expense_in.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense
