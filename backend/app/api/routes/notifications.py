from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.license_reminder import send_license_expiry_reminders, get_expiring_drivers
from app.models.user import User, RoleEnum
from app.api.deps import require_roles

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

ALLOWED_ROLES = [RoleEnum.SAFETY_OFFICER, RoleEnum.FLEET_MANAGER]


@router.get("/expiring-licenses")
def preview_expiring_licenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
):
    """Preview which drivers would trigger a reminder, without sending emails."""
    drivers = get_expiring_drivers(db)
    return {
        "count": len(drivers),
        "drivers": [
            {"name": d.name, "license_number": d.license_number, "expiry_date": str(d.license_expiry_date), "status": d.status.value}
            for d in drivers
        ],
    }


@router.post("/send-license-reminders")
def trigger_license_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
):
    """Manually trigger the license expiry email reminder immediately."""
    result = send_license_expiry_reminders(db)
    return result
