import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '@/lib/format';

const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const compactCurrency = (value) => {
  const v = Number(value) || 0;
  if (Math.abs(v) >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
};

const compactRupee = (value) => {
  const compact = compactCurrency(value);
  if (/[a-zA-Z]/.test(compact)) return `\u20B9${compact}`;
  return `\u20B9${Number(value || 0).toLocaleString('en-IN')}`;
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload || {};
  const value = payload[0]?.value ?? 0;
  let title = point.label;
  if (point.month) {
    const [yearStr, monthStr] = point.month.split('-');
    const idx = Number(monthStr) - 1;
    if (idx >= 0 && idx < 12) {
      title = `${MONTH_FULL[idx]} ${yearStr}`;
    }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-900/10">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-0.5 text-slate-500">
        Revenue:{' '}
        <span className="font-semibold text-indigo-600">
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}

export default function MonthlyRevenueChart({ data, height = 280 }) {
  const safeData = Array.isArray(data) ? data : [];
  const hasAny = safeData.some((d) => Number(d.revenue) > 0);

  if (!hasAny) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500"
      >
        <p className="font-medium text-slate-700">No revenue yet</p>
        <p>Record a payment to see the trend appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={safeData}
          margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#7c3aed" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revenueStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickFormatter={(v) => String(v).split(' ')[0]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={compactRupee}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip
            cursor={{ stroke: '#c7d2fe', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ChartTooltip />}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="url(#revenueStroke)"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            activeDot={{
              r: 6,
              fill: '#fff',
              stroke: '#7c3aed',
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
