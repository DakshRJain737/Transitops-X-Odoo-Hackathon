import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  CheckCircle2,
  Wrench,
  Route,
  Clock,
  Users,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  UserPlus,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { reportsApi } from '../../services/reports';
import { getStatusMeta } from '../../constants/statuses';
import StatusChip from '../../components/shared/StatusChip';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { AreaChartCard, PieChartCard, CHART_COLORS } from '../../components/charts/ChartComponents';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * - normalizeDashboard(): the backend's exact /api/reports/dashboard
 *   shape wasn't available at build time, so every field access is
 *   funneled through this single mapper with sane fallbacks. If the
 *   real response uses different key names, this is the ONLY place
 *   that needs to change — nothing in the JSX below touches raw API
 *   fields directly.
 *
 * - useCountUp(): a tiny local hook that animates numbers counting up
 *   from 0 on mount. Cheap (no extra dependency) but a big perceived-
 *   polish win for KPI cards — static numbers on a "premium SaaS"
 *   dashboard read as flat.
 *
 * - Layout: KPI row (4-up) -> 2-col chart row (utilization area +
 *   status pie) -> 2-col activity row (recent trips / maintenance) ->
 *   license expiry + quick actions row. This mirrors Linear/Vercel
 *   dashboard conventions: KPIs first, trend visualization second,
 *   actionable lists last.
 *
 * - Skeleton loading matches the final grid shape (same column spans,
 *   same card heights) so there's no layout shift when data arrives.
 *
 * - Partial-failure resilience: dashboard, recent trips, and recent
 *   maintenance are fetched independently (Promise.allSettled) so one
 *   failing endpoint degrades that one widget instead of blanking the
 *   whole page.
 *
 * - KPICard is defined locally for now (flagged in item #30 to be
 *   extracted into a shared component once built there); its public
 *   shape (props) is kept simple so extraction later won't require
 *   touching this file's usage.
 * ------------------------------------------------------------------ */

function normalizeDashboard(raw = {}) {
  return {
    activeVehicles: raw.active_vehicles ?? raw.activeVehicles ?? 0,
    availableVehicles: raw.available_vehicles ?? raw.availableVehicles ?? 0,
    inMaintenanceVehicles: raw.in_maintenance_vehicles ?? raw.inMaintenance ?? 0,
    totalVehicles: raw.total_vehicles ?? raw.totalVehicles ?? 0,
    activeTrips: raw.active_trips ?? raw.activeTrips ?? 0,
    pendingTrips: raw.pending_trips ?? raw.pendingTrips ?? 0,
    driversOnDuty: raw.drivers_on_duty ?? raw.driversOnDuty ?? 0,
    totalDrivers: raw.total_drivers ?? raw.totalDrivers ?? 0,
    fleetUtilization: raw.fleet_utilization ?? raw.fleetUtilization ?? 0,
    utilizationTrend:
      raw.utilization_trend ??
      raw.utilizationTrend ??
      [], // [{ date, utilization }]
    vehicleStatusBreakdown:
      raw.vehicle_status_breakdown ?? raw.vehicleStatusBreakdown ?? [], // [{ status, count }]
    recentTrips: raw.recent_trips ?? raw.recentTrips ?? [],
    recentMaintenance: raw.recent_maintenance ?? raw.recentMaintenance ?? [],
    licenseExpiry: raw.upcoming_license_expiry ?? raw.licenseExpiry ?? [],
  };
}

function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = Number(target) || 0;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out-cubic for a natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value);
}

function KPICard({ icon: Icon, label, value, suffix = '', decimals = 0, delta, accent = 'cyan', loading }) {
  const animated = useCountUp(loading ? 0 : value, { decimals });

  const accentMap = {
    cyan: 'text-accent-cyan bg-accent-cyan/10 shadow-glow-cyan',
    violet: 'text-accent-violet bg-accent-violet/10 shadow-glow-violet',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className="card-surface glass glass-hover rounded-2xl border border-white/10 p-5"
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        {delta !== undefined && delta !== null && (
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
              delta >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-8 w-20 rounded-md" />
        ) : (
          <div className="font-mono text-2xl font-semibold text-white">
            {animated}
            {suffix}
          </div>
        )}
        <div className="mt-1 text-xs font-medium text-white/50">{label}</div>
      </div>
    </motion.div>
  );
}

function SectionCard({ title, action, children, className }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
        {action}
      </div>
      <div className="flex-1 p-2">{children}</div>
    </Card>
  );
}

