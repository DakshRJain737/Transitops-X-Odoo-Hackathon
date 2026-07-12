import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Truck,
  User,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Circle,
  X,
  AlertTriangle,
  RefreshCcw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import tripsApi from '../../services/trips';
import vehiclesApi from '../../services/vehicles';
import driversApi from '../../services/drivers';
import { TRIP_STATUS_META } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - Resolves vehicle_id/driver_id to full entities via a single
 *   parallel fetch (getById each) since TripOut doesn't denormalize
 *   these — same reasoning as TripDispatch's entity map, just scoped
 *   to one trip instead of bulk-loading everything.
 *
 * - Timeline is built directly from the four real timestamp fields
 *   on TripOut (created_at, dispatched_at, completed_at,
 *   cancelled_at) — no synthetic/fake steps. A step only renders as
 *   "reached" if its timestamp is actually present.
 *
 * - Cancelled branches visually off the main Draft->Dispatched path
 *   rather than being forced into the same linear line, since
 *   cancellation can happen from either Draft or Dispatched — mirrors
 *   TRIP_STATUS_META's `step: -1` treatment.
 * ------------------------------------------------------------------ */

function CompleteTripForm({ onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { actual_distance: '', fuel_consumed: '' } });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Modal.Body className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Actual Distance (km)"
          type="number"
          step="0.01"
          required
          error={errors.actual_distance?.message}
          {...register('actual_distance', {
            required: 'Required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Must be > 0' },
          })}
        />
        <Input
          label="Fuel Consumed (L)"
          type="number"
          step="0.01"
          required
          error={errors.fuel_consumed?.message}
          {...register('fuel_consumed', {
            required: 'Required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Must be > 0' },
          })}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} leftIcon={<CheckCircle2 />}>
          Complete Trip
        </Button>
      </Modal.Footer>
    </form>
  );
}

function TimelineStep({ icon: Icon, title, timestamp, isActive, isLast, isDanger }) {
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <span
          className={cn(
            'absolute left-[15px] top-8 h-full w-px',
            isActive ? (isDanger ? 'bg-danger-400/40' : 'bg-accent-cyan/40') : 'bg-white/10'
          )}
        />
      )}
      <div
        className={cn(
          'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
          isActive
            ? isDanger
              ? 'border-danger-400 bg-danger-400/10 text-danger-400'
              : 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
            : 'border-white/15 bg-white/[0.02] text-white/20'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 pt-1">
        <div className={cn('text-sm font-medium', isActive ? 'text-white/90' : 'text-white/30')}>{title}</div>
        <div className="mt-0.5 text-xs text-white/40">
          {timestamp ? new Date(timestamp).toLocaleString() : 'Pending'}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-none">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-white/90">{value ?? '—'}</span>
    </div>
  );
}

