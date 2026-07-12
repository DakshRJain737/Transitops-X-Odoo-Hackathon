from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.maintenance import MaintenanceLog, MaintenanceStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate


def get_maintenance(db: Session, maintenance_id: str) -> Optional[MaintenanceLog]:
    return db.query(MaintenanceLog).filter(MaintenanceLog.id == maintenance_id).first()


def get_maintenance_logs(
    db: Session,
    vehicle_id: Optional[str] = None,
    status: Optional[MaintenanceStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[MaintenanceLog]:
    query = db.query(MaintenanceLog)
    if vehicle_id:
        query = query.filter(MaintenanceLog.vehicle_id == vehicle_id)
    if status:
        query = query.filter(MaintenanceLog.status == status)
    return query.order_by(MaintenanceLog.started_at.desc()).offset(skip).limit(limit).all()


def create_maintenance(db: Session, maintenance_in: MaintenanceCreate) -> MaintenanceLog:
    vehicle = db.query(Vehicle).filter(Vehicle.id == maintenance_in.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.status == VehicleStatus.ON_TRIP:
        raise HTTPException(status_code=400, detail="Cannot service a vehicle that is currently on a trip")

    record = MaintenanceLog(**maintenance_in.model_dump(), status=MaintenanceStatus.ACTIVE)
    db.add(record)

    vehicle.status = VehicleStatus.IN_SHOP

    db.commit()
    db.refresh(record)
    return record


def update_maintenance(db: Session, record: MaintenanceLog, update_in: MaintenanceUpdate) -> MaintenanceLog:
    update_data = update_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


def close_maintenance(db: Session, record: MaintenanceLog) -> MaintenanceLog:
    if record.status == MaintenanceStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Maintenance record already closed")

    record.status = MaintenanceStatus.CLOSED
    record.closed_at = datetime.now(timezone.utc)

    vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
    if vehicle.status != VehicleStatus.RETIRED:
        vehicle.status = VehicleStatus.AVAILABLE

    db.commit()
    db.refresh(record)
    return record
