import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Navigation,
  Plus,
  RefreshCcw,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  User,
  UserCheck,
  UserMinus,
  Users,
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
import { useForm } from 'react-hook-form';
import adminApi from '../../services/admin';
import { ROLES, ROLE_META, ROLE_OPTIONS } from '../../constants/roles';
import {
  VEHICLE_STATUS,
  DRIVER_STATUS,
  TRIP_STATUS,
} from '../../constants/statuses';
import Button from '../../components/ui/Button';
import { Modal, ConfirmDialog, ModalBody, ModalFooter } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSTANTS
 * ─────────────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'account',  label: 'My Account',      icon: User        },
  { key: 'users',    label: 'User Management',  icon: Users,      adminOnly: true },
  { key: 'admin',    label: 'Admin Tools',      icon: ShieldCheck, adminOnly: true },
];

const ROLE_FORM_OPTIONS = ROLE_OPTIONS.map((r) => ({
  value: r.value,
  label: r.label,
}));

/* Force-override options per entity type */
const FORCE_ENTITY_TYPES = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'driver',  label: 'Driver'  },
  { value: 'trip',    label: 'Trip'    },
];

const FORCE_STATUS_OPTIONS = {
  vehicle: Object.values(VEHICLE_STATUS).map((s) => ({ value: s, label: s.replace('_', ' ') })),
  driver:  Object.values(DRIVER_STATUS).map((s)  => ({ value: s, label: s.replace('_', ' ') })),
  trip:    Object.values(TRIP_STATUS).map((s)    => ({ value: s, label: s.replace('_', ' ') })),
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * COLOUR HELPERS — role → Tailwind classes
 * ─────────────────────────────────────────────────────────────────────────── */

const ROLE_COLOR_CLASSES = {
  accent:  { bg: 'bg-accent-500/12',  text: 'text-accent-400',  border: 'border-accent-500/25'  },
  info:    { bg: 'bg-info-bg',        text: 'text-info-400',    border: 'border-info-400/25'    },
  success: { bg: 'bg-success-bg',     text: 'text-success-400', border: 'border-success-400/25' },
  warning: { bg: 'bg-warning-bg',     text: 'text-warning-400', border: 'border-warning-400/25' },
  muted:   { bg: 'bg-surface-600',    text: 'text-muted',       border: 'border-border'         },
};

function roleBadgeClasses(role) {
  const color = ROLE_META[role]?.color ?? 'muted';
  return ROLE_COLOR_CLASSES[color] ?? ROLE_COLOR_CLASSES.muted;
}

const ROLE_ICONS = {
  [ROLES.ADMIN]:            ShieldCheck,
  [ROLES.FLEET_MANAGER]:    Truck,
  [ROLES.DRIVER]:           Navigation,
  [ROLES.SAFETY_OFFICER]:   ShieldAlert,
  [ROLES.FINANCIAL_ANALYST]: Settings2,
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * ROLE BADGE
 * ─────────────────────────────────────────────────────────────────────────── */
function RoleBadge({ role, size = 'sm' }) {
  const c    = roleBadgeClasses(role);
  const meta = ROLE_META[role];
  const Icon = ROLE_ICONS[role];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        c.bg, c.text, c.border
      )}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {meta?.shortLabel ?? role}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * TAB BAR (shared)
 * ─────────────────────────────────────────────────────────────────────────── */
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-border-subtle mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
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
                layoutId="settings-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-500 rounded-t-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MY ACCOUNT TAB
 * Displays current user's profile from the auth store (no backend call —
 * the /me data was already fetched on login).
 * Shows a role-access breakdown card underneath.
 * ─────────────────────────────────────────────────────────────────────────── */
