import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import driversApi from '../../services/drivers';
import { DRIVER_STATUS_META } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - Mirrors VehiclesList's structure (toolbar / table / pagination)
 *   intentionally — same interaction pattern across list pages means
 *   users only learn the table once.
 *
 * - License validity is the headline signal for a driver row, not an
 *   afterthought column. The backend already computes
 *   `is_license_expired` (trusted as the single source of truth for
 *   "expired"); we additionally compute a client-side "expiring
 *   soon" (<=30 days) amber warning purely as additive UI sugar —
 *   it never overrides or contradicts the backend's expired flag.
 *
 * - Safety score renders as a small horizontal bar + number instead
 *   of a bare figure — much faster to scan down a column of 15 rows
 *   than reading numbers one at a time.
 *
 * - Search is client-side over the loaded page (name / license
 *   number) since, as with Vehicles, the API has no generic text
 *   search param. status_filter is server-side per the README.
 *
 * - RBAC: create/edit/delete gated to Fleet Manager, Safety Officer,
 *   Admin (README's driver endpoint table). Buttons simply don't
 *   render for other roles.
 * ------------------------------------------------------------------ */

const PAGE_SIZE = 15;
const EXPIRY_WARNING_DAYS = 30;

const DRIVER_STATUS_OPTIONS = Object.entries(DRIVER_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

function LicenseBadge({ expiryDate, isExpired }) {
  const days = daysUntil(expiryDate);
  const expiringSoon = !isExpired && days !== null && days <= EXPIRY_WARNING_DAYS;

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'font-mono text-sm',
          isExpired ? 'text-danger-400' : expiringSoon ? 'text-amber-400' : 'text-white/70'
        )}
      >
        {expiryDate ? new Date(expiryDate).toLocaleDateString() : '—'}
      </span>
      {isExpired ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-danger-400">
          <ShieldAlert className="h-3 w-3" /> Expired
        </span>
      ) : expiringSoon ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
          <AlertTriangle className="h-3 w-3" /> Expires in {days}d
        </span>
      ) : null}
    </div>
  );
}

function SafetyScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-danger-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-white/60">{pct.toFixed(0)}</span>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd, canManage }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Users className="h-6 w-6 text-white/30" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/70">No drivers found</p>
        <p className="mt-0.5 text-xs text-white/40">
          {canManage ? 'Add your first driver to get started.' : 'No drivers match the current filters.'}
        </p>
      </div>
      {canManage && (
        <Button size="sm" leftIcon={<Plus />} onClick={onAdd}>
          Add Driver
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
        <p className="text-sm font-medium text-white/70">Couldn&apos;t load drivers</p>
        <p className="mt-0.5 text-xs text-white/40">Check your connection and try again.</p>
      </div>
      <Button size="sm" variant="secondary" leftIcon={<RefreshCcw />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Add/Edit form — driven by DriverCreate/DriverUpdate schema */
function DriverForm({ defaultValues, onSubmit, onCancel, isSubmitting, mode }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

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
          label="License Number"
          required
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? 'License number cannot be changed.' : 'Must be unique across drivers.'}
          error={errors.license_number?.message}
          {...register('license_number', {
            required: mode === 'create' ? 'License number is required' : false,
          })}
        />
        <Input
          label="License Category"
          required
          hint="e.g. LMV, HMV, Transport"
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
        {mode === 'create' && (
          <div className="sm:col-span-2">
            <Input
              label="Safety Score"
              type="number"
              step="0.1"
              hint="Defaults to 100 if left blank."
              error={errors.safety_score?.message}
              {...register('safety_score', { valueAsNumber: true, min: 0, max: 100 })}
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {mode === 'create' ? 'Add Driver' : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </form>
  );
}

export default function DriversList() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole ? hasRole(['fleet_manager', 'safety_officer', 'admin']) : true;

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [sorting, setSorting] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [deleteDriver, setDeleteDriver] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
      if (statusFilter) params.status_filter = statusFilter;

      const data = await driversApi.list(params);
      const rows = Array.isArray(data) ? data : data?.items ?? [];
      setDrivers(rows);
      setHasNextPage(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.trim().toLowerCase();
    return drivers.filter(
      (d) => d.name?.toLowerCase().includes(q) || d.license_number?.toLowerCase().includes(q)
    );
  }, [drivers, search]);

  const handleCreate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const payload = {
        ...formValues,
        safety_score:
          formValues.safety_score !== undefined && formValues.safety_score !== null && formValues.safety_score !== ''
            ? Number(formValues.safety_score)
            : 100,
      };
      await driversApi.create(payload);
      setAddOpen(false);
      fetchDrivers();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const { license_number, ...rest } = formValues;
      await driversApi.update(editDriver.id, rest);
      setEditDriver(null);
      fetchDrivers();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    try {
      await driversApi.remove(deleteDriver.id);
      setDeleteDriver(null);
      fetchDrivers();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Driver',
        cell: ({ row }) => (
          <Link
            to={`/drivers/${row.original.id}`}
            className="text-sm font-medium text-white hover:text-accent-400"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'license_number',
        header: 'License #',
        cell: ({ getValue }) => <span className="font-mono text-sm text-white/70">{getValue()}</span>,
      },
      {
        accessorKey: 'license_category',
        header: 'Category',
        cell: ({ getValue }) => <span className="text-sm text-white/70">{getValue()}</span>,
      },
      {
        accessorKey: 'license_expiry_date',
        header: 'License Expiry',
        cell: ({ row }) => (
          <LicenseBadge
            expiryDate={row.original.license_expiry_date}
            isExpired={row.original.is_license_expired}
          />
        ),
      },
      {
        accessorKey: 'safety_score',
        header: 'Safety Score',
        cell: ({ getValue }) => <SafetyScoreBar score={getValue()} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusChip type="driver" status={getValue()} />,
      },
      {
        accessorKey: 'contact_number',
        header: 'Contact',
        cell: ({ getValue }) => <span className="text-sm text-white/60">{getValue()}</span>,
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => (
                <div className="relative flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === row.original.id ? null : row.original.id);
                    }}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/80"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {openMenuId === row.original.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      className="glass absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-xl border border-white/10 py-1 shadow-2xl"
                    >
                      <button
                        onClick={() => {
                          setEditDriver(row.original);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteDriver(row.original);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger-400 hover:bg-danger-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </motion.div>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage, openMenuId]
  );

  const table = useReactTable({
    data: filteredDrivers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Driver Management</h1>
          <p className="text-sm text-white/50">Manage driver profiles, licenses, and availability.</p>
        </div>
        {canManage && (
          <Button leftIcon={<Plus />} onClick={() => setAddOpen(true)}>
            Add Driver
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
            placeholder="Search by name or license number…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-accent-500 focus:shadow-glow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 outline-none focus:border-accent-500"
        >
          <option value="">All Statuses</option>
          {DRIVER_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-surface glass overflow-hidden rounded-2xl border border-white/10">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={fetchDrivers} />
        ) : filteredDrivers.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} canManage={canManage} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-white/10">
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/40',
                            canSort && 'cursor-pointer select-none hover:text-white/70'
                          )}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : sortDir === 'desc' ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              ))}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="group relative border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    {row.getVisibleCells().map((cell, ci) => (
                      <td key={cell.id} className="relative px-4 py-3">
                        {ci === 0 && (
                          <span className="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-accent-400 transition-transform group-hover:scale-y-100" />
                        )}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && filteredDrivers.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + filteredDrivers.length}
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

      {/* Add Driver */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Driver"
        description="Register a new driver profile."
        size="lg"
      >
        <DriverForm
          mode="create"
          defaultValues={{
            name: '',
            license_number: '',
            license_category: '',
            license_expiry_date: '',
            contact_number: '',
            safety_score: 100,
          }}
          onSubmit={handleCreate}
          onCancel={() => setAddOpen(false)}
          isSubmitting={formSubmitting}
        />
      </Modal>

      {/* Edit Driver (drawer) */}
      <Modal
        isOpen={!!editDriver}
        onClose={() => setEditDriver(null)}
        title="Edit Driver"
        description={editDriver?.name}
        variant="drawer"
        size="md"
      >
        {editDriver && (
          <DriverForm
            mode="edit"
            defaultValues={{
              name: editDriver.name,
              license_number: editDriver.license_number,
              license_category: editDriver.license_category,
              license_expiry_date: editDriver.license_expiry_date,
              contact_number: editDriver.contact_number,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditDriver(null)}
            isSubmitting={formSubmitting}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteDriver}
        onClose={() => setDeleteDriver(null)}
        onConfirm={handleDelete}
        title="Delete this driver?"
        description={`${deleteDriver?.name} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Driver"
        isLoading={deleteSubmitting}
      />
    </div>
  );
}