from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models here so Base.metadata knows about them
# (uncomment as each model file is filled in)
# from app.models.user import User
# from app.models.vehicle import Vehicle
# from app.models.driver import Driver
# from app.models.trip import Trip
# from app.models.maintenance import MaintenanceLog
# from app.models.fuel_expense import FuelLog, Expense
