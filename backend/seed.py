from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.crud.driver import create_driver
from app.crud.vehicle import create_vehicle
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.driver import DriverStatus
from app.models.trip import Trip, TripStatus
from app.models.vehicle import Vehicle, VehicleStatus, VehicleType
from app.schemas.driver import DriverCreate
from app.schemas.vehicle import VehicleCreate


def seed_demo_data() -> None:
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    existing_vehicles = db.query(Vehicle).count()

    if existing_vehicles == 0:
        vehicle1 = create_vehicle(
            db,
            VehicleCreate(
                registration_number="TRK-101",
                name="North Star",
                model="Actros",
                type=VehicleType.TRUCK,
                max_load_capacity=12000,
                acquisition_cost=50000,
                region="North",
                documents_url="https://drive.google.com/drive/folders/demo-vehicle-1",
            ),
        )
        vehicle2 = create_vehicle(
            db,
            VehicleCreate(
                registration_number="VAN-204",
                name="Metro Van",
                model="Sprinter",
                type=VehicleType.VAN,
                max_load_capacity=4000,
                acquisition_cost=28000,
                region="Central",
                documents_url="https://drive.google.com/drive/folders/demo-vehicle-2",
            ),
        )
        vehicle3 = create_vehicle(
            db,
            VehicleCreate(
                registration_number="MIN-309",
                name="Express Mini",
                model="D-Max",
                type=VehicleType.MINI_TRUCK,
                max_load_capacity=2500,
                acquisition_cost=18000,
                region="West",
            ),
        )

        driver1 = create_driver(
            db,
            DriverCreate(
                name="Asha Kumar",
                license_number="DL-1001",
                license_category="LMV",
                license_expiry_date=date.today() + timedelta(days=365),
                contact_number="9876543210",
                safety_score=96.0,
                status=DriverStatus.AVAILABLE,
            ),
        )
        driver2 = create_driver(
            db,
            DriverCreate(
                name="Ravi Menon",
                license_number="DL-1002",
                license_category="HMV",
                license_expiry_date=date.today() + timedelta(days=180),
                contact_number="9123456780",
                safety_score=92.0,
                status=DriverStatus.ON_TRIP,
            ),
        )

        completed_trip = Trip(
            source="Lagos Port",
            destination="Abuja Hub",
            vehicle_id=vehicle1.id,
            driver_id=driver2.id,
            cargo_weight=9000,
            planned_distance=600,
            actual_distance=590,
            fuel_consumed=48,
            status=TripStatus.COMPLETED,
        )
        draft_trip = Trip(
            source="Kano Depot",
            destination="Ibadan Terminal",
            vehicle_id=vehicle2.id,
            driver_id=driver1.id,
            cargo_weight=3200,
            planned_distance=400,
            actual_distance=None,
            fuel_consumed=None,
            status=TripStatus.DRAFT,
        )
        db.add_all([completed_trip, draft_trip])
        db.commit()

        vehicle1.status = VehicleStatus.AVAILABLE
        vehicle2.status = VehicleStatus.ON_TRIP
        vehicle3.status = VehicleStatus.IN_SHOP
        db.commit()

    db.close()


if __name__ == "__main__":
    seed_demo_data()
    print("Demo data seeded successfully.")
