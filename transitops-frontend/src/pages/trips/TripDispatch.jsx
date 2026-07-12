import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  AlertTriangle,
  Route,
  Truck,
  User,
  Check,
  X,
  PlayCircle,
  CheckCircle2,
  XCircle,
  MapPin,
  Package,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import tripsApi from '../../services/trips';
import vehiclesApi from '../../services/vehicles';
import driversApi from '../../services/drivers';
import { TRIP_STATUS_META, TRIP_LIFECYCLE_ORDER, getStatusMeta } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - This is the hero feature, so it gets the most animation and
 *   interaction budget in the app. A few deliberate choices:
 *
 * - TripOut only returns vehicle_id / driver_id (raw FK strings), no
 *   denormalized names. This page resolves them client-side once by
 *   fetching vehicles + drivers in parallel and building id->entity
 *   lookup maps, so rows can show "VAN-05 · Alex Rivera" instead of
 *   raw UUIDs, without changing the backend contract.
 *
 * - Expand-in-place instead of forced navigation: clicking a trip row
 *   expands it inline to show a compact timeline + the relevant next
 *   action (Dispatch / Complete / Cancel). A dispatcher working
 *   through a queue of trips does this dozens of times a shift —
 *   forcing a full route change each time would be friction. The
 *   full /trips/:tripId page still exists for deep-linking/sharing.
 *
 * - Custom searchable pickers (not native <select>) for vehicle/
 *   driver selection in Create Trip: native options can't render a
 *   second line of styled metadata (capacity / safety score / status
 *   dot), and that inline context is exactly what was asked for so
 *   dispatchers can pick correctly on the first try.
 *
 * - Vehicle picker sources from vehiclesApi.dispatchable() (Available
 *   only) and driver picker from driversApi.assignable() (Available +
 *   license valid) — this reinforces business Rules 2/3/4 at the UI
 *   level by only offering eligible options, while the backend
 *   remains the final authority on dispatch.
 *
 * - Live cargo-weight-vs-capacity check (Rule 5) is shown as an
 *   inline warning the instant both a vehicle and a weight are
 *   chosen — pure client-side UX sugar, never blocks submission,
 *   since the backend's validation is authoritative.
 *
 * - Status accent: dispatched trips get a soft pulsing glow on their
 *   left accent bar (animate opacity 0.4->1 loop) to read as "in
 *   motion" versus the static bars for draft/completed/cancelled —
 *   small touch, but it's what makes a trip board feel alive rather
 *   than a static list.
 *
 * - Complete requires a body (actual_distance, fuel_consumed) per the
 *   TripCompleteRequest schema — this is the only action with an
 *   inline mini-form; Dispatch and Cancel are single-click since
 *   their endpoints take no body.
 * ------------------------------------------------------------------ */

const PAGE_SIZE = 15;