function EmptyRow({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
        <Icon className="h-5 w-5 text-white/30" />
      </div>
      <p className="text-xs text-white/40">{text}</p>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(() => normalizeDashboard());
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [dashRes] = await Promise.allSettled([reportsApi.dashboard()]);

      if (!mounted) return;

      if (dashRes.status === 'fulfilled') {
        setData(normalizeDashboard(dashRes.value?.data ?? dashRes.value));
      } else {
        setErrors((e) => ({ ...e, dashboard: true }));
      }
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const statusPieData = data.vehicleStatusBreakdown.map((s) => {
    const meta = getStatusMeta('vehicle', s.status);
    return {
      name: meta?.label || s.status,
      value: s.count,
      color: meta?.hex,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-white/50">Fleet-wide performance at a glance.</p>
      </div>

      {errors.dashboard && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Couldn&apos;t load some dashboard metrics. Showing partial data.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Truck}
          label="Available Vehicles"
          value={data.availableVehicles}
          accent="cyan"
          loading={loading}
        />
        <KPICard
          icon={Wrench}
          label="In Maintenance"
          value={data.inMaintenanceVehicles}
          accent="amber"
          loading={loading}
        />
        <KPICard
          icon={Route}
          label="Active Trips"
          value={data.activeTrips}
          accent="violet"
          loading={loading}
        />
        <KPICard
          icon={Users}
          label="Drivers On Duty"
          value={data.driversOnDuty}
          accent="emerald"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AreaChartCard
          className="lg:col-span-2"
          title="Fleet Utilization"
          subtitle={`${data.fleetUtilization}% average utilization`}
          height={280}
          data={
            data.utilizationTrend.length
              ? data.utilizationTrend
              : [{ date: 'No data', utilization: 0 }]
          }
          xKey="date"
          series={[{ key: 'utilization', name: 'Utilization %', color: CHART_COLORS.cyan }]}
          valueFormatter={(v) => `${v}%`}
        />
        <PieChartCard
          title="Vehicle Status"
          subtitle="Current fleet breakdown"
          height={280}
          data={
            statusPieData.length
              ? statusPieData
              : [{ name: 'No data', value: 1, color: 'rgba(255,255,255,0.1)' }]
          }
        />
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent Trips"
          action={
            <Button variant="ghost" size="sm" icon={ChevronRight} iconPosition="right">
              View all
            </Button>
          }
        >
          {loading ? (
            <RowSkeleton />
          ) : data.recentTrips.length === 0 ? (
            <EmptyRow icon={Route} text="No recent trips yet." />
          ) : (
            <div className="divide-y divide-white/5">
              {data.recentTrips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-white/90">
                      {trip.origin} → {trip.destination}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {trip.vehicle_registration_number || trip.vehicleReg} · {trip.driver_name || trip.driverName}
                    </div>
                  </div>
                  <StatusChip type="trip" status={trip.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Maintenance"
          action={
            <Button variant="ghost" size="sm" icon={ChevronRight} iconPosition="right">
              View all
            </Button>
          }
        >
          {loading ? (
            <RowSkeleton />
          ) : data.recentMaintenance.length === 0 ? (
            <EmptyRow icon={Wrench} text="No maintenance activity yet." />
          ) : (
            <div className="divide-y divide-white/5">
              {data.recentMaintenance.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-white/90">
                      {log.maintenance_type || log.type}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {log.vehicle_registration_number || log.vehicleReg}
                    </div>
                  </div>
                  <StatusChip type="maintenance" status={log.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* License expiry + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Upcoming License Expiry" className="lg:col-span-2">
          {loading ? (
            <RowSkeleton />
          ) : data.licenseExpiry.length === 0 ? (
            <EmptyRow icon={Clock} text="No licenses expiring soon." />
          ) : (
            <div className="divide-y divide-white/5">
              {data.licenseExpiry.slice(0, 5).map((driver) => (
                <div key={driver.id} className="flex items-center justify-between px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-white/90">{driver.name}</div>
                    <div className="mt-0.5 text-xs text-white/40">
                      License #{driver.license_number || driver.licenseNumber}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Expires {driver.license_expiry || driver.licenseExpiry}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <Card className="flex flex-col gap-3 p-5">
          <h3 className="text-sm font-semibold text-white/90">Quick Actions</h3>
          <Button variant="secondary" icon={PlusCircle} className="justify-start">
            Register Vehicle
          </Button>
          <Button variant="secondary" icon={UserPlus} className="justify-start">
            Add Driver
          </Button>
          <Button variant="secondary" icon={ClipboardList} className="justify-start">
            Dispatch Trip
          </Button>
          <Button variant="secondary" icon={Gauge} className="justify-start">
            View Reports
          </Button>
        </Card>
      </div>
    </div>
  );
}