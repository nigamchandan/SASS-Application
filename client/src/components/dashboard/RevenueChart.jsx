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

function ChartTooltip({ active, payload, metric }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload || {};
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-900/10">
      <div className="font-semibold text-slate-900">{point.label}</div>
      <div className="mt-0.5 text-slate-500">
        {metric === 'payments' ? 'Invoiced' : 'Payments'}:{' '}
        <span
          className={`font-semibold ${
            metric === 'payments' ? 'text-fuchsia-600' : 'text-emerald-600'
          }`}
        >
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}

export default function RevenueChart({
  data = [],
  metric = 'payments',
  height = 300,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const dataKey = metric === 'revenue' ? 'revenue' : 'payments';
  const hasAny = safeData.some((d) => Number(d[dataKey]) > 0);

  if (!hasAny) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500"
      >
        <p className="font-medium text-slate-700">No data for this range</p>
        <p>
          Try a different range or record a{' '}
          {metric === 'revenue' ? 'new invoice' : 'payment'} to see the trend.
        </p>
      </div>
    );
  }

  const isPayments = metric === 'payments';
  const fillId = isPayments ? 'paymentsFill' : 'invoicedFill';
  const strokeId = isPayments ? 'paymentsStroke' : 'invoicedStroke';

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={safeData}
          margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="paymentsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#10b981" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="paymentsStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>

            <linearGradient id="invoicedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#7c3aed" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="invoicedStroke" x1="0" y1="0" x2="1" y2="0">
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
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tickFormatter={compactRupee}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip
            cursor={{
              stroke: isPayments ? '#bbf7d0' : '#c7d2fe',
              strokeWidth: 1,
              strokeDasharray: '3 3',
            }}
            content={<ChartTooltip metric={metric} />}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={`url(#${strokeId})`}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            isAnimationActive
            animationDuration={700}
            activeDot={{
              r: 6,
              fill: '#fff',
              stroke: isPayments ? '#10b981' : '#7c3aed',
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
