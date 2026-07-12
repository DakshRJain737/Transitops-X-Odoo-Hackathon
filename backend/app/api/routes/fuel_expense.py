from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.fuel_expense import FuelLogCreate, FuelLogOut, ExpenseCreate, ExpenseOut
from app.crud.fuel_expense import get_fuel_logs, create_fuel_log, get_expenses, create_expense
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api", tags=["Fuel & Expenses"])

MANAGE_ROLES = [RoleEnum.FLEET_MANAGER, RoleEnum.DRIVER, RoleEnum.FINANCIAL_ANALYST]


@router.get("/fuel-logs", response_model=List[FuelLogOut])
def list_fuel_logs(
    vehicle_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_fuel_logs(db, vehicle_id=vehicle_id, skip=skip, limit=limit)


@router.post("/fuel-logs", response_model=FuelLogOut, status_code=201)
def create_fuel_log_endpoint(
    fuel_in: FuelLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    return create_fuel_log(db, fuel_in)


@router.get("/expenses", response_model=List[ExpenseOut])
def list_expenses(
    vehicle_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_expenses(db, vehicle_id=vehicle_id, skip=skip, limit=limit)


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense_endpoint(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    return create_expense(db, expense_in)
