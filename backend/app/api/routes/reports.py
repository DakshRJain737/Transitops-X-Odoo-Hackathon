import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.vehicle import Vehicle, VehicleStatus, VehicleType
from app.models.driver import Driver, DriverStatus
from app.models.trip import Trip, TripStatus
from app.models.maintenance import MaintenanceLog, MaintenanceStatus
from app.models.fuel_expense import FuelLog, Expense
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/dashboard")
def dashboard_kpis(
    vehicle_type: Optional[VehicleType] = Query(None),
    status_filter: Optional[VehicleStatus] = Query(None),
    region: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicles_query = db.query(Vehicle)
    if vehicle_type:
        vehicles_query = vehicles_query.filter(Vehicle.type == vehicle_type)
    if status_filter:
        vehicles_query = vehicles_query.filter(Vehicle.status == status_filter)
    if region:
        vehicles_query = vehicles_query.filter(Vehicle.region == region)

    vehicles = vehicles_query.all()
    vehicle_ids = [vehicle.id for vehicle in vehicles]

    total_vehicles = len(vehicles)
    active_vehicles = sum(1 for vehicle in vehicles if vehicle.status != VehicleStatus.RETIRED)
    available_vehicles = sum(1 for vehicle in vehicles if vehicle.status == VehicleStatus.AVAILABLE)
    in_maintenance = sum(1 for vehicle in vehicles if vehicle.status == VehicleStatus.IN_SHOP)

    active_trips = (
        db.query(Trip)
        .filter(Trip.status == TripStatus.DISPATCHED)
        .filter(Trip.vehicle_id.in_(vehicle_ids))
        .count()
        if vehicle_ids
        else 0
    )
    pending_trips = (
        db.query(Trip)
        .filter(Trip.status == TripStatus.DRAFT)
        .filter(Trip.vehicle_id.in_(vehicle_ids))
        .count()
        if vehicle_ids
        else 0
    )

    drivers_on_duty = 0
    if vehicle_ids:
        assigned_driver_ids = {
            trip.driver_id for trip in db.query(Trip).filter(Trip.vehicle_id.in_(vehicle_ids)).all()
        }
        drivers_on_duty = (
            db.query(Driver)
            .filter(Driver.id.in_(assigned_driver_ids))
            .filter(Driver.status == DriverStatus.ON_TRIP)
            .count()
        )

    fleet_utilization = round((active_trips / total_vehicles) * 100, 2) if total_vehicles else 0.0

    return {
        "active_vehicles": active_vehicles,
        "available_vehicles": available_vehicles,
        "vehicles_in_maintenance": in_maintenance,
        "active_trips": active_trips,
        "pending_trips": pending_trips,
        "drivers_on_duty": drivers_on_duty,
        "fleet_utilization_percent": fleet_utilization,
    }


@router.get("/fuel-efficiency")
def fuel_efficiency(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicles = db.query(Vehicle).all()
    results = []
    for v in vehicles:
        trips = db.query(Trip).filter(Trip.vehicle_id == v.id, Trip.status == TripStatus.COMPLETED).all()
        total_distance = sum(t.actual_distance or 0 for t in trips)
        total_fuel = sum(t.fuel_consumed or 0 for t in trips)
        efficiency = round(total_distance / total_fuel, 2) if total_fuel else 0.0
        results.append({
            "vehicle_id": v.id,
            "registration_number": v.registration_number,
            "total_distance_km": total_distance,
            "total_fuel_liters": total_fuel,
            "efficiency_km_per_liter": efficiency,
        })
    return results


@router.get("/operational-cost")
def operational_cost(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicles = db.query(Vehicle).all()
    results = []
    for v in vehicles:
        fuel_cost = sum(f.cost for f in db.query(FuelLog).filter(FuelLog.vehicle_id == v.id).all())
        maintenance_cost = sum(
            m.cost for m in db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == v.id).all()
        )
        other_expenses = sum(e.amount for e in db.query(Expense).filter(Expense.vehicle_id == v.id).all())
        total = fuel_cost + maintenance_cost + other_expenses
        results.append({
            "vehicle_id": v.id,
            "registration_number": v.registration_number,
            "fuel_cost": fuel_cost,
            "maintenance_cost": maintenance_cost,
            "other_expenses": other_expenses,
            "total_operational_cost": total,
        })
    return results


@router.get("/roi")
def vehicle_roi(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    revenue_per_km: float = 50.0,
):
    """
    ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost
    Revenue is estimated as distance traveled * revenue_per_km (adjust as needed).
    """
    vehicles = db.query(Vehicle).all()
    results = []
    for v in vehicles:
        trips = db.query(Trip).filter(Trip.vehicle_id == v.id, Trip.status == TripStatus.COMPLETED).all()
        total_distance = sum(t.actual_distance or 0 for t in trips)
        revenue = total_distance * revenue_per_km

        fuel_cost = sum(f.cost for f in db.query(FuelLog).filter(FuelLog.vehicle_id == v.id).all())
        maintenance_cost = sum(
            m.cost for m in db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == v.id).all()
        )

        roi = (
            round((revenue - (maintenance_cost + fuel_cost)) / v.acquisition_cost, 4)
            if v.acquisition_cost
            else 0.0
        )

        results.append({
            "vehicle_id": v.id,
            "registration_number": v.registration_number,
            "revenue": revenue,
            "fuel_cost": fuel_cost,
            "maintenance_cost": maintenance_cost,
            "acquisition_cost": v.acquisition_cost,
            "roi": roi,
        })
    return results


@router.get("/export")
def export_csv(
    report_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """report_type: vehicles | drivers | trips | operational-cost"""
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "vehicles":
        writer.writerow(["Registration Number", "Name", "Type", "Status", "Odometer", "Acquisition Cost"])
        for v in db.query(Vehicle).all():
            writer.writerow([v.registration_number, v.name, v.type.value, v.status.value, v.odometer, v.acquisition_cost])

    elif report_type == "drivers":
        writer.writerow(["Name", "License Number", "Status", "Safety Score", "License Expiry"])
        for d in db.query(Driver).all():
            writer.writerow([d.name, d.license_number, d.status.value, d.safety_score, d.license_expiry_date])

    elif report_type == "trips":
        writer.writerow(["Source", "Destination", "Status", "Cargo Weight", "Planned Distance", "Actual Distance"])
        for t in db.query(Trip).all():
            writer.writerow([t.source, t.destination, t.status.value, t.cargo_weight, t.planned_distance, t.actual_distance])

    else:
        writer.writerow(["Error"])
        writer.writerow([f"Unknown report_type: {report_type}"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"},
    )
