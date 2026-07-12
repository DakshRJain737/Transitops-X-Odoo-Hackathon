from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.trip import TripCreate, TripCompleteRequest, TripOut
from app.crud.trip import get_trip, get_trips, create_trip, dispatch_trip, complete_trip, cancel_trip
from app.models.trip import TripStatus
from app.models.user import User, RoleEnum
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/trips", tags=["Trips"])

DISPATCH_ROLES = [RoleEnum.DRIVER, RoleEnum.FLEET_MANAGER]


@router.get("/", response_model=List[TripOut])
def list_trips(
    status_filter: Optional[TripStatus] = None,
    vehicle_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_trips(db, status=status_filter, vehicle_id=vehicle_id, driver_id=driver_id, skip=skip, limit=limit)


@router.get("/{trip_id}", response_model=TripOut)
def get_trip_detail(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.post("/", response_model=TripOut, status_code=201)
def create_trip_endpoint(
    trip_in: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(DISPATCH_ROLES)),
):
    return create_trip(db, trip_in)


@router.post("/{trip_id}/dispatch", response_model=TripOut)
def dispatch_trip_endpoint(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(DISPATCH_ROLES)),
):
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return dispatch_trip(db, trip)


@router.post("/{trip_id}/complete", response_model=TripOut)
def complete_trip_endpoint(
    trip_id: str,
    complete_in: TripCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(DISPATCH_ROLES)),
):
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return complete_trip(db, trip, complete_in)


@router.post("/{trip_id}/cancel", response_model=TripOut)
def cancel_trip_endpoint(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(DISPATCH_ROLES)),
):
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return cancel_trip(db, trip)
