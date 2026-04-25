import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import Sparkline from '@/components/dashboard/Sparkline';

const TONES = {
  indigo: {
    tile: 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30',
    spark: { stroke: '#6366f1', fill: 'rgba(99,102,241,0.18)' },
    halo: 'from-indigo-500 to-violet-500',
  },
  emerald: {
    tile: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30',
    spark: { stroke: '#10b981', fill: 'rgba(16,185,129,0.18)' },
    halo: 'from-emerald-500 to-teal-500',
  },
  sky: {
    tile: 'bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/30',
    spark: { stroke: '#0ea5e9', fill: 'rgba(14,165,233,0.18)' },
    halo: 'from-sky-500 to-blue-500',
  },
  amber: {
    tile: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30',
    spark: { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.18)' },
    halo: 'from-amber-500 to-orange-500',
  },
  rose: {
    tile: 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/30',
    spark: { stroke: '#f43f5e', fill: 'rgba(244,63,94,0.18)' },
    halo: 'from-rose-500 to-pink-500',
  },
};

function DeltaPill({ delta }) {
  if (!delta) return null;
  const Icon =
    delta.kind === 'down'
      ? ArrowDownRight
      : delta.kind === 'up'
        ? ArrowUpRight
        : ArrowUpRight;
  const tone =
    delta.kind === 'down'
      ? 'text-rose-700 bg-rose-50'
      : delta.kind === 'flat'
        ? 'text-slate-600 bg-slate-100'
        : 'text-emerald-700 bg-emerald-50';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {delta.label}
    </span>
  );
}

export default function KpiCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = 'indigo',
  loading = false,
  sparkline,
}) {
  const styles = TONES[tone] || TONES.indigo;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${styles.halo} opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-25`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${styles.tile}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <button
          type="button"
          aria-label="More"
          className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-3.5 w-24" />
          <Skeleton className="mt-2 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-28" />
        </>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {value}
            </div>
            {Array.isArray(sparkline) && sparkline.length > 0 ? (
              <Sparkline
                data={sparkline}
                stroke={styles.spark.stroke}
                fill={styles.spark.fill}
                width={84}
                height={26}
              />
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <DeltaPill delta={delta} />
            {hint && <span className="text-slate-500">{hint}</span>}
          </div>
        </>
      )}
    </div>
  );
}
