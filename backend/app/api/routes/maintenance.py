from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceOut
from app.crud.maintenance import (
    get_maintenance,
    get_maintenance_logs,
    create_maintenance,
    update_maintenance,
    close_maintenance,
)
from app.models.maintenance import MaintenanceStatus
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])

MANAGE_ROLES = [RoleEnum.FLEET_MANAGER]


@router.get("/", response_model=List[MaintenanceOut])
def list_maintenance(
    vehicle_id: Optional[str] = None,
    status_filter: Optional[MaintenanceStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_maintenance_logs(db, vehicle_id=vehicle_id, status=status_filter, skip=skip, limit=limit)


@router.get("/{maintenance_id}", response_model=MaintenanceOut)
def get_maintenance_detail(
    maintenance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = get_maintenance(db, maintenance_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return record


@router.post("/", response_model=MaintenanceOut, status_code=201)
def create_maintenance_endpoint(
    maintenance_in: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    return create_maintenance(db, maintenance_in)


@router.patch("/{maintenance_id}", response_model=MaintenanceOut)
def update_maintenance_endpoint(
    maintenance_id: str,
    update_in: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    record = get_maintenance(db, maintenance_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return update_maintenance(db, record, update_in)


@router.post("/{maintenance_id}/close", response_model=MaintenanceOut)
def close_maintenance_endpoint(
    maintenance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    record = get_maintenance(db, maintenance_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return close_maintenance(db, record)
