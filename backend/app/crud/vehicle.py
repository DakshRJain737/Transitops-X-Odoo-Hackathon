from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def get_vehicle(db: Session, vehicle_id: str) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()


def get_vehicle_by_reg_number(db: Session, reg_number: str) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.registration_number == reg_number).first()


def get_vehicles(
    db: Session,
    status: Optional[VehicleStatus] = None,
    vehicle_type: Optional[str] = None,
    region: Optional[str] = None,
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
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(db: Session, vehicle: Vehicle) -> None:
    db.delete(vehicle)
    db.commit()
