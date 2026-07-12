# TransitOps

TransitOps is a full-stack fleet management platform built for an Odoo Hackathon. It gives fleet admins, managers, drivers, safety officers, and financial analysts a single dashboard to manage vehicles, drivers, trips, maintenance, fuel/expense logging, and reporting — with role-based access control and automated license-expiry email reminders.

**Backend:** FastAPI + SQLAlchemy + SQLite (Python)
**Frontend:** React 19 + Vite + Tailwind CSS (JavaScript)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Backend — File by File](#backend--file-by-file)
- [Frontend — File by File](#frontend--file-by-file)
- [Data Model Summary](#data-model-summary)
- [Roles & Permissions](#roles--permissions)
- [API Endpoint Reference](#api-endpoint-reference)
- [Known Gaps / Things to Watch](#known-gaps--things-to-watch)

---

## Architecture Overview

```
Browser (React SPA, :5173)
        │  Axios (JWT bearer token)
        ▼
FastAPI backend (:8000)
        │  SQLAlchemy ORM
        ▼
SQLite database (transitops.db)
        │
APScheduler (daily 08:00 job) ──► SMTP email (license expiry reminders)
```

- Auth is JWT-based (`python-jose`), issued on `/api/auth/login`, sent as `Authorization: Bearer <token>` on every request.
- The frontend never talks to the DB directly — every screen is backed by a REST call through `src/services/*.js`.
- Role checks happen **twice**: the backend enforces them per-endpoint (source of truth), and the frontend also hides/disables actions the current role can't perform (`constants/roles.js`) purely for UX.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Optional `.env` in `backend/` (defaults shown, all optional):

```env
DATABASE_URL=sqlite:///./transitops.db
SECRET_KEY=your-secret-key-change-this-later
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
LICENSE_EXPIRY_ALERT_DAYS=7
```

API docs: `http://localhost:8000/docs`. Seed sample data with `python seed.py`.

### Frontend

```bash
cd transitops-frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. Set `VITE_API_BASE_URL` in a `.env` file if your backend isn't at `http://127.0.0.1:8000` (see `src/services/api.js`).

---

## Backend — File by File

### `backend/app/main.py`
The FastAPI application entrypoint. Creates the `FastAPI(title="TransitOps API")` instance, adds CORS middleware (currently locked to `http://localhost:5173`), calls `Base.metadata.create_all()` to auto-create tables on startup (no Alembic migration run required for a fresh DB, even though `alembic` is a dependency), registers all nine routers (`auth`, `vehicles`, `drivers`, `trips`, `maintenance`, `fuel_expense`, `reports`, `admin`, `notifications`), starts the APScheduler background job on the `startup` event, and exposes a `GET /` health-check endpoint.

### `backend/app/core/config.py`
Defines `Settings(BaseSettings)` (Pydantic Settings) — the single source of environment configuration: `DATABASE_URL`, JWT `SECRET_KEY`/`ALGORITHM`/`ACCESS_TOKEN_EXPIRE_MINUTES`, and SMTP settings for email. Reads from a `.env` file automatically. A module-level `settings = Settings()` instance is imported everywhere else.

### `backend/app/core/security.py`
Password hashing and JWT helpers:
- `hash_password` / `verify_password` — bcrypt, with input truncated to 72 bytes (bcrypt's hard limit).
- `create_access_token(subject, role, expires_delta)` — encodes `{sub, role, exp}` into a JWT signed with `SECRET_KEY`.
- `decode_access_token(token)` — decodes and validates, returning `None` on any `JWTError` (expired/tampered token).

### `backend/app/core/email.py`
`send_email(to_email, subject, body_html)` — sends a single HTML email via `smtplib` + STARTTLS. If SMTP credentials aren't configured it logs a warning and returns `False` instead of raising, so the app keeps working without email set up (e.g. in local dev).

### `backend/app/core/license_reminder.py`
The domain logic behind driver license expiry alerts:
- `get_expiring_drivers(db, days_ahead)` — queries drivers whose `license_expiry_date` is within the alert window (default from `settings.LICENSE_EXPIRY_ALERT_DAYS`), including already-expired ones.
- `build_reminder_email_body(drivers)` — renders an HTML table (name, license number, expiry date, days-left/EXPIRED) for the alert email.
- `send_license_expiry_reminders(db)` — the orchestrator: finds expiring drivers, emails every active `SAFETY_OFFICER`/`FLEET_MANAGER`/`ADMIN` user, and returns a summary dict (`expiring_count`, `emails_sent`, `recipients`, `drivers`). **Note:** this function also unconditionally sends the same alert to three hardcoded personal Gmail addresses — see [Known Gaps](#known-gaps--things-to-watch).

### `backend/app/core/scheduler.py`
Wraps `send_license_expiry_reminders` in an `APScheduler` `BackgroundScheduler` job, scheduled via `CronTrigger(hour=8, minute=0)` to run daily at 08:00 server time. `start_scheduler()` is called once from `main.py`'s startup event.

### `backend/app/db/base.py`
One line: `Base = declarative_base()`. The shared SQLAlchemy declarative base every model inherits from.

### `backend/app/db/base_all_models.py`
Exists solely so that importing *this* module (instead of `base.py` directly) guarantees every model class is registered on `Base.metadata` before `create_all()` runs. Imports `User`, `Vehicle`, `Driver`, `Trip`, `MaintenanceLog`, `FuelLog`, `Expense`.

### `backend/app/db/session.py`
Creates the SQLAlchemy `engine` (SQLite, with `check_same_thread=False` so it works with FastAPI's threaded request handling) and `SessionLocal` sessionmaker. Exposes the `get_db()` FastAPI dependency — a generator that yields a session and always closes it in a `finally` block.

### `backend/app/api/deps.py`
Shared FastAPI dependencies for auth/authorization:
- `oauth2_scheme` — `OAuth2PasswordBearer` pointed at `/api/auth/login`, used to extract the bearer token from requests.
- `get_current_user(token, db)` — decodes the JWT, loads the user by ID, raises `401` if the token is invalid or the user is inactive.
- `require_roles(allowed_roles)` — a dependency **factory**. Returns a checker that always lets `ADMIN` through, and otherwise raises `403` if `current_user.role` isn't in the allowed list. Used as `Depends(require_roles([RoleEnum.FLEET_MANAGER]))`.
- `require_admin` — hard gate for admin-only endpoints.

### `backend/app/models/` (SQLAlchemy ORM models)
All models use a `String(36)` UUID primary key (`default=lambda: str(uuid.uuid4())`) rather than auto-increment integers.

- **`user.py`** — `User` table. `RoleEnum` (`admin`, `fleet_manager`, `driver`, `safety_officer`, `financial_analyst`), `full_name`, `email` (unique), `hashed_password`, `is_active`, timestamps.
- **`vehicle.py`** — `Vehicle` table. `VehicleStatus` (`available`, `on_trip`, `in_shop`, `retired`), `VehicleType` (`truck`, `van`, `mini_truck`, `trailer`, `bike`), `registration_number` (unique), `max_load_capacity`, `odometer`, `acquisition_cost`, `region`, `documents_url`. Has cascading relationships to `trips`, `maintenance_logs`, `fuel_logs`, `expenses` (deleting a vehicle deletes its history).
- **`driver.py`** — `Driver` table. `DriverStatus` (`available`, `on_trip`, `off_duty`, `suspended`), `license_number` (unique), `license_category`, `license_expiry_date`, `safety_score` (0–100, defaults to 100), plus an `is_license_expired` computed property. Relationship to `trips`.
- **`trip.py`** — `Trip` table. `TripStatus` (`draft`, `dispatched`, `completed`, `cancelled`), `source`/`destination`, FKs to `vehicle_id`/`driver_id`, `cargo_weight`, `planned_distance`, plus `actual_distance`/`fuel_consumed` filled in on completion. Timestamps for each lifecycle transition (`dispatched_at`, `completed_at`, `cancelled_at`).
- **`maintenance.py`** — `MaintenanceLog` table. `MaintenanceStatus` (`active`/`closed`), `MaintenanceType` (`oil_change`, `brake_service`, `tyre_replacement`, `general_service`, `repair`, `other`), `cost`, `started_at`/`closed_at`.
- **`fuel_expense.py`** — two tables: `FuelLog` (liters, cost, date, optional link to a `trip_id`) and `Expense` (`ExpenseType`: `toll`, `repair`, `maintenance`, `other`; `amount`, `description`).

### `backend/app/schemas/` (Pydantic request/response models)
Each resource has the same 3–4 class pattern: a `*Base` (shared fields), `*Create` (input for POST), `*Update` (all-optional fields for PATCH), and `*Out` (response shape, reads from ORM objects). `schemas/user.py` additionally defines `Token` (`access_token`, `token_type`), `TokenPayload`, and `LoginRequest`.

### `backend/app/crud/` (data-access layer)
Thin functions sitting between routes and the ORM — no business rules beyond simple lookups/filters, just query building:
- **`user.py`** — `get_user_by_email`, `get_user_by_id`, `create_user` (hashes the password), `authenticate_user` (looks up by email + verifies password).
- **`vehicle.py`** — `get_vehicle(s)` with filtering/search/sort/pagination, `get_vehicle_by_reg_number`, `get_dispatchable_vehicles` (status = available only), `create_vehicle`, `update_vehicle`, `delete_vehicle`.
- **`driver.py`** — mirrors `vehicle.py`: `get_drivers` (filter/search/sort), `get_assignable_drivers`, `get_driver_by_license`, create/update/delete.
- **`trip.py`** — `get_trips` (filter by status/vehicle/driver, search), `create_trip`, and the three lifecycle transitions `dispatch_trip`, `complete_trip`, `cancel_trip` — these contain the actual business rules (see below).
- **`maintenance.py`** — `get_maintenance(_logs)`, `create_maintenance`, `update_maintenance`, `close_maintenance`.
- **`fuel_expense.py`** — simple list/create for both `FuelLog` and `Expense`.

**Trip lifecycle business rules** (in `crud/trip.py`, referenced throughout the frontend as "Rule N"):
- Creating a trip validates `cargo_weight` doesn't exceed the vehicle's `max_load_capacity`.
- Dispatching a trip validates the vehicle is `available`, the driver is `available` and their license isn't expired, then flips both to `on_trip` and stamps `dispatched_at`.
- Completing a trip records `actual_distance`/`fuel_consumed`, flips the vehicle and driver back to `available`, and stamps `completed_at`.
- Cancelling a trip restores the vehicle/driver to `available` (if they'd been dispatched) and stamps `cancelled_at`.
- Creating a maintenance log automatically flips the vehicle to `in_shop`; closing it restores the vehicle's previous status.

### `backend/app/api/routes/` (HTTP layer — one router per resource)
- **`auth.py`** (`/api/auth`) — `POST /register` (public sign-up), `POST /login` (OAuth2 password flow, form-encoded, returns a JWT), `GET /me` (current user profile).
- **`vehicles.py`** (`/api/vehicles`) — full CRUD, plus `GET /dispatchable` (available-only, for the trip-creation flow) and an `include_meta` query flag on the list endpoint that adds `{items, pagination: {skip, limit, total_count, has_more}}` for infinite-scroll/pagination UIs. Write access requires `FLEET_MANAGER` (or admin).
- **`drivers.py`** (`/api/drivers`) — full CRUD, plus `GET /assignable`. Write access requires `FLEET_MANAGER` or `SAFETY_OFFICER` (or admin).
- **`trips.py`** (`/api/trips`) — list/detail/create, plus `POST /{id}/dispatch`, `POST /{id}/complete` (body: `actual_distance`, `fuel_consumed`), `POST /{id}/cancel`. Write access requires `DRIVER` or `FLEET_MANAGER` (or admin).
- **`maintenance.py`** (`/api/maintenance`) — list/detail/create/update, plus `POST /{id}/close`. Write access requires `FLEET_MANAGER` (or admin).
- **`fuel_expense.py`** (`/api/fuel-logs`, `/api/expenses`) — list/create for both resources. Write access requires `FLEET_MANAGER`, `DRIVER`, or `FINANCIAL_ANALYST` (or admin).
- **`reports.py`** (`/api/reports`) — the analytics surface: `GET /dashboard` (KPI summary), `GET /fuel-efficiency` (km/L per vehicle), `GET /operational-cost` (fuel + maintenance + other expenses per vehicle), `GET /roi` (ROI per vehicle), `GET /export` (CSV download), `GET /export-pdf` (PDF report via ReportLab).
- **`admin.py`** (`/api/admin`) — admin-only surface: full user CRUD including role changes and password resets (`PATCH /users/{id}`), activate/deactivate accounts, `POST /{resource}/{id}/force-status` overrides that bypass all the trip/vehicle/driver workflow validation rules above, and `GET /stats` (system-wide counts by role/resource).
- **`notifications.py`** (`/api/notifications`) — `GET /expiring-licenses` (preview, no emails sent) and `POST /send-license-reminders` (manually trigger the same job the scheduler runs daily). Restricted to `SAFETY_OFFICER`/`FLEET_MANAGER` (or admin).

### `backend/seed.py`
A standalone script (`python seed.py`) that creates all tables and, if the `vehicles` table is empty, inserts a handful of demo vehicles, drivers, and trips so the frontend has something to display immediately after cloning.

### `backend/tests/test_vehicle_documents.py`
A single `unittest.TestCase` (`VehicleDocumentTests`) running against an in-memory SQLite DB, verifying that a vehicle's `documents_url` starts `None` and can be set via `update_vehicle`. This is the only automated test in the repo.

### `backend/requirements.txt`
Pinned dependencies: `fastapi`, `uvicorn`, `SQLAlchemy`, `alembic`, `pydantic`/`pydantic-settings`, `python-jose` + `bcrypt` (auth), `APScheduler` (background jobs), `reportlab` (PDF export), `psycopg2-binary` (Postgres driver, unused by default since `DATABASE_URL` defaults to SQLite), `python-dotenv`, `email-validator`.

### `backend/transitops.db`
A committed SQLite database file (binary, ~72 KB) — likely leftover local dev data. Having a live DB file in version control means every clone starts with whatever data existed at commit time; see [Known Gaps](#known-gaps--things-to-watch).

---

## Frontend — File by File

### Entry & Routing

- **`src/main.jsx`** — Vite/React entrypoint. Mounts `<App />` into `#root` inside `<StrictMode>`, imports global `index.css`.
- **`src/App.jsx`** — Root component. On mount, if a JWT exists in the persisted auth store, it calls `GET /api/auth/me` to validate the token is still live and refresh the user's role/active-status (rather than trusting a possibly-stale localStorage copy). Renders `<BrowserRouter>` → `<AppRoutes />` plus a global `<ToastContainer />`.
- **`src/routes/AppRoutes.jsx`** — All page components are `React.lazy`-loaded (code-split per route) with a spinner `<Suspense>` fallback. Public routes: `/login`, `/register` (wrapped in `AuthLayout`). Protected routes (wrapped in `ProtectedRoute` + `AppLayout`): `/dashboard`, `/vehicles`, `/vehicles/:vehicleId`, `/drivers`, `/drivers/:driverId`, `/trips`, `/trips/:tripId`, `/maintenance`, `/fuel-expense`, `/reports`, `/settings`. Unmatched paths fall through to `NotFound`.
- **`src/routes/ProtectedRoute.jsx`** — Gatekeeper component: shows a branded full-screen loader while the initial auth check is in flight, redirects to `/login` (remembering the attempted path) if unauthenticated, and can optionally redirect to `/dashboard` if the user's role isn't in an `allowedRoles` list passed as a prop.

### Layouts

- **`src/layouts/AppLayout.jsx`** — The shell for every authenticated page: fixed `Sidebar` + `Navbar` + scrollable content area, with Framer Motion `AnimatePresence` page-transition fades keyed by route path.
- **`src/layouts/AuthLayout.jsx`** — Split-screen shell for Login/Register: an animated gradient/branding panel on the left (hidden on mobile), the actual form (`children`) on the right.

### State (`src/store/`)

- **`authStore.js`** — Zustand store (persisted to `localStorage` under `transitops-auth`) holding `user`, `token`, `isLoading`. Exposes `setSession`, `setUser`, `clearSession`, `setLoading`, and derived helpers `isAuthenticated()`, `hasRole(...roles)`, and `can(actionKey)` (wraps `hasPermission` from `constants/roles.js` for UI-level permission checks).
- **`toastStore.js`** — Non-persisted Zustand store holding an array of active toasts. Exposes a plain-object `toast` API (`toast.success/error/warning/info(message, options)`) callable from anywhere, including outside React components (e.g. the Axios interceptor).

### API Layer (`src/services/`)

- **`api.js`** — The shared Axios instance. Base URL from `VITE_API_BASE_URL` (falls back to `http://127.0.0.1:8000`). A **request interceptor** attaches `Authorization: Bearer <token>` to every call. A **response interceptor** normalizes FastAPI's error shapes (`{detail: "..."}` or Pydantic's `{detail: [{msg,...}]}`) into a single `error.message`, auto-clears the session and redirects to `/login` on `401` (except on the login request itself, where a 401 is just "wrong password"), and auto-fires a toast for any failure except login requests and `422` validation errors (which forms display inline instead). Also exports `loginRequest`, special-cased to send `application/x-www-form-urlencoded` since FastAPI's `OAuth2PasswordRequestForm` requires it.
- **`auth.js`** — `register`, `login`, `me`.
- **`vehicles.js`** — `list`, `dispatchable`, `getById`, `create`, `update`, `remove`.
- **`drivers.js`** — `list`, `assignable`, `getById`, `create`, `update`, `remove`.
- **`trips.js`** — `list`, `getById`, `create`, `dispatch`, `complete`, `cancel`.
- **`maintenance.js`** — `list`, `getById`, `create`, `update`, `close`.
- **`fuelExpense.js`** — `listFuelLogs`, `createFuelLog`, `listExpenses`, `createExpense`.
- **`reports.js`** — `dashboard`, `fuelEfficiency`, `operationalCost`, `roi`, `export` (CSV, returned as a `Blob` for download).
- **`admin.js`** — full user management (`listUsers`, `createUser`, `updateUser`, `deleteUser`, `activateUser`/`deactivateUser`), the force-status overrides, and `stats`.

Every service file is a thin, one-to-one wrapper over its corresponding backend route file — this mapping makes it easy to trace any UI action back to its exact API call.

### Constants (`src/constants/`)

- **`roles.js`** — `ROLES` enum matching the backend's `RoleEnum` exactly. `ROLE_META` (display label, description, color, icon per role) drives role badges throughout the UI. `ROLE_NAV_ACCESS` + `canAccessNavKey()` control which sidebar links each role sees. `ROLE_ROUTE_ACCESS` + `hasPermission()` control which actions (create/edit/delete vehicle, dispatch trip, etc.) each role can perform — admins bypass every check.
- **`statuses.js`** — Mirrors every backend status enum (`VehicleStatus`, `DriverStatus`, `TripStatus`, `MaintenanceStatus`) with a `{label, color}` metadata map each, consumed by the shared `StatusChip` component so adding a new status only requires one entry here.

### Shared / UI Components (`src/components/`)

- **`ui/Button.jsx`** — Variant-driven button component with loading-state support.
- **`ui/Card.jsx`** — A `forwardRef` wrapper `<div>` with consistent surface styling and an optional `hoverable` prop.
- **`ui/Input.jsx`** — Exports three `forwardRef` form controls: `Input`, `Select`, `Textarea` — styled to match the design system and wired for `react-hook-form`.
- **`ui/Modal.jsx`** — `Modal` (base dialog), `ModalBody`, `ModalFooter`, and `ConfirmDialog` (a pre-built yes/no confirmation dialog used for delete actions across the app).
- **`ui/Badge.jsx`** — Small colored pill/label component.
- **`ui/Toast.jsx`** — `ToastContainer` — subscribes to `toastStore` and renders the stack of active toasts with enter/exit animation.
- **`shared/StatusChip.jsx`** — Renders a colored status pill from any of the `*_STATUS_META` maps in `constants/statuses.js` — the single place that turns a raw backend enum value into a styled UI element.
- **`charts/ChartComponents.jsx`** — Recharts wrappers: `ChartCard` (generic card shell for a chart), `AreaChartCard`, `LineChartCard`, `BarChartCard`, `PieChartCard`, plus a shared `CHART_COLORS` palette. Used throughout Dashboard and Reports.
- **`layout/Navbar.jsx`** — Top bar: search/command-palette trigger, notifications, and a user menu (`MenuLink` helper) with logout.
- **`layout/Sidebar.jsx`** — Left navigation, filtered per-role via `canAccessNavKey`; `NavItem` renders each link with active-state styling and supports a collapsed mode.

### Pages (`src/pages/`)

- **`auth/Login.jsx`** — Email/password form (`react-hook-form`) posting to `authApi.login`, then `authApi.me`, then `setSession`. Includes a demo-account role picker that pre-fills the email field for hackathon demo convenience (role itself isn't sent to the API — the backend derives it from the account). Redirects back to the originally-attempted route (via `location.state.from`) after login. *Note: `pages/auth/Register.jsx` is referenced by `AppRoutes.jsx` but does not exist in the repository yet — see [Known Gaps](#known-gaps--things-to-watch).*
- **`dashboard/Dashboard.jsx`** — Landing page after login. Pulls `reportsApi.dashboard()` for KPI cards (fleet counts, utilization, active trips, drivers on duty) and renders `AreaChartCard`/`PieChartCard` visualizations plus recent-activity lists with `StatusChip`s.
- **`vehicles/VehiclesList.jsx`** — Data table (search, filter by status/type/region, sort, create/edit via modal form) for the vehicle fleet. Largest list page (~690 lines).
- **`vehicles/VehicleDetails.jsx`** — Single-vehicle profile: stats, edit form, related trips/maintenance/fuel history, delete confirmation.
- **`drivers/DriversList.jsx`** — Same pattern as `VehiclesList.jsx` for drivers, including license-expiry indicators.
- **`drivers/DriverDetails.jsx`** — Single-driver profile with trip history and safety-score display.
- **`trips/TripDispatch.jsx`** — The largest page in the app (~960 lines): trip list + a multi-step create/dispatch flow that pulls `dispatchable` vehicles and `assignable` drivers, validates cargo weight against capacity client-side (mirroring backend Rule 5), and drives the dispatch/complete/cancel actions.
- **`trips/TripDetails.jsx`** — Single-trip view with status timeline and the complete/cancel action forms (actual distance, fuel consumed).
- **`maintenance/Maintenance.jsx`** — Maintenance log list/board (open vs. closed), create/close-log forms, filtered by vehicle. Second-largest page (~1200 lines).
- **`fuel-expense/FuelExpense.jsx`** — Combined fuel-log and expense-log management with charts. Largest single file in the repo (~1286 lines).
- **`reports/Reports.jsx`** — Fuel efficiency, operational cost, and ROI report views (charts + tables), plus CSV/PDF export triggers.
- **`settings/Settings.jsx`** — User/account settings; for admins, surfaces the `admin.js` user-management API (list/create/update/deactivate users) — the largest "settings"-type page (~980 lines).
- **`NotFound.jsx`** — Styled 404 page (animated "glowing neon sign" 404, scanline effect, floating background orbs) shown for any unmatched route, with a link back to the dashboard.

### Config Files

- **`vite.config.js`** — Vite + `@vitejs/plugin-react` build configuration.
- **`tailwind.config.js`** — Tailwind theme customization: the `accent`/`success`/`warning`/`danger`/`info`/`muted` semantic color tokens referenced throughout `constants/statuses.js` and every UI component, plus custom animations (`animate-float`, `animate-pulse-glow`, grid background utilities) used in `AuthLayout`/`NotFound`.
- **`postcss.config.js`** — PostCSS pipeline (Tailwind + Autoprefixer).
- **`.oxlintrc.json`** — Linter config for `oxlint` (the `npm run lint` script).
- **`index.html`** — Vite HTML entry, mounts `#root`.
- **`package.json`** — Scripts (`dev`, `build`, `lint`, `preview`) and dependencies (React 19, Vite, Tailwind, Zustand, Axios, React Hook Form, React Router 7, Recharts, TanStack Table, Framer Motion, date-fns, lucide-react icons, clsx/tailwind-merge).

---

## Data Model Summary

| Entity | Key fields | Status enum |
|---|---|---|
| **User** | full_name, email, hashed_password, role, is_active | — |
| **Vehicle** | registration_number, name, type, max_load_capacity, odometer, acquisition_cost, region | available · on_trip · in_shop · retired |
| **Driver** | name, license_number, license_category, license_expiry_date, safety_score | available · on_trip · off_duty · suspended |
| **Trip** | source, destination, vehicle_id, driver_id, cargo_weight, planned/actual_distance, fuel_consumed | draft · dispatched · completed · cancelled |
| **MaintenanceLog** | vehicle_id, maintenance_type, description, cost | active · closed |
| **FuelLog** | vehicle_id, trip_id (optional), liters, cost, date | — |
| **Expense** | vehicle_id, expense_type, amount, description, date | — |

## Roles & Permissions

| Role | Can manage | Sidebar access |
|---|---|---|
| **Admin** | Everything, including user accounts, role changes, and force-status overrides | All pages |
| **Fleet Manager** | Vehicles, drivers, trips, maintenance | dashboard, vehicles, drivers, trips, maintenance, reports, settings |
| **Driver** | Create/dispatch/complete/cancel their trips, log fuel/expenses | dashboard, trips, settings |
| **Safety Officer** | Drivers (license compliance), maintenance visibility, license reminders | dashboard, drivers, maintenance, settings |
| **Financial Analyst** | Fuel logs, expenses, reports | dashboard, fuel-expense, reports, settings |

## API Endpoint Reference

| Prefix | Purpose |
|---|---|
| `/api/auth` | register, login, me |
| `/api/vehicles` | CRUD + `/dispatchable` |
| `/api/drivers` | CRUD + `/assignable` |
| `/api/trips` | CRUD + `/dispatch`, `/complete`, `/cancel` |
| `/api/maintenance` | CRUD + `/close` |
| `/api/fuel-logs`, `/api/expenses` | list + create |
| `/api/reports` | `/dashboard`, `/fuel-efficiency`, `/operational-cost`, `/roi`, `/export`, `/export-pdf` |
| `/api/admin` | user management, force-status overrides, `/stats` |
| `/api/notifications` | `/expiring-licenses`, `/send-license-reminders` |

Full interactive docs: `http://localhost:8000/docs`.

## Known Gaps / Things to Watch

- **`Register.jsx` is missing.** `AppRoutes.jsx` lazy-imports `../pages/auth/Register`, but no such file exists in the repository yet — visiting `/register` will currently fail to resolve.
- **Hardcoded personal email addresses.** `backend/app/core/license_reminder.py` sends every license-expiry alert to three hardcoded Gmail addresses in addition to the intended role-based recipients. This looks like leftover debugging code and should be removed before any real deployment.
- **A live SQLite database file is committed** at both `backend/transitops.db` and the repo-root `transitops.db`. Consider adding `*.db` to `.gitignore` and relying on `seed.py` for reproducible sample data instead.
- **`SECRET_KEY` has an insecure default** (`"your-secret-key-change-this-later"`) in `core/config.py` — make sure a real secret is set via `.env` before deploying anywhere.
- **Test coverage is minimal** — only one `unittest` case exists (`test_vehicle_documents.py`); the trip lifecycle business rules (capacity checks, status transitions) have no automated tests yet.
- **CORS is hardcoded** to `http://localhost:5173` in `main.py`; update `allow_origins` for any non-local deployment.