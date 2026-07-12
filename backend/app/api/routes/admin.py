from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserOut, UserUpdate, UserCreate
from app.crud.user import get_user_by_id, get_user_by_email, create_user
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.api.deps import require_admin
from app.core.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ---------- User Management ----------

@router.get("/users", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return db.query(User).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin can create users with any role, including other admins."""
    existing = get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return create_user(db, user_in)


@router.patch("/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin can change any user's role, deactivate accounts, reset passwords."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    db.delete(user)
    db.commit()
    return None


@router.post("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


# ---------- System-wide overrides ----------

@router.post("/vehicles/{vehicle_id}/force-status")
def force_vehicle_status(
    vehicle_id: str,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin override: force a vehicle into any status, bypassing normal workflow checks."""
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.status = new_status
    db.commit()
    db.refresh(vehicle)
    return {"message": f"Vehicle {vehicle.registration_number} status forced to {new_status}"}


@router.post("/drivers/{driver_id}/force-status")
def force_driver_status(
    driver_id: str,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin override: force a driver into any status, bypassing normal workflow checks."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.status = new_status
    db.commit()
    db.refresh(driver)
    return {"message": f"Driver {driver.name} status forced to {new_status}"}


@router.post("/trips/{trip_id}/force-status")
def force_trip_status(
    trip_id: str,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin override: force a trip into any status without validation (use with caution)."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.status = new_status
    db.commit()
    db.refresh(trip)
    return {"message": f"Trip {trip.id} status forced to {new_status}"}


@router.get("/stats")
def system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Full system overview only admins can see."""
    return {
        "total_users": db.query(User).count(),
        "users_by_role": {
            role.value: db.query(User).filter(User.role == role).count() for role in RoleEnum
        },
        "total_vehicles": db.query(Vehicle).count(),
        "total_drivers": db.query(Driver).count(),
        "total_trips": db.query(Trip).count(),
        "inactive_users": db.query(User).filter(User.is_active == False).count(),
    }
