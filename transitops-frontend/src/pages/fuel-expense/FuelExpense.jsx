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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  Droplets,
  Filter,
  Flame,
  Loader2,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useForm } from 'react-hook-form';
import fuelExpenseApi from '../../services/fuelExpense';
import vehiclesApi from '../../services/vehicles';
import tripsApi from '../../services/trips';
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_META,
  getStatusMeta,
} from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import { Modal, ConfirmDialog, ModalBody, ModalFooter } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ─────────────────────────────────────────────────────────────────────────── *
 * CHART COLORS — hex values pulled from CHART_COLORS palette so the donut
 * chart always matches the global chart aesthetic (no semantic-key ambiguity).
 * ─────────────────────────────────────────────────────────────────────────── */

const EXPENSE_PIE_COLORS = {
  [EXPENSE_TYPES.TOLL]:        '#60a5fa', // blue
  [EXPENSE_TYPES.REPAIR]:      '#fbbf24', // amber
  [EXPENSE_TYPES.MAINTENANCE]: '#fb7185', // rose
  [EXPENSE_TYPES.OTHER]:       '#a78bfa', // violet
};

const CHART_COLORS = {
  fuel:    '#22d3ee', // cyan
  expense: '#a78bfa', // violet
};

const axisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.4)' };

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSTANTS
 * ─────────────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'fuel', label: 'Fuel Logs', icon: Droplets },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
];

const EXPENSE_TYPE_OPTIONS = [
  { value: EXPENSE_TYPES.TOLL,        label: 'Toll' },
  { value: EXPENSE_TYPES.REPAIR,      label: 'Repair' },
  { value: EXPENSE_TYPES.MAINTENANCE, label: 'Maintenance' },
  { value: EXPENSE_TYPES.OTHER,       label: 'Other' },
];

const EXPENSE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  ...EXPENSE_TYPE_OPTIONS,
];

/* ─────────────────────────────────────────────────────────────────────────── *
 * COLOR HELPERS
 * ─────────────────────────────────────────────────────────────────────────── */