function AccountTab() {
  const user    = useAuthStore((s) => s.user);
  const meta    = ROLE_META[user?.role] ?? {};
  const RoleIcon = ROLE_ICONS[user?.role] ?? User;
  const c       = roleBadgeClasses(user?.role);

  /* Access summary per role (from ROLE_NAV_ACCESS in roles.js) */
  const accessItems = useMemo(() => {
    if (!user?.role) return [];
    if (user.role === ROLES.ADMIN) {
      return [
        'Full system access',
        'User management & RBAC',
        'Force-override vehicle / driver / trip status',
        'System statistics',
        'All fleet operations',
      ];
    }
    const base = {
      [ROLES.FLEET_MANAGER]:    ['Dashboard', 'Vehicles (CRUD)', 'Drivers (CRUD)', 'Trips (dispatch/complete/cancel)', 'Maintenance (CRUD + close)', 'Reports'],
      [ROLES.DRIVER]:           ['Dashboard', 'Trips (create / dispatch / complete / cancel)', 'Fuel logs'],
      [ROLES.SAFETY_OFFICER]:   ['Dashboard', 'Drivers (view + edit)', 'Maintenance (view)'],
      [ROLES.FINANCIAL_ANALYST]:['Dashboard', 'Fuel logs (create)', 'Expenses (create)', 'Reports (all + CSV export)'],
    };
    return base[user.role] ?? [];
  }, [user?.role]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 max-w-2xl"
    >
      {/* Profile card */}
      <div className="glass rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-zinc-100">Profile</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Your account information from the last login</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0', c.bg, c.text)}>
              {user?.full_name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-100">{user?.full_name ?? '—'}</p>
              <p className="text-sm text-zinc-500">{user?.email ?? '—'}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'User ID',  value: user?.id    ?? '—', mono: true },
              { label: 'Status',   value: user?.is_active ? 'Active' : 'Inactive', valueClass: user?.is_active ? 'text-success-400' : 'text-danger-400' },
              { label: 'Role',     value: null, custom: <RoleBadge role={user?.role} size="md" /> },
              { label: 'Joined',   value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            ].map(({ label, value, mono, valueClass, custom }) => (
              <div key={label} className="bg-surface-700/50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
                {custom ? (
                  <div className="mt-1">{custom}</div>
                ) : (
                  <p className={cn('text-sm font-semibold mt-0.5', mono ? 'font-mono text-zinc-400 text-xs truncate' : 'text-zinc-200', valueClass)}>
                    {value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role access card */}
      <div className="glass rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.bg)}>
            <RoleIcon className={cn('w-4 h-4', c.text)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{meta.label ?? user?.role} — Access Summary</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <ul className="space-y-2">
            {accessItems.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2.5 text-sm text-zinc-300"
              >
                <Check className={cn('w-4 h-4 shrink-0', c.text)} />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * USER CREATE / EDIT MODAL
 * Create → password required. Edit → password optional (blank = unchanged).
 * ─────────────────────────────────────────────────────────────────────────── */
function UserFormModal({ isOpen, onClose, onSuccess, editUser }) {
  const isEdit = Boolean(editUser);
  const [serverError, setServerError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
      full_name: '',
      password: '',
      role: ROLES.DRIVER,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setServerError('');
    setShowPw(false);
    if (isEdit && editUser) {
      reset({
        email:     editUser.email     ?? '',
        full_name: editUser.full_name ?? '',
        password:  '',
        role:      editUser.role      ?? ROLES.DRIVER,
      });
    } else {
      reset({ email: '', full_name: '', password: '', role: ROLES.DRIVER });
    }
  }, [isOpen, isEdit, editUser, reset]);

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const payload = {
        email:     data.email,
        full_name: data.full_name,
        role:      data.role,
        ...(data.password ? { password: data.password } : {}),
      };
      if (isEdit) {
        await adminApi.updateUser(editUser.id, payload);
      } else {
        await adminApi.createUser({ ...payload, password: data.password });
      }
      onSuccess();
    } catch (err) {
      setServerError(err?.response?.data?.detail ?? err?.message ?? 'Failed to save');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Create User'}
      description={isEdit ? 'Update user details and role.' : 'Add a new user to the system.'}
      variant="drawer"
      size="md"
    >
      <ModalBody>
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="Jane Doe"
            error={errors.full_name?.message}
            {...register('full_name', { required: 'Name is required' })}
          />
          <Input
            label="Email"
            type="email"
            required
            placeholder="jane@company.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
            })}
          />

          {/* Password */}
          <div className="relative">
            <Input
              label={isEdit ? 'New Password (optional)' : 'Password'}
              type={showPw ? 'text' : 'password'}
              required={!isEdit}
              placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 characters'}
              hint={isEdit ? 'Leave blank to keep the existing password.' : undefined}
              error={errors.password?.message}
              {...register('password', {
                validate: (v) => {
                  if (!isEdit && !v) return 'Password is required';
                  if (v && v.length < 8) return 'Min 8 characters';
                  return true;
                },
              })}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3.5 top-[38px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Select
            label="Role"
            required
            options={ROLE_FORM_OPTIONS}
            error={errors.role?.message}
            {...register('role', { required: 'Role is required' })}
          />

          {serverError && (
            <p className="text-sm text-danger-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {serverError}
            </p>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" form="user-form" isLoading={isSubmitting} leftIcon={isEdit ? <Settings2 /> : <Plus />} id={isEdit ? 'btn-save-user' : 'btn-create-user'}>
          {isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * USER MANAGEMENT TAB
 * ─────────────────────────────────────────────────────────────────────────── */
function UserManagementTab() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers]             = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [sorting, setSorting]         = useState([{ id: 'full_name', desc: false }]);
  const [pagination, setPagination]   = useState({ pageIndex: 0, pageSize: 12 });

  /* Modals */
  const [createOpen, setCreateOpen]   = useState(false);
  const [editUser, setEditUser]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null); // { user, action: 'activate'|'deactivate' }
  const [isToggling, setIsToggling]   = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try   { setUsers(await adminApi.listUsers()); }
    catch (e) { setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load users'); }
    finally   { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try { await adminApi.deleteUser(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (e) { setActionError(e?.response?.data?.detail ?? e?.message ?? 'Delete failed'); }
    finally { setIsDeleting(false); }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setIsToggling(true);
    try {
      if (toggleTarget.action === 'deactivate') await adminApi.deactivateUser(toggleTarget.user.id);
      else                                        await adminApi.activateUser(toggleTarget.user.id);
      setToggleTarget(null); await load();
    } catch (e) { setActionError(e?.response?.data?.detail ?? e?.message ?? 'Action failed'); }
    finally { setIsToggling(false); }
  };

  const columns = useMemo(() => [
    {
      id: 'full_name', header: 'User', size: 200,
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0', roleBadgeClasses(row.original.role).bg, roleBadgeClasses(row.original.role).text)}>
            {row.original.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{row.original.full_name}</p>
            <p className="text-xs text-zinc-500 truncate">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role', header: 'Role', size: 150,
      cell: ({ getValue }) => <RoleBadge role={getValue()} />,
    },
    {
      accessorKey: 'is_active', header: 'Status', size: 100,
      cell: ({ getValue }) => (
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-lg border',
          getValue()
            ? 'bg-success-bg text-success-400 border-success-400/25'
            : 'bg-surface-600 text-muted border-border'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', getValue() ? 'bg-success-400' : 'bg-zinc-600')} />
          {getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'joined', header: 'Joined', size: 110,
      accessorFn: (r) => r.created_at ?? '',
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-500">
          {getValue() ? new Date(getValue()).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      id: 'actions', header: '', size: 160, enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
            {/* Activate / Deactivate */}
            {!isSelf && (
              <button
                title={u.is_active ? 'Deactivate' : 'Activate'}
                onClick={() => setToggleTarget({ user: u, action: u.is_active ? 'deactivate' : 'activate' })}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  u.is_active
                    ? 'text-zinc-500 hover:text-warning-400 hover:bg-warning-bg'
                    : 'text-zinc-500 hover:text-success-400 hover:bg-success-bg'
                )}
              >
                {u.is_active ? <UserMinus className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              </button>
            )}
            {/* Edit */}
            <button
              title="Edit user"
              onClick={() => setEditUser(u)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            {/* Delete */}
            {!isSelf && (
              <button
                title="Delete user"
                onClick={() => setDeleteTarget(u)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-danger-400 hover:bg-danger-bg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [currentUser?.id]);

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">System Users</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCcw />} onClick={load} disabled={isLoading}>Refresh</Button>
          <Button size="sm" leftIcon={<Plus />} onClick={() => setCreateOpen(true)} id="btn-create-user-open">Create User</Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
            <span className="text-muted text-sm">Loading users…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="w-7 h-7 text-danger-400" />
            <p className="text-sm text-danger-400">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-border-subtle">
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          style={{ width: h.getSize() }}
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            'px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap select-none',
                            h.column.getCanSort() && 'cursor-pointer hover:text-zinc-200 transition-colors'
                          )}
                        >
                          <span className="flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === 'asc'  && <ChevronUp   className="w-3 h-3" />}
                            {h.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-16">
                        <Users className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
                        <p className="text-sm text-muted">No users found</p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-border-subtle hover:bg-surface-700/30 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {users.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                <p className="text-xs text-muted">
                  {users.length} total · Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-600 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface-600 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action errors (inline, not modal) */}
      {actionError && (
        <p className="text-sm text-danger-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
          <button onClick={() => setActionError('')} className="ml-1 text-zinc-500 hover:text-zinc-200"><X className="w-3.5 h-3.5" /></button>
        </p>
      )}

      {/* Modals */}
      <UserFormModal
        isOpen={createOpen || Boolean(editUser)}
        onClose={() => { setCreateOpen(false); setEditUser(null); }}
        onSuccess={async () => { setCreateOpen(false); setEditUser(null); await load(); }}
        editUser={editUser}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete User?"
        description={`Permanently delete ${deleteTarget?.full_name ?? deleteTarget?.email ?? 'this user'}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        isLoading={isToggling}
        title={toggleTarget?.action === 'deactivate' ? 'Deactivate User?' : 'Activate User?'}
        description={
          toggleTarget?.action === 'deactivate'
            ? `${toggleTarget?.user?.full_name} will lose access to the system immediately.`
            : `${toggleTarget?.user?.full_name} will regain access to the system.`
        }
        confirmLabel={toggleTarget?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.action === 'deactivate' ? 'danger' : 'primary'}
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FORCE OVERRIDE TOOL
 * Deliberately high-friction: requires typing "OVERRIDE" in a confirm field.
 * Two-stage safety gate before the API call fires.
 * ─────────────────────────────────────────────────────────────────────────── */
function ForceOverrideTool() {
  const [entityType, setEntityType] = useState('vehicle');
  const [entityId,   setEntityId]   = useState('');
  const [status,     setStatus]     = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isOpen, setIsOpen]         = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [result, setResult]         = useState(null); // { success, message }

  const statusOptions = FORCE_STATUS_OPTIONS[entityType] ?? [];
  const canSubmit     = entityId.trim() && status && confirmText === 'OVERRIDE';

  const handleForce = async () => {
    setIsLoading(true); setResult(null);
    try {
      if      (entityType === 'vehicle') await adminApi.forceVehicleStatus(entityId.trim(), status);
      else if (entityType === 'driver')  await adminApi.forceDriverStatus (entityId.trim(), status);
      else                               await adminApi.forceTripStatus   (entityId.trim(), status);
      setResult({ success: true, message: `Force-set ${entityType} ${entityId.trim()} → ${status}` });
      setEntityId(''); setStatus(''); setConfirmText(''); setIsOpen(false);
    } catch (e) {
      setResult({ success: false, message: e?.response?.data?.detail ?? e?.message ?? 'Override failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl border border-danger-400/25 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-danger-400/15 bg-danger-bg/30">
        <AlertTriangle className="w-5 h-5 text-danger-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-danger-400">Force Status Override</p>
          <p className="text-xs text-zinc-500 mt-0.5">Bypasses all business rules and workflow validation. Use only in emergencies.</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Entity type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setStatus(''); }}
              className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-danger-500 transition-colors appearance-none cursor-pointer"
              id="force-entity-type"
            >
              {FORCE_ENTITY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Target status */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Target Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 px-3 py-2.5 outline-none focus:border-danger-500 transition-colors appearance-none cursor-pointer"
              id="force-status"
            >
              <option value="">Select status…</option>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Entity ID */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Entity UUID</label>
            <input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={`${entityType} ID (UUID)`}
              className="w-full bg-surface-600/60 border border-border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 px-3.5 py-2.5 outline-none focus:border-danger-500 font-mono transition-all"
              id="force-entity-id"
            />
          </div>
        </div>

        {/* Confirm friction field */}
        <div className="bg-danger-bg/50 border border-danger-400/20 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-danger-400">
            Type <strong>OVERRIDE</strong> to confirm you understand this action bypasses all validation:
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="OVERRIDE"
            className="w-full bg-surface-700/60 border border-danger-400/30 rounded-lg text-sm text-danger-300 placeholder:text-zinc-600 px-3 py-2 outline-none focus:border-danger-500 font-mono tracking-widest transition-all"
            id="force-confirm-text"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="danger"
            size="sm"
            leftIcon={isLoading ? <Loader2 className="animate-spin" /> : <Zap />}
            disabled={!canSubmit || isLoading}
            onClick={handleForce}
            id="btn-force-override"
          >
            Execute Override
          </Button>
          {result && (
            <motion.p
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn('text-sm flex items-center gap-1.5', result.success ? 'text-success-400' : 'text-danger-400')}
            >
              {result.success
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertTriangle className="w-4 h-4 shrink-0" />
              }
              {result.message}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ADMIN TOOLS TAB
 * Stats (auto-loads when tab activates) + Force Override danger zone.
 * ─────────────────────────────────────────────────────────────────────────── */
function AdminToolsTab() {
  const [statsData,    setStatsData]    = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError,   setStatsError]   = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true); setStatsError(null);
    try   { setStatsData(await adminApi.stats()); }
    catch (e) { setStatsError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load stats'); }
    finally   { setStatsLoading(false); }
  }, []);

  /* Auto-load when tab mounts */
  useEffect(() => { loadStats(); }, [loadStats]);

  /* Build KPI tiles from stats response (field names are inferred) */
  const statTiles = useMemo(() => {
    if (!statsData) return [];
    return [
      { label: 'Total Users',     value: statsData.total_users     ?? statsData.users     ?? '—', color: 'text-accent-400'  },
      { label: 'Inactive Users',  value: statsData.inactive_users  ?? '—',                        color: 'text-danger-400'  },
      { label: 'Total Vehicles',  value: statsData.total_vehicles  ?? statsData.vehicles  ?? '—', color: 'text-info-400'    },
      { label: 'Total Drivers',   value: statsData.total_drivers   ?? statsData.drivers   ?? '—', color: 'text-success-400' },
      { label: 'Total Trips',     value: statsData.total_trips     ?? statsData.trips     ?? '—', color: 'text-[#a78bfa]'   },
      /* Users by role — rendered if backend returns them */
      ...(statsData.users_by_role
        ? Object.entries(statsData.users_by_role).map(([role, count]) => ({
            label: ROLE_META[role]?.shortLabel ?? role,
            value: count,
            color: ROLE_COLOR_CLASSES[ROLE_META[role]?.color ?? 'muted']?.text ?? 'text-zinc-300',
          }))
        : []
      ),
    ];
  }, [statsData]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* System Stats */}
      <div className="glass rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-accent-500/12 text-accent-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">System Statistics</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Live system-wide counts from the backend</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" leftIcon={statsLoading ? <Loader2 className="animate-spin" /> : <RefreshCcw />} onClick={loadStats} disabled={statsLoading} id="btn-refresh-stats">
            {statsLoading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        <div className="px-6 py-5">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
              <span className="text-sm text-muted">Fetching stats…</span>
            </div>
          ) : statsError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <AlertTriangle className="w-7 h-7 text-danger-400" />
              <p className="text-sm text-danger-400">{statsError}</p>
              <Button variant="outline" size="sm" onClick={loadStats}>Retry</Button>
            </div>
          ) : statsData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {statTiles.map(({ label, value, color }) => (
                <div key={label} className="bg-surface-700/50 rounded-xl px-4 py-3.5 border border-border-subtle">
                  <p className={cn('text-2xl font-bold font-mono leading-none', color)}>{value}</p>
                  <p className="text-xs text-zinc-500 mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Force Override danger zone */}
      <ForceOverrideTool />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MAIN PAGE
 * ─────────────────────────────────────────────────────────────────────────── */
export default function Settings() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const isAdmin = hasRole('admin');

  /* Filter tabs based on role */
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.adminOnly || isAdmin),
    [isAdmin]
  );

  const [activeTab, setActiveTab] = useState('account');

  /* Redirect non-admin away from admin-only tabs if they somehow get here */
  useEffect(() => {
    const tab = visibleTabs.find((t) => t.key === activeTab);
    if (!tab) setActiveTab('account');
  }, [activeTab, visibleTabs]);

  return (
    <div>
      {/* PAGE HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
          <Link to="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-zinc-300">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>
        <p className="text-sm text-muted mt-0.5">
          Account profile · {isAdmin ? 'User management · Admin tools' : 'Role access summary'}
        </p>
      </motion.div>

      {/* TABS */}
      <TabBar tabs={visibleTabs} active={activeTab} onChange={setActiveTab} />

      {/* TAB CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'account' && <AccountTab key="account" />}
        {activeTab === 'users'   && isAdmin && <UserManagementTab key="users" />}
        {activeTab === 'admin'   && isAdmin && <AdminToolsTab key="admin" />}
      </AnimatePresence>
    </div>
  );
}
