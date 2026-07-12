from typing import Any, List, Optional, Union

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
from app.models.vehicle import Vehicle, VehicleStatus, VehicleType
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])

MANAGE_ROLES = [RoleEnum.FLEET_MANAGER]  # Admin always passes via require_roles


@router.get("/", response_model=Union[List[VehicleOut], dict[str, Any]])
def list_vehicles(
    status_filter: Optional[VehicleStatus] = None,
    vehicle_type: Optional[VehicleType] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    include_meta: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = get_vehicles(
        db,
        status=status_filter,
        vehicle_type=vehicle_type,
        region=region,
        search=search,
        sort_by=sort_by,
        order=order,
        skip=skip,
        limit=limit,
    )
    if include_meta:
        count_query = db.query(Vehicle)
        if status_filter:
            count_query = count_query.filter(Vehicle.status == status_filter)
        if vehicle_type:
            count_query = count_query.filter(Vehicle.type == vehicle_type)
        if region:
            count_query = count_query.filter(Vehicle.region == region)
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            count_query = count_query.filter(
                db.query(Vehicle)
                .filter(
                    (Vehicle.registration_number.ilike(search_term))
                    | (Vehicle.name.ilike(search_term))
                    | (Vehicle.model.ilike(search_term))
                    | (Vehicle.region.ilike(search_term))
                )
                .exists()
            )
        total_count = count_query.count()
        return {
            "items": items,
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total_count": total_count,
                "has_more": (skip + len(items)) < total_count,
            },
        }
    return items


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