const TRIP_STATUS_OPTIONS = Object.entries(TRIP_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

/* --------------------------- Entity lookup --------------------------- */

function useEntityMaps() {
  const [vehicleMap, setVehicleMap] = useState({});
  const [driverMap, setDriverMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [vehicles, drivers] = await Promise.all([
        vehiclesApi.list({ limit: 500 }),
        driversApi.list({ limit: 500 }),
      ]);
      const vRows = Array.isArray(vehicles) ? vehicles : vehicles?.items ?? [];
      const dRows = Array.isArray(drivers) ? drivers : drivers?.items ?? [];
      setVehicleMap(Object.fromEntries(vRows.map((v) => [v.id, v])));
      setDriverMap(Object.fromEntries(dRows.map((d) => [d.id, d])));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { vehicleMap, driverMap, loaded, refresh };
}

/* ----------------------------- Pickers ----------------------------- */

function SearchablePicker({
  label,
  required,
  placeholder,
  items, // [{ id, primary, secondary, statusColor }]
  value,
  onChange,
  loading,
  emptyMessage,
  error,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = items.filter(
    (i) =>
      !query.trim() ||
      i.primary.toLowerCase().includes(query.toLowerCase()) ||
      i.secondary?.toLowerCase().includes(query.toLowerCase())
  );

  const selected = items.find((i) => i.id === value);

  return (
    <div className="relative w-full" ref={ref}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          {label}
          {required && <span className="ml-0.5 text-danger-400">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-left text-sm transition-all',
          error ? 'border-danger-500/50' : 'border-white/10 hover:border-white/20',
          open && 'border-accent-500 shadow-glow-sm'
        )}
      >
        {selected ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-white/90">{selected.primary}</span>
            <span className="truncate text-xs text-white/40">{selected.secondary}</span>
          </div>
        ) : (
          <span className="text-white/30">{placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>
      {error && <p className="mt-1.5 text-xs text-danger-400">{error}</p>}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 shadow-2xl"
          >
            <div className="border-b border-white/10 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg bg-white/[0.04] py-1.5 pl-8 pr-2 text-xs text-white outline-none placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {loading ? (
                <div className="px-3 py-6 text-center text-xs text-white/30">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-white/30">
                  {emptyMessage || 'No results'}
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5',
                      value === item.id && 'bg-accent-500/10'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/90">{item.primary}</div>
                      <div className="truncate text-xs text-white/40">{item.secondary}</div>
                    </div>
                    {value === item.id && <Check className="h-4 w-4 shrink-0 text-accent-400" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- Lifecycle stepper --------------------------- */

function LifecycleStepper({ status }) {
  const meta = TRIP_STATUS_META[status];
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-danger-400">
        <XCircle className="h-3.5 w-3.5" /> Cancelled
      </div>
    );
  }

  const currentStep = meta?.step ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      {TRIP_LIFECYCLE_ORDER.map((s, i) => {
        const stepMeta = TRIP_STATUS_META[s];
        const isActive = i <= currentStep;
        const isCurrent = i === currentStep;
        return (
          <React.Fragment key={s}>
            <div className="relative flex items-center gap-1.5">
              <div
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  isActive ? 'bg-accent-cyan' : 'bg-white/15'
                )}
              >
                {isCurrent && s === 'dispatched' && (
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 -m-1 rounded-full bg-accent-cyan/40"
                  />
                )}
              </div>
              <span className={cn('text-xs', isActive ? 'text-white/70' : 'text-white/30')}>
                {stepMeta.label}
              </span>
            </div>
            {i < TRIP_LIFECYCLE_ORDER.length - 1 && (
              <div className={cn('h-px w-4', i < currentStep ? 'bg-accent-cyan' : 'bg-white/10')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* --------------------------- Create Trip Form --------------------------- */

function CreateTripForm({ vehicleOptions, driverOptions, onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      source: '',
      destination: '',
      vehicle_id: '',
      driver_id: '',
      cargo_weight: '',
      planned_distance: '',
    },
  });

  const selectedVehicleId = watch('vehicle_id');
  const cargoWeight = watch('cargo_weight');
  const selectedVehicle = vehicleOptions.find((v) => v.id === selectedVehicleId);
  const capacityExceeded =
    selectedVehicle && cargoWeight && Number(cargoWeight) > selectedVehicle.rawCapacity;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Modal.Body className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Source"
            required
            leftIcon={<MapPin />}
            error={errors.source?.message}
            {...register('source', { required: 'Source is required' })}
          />
          <Input
            label="Destination"
            required
            leftIcon={<MapPin />}
            error={errors.destination?.message}
            {...register('destination', { required: 'Destination is required' })}
          />
        </div>

        <Controller
          name="vehicle_id"
          control={control}
          rules={{ required: 'Select a vehicle' }}
          render={({ field }) => (
            <SearchablePicker
              label="Vehicle"
              required
              placeholder="Select an available vehicle"
              items={vehicleOptions.map((v) => ({
                id: v.id,
                primary: `${v.registration_number} · ${v.name}`,
                secondary: `Capacity: ${v.rawCapacity} kg`,
              }))}
              value={field.value}
              onChange={field.onChange}
              emptyMessage="No dispatchable vehicles available"
              error={errors.vehicle_id?.message}
            />
          )}
        />

        <Controller
          name="driver_id"
          control={control}
          rules={{ required: 'Select a driver' }}
          render={({ field }) => (
            <SearchablePicker
              label="Driver"
              required
              placeholder="Select an assignable driver"
              items={driverOptions.map((d) => ({
                id: d.id,
                primary: d.name,
                secondary: `Safety score: ${d.safety_score?.toFixed(0)}`,
              }))}
              value={field.value}
              onChange={field.onChange}
              emptyMessage="No assignable drivers available"
              error={errors.driver_id?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Cargo Weight (kg)"
              type="number"
              step="0.01"
              required
              leftIcon={<Package />}
              error={errors.cargo_weight?.message}
              {...register('cargo_weight', {
                required: 'Cargo weight is required',
                valueAsNumber: true,
                min: { value: 0.01, message: 'Must be greater than 0' },
              })}
            />
            {capacityExceeded && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Exceeds {selectedVehicle.registration_number}&apos;s {selectedVehicle.rawCapacity} kg capacity
              </p>
            )}
          </div>
          <Input
            label="Planned Distance (km)"
            type="number"
            step="0.01"
            required
            leftIcon={<Gauge />}
            error={errors.planned_distance?.message}
            {...register('planned_distance', {
              required: 'Planned distance is required',
              valueAsNumber: true,
              min: { value: 0.01, message: 'Must be greater than 0' },
            })}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Create Trip
        </Button>
      </Modal.Footer>
    </form>
  );
}

/* --------------------------- Complete Trip Form --------------------------- */

function CompleteTripInlineForm({ onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { actual_distance: '', fuel_consumed: '' } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          label="Actual Distance (km)"
          type="number"
          step="0.01"
          error={errors.actual_distance?.message}
          {...register('actual_distance', {
            required: 'Required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Must be > 0' },
          })}
        />
      </div>
      <div className="flex-1">
        <Input
          label="Fuel Consumed (L)"
          type="number"
          step="0.01"
          error={errors.fuel_consumed?.message}
          {...register('fuel_consumed', {
            required: 'Required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Must be > 0' },
          })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="md" isLoading={isSubmitting} leftIcon={<CheckCircle2 />}>
          Complete
        </Button>
      </div>
    </form>
  );
}

/* --------------------------- Trip Row --------------------------- */

function TripRow({ trip, vehicle, driver, onDispatch, onComplete, onCancel, actionState, canManage }) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const meta = TRIP_STATUS_META[trip.status];

  const isPulsing = trip.status === 'dispatched';

  return (
    <div className="border-b border-white/5 last:border-none">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="group relative flex cursor-pointer items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
      >
        <span
          className={cn(
            'absolute left-0 top-0 h-full w-0.5',
            meta.color === 'success' && 'bg-emerald-400',
            meta.color === 'info' && 'bg-accent-cyan',
            meta.color === 'danger' && 'bg-danger-400',
            meta.color === 'muted' && 'bg-white/20'
          )}
        >
          {isPulsing && (
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="absolute inset-0 bg-accent-cyan"
            />
          )}
        </span>

        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-white/30 transition-transform', expanded && 'rotate-180')}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <span className="truncate">{trip.source}</span>
            <span className="text-white/30">→</span>
            <span className="truncate">{trip.destination}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" /> {vehicle?.registration_number || '—'}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {driver?.name || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" /> {trip.cargo_weight} kg
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 sm:block">
          <LifecycleStepper status={trip.status} />
        </div>
        <StatusChip type="trip" status={trip.status} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/5 bg-white/[0.015] px-4 py-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Planned Distance" value={`${trip.planned_distance} km`} />
                <MiniStat label="Cargo Weight" value={`${trip.cargo_weight} kg`} />
                <MiniStat
                  label="Actual Distance"
                  value={trip.actual_distance ? `${trip.actual_distance} km` : '—'}
                />
                <MiniStat
                  label="Fuel Consumed"
                  value={trip.fuel_consumed ? `${trip.fuel_consumed} L` : '—'}
                />
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to={`/trips/${trip.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-accent-400 hover:underline"
                >
                  View full details →
                </Link>

                {canManage && (
                  <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                    {trip.status === 'draft' && (
                      <Button
                        size="sm"
                        leftIcon={<PlayCircle />}
                        isLoading={actionState === 'dispatch'}
                        onClick={() => onDispatch(trip)}
                      >
                        Dispatch
                      </Button>
                    )}
                    {trip.status === 'dispatched' && !completing && (
                      <>
                        <Button size="sm" leftIcon={<CheckCircle2 />} onClick={() => setCompleting(true)}>
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={<X />}
                          isLoading={actionState === 'cancel'}
                          onClick={() => onCancel(trip)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {completing && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <CompleteTripInlineForm
                    isSubmitting={actionState === 'complete'}
                    onCancel={() => setCompleting(false)}
                    onSubmit={async (values) => {
                      await onComplete(trip, values);
                      setCompleting(false);
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2.5">
      <div className="text-xs text-white/40">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white/80">{value}</div>
    </div>
  );
}

/* ----------------------------- States ----------------------------- */

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd, canManage }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Route className="h-6 w-6 text-white/30" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/70">No trips found</p>
        <p className="mt-0.5 text-xs text-white/40">
          {canManage ? 'Create your first trip to get started.' : 'No trips match the current filters.'}
        </p>
      </div>
      {canManage && (
        <Button size="sm" leftIcon={<Plus />} onClick={onAdd}>
          Create Trip
        </Button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-500/10">
        <AlertTriangle className="h-6 w-6 text-danger-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/70">Couldn&apos;t load trips</p>
        <p className="mt-0.5 text-xs text-white/40">Check your connection and try again.</p>
      </div>
      <Button size="sm" variant="secondary" leftIcon={<RefreshCcw />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* ------------------------------- Page ------------------------------- */

export default function TripDispatch() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('driver', 'fleet_manager', 'admin');

  const { vehicleMap, driverMap, loaded: entitiesLoaded, refresh: refreshEntities } = useEntityMaps();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionTripId, setActionTripId] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const [dispatchableVehicles, setDispatchableVehicles] = useState([]);
  const [assignableDrivers, setAssignableDrivers] = useState([]);
  const [pickersLoading, setPickersLoading] = useState(false);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
      if (statusFilter) params.status_filter = statusFilter;
      const data = await tripsApi.list(params);
      const rows = Array.isArray(data) ? data : data?.items ?? [];
      setTrips(rows);
      setHasNextPage(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const openCreateModal = async () => {
    setAddOpen(true);
    setPickersLoading(true);
    try {
      const [vehicles, drivers] = await Promise.all([
        vehiclesApi.dispatchable(),
        driversApi.assignable(),
      ]);
      setDispatchableVehicles(Array.isArray(vehicles) ? vehicles : vehicles?.items ?? []);
      setAssignableDrivers(Array.isArray(drivers) ? drivers : drivers?.items ?? []);
    } finally {
      setPickersLoading(false);
    }
  };

  const handleCreate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const payload = {
        source: formValues.source,
        destination: formValues.destination,
        vehicle_id: formValues.vehicle_id,
        driver_id: formValues.driver_id,
        cargo_weight: Number(formValues.cargo_weight),
        planned_distance: Number(formValues.planned_distance),
      };
      await tripsApi.create(payload);
      setAddOpen(false);
      fetchTrips();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDispatch = async (trip) => {
    setActionTripId(trip.id);
    setActionState('dispatch');
    try {
      await tripsApi.dispatch(trip.id);
      await Promise.all([fetchTrips(), refreshEntities()]);
    } finally {
      setActionTripId(null);
      setActionState(null);
    }
  };

  const handleComplete = async (trip, values) => {
    setActionTripId(trip.id);
    setActionState('complete');
    try {
      await tripsApi.complete(trip.id, {
        actual_distance: Number(values.actual_distance),
        fuel_consumed: Number(values.fuel_consumed),
      });
      await Promise.all([fetchTrips(), refreshEntities()]);
    } finally {
      setActionTripId(null);
      setActionState(null);
    }
  };

  const handleCancelConfirm = async () => {
    setActionTripId(cancelTarget.id);
    setActionState('cancel');
    try {
      await tripsApi.cancel(cancelTarget.id);
      setCancelTarget(null);
      await Promise.all([fetchTrips(), refreshEntities()]);
    } finally {
      setActionTripId(null);
      setActionState(null);
    }
  };

  const filteredTrips = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      const vehicle = vehicleMap[t.vehicle_id];
      const driver = driverMap[t.driver_id];
      return (
        t.source?.toLowerCase().includes(q) ||
        t.destination?.toLowerCase().includes(q) ||
        vehicle?.registration_number?.toLowerCase().includes(q) ||
        driver?.name?.toLowerCase().includes(q)
      );
    });
  }, [trips, search, vehicleMap, driverMap]);

  const vehiclePickerOptions = dispatchableVehicles.map((v) => ({
    id: v.id,
    registration_number: v.registration_number,
    name: v.name,
    rawCapacity: v.max_load_capacity,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Trip Dispatch</h1>
          <p className="text-sm text-white/50">Create, dispatch, and track trips across your fleet.</p>
        </div>
        {canManage && (
          <Button leftIcon={<Plus />} onClick={openCreateModal}>
            Create Trip
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="card-surface glass flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by source, destination, vehicle, or driver…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-accent-500 focus:shadow-glow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 outline-none focus:border-accent-500"
        >
          <option value="">All Statuses</option>
          {TRIP_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Trip list */}
      <div className="card-surface glass overflow-hidden rounded-2xl border border-white/10">
        {loading || !entitiesLoaded ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={fetchTrips} />
        ) : filteredTrips.length === 0 ? (
          <EmptyState onAdd={openCreateModal} canManage={canManage} />
        ) : (
          <LayoutGroup>
            {filteredTrips.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                vehicle={vehicleMap[trip.vehicle_id]}
                driver={driverMap[trip.driver_id]}
                canManage={canManage}
                actionState={actionTripId === trip.id ? actionState : null}
                onDispatch={handleDispatch}
                onComplete={handleComplete}
                onCancel={(t) => setCancelTarget(t)}
              />
            ))}
          </LayoutGroup>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && filteredTrips.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + filteredTrips.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft />}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ChevronRight />}
              disabled={!hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Trip */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create Trip"
        description="New trips start in Draft status until dispatched."
        size="lg"
      >
        <CreateTripForm
          vehicleOptions={vehiclePickerOptions}
          driverOptions={assignableDrivers}
          onSubmit={handleCreate}
          onCancel={() => setAddOpen(false)}
          isSubmitting={formSubmitting}
        />
      </Modal>

      {/* Cancel confirm */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel this trip?"
        description={`${cancelTarget?.source} → ${cancelTarget?.destination} will be cancelled. The vehicle and driver will be restored to Available.`}
        confirmLabel="Cancel Trip"
        isLoading={actionState === 'cancel'}
      />
    </div>
  );
}