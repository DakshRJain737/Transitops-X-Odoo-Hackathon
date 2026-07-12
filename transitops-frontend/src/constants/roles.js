export const ROLES = {
  ADMIN: "admin",
  FLEET_MANAGER: "fleet_manager",
  DRIVER: "driver",
  SAFETY_OFFICER: "safety_officer",
  FINANCIAL_ANALYST: "financial_analyst",
};


export const ROLE_META = {
  [ROLES.ADMIN]: {
    label: "Administrator",
    shortLabel: "Admin",
    description: "Full system access, user management, overrides",
    color: "accent", // indigo — signals elevated/system-wide access
    icon: "ShieldCheck",
  },
  [ROLES.FLEET_MANAGER]: {
    label: "Fleet Manager",
    shortLabel: "Fleet Mgr",
    description: "Manages vehicles, drivers, maintenance",
    color: "info", // blue
    icon: "Truck",
  },
  [ROLES.DRIVER]: {
    label: "Driver",
    shortLabel: "Driver",
    description: "Creates, dispatches, and completes trips",
    color: "success", // green
    icon: "Navigation",
  },
  [ROLES.SAFETY_OFFICER]: {
    label: "Safety Officer",
    shortLabel: "Safety",
    description: "Driver compliance and license validity",
    color: "warning", // amber
    icon: "ShieldAlert",
  },
  [ROLES.FINANCIAL_ANALYST]: {
    label: "Financial Analyst",
    shortLabel: "Finance",
    description: "Fuel logs, expenses, financial reports",
    color: "muted",
    icon: "LineChart",
  },
};


export const ROLE_OPTIONS = Object.values(ROLES).map((value) => ({
  value,
  ...ROLE_META[value],
}));


export const ROLE_NAV_ACCESS = {
  [ROLES.FLEET_MANAGER]: [
    "dashboard",
    "vehicles",
    "drivers",
    "trips",
    "maintenance",
    "reports",
    "settings",
  ],
  [ROLES.DRIVER]: ["dashboard", "trips", "settings"],
  [ROLES.SAFETY_OFFICER]: ["dashboard", "drivers", "maintenance", "settings"],
  [ROLES.FINANCIAL_ANALYST]: [
    "dashboard",
    "fuel-expense",
    "reports",
    "settings",
  ],
};

export function canAccessNavKey(role, key) {
  if (role === ROLES.ADMIN) return true;
  return ROLE_NAV_ACCESS[role]?.includes(key) ?? false;
}

export const ROLE_ROUTE_ACCESS = {
  createVehicle: [ROLES.FLEET_MANAGER, ROLES.ADMIN],
  editVehicle: [ROLES.FLEET_MANAGER, ROLES.ADMIN],
  deleteVehicle: [ROLES.FLEET_MANAGER, ROLES.ADMIN],
  createDriver: [ROLES.FLEET_MANAGER, ROLES.SAFETY_OFFICER, ROLES.ADMIN],
  editDriver: [ROLES.FLEET_MANAGER, ROLES.SAFETY_OFFICER, ROLES.ADMIN],
  deleteDriver: [ROLES.FLEET_MANAGER, ROLES.SAFETY_OFFICER, ROLES.ADMIN],
  createTrip: [ROLES.DRIVER, ROLES.FLEET_MANAGER, ROLES.ADMIN],
  dispatchTrip: [ROLES.DRIVER, ROLES.FLEET_MANAGER, ROLES.ADMIN],
  completeTrip: [ROLES.DRIVER, ROLES.FLEET_MANAGER, ROLES.ADMIN],
  cancelTrip: [ROLES.DRIVER, ROLES.FLEET_MANAGER, ROLES.ADMIN],
  createMaintenance: [ROLES.FLEET_MANAGER, ROLES.ADMIN],
  closeMaintenance: [ROLES.FLEET_MANAGER, ROLES.ADMIN],
  createFuelLog: [
    ROLES.FLEET_MANAGER,
    ROLES.DRIVER,
    ROLES.FINANCIAL_ANALYST,
    ROLES.ADMIN,
  ],
  createExpense: [
    ROLES.FLEET_MANAGER,
    ROLES.DRIVER,
    ROLES.FINANCIAL_ANALYST,
    ROLES.ADMIN,
  ],
  adminOnly: [ROLES.ADMIN],
};

export function hasPermission(role, actionKey) {
  if (role === ROLES.ADMIN) return true;
  return ROLE_ROUTE_ACCESS[actionKey]?.includes(role) ?? false;
}