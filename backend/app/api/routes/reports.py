import csv
import io
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT

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


@router.get("/export-pdf")
def export_pdf(
    report_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """export pdf: vehicles | drivers | trips | dashboard | fuel-efficiency | operational-cost"""
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=A4, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    story = []
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#374151"),
        spaceAfter=8,
        fontName="Helvetica-Bold",
    )

    story.append(Paragraph(f"TransitOps - {report_type.replace('-', ' ').title()} Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
    story.append(Spacer(1, 0.3 * inch))

    if report_type == "vehicles":
        story.append(Paragraph("Vehicles Report", heading_style))
        vehicles = db.query(Vehicle).all()
        data = [["Reg. Number", "Name", "Type", "Status", "Odometer", "Acq. Cost"]]
        for v in vehicles:
            data.append([
                v.registration_number or "-",
                v.name or "-",
                v.type.value if v.type else "-",
                v.status.value if v.status else "-",
                str(v.odometer) if v.odometer else "-",
                f"${v.acquisition_cost}" if v.acquisition_cost else "-",
            ])
        table = Table(data, colWidths=[1.2 * inch, 1.2 * inch, 0.8 * inch, 1 * inch, 0.8 * inch, 0.9 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    elif report_type == "drivers":
        story.append(Paragraph("Drivers Report", heading_style))
        drivers = db.query(Driver).all()
        data = [["Name", "License Number", "Status", "Safety Score", "License Expiry"]]
        for d in drivers:
            data.append([
                d.name or "-",
                d.license_number or "-",
                d.status.value if d.status else "-",
                str(d.safety_score) if d.safety_score else "-",
                str(d.license_expiry_date) if d.license_expiry_date else "-",
            ])
        table = Table(data, colWidths=[1.5 * inch, 1.5 * inch, 1 * inch, 1 * inch, 1.5 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    elif report_type == "trips":
        story.append(Paragraph("Trips Report", heading_style))
        trips = db.query(Trip).all()
        data = [["Source", "Destination", "Status", "Cargo Wt", "Planned Dist", "Actual Dist"]]
        for t in trips:
            data.append([
                t.source or "-",
                t.destination or "-",
                t.status.value if t.status else "-",
                f"{t.cargo_weight} kg" if t.cargo_weight else "-",
                f"{t.planned_distance} km" if t.planned_distance else "-",
                f"{t.actual_distance} km" if t.actual_distance else "-",
            ])
        table = Table(data, colWidths=[1 * inch, 1 * inch, 0.9 * inch, 0.9 * inch, 1.1 * inch, 1.1 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    elif report_type == "dashboard":
        story.append(Paragraph("Dashboard KPIs Report", heading_style))
        vehicles = db.query(Vehicle).all()
        vehicle_ids = [v.id for v in vehicles]
        total_vehicles = len(vehicles)
        active_vehicles = sum(1 for v in vehicles if v.status != VehicleStatus.RETIRED)
        available_vehicles = sum(1 for v in vehicles if v.status == VehicleStatus.AVAILABLE)
        in_maintenance = sum(1 for v in vehicles if v.status == VehicleStatus.IN_SHOP)
        active_trips = (
            db.query(Trip)
            .filter(Trip.status == TripStatus.DISPATCHED)
            .filter(Trip.vehicle_id.in_(vehicle_ids))
            .count()
            if vehicle_ids
            else 0
        )
        fleet_utilization = round((active_trips / total_vehicles) * 100, 2) if total_vehicles else 0.0

        kpi_data = [
            ["Metric", "Value"],
            ["Total Vehicles", str(total_vehicles)],
            ["Active Vehicles", str(active_vehicles)],
            ["Available Vehicles", str(available_vehicles)],
            ["In Maintenance", str(in_maintenance)],
            ["Active Trips", str(active_trips)],
            ["Fleet Utilization", f"{fleet_utilization}%"],
        ]
        table = Table(kpi_data, colWidths=[3 * inch, 2 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    elif report_type == "fuel-efficiency":
        story.append(Paragraph("Fuel Efficiency Report", heading_style))
        vehicles = db.query(Vehicle).all()
        data = [["Vehicle ID", "Registration", "Total Distance", "Total Fuel", "Efficiency (km/L)"]]
        for v in vehicles:
            trips = db.query(Trip).filter(Trip.vehicle_id == v.id, Trip.status == TripStatus.COMPLETED).all()
            total_distance = sum(t.actual_distance or 0 for t in trips)
            total_fuel = sum(t.fuel_consumed or 0 for t in trips)
            efficiency = round(total_distance / total_fuel, 2) if total_fuel else 0.0
            data.append([
                str(v.id),
                v.registration_number or "-",
                f"{total_distance} km",
                f"{total_fuel} L",
                f"{efficiency}",
            ])
        table = Table(data, colWidths=[0.8 * inch, 1.2 * inch, 1.3 * inch, 1 * inch, 1.2 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    elif report_type == "operational-cost":
        story.append(Paragraph("Operational Cost Report", heading_style))
        vehicles = db.query(Vehicle).all()
        data = [["Registration", "Fuel Cost", "Maintenance", "Other Expenses", "Total Cost"]]
        for v in vehicles:
            fuel_cost = sum(f.cost for f in db.query(FuelLog).filter(FuelLog.vehicle_id == v.id).all())
            maintenance_cost = sum(
                m.cost for m in db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == v.id).all()
            )
            other_expenses = sum(e.amount for e in db.query(Expense).filter(Expense.vehicle_id == v.id).all())
            total = fuel_cost + maintenance_cost + other_expenses
            data.append([
                v.registration_number or "-",
                f"${fuel_cost}",
                f"${maintenance_cost}",
                f"${other_expenses}",
                f"${total}",
            ])
        table = Table(data, colWidths=[1.2 * inch, 1 * inch, 1.1 * inch, 1.2 * inch, 0.9 * inch])
        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ])
        )
        story.append(table)

    else:
        story.append(Paragraph("Error", heading_style))
        story.append(Paragraph(f"Unknown report_type: {report_type}", styles["Normal"]))

    doc.build(story)
    pdf_buffer.seek(0)

    return StreamingResponse(
        iter([pdf_buffer.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.pdf"},
    )
