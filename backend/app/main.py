from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.base_all_models import Base
from app.db.session import engine
from app.core.scheduler import start_scheduler
from app.api.routes import auth, vehicles, drivers, trips, maintenance, fuel_expense, reports, admin, notifications

app = FastAPI(title="TransitOps API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(drivers.router)
app.include_router(trips.router)
app.include_router(maintenance.router)
app.include_router(fuel_expense.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(notifications.router)


@app.on_event("startup")
def on_startup():
    start_scheduler()


@app.get("/")
def health_check():
    return {"status": "TransitOps API running"}
