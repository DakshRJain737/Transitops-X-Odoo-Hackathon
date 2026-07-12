from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.vehicle import Vehicle, VehicleStatus, VehicleType
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def get_vehicle(db: Session, vehicle_id: str) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()


def get_vehicle_by_reg_number(db: Session, reg_number: str) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.registration_number == reg_number).first()


def get_vehicles(
    db: Session,
    status: Optional[VehicleStatus] = None,
    vehicle_type: Optional[VehicleType] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 100,
) -> List[Vehicle]:
    query = db.query(Vehicle)
    if status:
        query = query.filter(Vehicle.status == status)
    if vehicle_type:
        query = query.filter(Vehicle.type == vehicle_type)
    if region:
        query = query.filter(Vehicle.region == region)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Vehicle.registration_number.ilike(search_term),
                Vehicle.name.ilike(search_term),
                Vehicle.model.ilike(search_term),
                Vehicle.region.ilike(search_term),
            )
        )
    sort_column = getattr(Vehicle, sort_by, None)
    if sort_column is None:
        sort_column = Vehicle.created_at
    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    return query.offset(skip).limit(limit).all()


def get_dispatchable_vehicles(db: Session) -> List[Vehicle]:
    """Only vehicles that can be assigned to a new trip."""
    return db.query(Vehicle).filter(Vehicle.status == VehicleStatus.AVAILABLE).all()


def create_vehicle(db: Session, vehicle_in: VehicleCreate) -> Vehicle:
    vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def update_vehicle(db: Session, vehicle: Vehicle, vehicle_in: VehicleUpdate) -> Vehicle:
    update_data = vehicle_in.model_dump(exclude_unset=True)
    from fastapi import HTTPException, status
    from app.models.trip import Trip, TripStatus

    if "status" in update_data:
        if update_data["status"] == VehicleStatus.ON_TRIP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vehicle status cannot be set to on_trip directly; use the trip dispatch workflow",
            )
        if update_data["status"] == VehicleStatus.AVAILABLE:
            active_trip = (
                db.query(Trip)
                .filter(Trip.vehicle_id == vehicle.id, Trip.status == TripStatus.DISPATCHED)
                .first()
            )
            if active_trip:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set a vehicle to available while a trip is in progress",
                )

    for field, value in update_data.items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(db: Session, vehicle: Vehicle) -> None:
    db.delete(vehicle)
    db.commit()
