import React from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '../../utils/cn';

/* ------------------------------------------------------------------ *
 * DESIGN NOTES
 * ------------------------------------------------------------------
 * 1. Recharts' default tooltip is a plain white box — it clashes hard
 *    with a dark glass UI and is usually the #1 giveaway of an
 *    unstyled chart. We replace it everywhere with <GlassTooltip />.
 *
 * 2. Every chart shares one palette (CHART_COLORS) sourced to match
 *    the Tailwind design tokens (accent cyan / violet / emerald /
 *    amber / rose) so charts never feel like a bolted-on library.
 *
 * 3. Area charts use an SVG gradient fill that fades to transparent —
 *    a subtle "glow under the line" effect instead of a flat block
 *    of color, which reads as much more premium.
 *
 * 4. Animation: charts animate in on mount (draw-in) but we accept an
 *    `animate` prop so a parent can disable it on background refetches
 *    — replaying the draw-in animation on every poll looks jittery
 *    and is a common cheap-chart tell.
 *
 * 5. ChartCard is the shared shell (glass surface, header slot with
 *    title/subtitle/actions) so every chart on Dashboard/Reports has
 *    identical padding, radius, and border treatment.
 * ------------------------------------------------------------------ */

export const CHART_COLORS = {
  cyan: '#22d3ee',
  violet: '#a78bfa',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  blue: '#60a5fa',
};

const PALETTE = [
  CHART_COLORS.cyan,
  CHART_COLORS.violet,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
  CHART_COLORS.blue,
];

/* ------------------------------- Shell ------------------------------- */

export function ChartCard({
  title,
  subtitle,
  actions,
  className,
  children,
  height = 300,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'card-surface glass rounded-2xl border border-white/10 p-5',
        'flex flex-col gap-4',
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div style={{ width: '100%', height }}>{children}</div>
    </motion.div>
  );
}

/* ----------------------------- Tooltip ----------------------------- */

function GlassTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass rounded-lg border border-white/10 bg-black/80 px-3 py-2 shadow-glow-sm backdrop-blur-md">
      {label && (
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey || entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-white/60">{entry.name}</span>
            <span className="ml-auto font-mono font-medium text-white">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const axisStyle = {
  fontSize: 11,
  fill: 'rgba(255,255,255,0.4)',
};

/* --------------------------- Area Chart --------------------------- */

export function AreaChartCard({
  data,
  xKey,
  series, // [{ key, name, color }]
  valueFormatter,
  animate = true,
  ...cardProps
}) {
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color || PALETTE[i % PALETTE.length];
              return (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<GlassTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />}
          {series.map((s, i) => {
            const color = s.color || PALETTE[i % PALETTE.length];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                isAnimationActive={animate}
                animationDuration={900}
                animationBegin={i * 120}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --------------------------- Line Chart --------------------------- */

export function LineChartCard({
  data,
  xKey,
  series,
  valueFormatter,
  animate = true,
  ...cardProps
}) {
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<GlassTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />}
          {series.map((s, i) => {
            const color = s.color || PALETTE[i % PALETTE.length];
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive={animate}
                animationDuration={900}
                animationBegin={i * 120}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --------------------------- Bar Chart --------------------------- */

export function BarChartCard({
  data,
  xKey,
  series,
  valueFormatter,
  animate = true,
  stacked = false,
  ...cardProps
}) {
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            content={<GlassTooltip valueFormatter={valueFormatter} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />}
          {series.map((s, i) => {
            const color = s.color || PALETTE[i % PALETTE.length];
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name || s.key}
                fill={color}
                radius={[6, 6, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
                isAnimationActive={animate}
                animationDuration={700}
                animationBegin={i * 100}
                maxBarSize={40}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --------------------------- Pie Chart --------------------------- */

export function PieChartCard({
  data, // [{ name, value, color? }]
  valueFormatter,
  animate = true,
  innerRadius = 55,
  outerRadius = 90,
  ...cardProps
}) {
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<GlassTooltip valueFormatter={valueFormatter} />} />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            isAnimationActive={animate}
            animationDuration={800}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={entry.color || PALETTE[i % PALETTE.length]}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={2}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}