import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Fuel,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import reportsApi from '../../services/reports';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';

/* ─────────────────────────────────────────────────────────────────────────── *
 * INLINE DOWNLOAD UTILITY
 * Triggers a browser Save-As dialog from a Blob returned by the export API.
 * Avoids the need for a separate utils/downloadBlob.js file.
 * ─────────────────────────────────────────────────────────────────────────── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CHART PALETTE  (hex — never semantic key so colours always resolve)
 * ─────────────────────────────────────────────────────────────────────────── */
const PALETTE = {
  cyan:    '#22d3ee',
  violet:  '#a78bfa',
  emerald: '#34d399',
  amber:   '#fbbf24',
  rose:    '#fb7185',
  blue:    '#60a5fa',
  orange:  '#fb923c',
};

const axisStyle      = { fontSize: 11, fill: 'rgba(255,255,255,0.38)' };
const gridStyle      = { stroke: 'rgba(255,255,255,0.06)', strokeDasharray: '3 3' };

/* ─────────────────────────────────────────────────────────────────────────── *
 * GLASS TOOLTIP  (shared across every chart on this page)
 * ─────────────────────────────────────────────────────────────────────────── */
function GlassTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/10 bg-black/80 px-3 py-2.5 shadow-glow-sm backdrop-blur-md min-w-[140px]">
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey || entry.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? entry.fill }} />
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
 * SECTION SHELL
 * Shared wrapper for every report card: header row + collapsible body.
 * `autoLoad` sections load immediately; others show a "Load Report" CTA.
 * ─────────────────────────────────────────────────────────────────────────── */
