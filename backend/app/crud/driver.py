from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.driver import Driver, DriverStatus
from app.schemas.driver import DriverCreate, DriverUpdate


def get_driver(db: Session, driver_id: str) -> Optional[Driver]:
    return db.query(Driver).filter(Driver.id == driver_id).first()


def get_driver_by_license(db: Session, license_number: str) -> Optional[Driver]:
    return db.query(Driver).filter(Driver.license_number == license_number).first()


def get_drivers(
    db: Session,
    status: Optional[DriverStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Driver]:
    query = db.query(Driver)
    if status:
        query = query.filter(Driver.status == status)
    return query.offset(skip).limit(limit).all()


def get_assignable_drivers(db: Session) -> List[Driver]:
    """Drivers eligible for a new trip: Available, not suspended, license not expired."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date()
    return (
        db.query(Driver)
        .filter(Driver.status == DriverStatus.AVAILABLE)
        .filter(Driver.license_expiry_date >= today)
        .all()
    )


def create_driver(db: Session, driver_in: DriverCreate) -> Driver:
    driver = Driver(**driver_in.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def update_driver(db: Session, driver: Driver, driver_in: DriverUpdate) -> Driver:
    update_data = driver_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return driver


def delete_driver(db: Session, driver: Driver) -> None:
    db.delete(driver)
    db.commit()
