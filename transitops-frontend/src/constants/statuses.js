/**
 * STATUS CONSTANTS
 * Every enum here mirrors the corresponding backend model exactly:
 *   VehicleStatus     → app/models/vehicle.py
 *   DriverStatus      → app/models/driver.py
 *   TripStatus        → app/models/trip.py
 *   MaintenanceStatus → app/models/maintenance.py
 *
 * Each status resolves to a { label, color, dotColor } shape consumed by the
 * shared <StatusChip /> component, so adding a new status anywhere only requires
 * an entry here — no changes needed in the components that render it.
 *
 * `color` values map to Tailwind semantic colors defined in tailwind.config.js
 * (success / warning / danger / info / accent / muted).
 */

// ---- Vehicle ----
export const VEHICLE_STATUS = {
  AVAILABLE: "available",
  ON_TRIP: "on_trip",
  IN_SHOP: "in_shop",
  RETIRED: "retired",
};

export const VEHICLE_STATUS_META = {
  [VEHICLE_STATUS.AVAILABLE]: { label: "Available", color: "success" },
  [VEHICLE_STATUS.ON_TRIP]: { label: "On Trip", color: "info" },
  [VEHICLE_STATUS.IN_SHOP]: { label: "In Shop", color: "warning" },
  [VEHICLE_STATUS.RETIRED]: { label: "Retired", color: "muted" },
};

export const VEHICLE_TYPES = {
  VAN: "van",
  TRUCK: "truck",
  BUS: "bus",
  PICKUP: "pickup",
};

export const VEHICLE_TYPE_META = {
  [VEHICLE_TYPES.VAN]: { label: "Van", icon: "Truck" },
  [VEHICLE_TYPES.TRUCK]: { label: "Truck", icon: "Truck" },
  [VEHICLE_TYPES.BUS]: { label: "Bus", icon: "Bus" },
  [VEHICLE_TYPES.PICKUP]: { label: "Pickup", icon: "Truck" },
};

// ---- Driver ----
export const DRIVER_STATUS = {
  AVAILABLE: "available",
  ON_TRIP: "on_trip",
  SUSPENDED: "suspended",
  OFF_DUTY: "off_duty",
};

export const DRIVER_STATUS_META = {
  [DRIVER_STATUS.AVAILABLE]: { label: "Available", color: "success" },
  [DRIVER_STATUS.ON_TRIP]: { label: "On Trip", color: "info" },
  [DRIVER_STATUS.SUSPENDED]: { label: "Suspended", color: "danger" },
  [DRIVER_STATUS.OFF_DUTY]: { label: "Off Duty", color: "muted" },
};

// ---- Trip ----
export const TRIP_STATUS = {
  DRAFT: "draft",
  DISPATCHED: "dispatched",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const TRIP_STATUS_META = {
  [TRIP_STATUS.DRAFT]: { label: "Draft", color: "muted", step: 0 },
  [TRIP_STATUS.DISPATCHED]: { label: "Dispatched", color: "info", step: 1 },
  [TRIP_STATUS.COMPLETED]: { label: "Completed", color: "success", step: 2 },
  [TRIP_STATUS.CANCELLED]: { label: "Cancelled", color: "danger", step: -1 },
};

/** Ordered lifecycle used by the Trip timeline component (cancelled branches off separately) */
export const TRIP_LIFECYCLE_ORDER = [
  TRIP_STATUS.DRAFT,
  TRIP_STATUS.DISPATCHED,
  TRIP_STATUS.COMPLETED,
];

// ---- Maintenance ----
export const MAINTENANCE_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  CLOSED: "closed",
};

export const MAINTENANCE_STATUS_META = {
  [MAINTENANCE_STATUS.OPEN]: { label: "Open", color: "warning" },
  [MAINTENANCE_STATUS.IN_PROGRESS]: { label: "In Progress", color: "info" },
  [MAINTENANCE_STATUS.CLOSED]: { label: "Closed", color: "success" },
};

export const MAINTENANCE_TYPES = {
  ROUTINE: "routine",
  REPAIR: "repair",
  INSPECTION: "inspection",
  EMERGENCY: "emergency",
};

export const MAINTENANCE_TYPE_META = {
  [MAINTENANCE_TYPES.ROUTINE]: { label: "Routine Service", color: "info" },
  [MAINTENANCE_TYPES.REPAIR]: { label: "Repair", color: "warning" },
  [MAINTENANCE_TYPES.INSPECTION]: { label: "Inspection", color: "muted" },
  [MAINTENANCE_TYPES.EMERGENCY]: { label: "Emergency", color: "danger" },
};

// ---- Expense ----
export const EXPENSE_TYPES = {
  TOLL: "toll",
  PARKING: "parking",
  FINE: "fine",
  REPAIR: "repair",
  OTHER: "other",
};

export const EXPENSE_TYPE_META = {
  [EXPENSE_TYPES.TOLL]: { label: "Toll", color: "info" },
  [EXPENSE_TYPES.PARKING]: { label: "Parking", color: "muted" },
  [EXPENSE_TYPES.FINE]: { label: "Fine", color: "danger" },
  [EXPENSE_TYPES.REPAIR]: { label: "Repair", color: "warning" },
  [EXPENSE_TYPES.OTHER]: { label: "Other", color: "muted" },
};

/**
 * Generic lookup helper — used by <StatusChip status={x} type="vehicle" />
 * so one component can render any entity's status without per-entity branching logic.
 */
const META_MAP = {
  vehicle: VEHICLE_STATUS_META,
  driver: DRIVER_STATUS_META,
  trip: TRIP_STATUS_META,
  maintenance: MAINTENANCE_STATUS_META,
  maintenanceType: MAINTENANCE_TYPE_META,
  vehicleType: VEHICLE_TYPE_META,
  expenseType: EXPENSE_TYPE_META,
};

export function getStatusMeta(type, value) {
  return (
    META_MAP[type]?.[value] ?? { label: value ?? "Unknown", color: "muted" }
  );
}