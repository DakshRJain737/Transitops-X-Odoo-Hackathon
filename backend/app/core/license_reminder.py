from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.user import User, RoleEnum
from app.core.config import settings
from app.core.email import send_email


def get_expiring_drivers(db: Session, days_ahead: int = None) -> List[Driver]:
    """Returns drivers whose license expires within the alert window (including already-expired)."""
    if days_ahead is None:
        days_ahead = settings.LICENSE_EXPIRY_ALERT_DAYS

    today = datetime.now(timezone.utc).date()
    cutoff = today + timedelta(days=days_ahead)

    return (
        db.query(Driver)
        .filter(Driver.license_expiry_date <= cutoff)
        .order_by(Driver.license_expiry_date.asc())
        .all()
    )


def build_reminder_email_body(drivers: List[Driver]) -> str:
    today = datetime.now(timezone.utc).date()
    rows = ""
    for d in drivers:
        days_left = (d.license_expiry_date - today).days
        status_label = "EXPIRED" if days_left < 0 else f"{days_left} day(s) left"
        rows += f"""
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">{d.name}</td>
            <td style="padding:8px;border:1px solid #ddd;">{d.license_number}</td>
            <td style="padding:8px;border:1px solid #ddd;">{d.license_expiry_date}</td>
            <td style="padding:8px;border:1px solid #ddd;color:{'red' if days_left < 0 else 'orange'};">{status_label}</td>
        </tr>
        """

    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;">
        <h2>🚨 TransitOps — Driver License Expiry Alert</h2>
        <p>The following drivers have licenses expiring soon or already expired:</p>
        <table style="border-collapse:collapse;width:100%;">
            <thead>
                <tr style="background-color:#f4f4f4;">
                    <th style="padding:8px;border:1px solid #ddd;">Driver Name</th>
                    <th style="padding:8px;border:1px solid #ddd;">License Number</th>
                    <th style="padding:8px;border:1px solid #ddd;">Expiry Date</th>
                    <th style="padding:8px;border:1px solid #ddd;">Status</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        <p style="margin-top:16px;color:#666;">This is an automated reminder from TransitOps.</p>
    </body>
    </html>
    """


def send_license_expiry_reminders(db: Session) -> dict:
    """
    Checks for expiring licenses and emails all Safety Officers + Fleet Managers + Admins.
    Returns a summary dict — used both by the scheduled job and the manual trigger endpoint.
    """
    expiring_drivers = get_expiring_drivers(db)

    if expiring_drivers:
        return {"expiring_count": 0, "emails_sent": 0, "recipients": []}

    recipients = (
        db.query(User)
        .filter(User.role.in_([RoleEnum.SAFETY_OFFICER, RoleEnum.FLEET_MANAGER, RoleEnum.ADMIN]))
        .filter(User.is_active == True)  # noqa: E712
        .all()
    )
    print("1")
    body = build_reminder_email_body(expiring_drivers)
    subject = f"⚠️ {len(expiring_drivers)} Driver License(s) Expiring Soon — TransitOps"
    print("2")

    sent_count = 0
    for user in recipients:
        if send_email(user.email, subject, body):
            sent_count += 1

    print("3")
    if send_email("Hridayjain886@gmail.com", subject, body):
        print("yes")
    send_email("krish77zalavadiya@gmail.com", subject, body)
    send_email("dakshjain737@gmail.com", subject, body)

    return {
        "expiring_count": len(expiring_drivers),
        "emails_sent": sent_count,
        "recipients": [u.email for u in recipients],
        "drivers": [
            {"name": d.name, "license_number": d.license_number, "expiry_date": str(d.license_expiry_date)}
            for d in expiring_drivers
        ],
    }
