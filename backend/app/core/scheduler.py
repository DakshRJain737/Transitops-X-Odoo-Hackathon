from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.session import SessionLocal
from app.core.license_reminder import send_license_expiry_reminders

scheduler = BackgroundScheduler()


def scheduled_license_check():
    db = SessionLocal()
    try:
        result = send_license_expiry_reminders(db)
        print(f"📧 Scheduled license check complete: {result['expiring_count']} expiring, {result['emails_sent']} emails sent")
    finally:
        db.close()


def start_scheduler():
    # Runs every day at 8:00 AM server time
    scheduler.add_job(scheduled_license_check, CronTrigger(hour=8, minute=0))
    scheduler.start()
    print("✅ License expiry reminder scheduler started (daily at 8:00 AM)")
