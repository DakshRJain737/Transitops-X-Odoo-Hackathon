import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.crud.vehicle import create_vehicle, update_vehicle
from app.db.base import Base
from app.models.vehicle import VehicleType
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


class VehicleDocumentTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        SessionLocal = sessionmaker(bind=self.engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_vehicle_documents_url_can_be_created_and_updated(self):
        vehicle = create_vehicle(
            self.db,
            VehicleCreate(
                registration_number="ABC123",
                name="Demo Truck",
                model="Actros",
                type=VehicleType.TRUCK,
                max_load_capacity=12000,
                acquisition_cost=50000,
                region="North",
            ),
        )

        self.assertIsNone(vehicle.documents_url)

        updated_vehicle = update_vehicle(
            self.db,
            vehicle,
            VehicleUpdate(documents_url="https://drive.google.com/drive/folders/demo-vehicle"),
        )

        self.assertEqual(
            updated_vehicle.documents_url,
            "https://drive.google.com/drive/folders/demo-vehicle",
        )


if __name__ == "__main__":
    unittest.main()
