import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  IdCard,
  ShieldCheck,
  Phone,
  CalendarClock,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  Route,
  ShieldAlert,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import driversApi from '../../services/drivers';
import { getStatusMeta } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - Same single-page shell as VehicleDetails for visual consistency:
 *   header stat strip + overview info grid + a TODO-stubbed related-
 *   records section (Trip History here), wired for real once the
 *   Trips page (#24) exists.
 *
 * - `is_license_expired` from the backend is treated as the sole
 *   source of truth for "expired" — the amber "expiring soon"
 *   threshold is purely additive client-side UI sugar and never
 *   contradicts it.
 *
 * - No "Documents placeholder" section — that's explicitly listed as
 *   an unscoped bonus feature in the original spec, so it's left out
 *   entirely rather than faked.
 * ------------------------------------------------------------------ */

const EXPIRY_WARNING_DAYS = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

function StatCard({ icon: Icon, label, value, accent = 'cyan' }) {
  const accentMap = {
    cyan: 'text-accent-cyan bg-accent-cyan/10',
    violet: 'text-accent-violet bg-accent-violet/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    danger: 'text-danger-400 bg-danger-400/10',
  };
  return (
    <div className="card-surface glass flex items-center gap-3 rounded-2xl border border-white/10 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentMap[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{value}</div>
        <div className="text-xs text-white/50">{label}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-none">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-white/90">{value || '—'}</span>
    </div>
  );
}

function StubSection({ icon: Icon, title, note }) {
  return (
    <div className="card-surface glass rounded-2xl border border-white/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          <Icon className="h-5 w-5 text-white/30" />
        </div>
        <p className="max-w-xs text-xs text-white/40">{note}</p>
      </div>
    </div>
  );
}

function EditDriverForm({ driver, onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: driver.name,
      license_category: driver.license_category,
      license_expiry_date: driver.license_expiry_date,
      contact_number: driver.contact_number,
      safety_score: driver.safety_score,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Modal.Body className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Full Name"
            required
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
        </div>
        <Input
          label="License Category"
          required
          error={errors.license_category?.message}
          {...register('license_category', { required: 'Category is required' })}
        />
        <Input
          label="License Expiry Date"
          type="date"
          required
          error={errors.license_expiry_date?.message}
          {...register('license_expiry_date', { required: 'Expiry date is required' })}
        />
        <Input
          label="Contact Number"
          required
          error={errors.contact_number?.message}
          {...register('contact_number', { required: 'Contact number is required' })}
        />
        <Input
          label="Safety Score"
          type="number"
          step="0.1"
          error={errors.safety_score?.message}
          {...register('safety_score', { valueAsNumber: true, min: 0, max: 100 })}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Save Changes
        </Button>
      </Modal.Footer>
    </form>
  );
}

export default function DriverDetails() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole ? hasRole(['fleet_manager', 'safety_officer', 'admin']) : true;

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchDriver = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await driversApi.getById(driverId);
      setDriver(data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  const handleUpdate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const payload = { ...formValues, safety_score: Number(formValues.safety_score) };
      const updated = await driversApi.update(driverId, payload);
      setDriver(updated);
      setEditOpen(false);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    try {
      await driversApi.remove(driverId);
      navigate('/drivers');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-danger-400" />
        <p className="text-sm text-white/60">Couldn&apos;t load this driver.</p>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCcw />} onClick={fetchDriver}>
            Retry
          </Button>
          <Button variant="ghost" leftIcon={<ArrowLeft />} onClick={() => navigate('/drivers')}>
            Back to Drivers
          </Button>
        </div>
      </div>
    );
  }

  const days = daysUntil(driver.license_expiry_date);
  const expiringSoon = !driver.is_license_expired && days !== null && days <= EXPIRY_WARNING_DAYS;
  const safetyAccent = driver.safety_score >= 80 ? 'emerald' : driver.safety_score >= 50 ? 'amber' : 'danger';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/drivers')}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white">{driver.name}</h1>
              <StatusChip type="driver" status={driver.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-white/50">
              License #{driver.license_number} · {driver.license_category}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Pencil />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" leftIcon={<Trash2 />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {driver.is_license_expired && (
        <div className="flex items-center gap-2 rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          This driver&apos;s license has expired and cannot be assigned to new trips.
        </div>
      )}

      {/* Stat strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard icon={IdCard} label="License Category" value={driver.license_category} accent="cyan" />
        <StatCard
          icon={CalendarClock}
          label="License Expiry"
          value={new Date(driver.license_expiry_date).toLocaleDateString()}
          accent={driver.is_license_expired ? 'danger' : expiringSoon ? 'amber' : 'violet'}
        />
        <StatCard
          icon={ShieldCheck}
          label="Safety Score"
          value={driver.safety_score?.toFixed(0)}
          accent={safetyAccent}
        />
        <StatCard icon={Phone} label="Contact" value={driver.contact_number} accent="emerald" />
      </motion.div>

      {/* Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface glass rounded-2xl border border-white/10 p-5 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-white/90">Overview</h3>
          <div>
            <InfoRow label="Full Name" value={driver.name} />
            <InfoRow label="License Number" value={driver.license_number} />
            <InfoRow label="License Category" value={driver.license_category} />
            <InfoRow
              label="License Expiry"
              value={new Date(driver.license_expiry_date).toLocaleDateString()}
            />
            <InfoRow label="Status" value={getStatusMeta('driver', driver.status)?.label} />
            <InfoRow label="Safety Score" value={driver.safety_score?.toFixed(1)} />
            <InfoRow label="Contact Number" value={driver.contact_number} />
            <InfoRow
              label="Added On"
              value={driver.created_at ? new Date(driver.created_at).toLocaleDateString() : null}
            />
            <InfoRow
              label="Last Updated"
              value={driver.updated_at ? new Date(driver.updated_at).toLocaleDateString() : null}
            />
          </div>
        </div>

        <div
          className={cn(
            'card-surface glass flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center',
            driver.is_license_expired
              ? 'border-danger-500/20 bg-danger-500/5'
              : expiringSoon
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-white/10'
          )}
        >
          <ShieldCheck
            className={cn(
              'h-8 w-8',
              driver.is_license_expired ? 'text-danger-400' : expiringSoon ? 'text-amber-400' : 'text-emerald-400'
            )}
          />
          <p className="text-sm font-medium text-white/80">
            {driver.is_license_expired
              ? 'License Expired'
              : expiringSoon
              ? `Expires in ${days} day${days === 1 ? '' : 's'}`
              : 'License Valid'}
          </p>
          <p className="text-xs text-white/40">
            {driver.is_license_expired
              ? 'Renew before this driver can be dispatched.'
              : 'Eligible for trip assignment.'}
          </p>
        </div>
      </div>

      {/* Related section — stubbed until Trips page exists */}
      <StubSection
        icon={Route}
        title="Trip History"
        note="Will show this driver's trip history once the Trips page (GET /api/trips?driver_id=) is wired up."
      />

      {/* Edit */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Driver"
        description={driver.name}
        size="lg"
      >
        <EditDriverForm
          driver={driver}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          isSubmitting={formSubmitting}
        />
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this driver?"
        description={`${driver.name} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Driver"
        isLoading={deleteSubmitting}
      />
    </div>
  );
}