const COLOR_CLASSES = {
  success: { bg: 'bg-success-bg', text: 'text-success-400', border: 'border-success-400/30' },
  warning: { bg: 'bg-warning-bg', text: 'text-warning-400', border: 'border-warning-400/30' },
  info:    { bg: 'bg-info-bg',    text: 'text-info-400',    border: 'border-info-400/30'    },
  danger:  { bg: 'bg-danger-bg',  text: 'text-danger-400',  border: 'border-danger-400/30'  },
  muted:   { bg: 'bg-surface-600',text: 'text-muted',       border: 'border-border'         },
  accent:  { bg: 'bg-accent-500/12', text: 'text-accent-400', border: 'border-accent-500/30' },
  cyan:    { bg: 'bg-info-bg',    text: 'text-[#22d3ee]',   border: 'border-[#22d3ee]/30'   },
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * KPI CARD
 * ─────────────────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, icon: Icon, color = 'muted', subtitle, delay = 0 }) {
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.muted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn('glass rounded-2xl p-5 flex items-center gap-4 border', c.border)}
    >
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', c.bg)}>
        <Icon className={cn('w-5 h-5', c.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-zinc-50 leading-none font-mono">{value}</p>
        <p className="text-sm text-muted mt-0.5 truncate">{label}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * GLASS TOOLTIP (shared for both charts)
 * ─────────────────────────────────────────────────────────────────────────── */

function GlassTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/10 bg-black/80 px-3 py-2.5 shadow-glow-sm backdrop-blur-md min-w-[130px]">
      {label && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/40 mb-1.5">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey || entry.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-white/60 truncate">{entry.name}</span>
            <span className="ml-auto font-mono font-semibold text-white">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FUEL LOG EXPANDED ROW
 * ─────────────────────────────────────────────────────────────────────────── */

function FuelLogExpanded({ record, vehicleMap }) {
  const vehicle = vehicleMap[record.vehicle_id];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-1">
        <div className="rounded-2xl border border-info-400/20 bg-surface-800/60 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Vehicle', value: vehicle?.registration_number ?? record.vehicle_id ?? '—' },
            { label: 'Litres', value: record.liters != null ? `${Number(record.liters).toFixed(2)} L` : '—' },
            { label: 'Total Cost', value: record.cost != null ? `$${Number(record.cost).toFixed(2)}` : '—' },
            { label: 'Date', value: record.date ? new Date(record.date).toLocaleDateString() : '—' },
            { label: 'Linked Trip', value: record.trip_id ?? '—' },
            { label: 'Created', value: record.created_at ? new Date(record.created_at).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-700/60 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * EXPENSE EXPANDED ROW
 * ─────────────────────────────────────────────────────────────────────────── */

function ExpenseExpanded({ record, vehicleMap }) {
  const vehicle = vehicleMap[record.vehicle_id];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-1">
        <div className="rounded-2xl border border-border bg-surface-800/60 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Vehicle', value: vehicle?.registration_number ?? record.vehicle_id ?? '—' },
            { label: 'Amount', value: record.amount != null ? `$${Number(record.amount).toFixed(2)}` : '—' },
            { label: 'Date', value: record.date ? new Date(record.date).toLocaleDateString() : '—' },
            { label: 'Description', value: record.description ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-700/60 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FUEL LOG CREATE MODAL
 * Features live total_cost preview = liters × cost_per_liter
 * ─────────────────────────────────────────────────────────────────────────── */

function FuelLogModal({ isOpen, onClose, onSuccess, vehicles }) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      vehicle_id: '',
      trip_id: '',
      liters: '',
      cost: '',
      date: '',
    },
  });

  useEffect(() => {
    if (isOpen) { reset(); setServerError(''); }
  }, [isOpen, reset]);

  // Backend FuelLogCreate: vehicle_id (str, required), trip_id (optional), liters (float>0), cost (float>=0), date (date)
  const onSubmit = async (data) => {
    setServerError('');
    try {
      const payload = {
        vehicle_id: data.vehicle_id,
        ...(data.trip_id ? { trip_id: data.trip_id } : {}),
        liters: Number(data.liters),
        cost: Number(data.cost),
        date: data.date || new Date().toISOString().split('T')[0],
      };
      await fuelExpenseApi.createFuelLog(payload);
      onSuccess();
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? err?.message ?? 'Failed to save');
    }
  };

  const vehicleOptions = [
    { value: '', label: 'Select vehicle…' },
    ...vehicles.map((v) => ({
      value: v.id,
      label: `${v.registration_number}${v.name ? ` — ${v.name}` : ''}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Fuel Fill-Up"
      description="Record a fuel transaction for a vehicle."
      variant="drawer"
      size="md"
    >
      <ModalBody>
        <form id="fuel-log-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Vehicle"
            required
            options={vehicleOptions}
            error={errors.vehicle_id?.message}
            {...register('vehicle_id', {
              validate: (v) => v !== '' || 'Please select a vehicle',
            })}
          />

          <Input
            label="Trip ID (optional)"
            placeholder="Link to a trip UUID…"
            hint="Leave blank if not associated with a specific trip."
            {...register('trip_id')}
          />

          {/* Litres + Total Cost */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Litres"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 45.5"
              required
              error={errors.liters?.message}
              {...register('liters', {
                required: 'Litres is required',
                min: { value: 0.01, message: 'Must be > 0' },
              })}
            />
            <Input
              label="Total Cost ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 85.00"
              required
              error={errors.cost?.message}
              {...register('cost', {
                required: 'Cost is required',
                min: { value: 0, message: 'Must be ≥ 0' },
              })}
            />
          </div>

          <Input
            label="Date"
            type="date"
            required
            error={errors.date?.message}
            {...register('date', { required: 'Date is required' })}
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
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          type="submit"
          form="fuel-log-form"
          isLoading={isSubmitting}
          leftIcon={<Droplets />}
          id="btn-create-fuel-log"
        >
          Log Fill-Up
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * EXPENSE CREATE MODAL
 * ─────────────────────────────────────────────────────────────────────────── */

function ExpenseModal({ isOpen, onClose, onSuccess, vehicles }) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      vehicle_id: '',
      expense_type: EXPENSE_TYPES.TOLL,
      amount: '',
      description: '',
      date: '',
    },
  });

  useEffect(() => {
    if (isOpen) { reset(); setServerError(''); }
  }, [isOpen, reset]);

  // Backend ExpenseCreate: vehicle_id (required str), expense_type, amount (float>=0), description (optional), date (date)
  const onSubmit = async (data) => {
    setServerError('');
    try {
      const payload = {
        vehicle_id: data.vehicle_id,
        expense_type: data.expense_type,
        amount: Number(data.amount),
        ...(data.description ? { description: data.description } : {}),
        date: data.date || new Date().toISOString().split('T')[0],
      };
      await fuelExpenseApi.createExpense(payload);
      onSuccess();
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? err?.message ?? 'Failed to save');
    }
  };

  const vehicleOptions = [
    { value: '', label: 'Select vehicle…' },
    ...vehicles.map((v) => ({
      value: v.id,
      label: `${v.registration_number}${v.name ? ` — ${v.name}` : ''}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Expense"
      description="Record a non-fuel operational expense."
      variant="drawer"
      size="md"
    >
      <ModalBody>
        <form id="expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Vehicle"
            required
            options={vehicleOptions}
            error={errors.vehicle_id?.message}
            {...register('vehicle_id', {
              validate: (v) => v !== '' || 'Please select a vehicle',
            })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Expense Type"
              required
              options={EXPENSE_TYPE_OPTIONS}
              error={errors.expense_type?.message}
              {...register('expense_type', { required: 'Type is required' })}
            />
            <Input
              label="Amount ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              error={errors.amount?.message}
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 0, message: 'Must be ≥ 0' },
              })}
            />
          </div>

          <Input
            label="Date"
            type="date"
            required
            error={errors.date?.message}
            {...register('date', { required: 'Date is required' })}
          />

          <Textarea
            label="Description"
            placeholder="Details about this expense…"
            rows={3}
            {...register('description')}
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
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          type="submit"
          form="expense-form"
          isLoading={isSubmitting}
          leftIcon={<Receipt />}
          id="btn-create-expense"
        >
          Log Expense
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MAIN PAGE
 * ─────────────────────────────────────────────────────────────────────────── */

export default function FuelExpense() {
  const hasRole = useAuthStore((s) => s.hasRole);

  // Create permissions per service comments in fuelExpense.js
  const canCreateFuelLog = hasRole('admin', 'fleet_manager', 'driver', 'financial_analyst');
  const canCreateExpense  = hasRole('admin', 'fleet_manager', 'financial_analyst');

  /* ── data ── */
  const [fuelLogs, setFuelLogs]   = useState([]);
  const [expenses, setExpenses]   = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  /* ── tabs ── */
  const [activeTab, setActiveTab] = useState('fuel');

  /* ── filters ── */
  const [fuelSearch,    setFuelSearch]    = useState('');
  const [expSearch,     setExpSearch]     = useState('');
  const [fuelVehicle,   setFuelVehicle]   = useState('');
  const [expVehicle,    setExpVehicle]    = useState('');
  const [expTypeFilter, setExpTypeFilter] = useState('');

  /* ── table expanded ── */
  const [fuelExpandedId, setFuelExpandedId] = useState(null);
  const [expExpandedId,  setExpExpandedId]  = useState(null);

  /* ── sorting / pagination ── */
  const [fuelSort, setFuelSort] = useState([{ id: 'fueled_at', desc: true }]);
  const [expSort,  setExpSort]  = useState([{ id: 'date', desc: true }]);
  const [fuelPage, setFuelPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [expPage,  setExpPage]  = useState({ pageIndex: 0, pageSize: 10 });

  /* ── modals ── */
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [expModalOpen,  setExpModalOpen]  = useState(false);

  /* ── load data ── */
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [logs, exps, vehs] = await Promise.all([
        fuelExpenseApi.listFuelLogs(),
        fuelExpenseApi.listExpenses(),
        vehiclesApi.list(),
      ]);
      setFuelLogs(Array.isArray(logs) ? logs : []);
      setExpenses(Array.isArray(exps) ? exps : []);
      setVehicles(Array.isArray(vehs) ? vehs : []);
    } catch (err) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── lookups ── */
  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  /* ── filtered fuel logs ── */
  const filteredFuel = useMemo(() => {
    const q = fuelSearch.toLowerCase();
    return fuelLogs.filter((r) => {
      if (fuelVehicle && r.vehicle_id !== fuelVehicle) return false;
      if (q) {
        const v = vehicleMap[r.vehicle_id];
        const hay = [v?.registration_number ?? '', v?.name ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fuelLogs, fuelSearch, fuelVehicle, vehicleMap]);

  /* ── filtered expenses ── */
  const filteredExp = useMemo(() => {
    const q = expSearch.toLowerCase();
    return expenses.filter((r) => {
      if (expVehicle && r.vehicle_id !== expVehicle) return false;
      if (expTypeFilter && r.expense_type !== expTypeFilter) return false;
      if (q) {
        const v = vehicleMap[r.vehicle_id];
        const typeMeta = getStatusMeta('expenseType', r.expense_type);
        const hay = [v?.registration_number ?? '', r.description ?? '', typeMeta.label].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, expSearch, expVehicle, expTypeFilter, vehicleMap]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    // Backend FuelLog uses `cost` field (total cost, not cost_per_liter)
    const totalFuelCost   = fuelLogs.reduce((s, r) => s + (r.cost ?? 0), 0);
    const totalLiters     = fuelLogs.reduce((s, r) => s + (r.liters ?? 0), 0);
    const totalExpenses   = expenses.reduce((s, r) => s + (r.amount ?? 0), 0);
    const totalOperational = totalFuelCost + totalExpenses;
    return { totalFuelCost, totalLiters, totalExpenses, totalOperational };
  }, [fuelLogs, expenses]);

  /* ── Bar chart: fuel spend per vehicle ── */
  const fuelByVehicle = useMemo(() => {
    const acc = {};
    fuelLogs.forEach((r) => {
      const plate = vehicleMap[r.vehicle_id]?.registration_number ?? r.vehicle_id ?? 'Unknown';
      const cost  = r.cost ?? 0;
      acc[plate]  = (acc[plate] ?? 0) + cost;
    });
    return Object.entries(acc)
      .map(([plate, cost]) => ({ plate, cost: parseFloat(cost.toFixed(2)) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12);
  }, [fuelLogs, vehicleMap]);

  /* ── Pie chart: expense by type ── */
  const expByType = useMemo(() => {
    const acc = {};
    expenses.forEach((r) => {
      const type = r.expense_type ?? 'other';
      acc[type]  = (acc[type] ?? 0) + (r.amount ?? 0);
    });
    return Object.entries(acc).map(([type, value]) => ({
      name: EXPENSE_TYPE_META[type]?.label ?? type,
      value: parseFloat(value.toFixed(2)),
      color: EXPENSE_PIE_COLORS[type] ?? '#8b8b95',
    }));
  }, [expenses]);

  /* ── vehicle filter options ── */
  const fuelVehicleOpts = useMemo(() => {
    const ids = [...new Set(fuelLogs.map((r) => r.vehicle_id).filter(Boolean))];
    return [
      { value: '', label: 'All Vehicles' },
      ...ids.map((id) => ({ value: id, label: vehicleMap[id]?.registration_number ?? id })),
    ];
  }, [fuelLogs, vehicleMap]);

  const expVehicleOpts = useMemo(() => {
    const ids = [...new Set(expenses.map((r) => r.vehicle_id).filter(Boolean))];
    return [
      { value: '', label: 'All Vehicles' },
      ...ids.map((id) => ({ value: id, label: vehicleMap[id]?.registration_number ?? id })),
    ];
  }, [expenses, vehicleMap]);

  /* ── Fuel Logs table columns ── */
  // Backend FuelLog fields: id, vehicle_id, trip_id, liters, cost, date, created_at
  const fuelColumns = useMemo(() => [
    {
      id: 'expander', header: '', size: 44, enableSorting: false,
      cell: ({ row }) => (
        <button
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5"
          onClick={(e) => { e.stopPropagation(); setFuelExpandedId((p) => p === row.original.id ? null : row.original.id); }}
        >
          {fuelExpandedId === row.original.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      ),
    },
    {
      id: 'vehicle', header: 'Vehicle', size: 150,
      accessorFn: (r) => vehicleMap[r.vehicle_id]?.registration_number ?? r.vehicle_id ?? '—',
      cell: ({ getValue }) => <span className="text-sm font-medium text-zinc-200">{getValue()}</span>,
    },
    {
      accessorKey: 'liters', header: 'Litres', size: 100,
      cell: ({ getValue }) => <span className="text-sm font-mono text-zinc-300">{getValue() != null ? `${Number(getValue()).toFixed(2)} L` : '—'}</span>,
    },
    {
      accessorKey: 'cost', header: 'Total Cost', size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm font-bold font-mono text-[#22d3ee]">
          {getValue() != null ? `$${Number(getValue()).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'date', header: 'Date', size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm text-zinc-300">
          {getValue() ? new Date(getValue()).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ], [vehicleMap, fuelExpandedId]);

  /* ── Expenses table columns ── */
  // Backend Expense fields: id, vehicle_id, expense_type, amount, description, date, created_at
  const expColumns = useMemo(() => [
    {
      id: 'expander', header: '', size: 44, enableSorting: false,
      cell: ({ row }) => (
        <button
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5"
          onClick={(e) => { e.stopPropagation(); setExpExpandedId((p) => p === row.original.id ? null : row.original.id); }}
        >
          {expExpandedId === row.original.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      ),
    },
    {
      accessorKey: 'expense_type', header: 'Type', size: 140,
      cell: ({ getValue }) => <StatusChip type="expenseType" status={getValue()} />,
    },
    {
      id: 'vehicle', header: 'Vehicle', size: 150,
      accessorFn: (r) => vehicleMap[r.vehicle_id]?.registration_number ?? r.vehicle_id ?? '—',
      cell: ({ getValue }) => <span className="text-sm font-medium text-zinc-200">{getValue()}</span>,
    },
    {
      accessorKey: 'amount', header: 'Amount', size: 110,
      cell: ({ getValue }) => (
        <span className="text-sm font-bold font-mono text-zinc-100">
          {getValue() != null ? `$${Number(getValue()).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'description', header: 'Description', size: 220, enableSorting: false,
      cell: ({ getValue }) => <span className="text-sm text-zinc-400 line-clamp-1">{getValue() ?? '—'}</span>,
    },
    {
      accessorKey: 'date', header: 'Date', size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm text-zinc-300">
          {getValue() ? new Date(getValue()).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ], [vehicleMap, expExpandedId]);

  /* ── tables ── */
  const fuelTable = useReactTable({
    data: filteredFuel,
    columns: fuelColumns,
    state: { sorting: fuelSort, pagination: fuelPage },
    onSortingChange: setFuelSort,
    onPaginationChange: setFuelPage,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const expTable = useReactTable({
    data: filteredExp,
    columns: expColumns,
    state: { sorting: expSort, pagination: expPage },
    onSortingChange: setExpSort,
    onPaginationChange: setExpPage,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /* ─────────────────────── RENDER ─────────────────────── */

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
            <Link to="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-zinc-300">Fuel & Expenses</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-50">Fuel & Expenses</h1>
          <p className="text-sm text-muted mt-0.5">Fuel logs · Operational expense tracking · Cost analysis</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCcw />} onClick={load} disabled={isLoading} id="btn-refresh-fuel">
            Refresh
          </Button>
          {activeTab === 'fuel' && canCreateFuelLog && (
            <Button size="sm" leftIcon={<Droplets />} onClick={() => setFuelModalOpen(true)} id="btn-log-fuel">
              Log Fill-Up
            </Button>
          )}
          {activeTab === 'expenses' && canCreateExpense && (
            <Button size="sm" leftIcon={<Receipt />} onClick={() => setExpModalOpen(true)} id="btn-log-expense">
              Log Expense
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Fuel Cost"    value={`$${kpis.totalFuelCost.toFixed(2)}`}     icon={Droplets}    color="cyan"    delay={0}    subtitle={`${kpis.totalLiters.toFixed(1)} L total`} />
        <KpiCard label="Total Litres"       value={`${kpis.totalLiters.toFixed(1)} L`}       icon={Flame}       color="info"    delay={0.05} subtitle={`${fuelLogs.length} fill-up${fuelLogs.length !== 1 ? 's' : ''}`} />
        <KpiCard label="Other Expenses"     value={`$${kpis.totalExpenses.toFixed(2)}`}      icon={Receipt}     color="warning" delay={0.1}  subtitle={`${expenses.length} record${expenses.length !== 1 ? 's' : ''}`} />
        <KpiCard label="Total Operational"  value={`$${kpis.totalOperational.toFixed(2)}`}   icon={DollarSign}  color="accent"  delay={0.15} subtitle="Fuel + expenses" />
      </div>

      {/* ── CHARTS ROW ── */}
      {!isLoading && !error && (fuelByVehicle.length > 0 || expByType.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Fuel spend by vehicle — wider */}
          {fuelByVehicle.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-3 glass rounded-2xl border border-white/10 p-5 flex flex-col gap-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-white/90">Fuel Spend by Vehicle</h3>
                <p className="text-xs text-white/40 mt-0.5">Top vehicles by total fuel cost</p>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fuelByVehicle} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="plate" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      content={<GlassTooltip valueFormatter={(v) => `$${v.toFixed(2)}`} />}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="cost" name="Fuel Cost ($)" fill={CHART_COLORS.fuel} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Expense by type — narrower */}
          {expByType.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="lg:col-span-2 glass rounded-2xl border border-white/10 p-5 flex flex-col gap-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-white/90">Expense Breakdown</h3>
                <p className="text-xs text-white/40 mt-0.5">By expense category</p>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive
                      animationDuration={800}
                    >
                      {expByType.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<GlassTooltip valueFormatter={(v) => `$${v.toFixed(2)}`} />}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}
                      iconType="circle"
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex items-center gap-1 border-b border-border-subtle">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'
              )}
              id={`tab-${tab.key}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-500 rounded-t-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-24 gap-3"
          >
            <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
            <span className="text-muted text-sm">Loading financial data…</span>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-3"
          >
            <AlertTriangle className="w-8 h-8 text-danger-400" />
            <p className="text-sm text-danger-400">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </motion.div>
        ) : activeTab === 'fuel' ? (
          <motion.div
            key="fuel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Fuel filter bar */}
            <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  value={fuelSearch}
                  onChange={(e) => { setFuelSearch(e.target.value); setFuelPage((p) => ({ ...p, pageIndex: 0 })); }}
                  placeholder="Search vehicle, notes…"
                  id="fuel-search"
                  className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 pl-9 pr-4 py-2.5 outline-none focus:border-accent-500 focus:shadow-glow-sm transition-all"
                />
              </div>
              <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
              <select
                value={fuelVehicle}
                onChange={(e) => { setFuelVehicle(e.target.value); setFuelPage((p) => ({ ...p, pageIndex: 0 })); }}
                id="fuel-vehicle-filter"
                className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
              >
                {fuelVehicleOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {(fuelSearch || fuelVehicle) && (
                <button onClick={() => { setFuelSearch(''); setFuelVehicle(''); }} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            {/* Fuel table */}
            <FuelTable
              table={fuelTable}
              columns={fuelColumns}
              expandedId={fuelExpandedId}
              setExpandedId={setFuelExpandedId}
              vehicleMap={vehicleMap}
              totalRows={filteredFuel.length}
              allRows={fuelLogs.length}
              emptyLabel="No fuel logs yet"
              onAdd={canCreateFuelLog ? () => setFuelModalOpen(true) : null}
              addLabel="Log First Fill-Up"
              ExpRow={FuelLogExpanded}
            />
          </motion.div>
        ) : (
          <motion.div
            key="expenses"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Expense filter bar */}
            <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  value={expSearch}
                  onChange={(e) => { setExpSearch(e.target.value); setExpPage((p) => ({ ...p, pageIndex: 0 })); }}
                  placeholder="Search vehicle, description, type…"
                  id="expense-search"
                  className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 pl-9 pr-4 py-2.5 outline-none focus:border-accent-500 focus:shadow-glow-sm transition-all"
                />
              </div>
              <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
              <select
                value={expTypeFilter}
                onChange={(e) => { setExpTypeFilter(e.target.value); setExpPage((p) => ({ ...p, pageIndex: 0 })); }}
                id="expense-type-filter"
                className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
              >
                {EXPENSE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={expVehicle}
                onChange={(e) => { setExpVehicle(e.target.value); setExpPage((p) => ({ ...p, pageIndex: 0 })); }}
                id="expense-vehicle-filter"
                className="bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
              >
                {expVehicleOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {(expSearch || expVehicle || expTypeFilter) && (
                <button onClick={() => { setExpSearch(''); setExpVehicle(''); setExpTypeFilter(''); }} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            {/* Expense table */}
            <FuelTable
              table={expTable}
              columns={expColumns}
              expandedId={expExpandedId}
              setExpandedId={setExpExpandedId}
              vehicleMap={vehicleMap}
              totalRows={filteredExp.length}
              allRows={expenses.length}
              emptyLabel="No expenses logged yet"
              onAdd={canCreateExpense ? () => setExpModalOpen(true) : null}
              addLabel="Log First Expense"
              ExpRow={ExpenseExpanded}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODALS ── */}
      <FuelLogModal
        isOpen={fuelModalOpen}
        onClose={() => setFuelModalOpen(false)}
        onSuccess={async () => { setFuelModalOpen(false); await load(); }}
        vehicles={vehicles}
      />
      <ExpenseModal
        isOpen={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        onSuccess={async () => { setExpModalOpen(false); await load(); }}
        vehicles={vehicles}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SHARED TABLE COMPONENT (used by both Fuel and Expense tabs)
 * Factored out to eliminate duplication between the two near-identical tables.
 * ─────────────────────────────────────────────────────────────────────────── */

function FuelTable({
  table,
  columns,
  expandedId,
  setExpandedId,
  vehicleMap,
  totalRows,
  allRows,
  emptyLabel,
  onAdd,
  addLabel,
  ExpRow,
}) {
  const rows = table.getRowModel().rows;
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
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
                      header.column.getCanSort() && 'cursor-pointer hover:text-zinc-200 transition-colors'
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'  && <ChevronUp   className="w-3 h-3" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <Zap className="w-8 h-8 text-zinc-600" />
                    <p className="text-sm text-muted">{emptyLabel}</p>
                    {onAdd && (
                      <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={onAdd}>
                        {addLabel}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rec = row.original;
                const isExpanded = expandedId === rec.id;
                return (
                  <React.Fragment key={rec.id}>
                    <tr
                      className={cn(
                        'border-b border-border-subtle cursor-pointer transition-colors duration-150',
                        isExpanded ? 'bg-surface-700/50' : 'hover:bg-surface-700/30'
                      )}
                      onClick={() => setExpandedId((p) => p === rec.id ? null : rec.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3.5 align-middle"
                          onClick={cell.column.id === 'expander' ? (e) => e.stopPropagation() : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-0">
                      <td colSpan={columns.length + 1} className="p-0">
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <ExpRow
                              key={rec.id + '-exp'}
                              record={rec}
                              vehicleMap={vehicleMap}
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

      {/* Pagination */}
      {totalRows > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
          <p className="text-xs text-muted">
            {totalRows === allRows
              ? `${allRows} total records`
              : `${totalRows} of ${allRows} filtered`}
            {' · '}Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
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
    </div>
  );
}