function ReportSection({ id, title, subtitle, icon: Icon, iconColor, children, onLoad, isLoading, isLoaded, error }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass rounded-2xl border border-white/[0.07] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Button
          variant={isLoaded ? 'ghost' : 'secondary'}
          size="sm"
          leftIcon={isLoading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          onClick={onLoad}
          disabled={isLoading}
          id={`btn-load-${id}`}
        >
          {isLoading ? 'Loading…' : isLoaded ? 'Refresh' : 'Load Report'}
        </Button>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertTriangle className="w-7 h-7 text-danger-400" />
            <p className="text-sm text-danger-400 text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={onLoad}>Retry</Button>
          </div>
        ) : !isLoaded && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <BarChart2 className="w-8 h-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">Click <strong className="text-zinc-300">Load Report</strong> to fetch this data.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-14 gap-3">
            <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
            <span className="text-sm text-muted">Crunching numbers…</span>
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SUMMARY TABLE  (shared compact table used below every chart)
 * ─────────────────────────────────────────────────────────────────────────── */
function SummaryTable({ columns, rows, maxRows = 8 }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? rows : rows.slice(0, maxRows);
  return (
    <div className="mt-5 rounded-xl border border-border-subtle overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-700/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border-subtle last:border-0 transition-colors',
                  'hover:bg-surface-700/30'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-sm align-middle">
                    {col.render ? col.render(row[col.key], row) : (
                      <span className={cn('text-zinc-300', col.mono && 'font-mono')}>{row[col.key] ?? '—'}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-surface-700/30 transition-colors border-t border-border-subtle"
        >
          {showAll ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Show all {rows.length} rows</>
          )}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FLEET DASHBOARD SECTION (auto-loads on mount)
 * Response shape (inferred): {
 *   active_vehicles, available_vehicles, in_maintenance,
 *   active_trips, pending_trips, drivers_on_duty,
 *   fleet_utilization_pct
 * }
 * ─────────────────────────────────────────────────────────────────────────── */
function FleetDashboardSection({ data, isLoading, isLoaded, error, onLoad }) {
  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Active Vehicles',    value: data.active_vehicles     ?? data.active_vehicle_count   ?? '—', color: 'text-success-400',  bg: 'bg-success-bg'  },
      { label: 'Available',          value: data.available_vehicles  ?? data.available_count        ?? '—', color: 'text-info-400',    bg: 'bg-info-bg'     },
      { label: 'In Maintenance',     value: data.in_maintenance      ?? data.in_shop_count          ?? '—', color: 'text-warning-400', bg: 'bg-warning-bg'  },
      { label: 'Active Trips',       value: data.active_trips        ?? data.active_trip_count      ?? '—', color: 'text-accent-400',  bg: 'bg-accent-500/12' },
      { label: 'Pending Trips',      value: data.pending_trips       ?? data.pending_trip_count     ?? '—', color: 'text-[#a78bfa]',   bg: 'bg-[#a78bfa]/10' },
      { label: 'Drivers on Duty',    value: data.drivers_on_duty     ?? data.drivers_on_trip_count  ?? '—', color: 'text-[#22d3ee]',  bg: 'bg-[#22d3ee]/10' },
      ...(data.fleet_utilization_pct != null
        ? [{ label: 'Utilization %', value: `${Number(data.fleet_utilization_pct).toFixed(1)}%`,            color: 'text-emerald-400', bg: 'bg-emerald-400/10' }]
        : []
      ),
    ];
  }, [data]);

  return (
    <ReportSection
      id="fleet-dashboard"
      title="Fleet Dashboard"
      subtitle="Live snapshot of fleet-wide KPIs"
      icon={Truck}
      iconColor="bg-success-bg text-success-400"
      onLoad={onLoad}
      isLoading={isLoading}
      isLoaded={isLoaded}
      error={error}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl border border-white/[0.06] px-4 py-4', bg)}>
            <p className={cn('text-2xl font-bold font-mono leading-none', color)}>{value}</p>
            <p className="text-xs text-zinc-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>
      {data && Object.keys(data).length === 0 && (
        <p className="text-sm text-muted text-center py-8">No dashboard data returned from API.</p>
      )}
    </ReportSection>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FUEL EFFICIENCY SECTION
 * Response shape (inferred): Array of {
 *   vehicle_id, registration_number, total_distance_km,
 *   total_fuel_liters, efficiency_km_per_liter
 * }
 * ─────────────────────────────────────────────────────────────────────────── */
function FuelEfficiencySection({ data, isLoading, isLoaded, error, onLoad }) {
  const chartData = useMemo(() =>
    (data ?? [])
      .map((r) => ({
        plate:      r.registration_number ?? r.vehicle_id ?? '?',
        efficiency: r.efficiency_km_per_liter != null
          ? parseFloat(Number(r.efficiency_km_per_liter).toFixed(2))
          : null,
      }))
      .filter((r) => r.efficiency != null)
      .sort((a, b) => b.efficiency - a.efficiency),
    [data]
  );

  const tableColumns = [
    { key: 'registration_number', label: 'Vehicle',      render: (v, r) => <span className="font-medium text-zinc-200">{v ?? r.vehicle_id}</span> },
    { key: 'total_distance_km',    label: 'Distance',     render: (v) => <span className="font-mono text-zinc-300">{v != null ? `${Number(v).toLocaleString()} km` : '—'}</span> },
    { key: 'total_fuel_liters',    label: 'Fuel Used',    render: (v) => <span className="font-mono text-zinc-300">{v != null ? `${Number(v).toFixed(1)} L` : '—'}</span> },
    {
      key: 'efficiency_km_per_liter', label: 'Efficiency',
      render: (v) => {
        const n = Number(v);
        const color = n >= 12 ? 'text-success-400' : n >= 8 ? 'text-warning-400' : 'text-danger-400';
        return <span className={cn('font-mono font-semibold', color)}>{v != null ? `${n.toFixed(2)} km/L` : '—'}</span>;
      },
    },
  ];

  return (
    <ReportSection
      id="fuel-efficiency"
      title="Fuel Efficiency"
      subtitle="Distance per litre — per vehicle"
      icon={Fuel}
      iconColor="bg-[#22d3ee]/10 text-[#22d3ee]"
      onLoad={onLoad}
      isLoading={isLoading}
      isLoaded={isLoaded}
      error={error}
    >
      {chartData.length > 0 ? (
        <>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="plate" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={42} unit=" km/L" />
                <Tooltip
                  content={<GlassTooltip valueFormatter={(v) => `${v} km/L`} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="efficiency" name="km/L" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive animationDuration={800}>
                  {chartData.map((entry, i) => {
                    const color = entry.efficiency >= 12 ? PALETTE.emerald : entry.efficiency >= 8 ? PALETTE.amber : PALETTE.rose;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SummaryTable columns={tableColumns} rows={data ?? []} />
        </>
      ) : (
        <p className="text-sm text-muted text-center py-8">No fuel efficiency data available.</p>
      )}
    </ReportSection>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * OPERATIONAL COST SECTION
 * Response shape (inferred): Array of {
 *   vehicle_id, registration_number,
 *   fuel_cost, maintenance_cost, other_expenses, total_cost
 * }
 * ─────────────────────────────────────────────────────────────────────────── */
function OperationalCostSection({ data, isLoading, isLoaded, error, onLoad }) {
  const chartData = useMemo(() =>
    (data ?? [])
      .map((r) => ({
        plate:       r.registration_number ?? r.vehicle_id ?? '?',
        fuel:        parseFloat(Number(r.fuel_cost        ?? 0).toFixed(2)),
        maintenance: parseFloat(Number(r.maintenance_cost ?? 0).toFixed(2)),
        other:       parseFloat(Number(r.other_expenses   ?? 0).toFixed(2)),
      }))
      .sort((a, b) => (b.fuel + b.maintenance + b.other) - (a.fuel + a.maintenance + a.other)),
    [data]
  );

  const tableColumns = [
    { key: 'registration_number',    label: 'Vehicle',       render: (v, r) => <span className="font-medium text-zinc-200">{v ?? r.vehicle_id}</span> },
    { key: 'fuel_cost',        label: 'Fuel',          render: (v) => <span className="font-mono text-[#22d3ee]">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    { key: 'maintenance_cost', label: 'Maintenance',   render: (v) => <span className="font-mono text-warning-400">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    { key: 'other_expenses',   label: 'Other',         render: (v) => <span className="font-mono text-[#a78bfa]">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    { key: 'total_cost',       label: 'Total',         render: (v, r) => {
        const total = v ?? ((r.fuel_cost ?? 0) + (r.maintenance_cost ?? 0) + (r.other_expenses ?? 0));
        return <span className="font-mono font-bold text-zinc-100">${Number(total).toFixed(2)}</span>;
      }
    },
  ];

  return (
    <ReportSection
      id="operational-cost"
      title="Operational Cost"
      subtitle="Fuel · Maintenance · Other expenses — per vehicle"
      icon={BarChart2}
      iconColor="bg-warning-bg text-warning-400"
      onLoad={onLoad}
      isLoading={isLoading}
      isLoaded={isLoaded}
      error={error}
    >
      {chartData.length > 0 ? (
        <>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="plate" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  content={<GlassTooltip valueFormatter={(v) => `$${Number(v).toFixed(2)}`} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }} />
                <Bar dataKey="fuel"        name="Fuel ($)"        fill={PALETTE.cyan}   stackId="stack" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={700} maxBarSize={44} />
                <Bar dataKey="maintenance" name="Maintenance ($)" fill={PALETTE.amber}  stackId="stack" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={700} animationBegin={100} maxBarSize={44} />
                <Bar dataKey="other"       name="Other ($)"       fill={PALETTE.violet} stackId="stack" radius={[5, 5, 0, 0]} isAnimationActive animationDuration={700} animationBegin={200} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SummaryTable columns={tableColumns} rows={data ?? []} />
        </>
      ) : (
        <p className="text-sm text-muted text-center py-8">No operational cost data available.</p>
      )}
    </ReportSection>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ROI SECTION
 * Response shape (inferred): Array of {
 *   vehicle_id, registration_number, roi_pct (or roi),
 *   revenue, total_cost, acquisition_cost
 * }
 * Bars colored per-entry: positive ROI → emerald, negative → rose.
 * ReferenceLine at y=0 is the key visual differentiator on this chart.
 * ─────────────────────────────────────────────────────────────────────────── */
function RoiSection({ data, isLoading, isLoaded, error, onLoad }) {
  const chartData = useMemo(() =>
    (data ?? [])
      .map((r) => ({
        plate: r.registration_number ?? r.vehicle_id ?? '?',
        roi:   r.roi_pct != null ? parseFloat(Number(r.roi_pct).toFixed(2))
             : r.roi    != null ? parseFloat(Number(r.roi).toFixed(2))
             : null,
        _raw: r,
      }))
      .filter((r) => r.roi != null)
      .sort((a, b) => b.roi - a.roi),
    [data]
  );

  const tableColumns = [
    { key: 'registration_number', label: 'Vehicle',    render: (v, r) => <span className="font-medium text-zinc-200">{v ?? r.vehicle_id}</span> },
    { key: 'revenue',       label: 'Revenue',    render: (v) => <span className="font-mono text-success-400">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    { key: 'total_cost',    label: 'Total Cost', render: (v) => <span className="font-mono text-danger-400">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    { key: 'acquisition_cost', label: 'Acq. Cost', render: (v) => <span className="font-mono text-zinc-400">{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span> },
    {
      key: 'roi_pct', label: 'ROI %',
      render: (v, r) => {
        const pct = v ?? r.roi;
        const n   = Number(pct);
        const color = n >= 0 ? 'text-success-400' : 'text-danger-400';
        return <span className={cn('font-mono font-bold', color)}>{pct != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'}</span>;
      },
    },
  ];

  return (
    <ReportSection
      id="roi"
      title="ROI Analysis"
      subtitle="Return on investment per vehicle — Revenue minus costs over acquisition price"
      icon={TrendingUp}
      iconColor="bg-success-bg text-success-400"
      onLoad={onLoad}
      isLoading={isLoading}
      isLoaded={isLoaded}
      error={error}
    >
      {chartData.length > 0 ? (
        <>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="plate" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  content={<GlassTooltip valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v}%`} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                {/* Zero-line — the key visual: above=green, below=red */}
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                <Bar dataKey="roi" name="ROI %" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive animationDuration={800}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.roi >= 0 ? PALETTE.emerald : PALETTE.rose} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend row */}
          <div className="flex items-center gap-5 mt-3 mb-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-3 h-3 rounded-sm" style={{ background: PALETTE.emerald }} />
              Positive ROI (profitable)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-3 h-3 rounded-sm" style={{ background: PALETTE.rose }} />
              Negative ROI (loss-making)
            </div>
          </div>
          <SummaryTable columns={tableColumns} rows={data ?? []} />
        </>
      ) : (
        <p className="text-sm text-muted text-center py-8">No ROI data available.</p>
      )}
    </ReportSection>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CSV EXPORT PANEL
 * Each button independently manages its downloading state.
 * ─────────────────────────────────────────────────────────────────────────── */
const EXPORT_TYPES = [
  { key: 'vehicles', label: 'Vehicles CSV',  icon: Truck,          filename: 'transitops_vehicles.csv' },
  { key: 'drivers',  label: 'Drivers CSV',   icon: Users,          filename: 'transitops_drivers.csv'  },
  { key: 'trips',    label: 'Trips CSV',     icon: Zap,            filename: 'transitops_trips.csv'    },
];

function ExportPanel() {
  const [downloading, setDownloading] = useState({});
  const [exportErrors, setExportErrors] = useState({});

  const handleExport = async (type, filename) => {
    setDownloading((d) => ({ ...d, [type]: true }));
    setExportErrors((e) => ({ ...e, [type]: null }));
    try {
      const blob = await reportsApi.export(type);
      downloadBlob(blob, filename);
    } catch (err) {
      setExportErrors((e) => ({
        ...e,
        [type]: err?.response?.data?.detail ?? err?.message ?? 'Export failed',
      }));
    } finally {
      setDownloading((d) => ({ ...d, [type]: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="glass rounded-2xl border border-white/[0.07] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-accent-500/12 text-accent-400">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Data Export</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Download CSV snapshots of fleet records</p>
        </div>
      </div>

      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {EXPORT_TYPES.map(({ key, label, icon: Icon, filename }) => (
          <div key={key} className="flex flex-col gap-2">
            <button
              onClick={() => handleExport(key, filename)}
              disabled={downloading[key]}
              id={`btn-export-${key}`}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 text-left w-full group',
                'bg-surface-700/40 border-border hover:border-accent-500/40 hover:bg-surface-600/60',
                downloading[key] && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-500/10 text-accent-400 shrink-0 group-hover:bg-accent-500/20 transition-colors">
                {downloading[key] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-500">{filename}</p>
              </div>
              <Download className="w-4 h-4 text-zinc-600 group-hover:text-accent-400 transition-colors shrink-0" />
            </button>
            {exportErrors[key] && (
              <p className="text-xs text-danger-400 flex items-center gap-1.5 px-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {exportErrors[key]}
              </p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MAIN PAGE
 * ─────────────────────────────────────────────────────────────────────────── */
export default function Reports() {
  /* ── Fleet Dashboard (auto-loads) ── */
  const [dashData,    setDashData]    = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashLoaded,  setDashLoaded]  = useState(false);
  const [dashError,   setDashError]   = useState(null);

  /* ── Fuel Efficiency (lazy) ── */
  const [fuelData,    setFuelData]    = useState(null);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelLoaded,  setFuelLoaded]  = useState(false);
  const [fuelError,   setFuelError]   = useState(null);

  /* ── Operational Cost (lazy) ── */
  const [opData,    setOpData]    = useState(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opLoaded,  setOpLoaded]  = useState(false);
  const [opError,   setOpError]   = useState(null);

  /* ── ROI (lazy) ── */
  const [roiData,    setRoiData]    = useState(null);
  const [roiLoading, setRoiLoading] = useState(false);
  const [roiLoaded,  setRoiLoaded]  = useState(false);
  const [roiError,   setRoiError]   = useState(null);

  /* ── Loader helpers ── */
  const loadDash = useCallback(async () => {
    setDashLoading(true); setDashError(null);
    try   { setDashData(await reportsApi.dashboard());       setDashLoaded(true); }
    catch (e) { setDashError(e?.response?.data?.detail ?? e?.message ?? 'Failed'); }
    finally   { setDashLoading(false); }
  }, []);

  const loadFuel = useCallback(async () => {
    setFuelLoading(true); setFuelError(null);
    try   { setFuelData(await reportsApi.fuelEfficiency());  setFuelLoaded(true); }
    catch (e) { setFuelError(e?.response?.data?.detail ?? e?.message ?? 'Failed'); }
    finally   { setFuelLoading(false); }
  }, []);

  const loadOp = useCallback(async () => {
    setOpLoading(true); setOpError(null);
    try   { setOpData(await reportsApi.operationalCost());   setOpLoaded(true); }
    catch (e) { setOpError(e?.response?.data?.detail ?? e?.message ?? 'Failed'); }
    finally   { setOpLoading(false); }
  }, []);

  const loadRoi = useCallback(async () => {
    setRoiLoading(true); setRoiError(null);
    try   { setRoiData(await reportsApi.roi());              setRoiLoaded(true); }
    catch (e) { setRoiError(e?.response?.data?.detail ?? e?.message ?? 'Failed'); }
    finally   { setRoiLoading(false); }
  }, []);

  /* Fleet dashboard auto-loads on mount */
  useEffect(() => { loadDash(); }, [loadDash]);

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Link to="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-zinc-300">Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-50">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted mt-0.5">
            Fleet KPIs · Fuel efficiency · Operational cost · ROI · CSV exports
          </p>
        </div>

        {/* Quick-load all button */}
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<BarChart2 />}
          onClick={() => { loadDash(); loadFuel(); loadOp(); loadRoi(); }}
          disabled={dashLoading && fuelLoading && opLoading && roiLoading}
          id="btn-load-all-reports"
        >
          Load All Reports
        </Button>
      </motion.div>

      {/* SECTIONS */}
      <div className="space-y-5">
        <FleetDashboardSection
          data={dashData}
          isLoading={dashLoading}
          isLoaded={dashLoaded}
          error={dashError}
          onLoad={loadDash}
        />

        <FuelEfficiencySection
          data={fuelData}
          isLoading={fuelLoading}
          isLoaded={fuelLoaded}
          error={fuelError}
          onLoad={loadFuel}
        />

        <OperationalCostSection
          data={opData}
          isLoading={opLoading}
          isLoaded={opLoaded}
          error={opError}
          onLoad={loadOp}
        />

        <RoiSection
          data={roiData}
          isLoading={roiLoading}
          isLoaded={roiLoaded}
          error={roiError}
          onLoad={loadRoi}
        />

        {/* CSV EXPORT */}
        <ExportPanel />
      </div>
    </div>
  );
}
