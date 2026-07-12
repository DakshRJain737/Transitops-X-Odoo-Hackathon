from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleOut
from app.crud.vehicle import (
    get_vehicle,
    get_vehicle_by_reg_number,
    get_vehicles,
    get_dispatchable_vehicles,
    create_vehicle,
    update_vehicle,
    delete_vehicle,
)
from app.models.vehicle import VehicleStatus
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])

MANAGE_ROLES = [RoleEnum.FLEET_MANAGER]  # Admin always passes via require_roles


@router.get("/", response_model=List[VehicleOut])
def list_vehicles(
    status_filter: Optional[VehicleStatus] = None,
    vehicle_type: Optional[str] = None,
    region: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_vehicles(db, status=status_filter, vehicle_type=vehicle_type, region=region, skip=skip, limit=limit)


@router.get("/dispatchable", response_model=List[VehicleOut])
def list_dispatchable_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vehicles eligible for a new trip (Available only)."""
    return get_dispatchable_vehicles(db)


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle_detail(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle_endpoint(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    existing = get_vehicle_by_reg_number(db, vehicle_in.registration_number)
    if existing:
        raise HTTPException(status_code=400, detail="Registration number already exists")
    return create_vehicle(db, vehicle_in)


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle_endpoint(
    vehicle_id: str,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return update_vehicle(db, vehicle, vehicle_in)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle_endpoint(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(MANAGE_ROLES)),
):
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    delete_vehicle(db, vehicle)
    return None
