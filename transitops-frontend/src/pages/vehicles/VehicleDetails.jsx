import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Truck,
  Bus,
  Gauge,
  MapPin,
  Wallet,
  FileText,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  Route,
  Wrench,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import vehiclesApi from '../../services/vehicles';
import { getStatusMeta } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - Single-page layout (no tabs) to fit the hackathon time budget:
 *   a header stat strip + an info grid covers everything the
 *   VehicleOut schema actually gives us. Related Trips / Maintenance
 *   are left as clearly-labeled TODO stub sections rather than faked
 *   with placeholder rows — per instruction, no dummy data anywhere.
 *   These get wired for real once trips.js / maintenance.js pages
 *   exist (#24 / #25), at which point this file only needs the fetch
 *   calls added, not a redesign.
 *
 * - Admin "force status" override is deliberately NOT here — that's
 *   POST /api/admin/vehicles/{id}/force-status, which belongs with
 *   the rest of the admin override tools in Settings, not mixed into
 *   a regular vehicle detail page.
 *
 * - Edit reuses the same field set as VehiclesList's drawer form
 *   (kept local here rather than importing from VehiclesList, since
 *   that file doesn't export it — small duplication is preferable to
 *   a cross-page import coupling two otherwise-independent pages).
 * ------------------------------------------------------------------ */

const TYPE_ICON = { bus: Bus }; // default falls through to Truck

function StatCard({ icon: Icon, label, value, accent = 'cyan' }) {
  const accentMap = {
    cyan: 'text-accent-cyan bg-accent-cyan/10',
    violet: 'text-accent-violet bg-accent-violet/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
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

function EditVehicleForm({ vehicle, onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: vehicle.name,
      model: vehicle.model || '',
      type: vehicle.type,
      max_load_capacity: vehicle.max_load_capacity,
      acquisition_cost: vehicle.acquisition_cost,
      region: vehicle.region || '',
      documents_url: vehicle.documents_url || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Modal.Body className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Vehicle Name"
          required
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />
        <Input label="Model" error={errors.model?.message} {...register('model')} />
        <Select
          label="Type"
          required
          options={[
            { value: 'van', label: 'Van' },
            { value: 'truck', label: 'Truck' },
            { value: 'bus', label: 'Bus' },
            { value: 'pickup', label: 'Pickup' },
          ]}
          error={errors.type?.message}
          {...register('type', { required: 'Type is required' })}
        />
        <Input
          label="Max Load Capacity (kg)"
          type="number"
          step="0.01"
          required
          error={errors.max_load_capacity?.message}
          {...register('max_load_capacity', { required: true, valueAsNumber: true, min: 0.01 })}
        />
        <Input
          label="Acquisition Cost"
          type="number"
          step="0.01"
          required
          error={errors.acquisition_cost?.message}
          {...register('acquisition_cost', { required: true, valueAsNumber: true, min: 0 })}
        />
        <Input label="Region" {...register('region')} />
        <div className="sm:col-span-2">
          <Input label="Documents URL" {...register('documents_url')} />
        </div>
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

export default function VehicleDetails() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole ? hasRole(['fleet_manager', 'admin']) : true;

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchVehicle = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await vehiclesApi.getById(vehicleId);
      setVehicle(data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  const handleUpdate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const payload = {
        ...formValues,
        max_load_capacity: Number(formValues.max_load_capacity),
        acquisition_cost: Number(formValues.acquisition_cost),
      };
      const updated = await vehiclesApi.update(vehicleId, payload);
      setVehicle(updated);
      setEditOpen(false);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    try {
      await vehiclesApi.remove(vehicleId);
      navigate('/vehicles');
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

  if (error || !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-danger-400" />
        <p className="text-sm text-white/60">Couldn&apos;t load this vehicle.</p>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCcw />} onClick={fetchVehicle}>
            Retry
          </Button>
          <Button variant="ghost" leftIcon={<ArrowLeft />} onClick={() => navigate('/vehicles')}>
            Back to Vehicles
          </Button>
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICON[vehicle.type] || Truck;
  const typeMeta = getStatusMeta('vehicleType', vehicle.type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/vehicles')}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-white">
                {vehicle.registration_number}
              </h1>
              <StatusChip type="vehicle" status={vehicle.status} />
            </div>
            <p className="mt-1 text-sm text-white/50">
              {vehicle.name} {vehicle.model && `· ${vehicle.model}`} · {typeMeta?.label}
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

      {/* Stat strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard icon={TypeIcon} label="Type" value={typeMeta?.label} accent="cyan" />
        <StatCard icon={Gauge} label="Odometer" value={`${vehicle.odometer?.toLocaleString()} km`} accent="violet" />
        <StatCard
          icon={Wallet}
          label="Max Load Capacity"
          value={`${vehicle.max_load_capacity} kg`}
          accent="amber"
        />
        <StatCard icon={MapPin} label="Region" value={vehicle.region || '—'} accent="emerald" />
      </motion.div>

      {/* Overview + docs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface glass rounded-2xl border border-white/10 p-5 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-white/90">Overview</h3>
          <div>
            <InfoRow label="Registration Number" value={vehicle.registration_number} />
            <InfoRow label="Name" value={vehicle.name} />
            <InfoRow label="Model" value={vehicle.model} />
            <InfoRow label="Type" value={typeMeta?.label} />
            <InfoRow label="Status" value={getStatusMeta('vehicle', vehicle.status)?.label} />
            <InfoRow label="Max Load Capacity" value={`${vehicle.max_load_capacity} kg`} />
            <InfoRow label="Odometer" value={`${vehicle.odometer?.toLocaleString()} km`} />
            <InfoRow label="Acquisition Cost" value={`$${vehicle.acquisition_cost?.toLocaleString()}`} />
            <InfoRow label="Region" value={vehicle.region} />
            <InfoRow
              label="Registered On"
              value={vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString() : null}
            />
            <InfoRow
              label="Last Updated"
              value={vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleDateString() : null}
            />
          </div>
        </div>

        <div className="card-surface glass rounded-2xl border border-white/10 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white/90">Documents</h3>
          {vehicle.documents_url ? (
            <a
              href={vehicle.documents_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-accent-400 hover:border-accent-500/50"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">View Documents</span>
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <FileText className="h-6 w-6 text-white/20" />
              <p className="text-xs text-white/40">No documents linked.</p>
            </div>
          )}
        </div>
      </div>

      {/* Related sections — stubbed until Trips/Maintenance pages exist */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StubSection
          icon={Route}
          title="Trip History"
          note="Will show this vehicle's trip history once the Trips page (GET /api/trips?vehicle_id=) is wired up."
        />
        <StubSection
          icon={Wrench}
          title="Maintenance History"
          note="Will show this vehicle's maintenance log once the Maintenance page (GET /api/maintenance?vehicle_id=) is wired up."
        />
      </div>

      {/* Edit */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Vehicle"
        description={vehicle.registration_number}
        size="lg"
      >
        <EditVehicleForm
          vehicle={vehicle}
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
        title="Delete this vehicle?"
        description={`${vehicle.registration_number} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Vehicle"
        isLoading={deleteSubmitting}
      />
    </div>
  );
}