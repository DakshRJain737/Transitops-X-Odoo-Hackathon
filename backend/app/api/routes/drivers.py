from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.driver import DriverCreate, DriverUpdate, DriverOut
from app.crud.driver import (
    get_driver,
    get_driver_by_license,
    get_drivers,
    get_assignable_drivers,
    create_driver,
    update_driver,
    delete_driver,
)
from app.models.driver import DriverStatus
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/drivers", tags=["Drivers"])

MANAGE_ROLES = [RoleEnum.FLEET_MANAGER, RoleEnum.SAFETY_OFFICER]


@router.get("/", response_model=List[DriverOut])
def list_drivers(
    status_filter: Optional[DriverStatus] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_drivers(db, status=status_filter, search=search, sort_by=sort_by, order=order, skip=skip, limit=limit)


@router.get("/assignable", response_model=List[DriverOut])
def list_assignable_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_assignable_drivers(db)


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver_detail(
    driver_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.post("/", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver_endpoint(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    existing = get_driver_by_license(db, driver_in.license_number)
    if existing:
        raise HTTPException(status_code=400, detail="License number already exists")
    return create_driver(db, driver_in)


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver_endpoint(
    driver_id: str,
    driver_in: DriverUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    driver = get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return update_driver(db, driver, driver_in)


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver_endpoint(
    driver_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    driver = get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    delete_driver(db, driver)
    return None
