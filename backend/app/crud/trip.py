from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.trip import Trip, TripStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver, DriverStatus
from app.schemas.trip import TripCreate, TripCompleteRequest


def get_trip(db: Session, trip_id: str) -> Optional[Trip]:
    return db.query(Trip).filter(Trip.id == trip_id).first()


def get_trips(
    db: Session,
    status: Optional[TripStatus] = None,
    vehicle_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 100,
) -> List[Trip]:
    query = db.query(Trip)
    if status:
        query = query.filter(Trip.status == status)
    if vehicle_id:
        query = query.filter(Trip.vehicle_id == vehicle_id)
    if driver_id:
        query = query.filter(Trip.driver_id == driver_id)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(or_(Trip.source.ilike(search_term), Trip.destination.ilike(search_term)))
    sort_column = getattr(Trip, sort_by, None)
    if sort_column is None:
        sort_column = Trip.created_at
    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    return query.offset(skip).limit(limit).all()


def create_trip(db: Session, trip_in: TripCreate) -> Trip:
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip_in.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    driver = db.query(Driver).filter(Driver.id == trip_in.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if trip_in.cargo_weight > vehicle.max_load_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Cargo weight {trip_in.cargo_weight}kg exceeds vehicle capacity {vehicle.max_load_capacity}kg",
        )

    trip = Trip(**trip_in.model_dump(), status=TripStatus.DRAFT)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def dispatch_trip(db: Session, trip: Trip) -> Trip:
    if trip.status != TripStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only Draft trips can be dispatched")

    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()

    if vehicle.status in (VehicleStatus.RETIRED, VehicleStatus.IN_SHOP):
        raise HTTPException(status_code=400, detail="Vehicle is Retired or In Shop and cannot be dispatched")
    if vehicle.status == VehicleStatus.ON_TRIP:
        raise HTTPException(status_code=400, detail="Vehicle is already on another trip")

    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(status_code=400, detail="Driver is suspended and cannot be assigned")
    if driver.status == DriverStatus.ON_TRIP:
        raise HTTPException(status_code=400, detail="Driver is already on another trip")
    if driver.license_expiry_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Driver's license has expired")

    if trip.cargo_weight > vehicle.max_load_capacity:
        raise HTTPException(status_code=400, detail="Cargo weight exceeds vehicle capacity")

    trip.status = TripStatus.DISPATCHED
    trip.dispatched_at = datetime.now(timezone.utc)
    vehicle.status = VehicleStatus.ON_TRIP
    driver.status = DriverStatus.ON_TRIP

    db.commit()
    db.refresh(trip)
    return trip


def complete_trip(db: Session, trip: Trip, complete_in: TripCompleteRequest) -> Trip:
    if trip.status != TripStatus.DISPATCHED:
        raise HTTPException(status_code=400, detail="Only Dispatched trips can be completed")

    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()

    trip.actual_distance = complete_in.actual_distance
    trip.fuel_consumed = complete_in.fuel_consumed
    trip.status = TripStatus.COMPLETED
    trip.completed_at = datetime.now(timezone.utc)

    vehicle.odometer += complete_in.actual_distance
    vehicle.status = VehicleStatus.AVAILABLE
    driver.status = DriverStatus.AVAILABLE

    db.commit()
    db.refresh(trip)
    return trip


def cancel_trip(db: Session, trip: Trip) -> Trip:
    if trip.status not in (TripStatus.DRAFT, TripStatus.DISPATCHED):
        raise HTTPException(status_code=400, detail="Only Draft or Dispatched trips can be cancelled")

    if trip.status == TripStatus.DISPATCHED:
        vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
        driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
        vehicle.status = VehicleStatus.AVAILABLE
        driver.status = DriverStatus.AVAILABLE

    trip.status = TripStatus.CANCELLED
    trip.cancelled_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(trip)
    return trip
