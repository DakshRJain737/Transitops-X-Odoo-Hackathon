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
  Truck,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import vehiclesApi from '../../services/vehicles';
import { VEHICLE_STATUS_META, VEHICLE_TYPE_META, getStatusMeta } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - TanStack Table is headless — we own 100% of the markup/styling,
 *   which keeps this table visually consistent with the rest of the
 *   glass-dark UI instead of looking like a generic data-grid plugin.
 *
 * - Filters (status, type, region) are SERVER-SIDE — sent as
 *   status_filter / vehicle_type / region query params exactly as
 *   documented in the README, refetching vehiclesApi.list(params) on
 *   change. Search is CLIENT-SIDE (debounced) over the currently
 *   loaded page, since the API has no generic text-search param
 *   (confirmed "Not implemented" in README's Known Gaps table) —
 *   filtering the fetched page avoids implying a capability the
 *   backend doesn't have.
 *
 * - Pagination uses skip/limit exactly as documented. The README also
 *   notes pagination metadata (total count) is NOT returned by the
 *   API, so we can't show "Page 3 of 12" — instead we show a simple
 *   Prev/Next control and disable Next when a fetch returns fewer
 *   rows than the page size (the standard workaround for count-less
 *   paginated APIs).
 *
 * - RBAC: create/edit/delete affordances are gated with `canManage`
 *   (Fleet Manager or Admin, per README's vehicle endpoint table).
 *   Unauthorized roles simply don't see the buttons — cleaner for a
 *   toolbar than disabled-with-tooltip, and avoids leaking the shape
 *   of admin actions to roles that can't use them.
 *
 * - Row interaction: subtle left accent bar + background lift on
 *   hover (not a big shadow/scale hover) — dense tables get noisy
 *   with heavy hover treatments; the accent bar mirrors Linear's
 *   table row hover style.
 *
 * - Add Vehicle uses Modal variant="dialog" (centered) since it's a
 *   short, focused form. Edit uses variant="drawer" (per your Modal
 *   component's intended usage) to keep list context visible while
 *   editing.
 * ------------------------------------------------------------------ */

const PAGE_SIZE = 15;

const VEHICLE_STATUS_OPTIONS = Object.entries(VEHICLE_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const VEHICLE_TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

/* --------------------------- Sub-components --------------------------- */

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
        <Truck className="h-6 w-6 text-white/30" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/70">No vehicles found</p>
        <p className="mt-0.5 text-xs text-white/40">
          {canManage ? 'Register your first vehicle to get started.' : 'No vehicles match the current filters.'}
        </p>
      </div>
      {canManage && (
        <Button size="sm" leftIcon={<Plus />} onClick={onAdd}>
          Register Vehicle
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
        <p className="text-sm font-medium text-white/70">Couldn&apos;t load vehicles</p>
        <p className="mt-0.5 text-xs text-white/40">Check your connection and try again.</p>
      </div>
      <Button size="sm" variant="secondary" leftIcon={<RefreshCcw />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Add/Edit form — shared field set, driven by VehicleCreate/VehicleUpdate schema */
function VehicleForm({ defaultValues, onSubmit, onCancel, isSubmitting, mode }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Modal.Body className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Registration Number"
          required
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? 'Registration number cannot be changed.' : 'Must be unique across the fleet.'}
          error={errors.registration_number?.message}
          {...register('registration_number', {
            required: mode === 'create' ? 'Registration number is required' : false,
          })}
        />
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
          placeholder="Select type"
          options={VEHICLE_TYPE_OPTIONS}
          error={errors.type?.message}
          {...register('type', { required: 'Type is required' })}
        />
        <Input
          label="Max Load Capacity (kg)"
          type="number"
          step="0.01"
          required
          error={errors.max_load_capacity?.message}
          {...register('max_load_capacity', {
            required: 'Capacity is required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Must be greater than 0' },
          })}
        />
        <Input
          label="Acquisition Cost"
          type="number"
          step="0.01"
          required
          error={errors.acquisition_cost?.message}
          {...register('acquisition_cost', {
            required: 'Acquisition cost is required',
            valueAsNumber: true,
            min: { value: 0, message: 'Must be 0 or greater' },
          })}
        />
        <Input label="Region" error={errors.region?.message} {...register('region')} />
        {mode === 'create' && (
          <Input
            label="Starting Odometer"
            type="number"
            step="0.01"
            hint="Defaults to 0 if left blank."
            error={errors.odometer?.message}
            {...register('odometer', { valueAsNumber: true, min: 0 })}
          />
        )}
        <div className="sm:col-span-2">
          <Input
            label="Documents URL"
            hint="Optional link to registration/insurance documents."
            error={errors.documents_url?.message}
            {...register('documents_url')}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {mode === 'create' ? 'Register Vehicle' : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </form>
  );
}

/* ------------------------------- Page ------------------------------- */

export default function VehiclesList() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole ? hasRole(['fleet_manager', 'admin']) : true;

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const [sorting, setSorting] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [deleteVehicle, setDeleteVehicle] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (statusFilter) params.status_filter = statusFilter;
      if (typeFilter) params.vehicle_type = typeFilter;
      if (regionFilter) params.region = regionFilter;

      const data = await vehiclesApi.list(params);
      const rows = Array.isArray(data) ? data : data?.items ?? [];
      setVehicles(rows);
      setHasNextPage(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, regionFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Reset to page 0 whenever a server-side filter changes
  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter, regionFilter]);

  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicles;
    const q = search.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        v.registration_number?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const handleCreate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const payload = {
        ...formValues,
        max_load_capacity: Number(formValues.max_load_capacity),
        acquisition_cost: Number(formValues.acquisition_cost),
        odometer: formValues.odometer ? Number(formValues.odometer) : 0,
      };
      await vehiclesApi.create(payload);
      setAddOpen(false);
      fetchVehicles();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdate = async (formValues) => {
    setFormSubmitting(true);
    try {
      const { registration_number, odometer, ...rest } = formValues;
      const payload = {
        ...rest,
        max_load_capacity: Number(formValues.max_load_capacity),
        acquisition_cost: Number(formValues.acquisition_cost),
      };
      await vehiclesApi.update(editVehicle.id, payload);
      setEditVehicle(null);
      fetchVehicles();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    try {
      await vehiclesApi.remove(deleteVehicle.id);
      setDeleteVehicle(null);
      fetchVehicles();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'registration_number',
        header: 'Registration',
        cell: ({ row }) => (
          <Link
            to={`/vehicles/${row.original.id}`}
            className="font-mono text-sm font-medium text-white hover:text-accent-400"
          >
            {row.original.registration_number}
          </Link>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <div className="text-sm text-white/90">{row.original.name}</div>
            {row.original.model && (
              <div className="text-xs text-white/40">{row.original.model}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="text-sm text-white/70">
            {getStatusMeta('vehicleType', getValue())?.label}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusChip type="vehicle" status={getValue()} />,
      },
      {
        accessorKey: 'max_load_capacity',
        header: 'Capacity',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-white/70">{getValue()} kg</span>
        ),
      },
      {
        accessorKey: 'odometer',
        header: 'Odometer',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-white/70">{getValue()?.toLocaleString()} km</span>
        ),
      },
      {
        accessorKey: 'region',
        header: 'Region',
        cell: ({ getValue }) => <span className="text-sm text-white/60">{getValue() || '—'}</span>,
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
                          setEditVehicle(row.original);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteVehicle(row.original);
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
    data: filteredVehicles,
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
          <h1 className="text-xl font-semibold text-white">Vehicle Registry</h1>
          <p className="text-sm text-white/50">Manage your fleet&apos;s vehicles and their status.</p>
        </div>
        {canManage && (
          <Button leftIcon={<Plus />} onClick={() => setAddOpen(true)}>
            Register Vehicle
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
            placeholder="Search by registration, name, or model…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-accent-500 focus:shadow-glow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 outline-none focus:border-accent-500"
          >
            <option value="">All Statuses</option>
            {VEHICLE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 outline-none focus:border-accent-500"
          >
            <option value="">All Types</option>
            {VEHICLE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            placeholder="Region"
            className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-surface glass overflow-hidden rounded-2xl border border-white/10">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={fetchVehicles} />
        ) : filteredVehicles.length === 0 ? (
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
      {!loading && !error && filteredVehicles.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + filteredVehicles.length}
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

      {/* Add Vehicle */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register Vehicle"
        description="Add a new vehicle to your fleet."
        size="lg"
      >
        <VehicleForm
          mode="create"
          defaultValues={{
            registration_number: '',
            name: '',
            model: '',
            type: '',
            max_load_capacity: '',
            acquisition_cost: '',
            region: '',
            documents_url: '',
            odometer: 0,
          }}
          onSubmit={handleCreate}
          onCancel={() => setAddOpen(false)}
          isSubmitting={formSubmitting}
        />
      </Modal>

      {/* Edit Vehicle (drawer) */}
      <Modal
        isOpen={!!editVehicle}
        onClose={() => setEditVehicle(null)}
        title="Edit Vehicle"
        description={editVehicle?.registration_number}
        variant="drawer"
        size="md"
      >
        {editVehicle && (
          <VehicleForm
            mode="edit"
            defaultValues={{
              registration_number: editVehicle.registration_number,
              name: editVehicle.name,
              model: editVehicle.model || '',
              type: editVehicle.type,
              max_load_capacity: editVehicle.max_load_capacity,
              acquisition_cost: editVehicle.acquisition_cost,
              region: editVehicle.region || '',
              documents_url: editVehicle.documents_url || '',
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditVehicle(null)}
            isSubmitting={formSubmitting}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteVehicle}
        onClose={() => setDeleteVehicle(null)}
        onConfirm={handleDelete}
        title="Delete this vehicle?"
        description={`${deleteVehicle?.registration_number} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Vehicle"
        isLoading={deleteSubmitting}
      />
    </div>
  );
}