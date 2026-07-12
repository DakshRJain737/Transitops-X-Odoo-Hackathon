import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Wrench,
  X,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import maintenanceApi from '../../services/maintenance';
import vehiclesApi from '../../services/vehicles';
import {
  MAINTENANCE_STATUS,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPES,
  getStatusMeta,
} from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import { Modal, ConfirmDialog, ModalBody, ModalFooter } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSTANTS
 * ─────────────────────────────────────────────────────────────────────────── */

const LIFECYCLE = [
  MAINTENANCE_STATUS.OPEN,
  MAINTENANCE_STATUS.IN_PROGRESS,
  MAINTENANCE_STATUS.CLOSED,
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: MAINTENANCE_TYPES.ROUTINE, label: 'Routine Service' },
  { value: MAINTENANCE_TYPES.REPAIR, label: 'Repair' },
  { value: MAINTENANCE_TYPES.INSPECTION, label: 'Inspection' },
  { value: MAINTENANCE_TYPES.EMERGENCY, label: 'Emergency' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: MAINTENANCE_STATUS.OPEN, label: 'Open' },
  { value: MAINTENANCE_STATUS.IN_PROGRESS, label: 'In Progress' },
  { value: MAINTENANCE_STATUS.CLOSED, label: 'Closed' },
];

const MAINTENANCE_TYPE_FORM_OPTIONS = [
  { value: MAINTENANCE_TYPES.ROUTINE, label: 'Routine Service' },
  { value: MAINTENANCE_TYPES.REPAIR, label: 'Repair' },
  { value: MAINTENANCE_TYPES.INSPECTION, label: 'Inspection' },
  { value: MAINTENANCE_TYPES.EMERGENCY, label: 'Emergency' },
];

const STATUS_UPDATE_OPTIONS = [
  { value: MAINTENANCE_STATUS.OPEN, label: 'Open' },
  { value: MAINTENANCE_STATUS.IN_PROGRESS, label: 'In Progress' },
];

/* ─────────────────────────────────────────────────────────────────────────── *
 * COLOR HELPERS
 * Maps semantic color key → Tailwind utility classes
 * ─────────────────────────────────────────────────────────────────────────── */

const COLOR_CLASSES = {
  success: {
    bg: 'bg-success-bg',
    text: 'text-success-400',
    border: 'border-success-400/30',
    bar: 'bg-success-400',
  },
  warning: {
    bg: 'bg-warning-bg',
    text: 'text-warning-400',
    border: 'border-warning-400/30',
    bar: 'bg-warning-400',
  },
  info: {
    bg: 'bg-info-bg',
    text: 'text-info-400',
    border: 'border-info-400/30',
    bar: 'bg-info-400',
  },
  danger: {
    bg: 'bg-danger-bg',
    text: 'text-danger-400',
    border: 'border-danger-400/30',
    bar: 'bg-danger-400',
  },
  muted: {
    bg: 'bg-surface-600',
    text: 'text-muted',
    border: 'border-border',
    bar: 'bg-zinc-600',
  },
};

function colorFor(status) {
  const meta = MAINTENANCE_STATUS_META[status];
  return COLOR_CLASSES[meta?.color] ?? COLOR_CLASSES.muted;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * KPI CARD
 * ─────────────────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, icon: Icon, color = 'muted', subtitle }) {
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.muted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass rounded-2xl p-5 flex items-center gap-4 border',
        c.border
      )}
    >
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', c.bg)}>
        <Icon className={cn('w-5 h-5', c.text)} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-zinc-50 leading-none">{value}</p>
        <p className="text-sm text-muted mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * LIFECYCLE STEPPER  (Open → In Progress → Closed)
 * Mirrors TripDetails stepper pattern for visual consistency across pages.
 * ─────────────────────────────────────────────────────────────────────────── */