export default function TripDetails() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('driver', 'fleet_manager', 'admin');

  const [trip, setTrip] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [dispatching, setDispatching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const tripData = await tripsApi.getById(tripId);
      setTrip(tripData);
      const [vehicleData, driverData] = await Promise.all([
        vehiclesApi.getById(tripData.vehicle_id).catch(() => null),
        driversApi.getById(tripData.driver_id).catch(() => null),
      ]);
      setVehicle(vehicleData);
      setDriver(driverData);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDispatch = async () => {
    setDispatching(true);
    try {
      const updated = await tripsApi.dispatch(tripId);
      setTrip(updated);
      fetchAll();
    } finally {
      setDispatching(false);
    }
  };

  const handleComplete = async (values) => {
    setCompleting(true);
    try {
      const updated = await tripsApi.complete(tripId, {
        actual_distance: Number(values.actual_distance),
        fuel_consumed: Number(values.fuel_consumed),
      });
      setTrip(updated);
      setCompleteOpen(false);
      fetchAll();
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const updated = await tripsApi.cancel(tripId);
      setTrip(updated);
      setCancelOpen(false);
      fetchAll();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64 rounded-md" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-danger-400" />
        <p className="text-sm text-white/60">Couldn&apos;t load this trip.</p>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCcw />} onClick={fetchAll}>
            Retry
          </Button>
          <Button variant="ghost" leftIcon={<ArrowLeft />} onClick={() => navigate('/trips')}>
            Back to Trips
          </Button>
        </div>
      </div>
    );
  }

  const isCancelled = trip.status === 'cancelled';
  const meta = TRIP_STATUS_META[trip.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/trips')}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
                <span>{trip.source}</span>
                <span className="text-white/30">→</span>
                <span>{trip.destination}</span>
              </h1>
              <StatusChip type="trip" status={trip.status} />
            </div>
            <p className="mt-1 text-sm text-white/50">
              Trip #{trip.id?.slice(0, 8)} · Created {new Date(trip.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            {trip.status === 'draft' && (
              <Button leftIcon={<PlayCircle />} isLoading={dispatching} onClick={handleDispatch}>
                Dispatch Trip
              </Button>
            )}
            {trip.status === 'dispatched' && (
              <>
                <Button leftIcon={<CheckCircle2 />} onClick={() => setCompleteOpen(true)}>
                  Complete Trip
                </Button>
                <Button variant="danger" leftIcon={<X />} onClick={() => setCancelOpen(true)}>
                  Cancel Trip
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Timeline */}
        <div className="card-surface glass rounded-2xl border border-white/10 p-6 lg:col-span-2">
          <h3 className="mb-5 text-sm font-semibold text-white/90">Trip Timeline</h3>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <TimelineStep icon={Circle} title="Draft Created" timestamp={trip.created_at} isActive />
            <TimelineStep
              icon={PlayCircle}
              title="Dispatched"
              timestamp={trip.dispatched_at}
              isActive={!!trip.dispatched_at}
              isLast={isCancelled}
            />
            {!isCancelled && (
              <TimelineStep
                icon={CheckCircle2}
                title="Completed"
                timestamp={trip.completed_at}
                isActive={!!trip.completed_at}
                isLast
              />
            )}
            {isCancelled && (
              <TimelineStep
                icon={XCircle}
                title="Cancelled"
                timestamp={trip.cancelled_at}
                isActive
                isDanger
                isLast
              />
            )}
          </motion.div>
        </div>

        {/* Vehicle & driver cards */}
        <div className="space-y-4">
          <div className="card-surface glass rounded-2xl border border-white/10 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
              <Truck className="h-4 w-4 text-accent-cyan" /> Vehicle
            </h3>
            {vehicle ? (
              <Link
                to={`/vehicles/${vehicle.id}`}
                className="block rounded-xl border border-white/10 p-3 hover:border-accent-500/40"
              >
                <div className="font-mono text-sm font-medium text-white">{vehicle.registration_number}</div>
                <div className="mt-0.5 text-xs text-white/50">{vehicle.name}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>Capacity: {vehicle.max_load_capacity} kg</span>
                  <StatusChip type="vehicle" status={vehicle.status} />
                </div>
              </Link>
            ) : (
              <p className="text-xs text-white/30">Vehicle unavailable</p>
            )}
          </div>

          <div className="card-surface glass rounded-2xl border border-white/10 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
              <User className="h-4 w-4 text-accent-violet" /> Driver
            </h3>
            {driver ? (
              <Link
                to={`/drivers/${driver.id}`}
                className="block rounded-xl border border-white/10 p-3 hover:border-accent-500/40"
              >
                <div className="text-sm font-medium text-white">{driver.name}</div>
                <div className="mt-0.5 font-mono text-xs text-white/50">{driver.license_number}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>Safety: {driver.safety_score?.toFixed(0)}</span>
                  <StatusChip type="driver" status={driver.status} />
                </div>
              </Link>
            ) : (
              <p className="text-xs text-white/30">Driver unavailable</p>
            )}
          </div>
        </div>
      </div>

      {/* Trip details */}
      <div className="card-surface glass rounded-2xl border border-white/10 p-5">
        <h3 className="mb-2 text-sm font-semibold text-white/90">Trip Details</h3>
        <div>
          <InfoRow label="Source" value={trip.source} />
          <InfoRow label="Destination" value={trip.destination} />
          <InfoRow label="Cargo Weight" value={`${trip.cargo_weight} kg`} />
          <InfoRow label="Planned Distance" value={`${trip.planned_distance} km`} />
          <InfoRow label="Actual Distance" value={trip.actual_distance ? `${trip.actual_distance} km` : null} />
          <InfoRow label="Fuel Consumed" value={trip.fuel_consumed ? `${trip.fuel_consumed} L` : null} />
          <InfoRow label="Status" value={meta?.label} />
        </div>
      </div>

      {/* Complete modal */}
      <Modal
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete Trip"
        description="Enter the actual trip metrics to close it out."
      >
        <CompleteTripForm
          onSubmit={handleComplete}
          onCancel={() => setCompleteOpen(false)}
          isSubmitting={completing}
        />
      </Modal>

      {/* Cancel confirm */}
      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel this trip?"
        description="The vehicle and driver will be restored to Available. This cannot be undone."
        confirmLabel="Cancel Trip"
        isLoading={cancelling}
      />
    </div>
  );
}