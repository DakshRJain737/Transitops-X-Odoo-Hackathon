# This module's only job is to ensure every model is registered on Base.metadata
# before create_all() runs. Import this file (not base.py) wherever you need
# every table to exist.

from app.db.base import Base  # noqa: F401

from app.models.user import User                      # noqa: F401
from app.models.vehicle import Vehicle                  # noqa: F401
from app.models.driver import Driver                    # noqa: F401
from app.models.trip import Trip                        # noqa: F401
from app.models.maintenance import MaintenanceLog        # noqa: F401
from app.models.fuel_expense import FuelLog, Expense    # noqa: F401