function LifecycleStepper({ status }) {
  const currentIdx = LIFECYCLE.indexOf(status);
  return (
    <div className="flex items-center gap-0 w-full">
      {LIFECYCLE.map((s, idx) => {
        const meta = MAINTENANCE_STATUS_META[s];
        const c = COLOR_CLASSES[meta?.color] ?? COLOR_CLASSES.muted;
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  isDone
                    ? 'bg-success-400 border-success-400 text-black'
                    : isCurrent
                    ? cn(c.bg, c.text, 'border-current')
                    : 'border-border bg-surface-600 text-zinc-600'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium whitespace-nowrap',
                  isCurrent ? c.text : isDone ? 'text-success-400' : 'text-zinc-600'
                )}
              >
                {meta?.label ?? s}
              </span>
            </div>
            {idx < LIFECYCLE.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 mb-4 rounded-full transition-all duration-500',
                  idx < currentIdx ? 'bg-success-400' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * EXPANDED ROW DETAIL PANEL
 * Slides in below the row (height animation). Shows:
 *   - lifecycle stepper
 *   - cost / date / odometer grid
 *   - notes block
 *   - Update + Close Job actions (write-role only, active jobs only)
 * ─────────────────────────────────────────────────────────────────────────── */

function ExpandedRow({ record, vehicleMap, canWrite, onEdit, onClose }) {
  const vehicle = vehicleMap[record.vehicle_id];
  const c = colorFor(record.status);
  const isActive = record.status !== MAINTENANCE_STATUS.CLOSED;
  const typeMeta = getStatusMeta('maintenanceType', record.maintenance_type);

  return (
    <motion.div
      key={record.id + '-expanded'}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-1">
        <div className={cn('rounded-2xl border p-5 space-y-5', c.border, 'bg-surface-800/60 backdrop-blur-sm')}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] text-zinc-500 font-mono mb-1 uppercase tracking-wide">
                Record ID: {record.id}
              </p>
              <p className="text-base font-semibold text-zinc-100">
                {typeMeta.label}
                {record.description && (
                  <span className="text-sm text-muted font-normal ml-2">
                    — {record.description}
                  </span>
                )}
              </p>
              {vehicle && (
                <p className="text-sm text-zinc-400 mt-0.5">
                  Vehicle:{' '}
                  <span className="text-zinc-200 font-medium">{vehicle.license_plate}</span>
                  {vehicle.make && (
                    <span className="text-zinc-500 ml-1.5">
                      ({vehicle.make} {vehicle.model})
                    </span>
                  )}
                </p>
              )}
            </div>

            {canWrite && isActive && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Settings2 />}
                  onClick={() => onEdit(record)}
                  id={`btn-edit-maint-${record.id}`}
                >
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CheckCircle2 />}
                  onClick={() => onClose(record)}
                  id={`btn-close-maint-${record.id}`}
                >
                  Close Job
                </Button>
              </div>
            )}
          </div>

          {/* Lifecycle stepper */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-3 font-medium">
              Job Progress
            </p>
            <LifecycleStepper status={record.status} />
          </div>

          {/* Cost + dates grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Scheduled',
                value: record.scheduled_date
                  ? new Date(record.scheduled_date).toLocaleDateString()
                  : '—',
              },
              {
                label: 'Completed',
                value: record.completed_date
                  ? new Date(record.completed_date).toLocaleDateString()
                  : '—',
              },
              {
                label: 'Cost',
                value:
                  record.cost != null
                    ? `$${Number(record.cost).toFixed(2)}`
                    : '—',
              },
              {
                label: 'Odometer',
                value:
                  record.odometer_reading != null
                    ? `${Number(record.odometer_reading).toLocaleString()} km`
                    : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-700/60 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-zinc-200 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="bg-surface-700/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                Workshop Notes
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed">{record.notes}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CREATE / EDIT DRAWER FORM
 * Create path shows Rule 9 amber banner.
 * Edit path shows status selector (open/in_progress only — Close Job is a
 * separate dedicated action with its own endpoint + confirm dialog).
 * ─────────────────────────────────────────────────────────────────────────── */

function MaintenanceFormModal({ isOpen, onClose, onSuccess, vehicles, editRecord }) {
  const isEdit = Boolean(editRecord);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      vehicle_id: '',
      maintenance_type: MAINTENANCE_TYPES.ROUTINE,
      description: '',
      scheduled_date: '',
      cost: '',
      odometer_reading: '',
      notes: '',
      status: MAINTENANCE_STATUS.OPEN,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setServerError('');
    if (isEdit && editRecord) {
      reset({
        vehicle_id: editRecord.vehicle_id ?? '',
        maintenance_type: editRecord.maintenance_type ?? MAINTENANCE_TYPES.ROUTINE,
        description: editRecord.description ?? '',
        scheduled_date: editRecord.scheduled_date
          ? editRecord.scheduled_date.slice(0, 10)
          : '',
        cost: editRecord.cost ?? '',
        odometer_reading: editRecord.odometer_reading ?? '',
        notes: editRecord.notes ?? '',
        status: editRecord.status ?? MAINTENANCE_STATUS.OPEN,
      });
    } else {
      reset({
        vehicle_id: '',
        maintenance_type: MAINTENANCE_TYPES.ROUTINE,
        description: '',
        scheduled_date: '',
        cost: '',
        odometer_reading: '',
        notes: '',
        status: MAINTENANCE_STATUS.OPEN,
      });
    }
  }, [isOpen, isEdit, editRecord, reset]);

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const payload = {
        ...(data.vehicle_id ? { vehicle_id: data.vehicle_id } : {}),
        maintenance_type: data.maintenance_type,
        ...(data.description ? { description: data.description } : {}),
        ...(data.scheduled_date ? { scheduled_date: data.scheduled_date } : {}),
        ...(data.cost !== '' ? { cost: Number(data.cost) } : {}),
        ...(data.odometer_reading !== ''
          ? { odometer_reading: Number(data.odometer_reading) }
          : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        ...(isEdit ? { status: data.status } : {}),
      };

      if (isEdit) {
        await maintenanceApi.update(editRecord.id, payload);
      } else {
        await maintenanceApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      setServerError(
        err?.response?.data?.detail ?? err?.message ?? 'Something went wrong'
      );
    }
  };

  const vehicleOptions = [
    { value: '', label: 'Select vehicle…' },
    ...vehicles.map((v) => ({
      value: v.id,
      label: `${v.license_plate}${v.make ? ` — ${v.make} ${v.model ?? ''}`.trimEnd() : ''}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Update Maintenance Record' : 'Schedule Maintenance'}
      description={
        isEdit
          ? 'Edit job details, status, or notes.'
          : 'Create a new workshop job for a vehicle.'
      }
      variant="drawer"
      size="md"
    >
      <ModalBody>
        {/* Rule 9 warning — create only */}
        {!isEdit && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-warning-bg border border-warning-400/25 rounded-xl px-4 py-3 mb-5"
          >
            <AlertTriangle className="w-4 h-4 text-warning-400 mt-0.5 shrink-0" />
            <p className="text-sm text-warning-400 leading-snug">
              <strong>Rule 9:</strong> Creating this record will automatically set the selected
              vehicle&apos;s status to <em>In Shop</em>.
            </p>
          </motion.div>
        )}

        <form id="maintenance-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Vehicle (locked in edit mode) */}
          <Select
            label="Vehicle"
            required={!isEdit}
            options={vehicleOptions}
            error={errors.vehicle_id?.message}
            disabled={isEdit}
            {...register('vehicle_id', {
              validate: (v) =>
                isEdit || v !== '' || 'Please select a vehicle',
            })}
          />

          {/* Type + Status */}
          <div className={cn('grid gap-4', isEdit ? 'grid-cols-2' : 'grid-cols-1')}>
            <Select
              label="Maintenance Type"
              required
              options={MAINTENANCE_TYPE_FORM_OPTIONS}
              error={errors.maintenance_type?.message}
              {...register('maintenance_type', { required: 'Type is required' })}
            />
            {isEdit && (
              <Select
                label="Status"
                options={STATUS_UPDATE_OPTIONS}
                hint="Use &quot;Close Job&quot; to fully close a record."
                error={errors.status?.message}
                {...register('status')}
              />
            )}
          </div>

          {/* Description */}
          <Input
            label="Description"
            placeholder="Brief summary of the issue or service…"
            error={errors.description?.message}
            {...register('description')}
          />

          {/* Date + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Scheduled Date"
              type="date"
              error={errors.scheduled_date?.message}
              {...register('scheduled_date')}
            />
            <Input
              label="Cost (USD)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.cost?.message}
              {...register('cost', {
                min: { value: 0, message: 'Must be ≥ 0' },
              })}
            />
          </div>

          {/* Odometer */}
          <Input
            label="Odometer Reading (km)"
            type="number"
            min="0"
            placeholder="e.g. 85000"
            error={errors.odometer_reading?.message}
            {...register('odometer_reading', {
              min: { value: 0, message: 'Must be ≥ 0' },
            })}
          />

          {/* Notes */}
          <Textarea
            label="Workshop Notes"
            placeholder="Additional instructions for the mechanic…"
            rows={3}
            error={errors.notes?.message}
            {...register('notes')}
          />

          {serverError && (
            <p className="text-sm text-danger-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {serverError}
            </p>
          )}
        </form>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="maintenance-form"
          isLoading={isSubmitting}
          leftIcon={isEdit ? <Settings2 /> : <Plus />}
          id={isEdit ? 'btn-save-maint' : 'btn-create-maint'}
        >
          {isEdit ? 'Save Changes' : 'Schedule Job'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MAIN PAGE — Maintenance.jsx
 * ─────────────────────────────────────────────────────────────────────────── */

export default function Maintenance() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canWrite = hasRole('admin', 'fleet_manager');

  /* ── data state ── */
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── filter state ── */
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');

  /* ── table state ── */
  const [expandedId, setExpandedId] = useState(null);
  const [sorting, setSorting] = useState([{ id: 'scheduled_date', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  /* ── modal state ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  /* ── data loading ── */
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [recs, vehs] = await Promise.all([
        maintenanceApi.list(),
        vehiclesApi.list(),
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      setVehicles(Array.isArray(vehs) ? vehs : []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ?? err?.message ?? 'Failed to load data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── derived lookups ── */
  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  /* ── filtered / searched data ── */
  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterType && r.maintenance_type !== filterType) return false;
      if (filterVehicle && r.vehicle_id !== filterVehicle) return false;
      if (q) {
        const typeMeta = getStatusMeta('maintenanceType', r.maintenance_type);
        const vehicle = vehicleMap[r.vehicle_id];
        const haystack = [
          r.description ?? '',
          typeMeta.label,
          vehicle?.license_plate ?? '',
          vehicle?.make ?? '',
          r.notes ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, filterStatus, filterType, filterVehicle, vehicleMap]);

  /* ── KPIs ── */
  const kpis = useMemo(() => ({
    open: records.filter((r) => r.status === MAINTENANCE_STATUS.OPEN).length,
    inProg: records.filter((r) => r.status === MAINTENANCE_STATUS.IN_PROGRESS).length,
    closed: records.filter((r) => r.status === MAINTENANCE_STATUS.CLOSED).length,
    emergency: records.filter((r) => r.maintenance_type === MAINTENANCE_TYPES.EMERGENCY).length,
  }), [records]);

  /* ── vehicle filter options (only vehicles that actually appear in records) ── */
  const vehicleFilterOptions = useMemo(() => {
    const ids = [...new Set(records.map((r) => r.vehicle_id).filter(Boolean))];
    return [
      { value: '', label: 'All Vehicles' },
      ...ids.map((id) => {
        const v = vehicleMap[id];
        return { value: id, label: v?.license_plate ?? id };
      }),
    ];
  }, [records, vehicleMap]);

  /* ── close job action ── */
  const handleCloseJob = async () => {
    if (!closeTarget) return;
    setIsClosing(true);
    try {
      await maintenanceApi.close(closeTarget.id);
      setCloseTarget(null);
      setExpandedId(null);
      await load();
    } catch (err) {
      console.error('Close job failed:', err);
    } finally {
      setIsClosing(false);
    }
  };

  /* ── table columns ── */
  const columns = useMemo(
    () => [
      {
        id: 'expander',
        header: '',
        size: 44,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId((prev) =>
                prev === row.original.id ? null : row.original.id
              );
            }}
            aria-label={
              expandedId === row.original.id ? 'Collapse row' : 'Expand row'
            }
          >
            {expandedId === row.original.id ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        cell: ({ getValue }) => (
          <StatusChip type="maintenance" status={getValue()} />
        ),
      },
      {
        accessorKey: 'maintenance_type',
        header: 'Type',
        size: 155,
        cell: ({ getValue }) => (
          <StatusChip type="maintenanceType" status={getValue()} />
        ),
      },
      {
        id: 'vehicle',
        header: 'Vehicle',
        size: 155,
        accessorFn: (row) =>
          vehicleMap[row.vehicle_id]?.license_plate ?? row.vehicle_id ?? '—',
        cell: ({ getValue, row }) => {
          const v = vehicleMap[row.original.vehicle_id];
          return (
            <div>
              <p className="text-sm font-medium text-zinc-200">{getValue()}</p>
              {v?.make && (
                <p className="text-xs text-zinc-500">
                  {v.make} {v.model}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        size: 230,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-sm text-zinc-300 line-clamp-1">
            {getValue() ?? <span className="text-zinc-600">—</span>}
          </span>
        ),
      },
      {
        accessorKey: 'scheduled_date',
        header: 'Scheduled',
        size: 120,
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="text-sm text-zinc-300">
              {new Date(getValue()).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-sm text-zinc-600">—</span>
          ),
      },
      {
        accessorKey: 'cost',
        header: 'Cost',
        size: 100,
        cell: ({ getValue }) =>
          getValue() != null ? (
            <span className="text-sm font-mono text-zinc-200">
              ${Number(getValue()).toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-zinc-600">—</span>
          ),
      },
    ],
    [vehicleMap, expandedId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  /* ─────────────────────────────── RENDER ─────────────────────────────── */

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Link to="/dashboard" className="hover:text-zinc-300 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-zinc-300">Maintenance</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-50">Maintenance</h1>
          <p className="text-sm text-muted mt-0.5">
            Workshop queue · Service history · Vehicle health
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCcw />}
            onClick={load}
            disabled={isLoading}
            id="btn-refresh-maintenance"
          >
            Refresh
          </Button>
          {canWrite && (
            <Button
              size="sm"
              leftIcon={<Plus />}
              onClick={() => setCreateOpen(true)}
              id="btn-schedule-maintenance"
            >
              Schedule Job
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Open Jobs"   value={kpis.open}      icon={Clock}         color="warning" subtitle="Awaiting workshop" />
        <KpiCard label="In Progress" value={kpis.inProg}    icon={Wrench}        color="info"    subtitle="Currently serviced" />
        <KpiCard label="Closed"      value={kpis.closed}    icon={CheckCircle2}  color="success" subtitle="Completed jobs" />
        <KpiCard label="Emergency"   value={kpis.emergency} icon={AlertTriangle} color="danger"  subtitle="All time" />
      </div>

      {/* ── FILTER BAR ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center"
      >
        {/* Text search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Search description, vehicle, notes…"
            id="maintenance-search"
            className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 pl-9 pr-4 py-2.5 outline-none focus:border-accent-500 focus:shadow-glow-sm transition-all duration-200"
          />
        </div>

        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          id="filter-maintenance-status"
          className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          id="filter-maintenance-type"
          className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Vehicle filter */}
        <select
          value={filterVehicle}
          onChange={(e) => {
            setFilterVehicle(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          id="filter-maintenance-vehicle"
          className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
        >
          {vehicleFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || filterStatus || filterType || filterVehicle) && (
          <button
            onClick={() => {
              setSearch('');
              setFilterStatus('');
              setFilterType('');
              setFilterVehicle('');
            }}
            className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </motion.div>

      {/* ── WORKSHOP TABLE ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
            <span className="text-muted text-sm">Loading maintenance records…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-8 h-8 text-danger-400" />
            <p className="text-sm text-danger-400">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {/* HEAD */}
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-border-subtle">
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap select-none',
                            header.column.getCanSort() &&
                              'cursor-pointer hover:text-zinc-200 transition-colors'
                          )}
                        >
                          <span className="flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getIsSorted() === 'asc' && (
                              <ChevronUp className="w-3 h-3" />
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                {/* BODY */}
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3">
                          <Wrench className="w-8 h-8 text-zinc-600" />
                          <p className="text-sm text-muted">
                            {search || filterStatus || filterType || filterVehicle
                              ? 'No records match your filters'
                              : 'No maintenance records yet'}
                          </p>
                          {canWrite && (
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Plus />}
                              onClick={() => setCreateOpen(true)}
                            >
                              Schedule First Job
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const rec = row.original;
                      const isExpanded = expandedId === rec.id;
                      const c = colorFor(rec.status);
                      const isInProgress =
                        rec.status === MAINTENANCE_STATUS.IN_PROGRESS;

                      return (
                        <React.Fragment key={rec.id}>
                          {/* ── DATA ROW ── */}
                          <tr
                            className={cn(
                              'border-b border-border-subtle relative cursor-pointer group transition-colors duration-150',
                              isExpanded
                                ? 'bg-surface-700/50'
                                : 'hover:bg-surface-700/30'
                            )}
                            onClick={() =>
                              setExpandedId((prev) =>
                                prev === rec.id ? null : rec.id
                              )
                            }
                          >
                            {/* Colored left accent bar — pulses for in_progress */}
                            <td className="relative w-0 p-0 overflow-visible">
                              <div
                                className={cn(
                                  'absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm',
                                  c.bar,
                                  isInProgress && 'animate-pulse-glow'
                                )}
                              />
                            </td>

                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className="px-4 py-3.5 align-middle"
                                onClick={
                                  cell.column.id === 'expander'
                                    ? (e) => e.stopPropagation()
                                    : undefined
                                }
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            ))}
                          </tr>

                          {/* ── EXPANDED DETAIL ── */}
                          <tr className="border-0">
                            <td colSpan={columns.length + 1} className="p-0">
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <ExpandedRow
                                    key={rec.id + '-detail'}
                                    record={rec}
                                    vehicleMap={vehicleMap}
                                    canWrite={canWrite}
                                    onEdit={(r) => setEditRecord(r)}
                                    onClose={(r) => setCloseTarget(r)}
                                  />
                                )}
                              </AnimatePresence>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── PAGINATION ── */}
            {filteredData.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                <p className="text-xs text-muted">
                  {filteredData.length === records.length
                    ? `${records.length} total records`
                    : `${filteredData.length} of ${records.length} filtered`}
                  {' · '}
                  Page {table.getState().pagination.pageIndex + 1} of{' '}
                  {table.getPageCount() || 1}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── CREATE / EDIT DRAWER ── */}
      <MaintenanceFormModal
        isOpen={createOpen || Boolean(editRecord)}
        onClose={() => {
          setCreateOpen(false);
          setEditRecord(null);
        }}
        onSuccess={async () => {
          setCreateOpen(false);
          setEditRecord(null);
          await load();
        }}
        vehicles={vehicles}
        editRecord={editRecord}
      />

      {/* ── CLOSE JOB CONFIRM ── */}
      <ConfirmDialog
        isOpen={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleCloseJob}
        isLoading={isClosing}
        title="Close Maintenance Job?"
        description={
          closeTarget
            ? `Closing this job will automatically restore the vehicle's status (Rule 10).\n\nVehicle: ${
                vehicleMap[closeTarget.vehicle_id]?.license_plate ??
                closeTarget.vehicle_id ??
                '—'
              }`
            : 'This will close the job and restore vehicle status.'
        }
        confirmLabel="Close Job"
        variant="primary"
      />
    </div>
  );
}
