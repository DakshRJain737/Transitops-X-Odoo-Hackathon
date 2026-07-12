# Convenience re-exports so routes can do: from app.schemas import UserOut, VehicleOut, ...

from app.schemas.user import UserCreate, UserUpdate, UserOut, Token, TokenPayload, LoginRequest
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleOut
from app.schemas.driver import DriverCreate, DriverUpdate, DriverOut
from app.schemas.trip import TripCreate, TripCompleteRequest, TripOut
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceOut
from app.schemas.fuel_expense import FuelLogCreate, FuelLogOut, ExpenseCreate, ExpenseOut
