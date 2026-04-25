import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Crown,
  FileBarChart,
  Loader2,
  Minus,
  PieChart as PieIcon,
  Receipt,
  RefreshCw,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import ExportMenu from '@/components/common/ExportMenu';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractApiError, reportsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const PIE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#0ea5e9',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#ef4444',
  '#84cc16',
  '#64748b',
];

const STATUS_COLORS = {
  PAID: '#10b981',
  UNPAID: '#f59e0b',
  OVERDUE: '#ef4444',
};

const compactCurrency = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `\u20B9${(v / 10000000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100000) return `\u20B9${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `\u20B9${Math.round(v / 1000)}k`;
  return `\u20B9${v.toFixed(0)}`;
};

function DeltaPill({ pct, lowerIsBetter = false }) {
  const v = Number(pct) || 0;
  if (Math.abs(v) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  const isUp = v > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;
  const tone = isGood
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-rose-50 text-rose-700';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {isUp ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'from-indigo-500 to-violet-500',
  delta,
  hint,
  loading,
  highlight,
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        highlight
          ? 'border-emerald-200 ring-1 ring-emerald-100'
          : 'border-slate-200'
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-0 blur-3xl transition-opacity group-hover:opacity-25`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md transition-transform group-hover:scale-110`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {delta}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-3.5 w-20" />
          <Skeleton className="mt-2 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-28" />
        </>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
          <div
            className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${
              highlight ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {value}
          </div>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </>
      )}
    </div>
  );
}

function RevenueExpenseChart({ series, loading, granularity }) {
  if (loading) {
    return (
      <div className="flex h-[280px] items-end gap-2 pt-4">
        {[...Array(12)].map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${30 + ((i * 11) % 60)}%` }}
          />
        ))}
      </div>
    );
  }
  const safe = Array.isArray(series) ? series : [];
  const hasAny = safe.some(
    (s) => Number(s.revenue) > 0 || Number(s.expenses) > 0
  );
  if (!hasAny) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500">
        <p className="font-medium text-slate-700">No data in this range</p>
        <p>Add some payments or expenses to see the trend.</p>
      </div>
    );
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={safe}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="repRevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="repExpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
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
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tickFormatter={compactCurrency}
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold text-slate-900">{p.label}</div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                      Revenue
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3 text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                      Expenses
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(p.expenses)}
                    </span>
                  </div>
                  <div className="mt-1 border-t border-slate-100 pt-1 flex items-center justify-between gap-3">
                    <span className="text-slate-500">Profit</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        Number(p.profit) >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(p.profit)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: '#64748b' }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#repRevFill)"
            dot={false}
            isAnimationActive
            animationDuration={700}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#f43f5e"
            strokeWidth={2.5}
            fill="url(#repExpFill)"
            dot={false}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-slate-400">
        {granularity === 'day' ? 'Daily' : 'Monthly'} aggregation
      </p>
    </div>
  );
}

function CategoryDonut({ data, loading }) {
  if (loading) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <Skeleton className="h-[160px] w-[160px] rounded-full" />
      </div>
    );
  }
  const safe = (Array.isArray(data) ? data : [])
    .filter((c) => Number(c.total) > 0)
    .slice(0, 8);
  if (safe.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500">
        <p className="font-medium text-slate-700">No expenses yet</p>
        <p>Categorized spend will appear here.</p>
      </div>
    );
  }
  const total = safe.reduce((s, c) => s + Number(c.total || 0), 0);
  return (
    <div className="grid h-[260px] grid-cols-1 gap-3 sm:grid-cols-[170px_1fr]">
      <div className="relative h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safe}
              dataKey="total"
              nameKey="category"
              innerRadius={48}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              stroke="#fff"
              strokeWidth={2}
              paddingAngle={2}
            >
              {safe.map((entry, i) => (
                <Cell
                  key={entry.category}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold text-slate-900">
                      {p.category}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {formatCurrency(p.total)}
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            total
          </span>
          <span className="text-base font-semibold tabular-nums text-slate-900">
            {compactCurrency(total)}
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 self-center text-sm">
        {safe.map((c, i) => {
          const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
          return (
            <li
              key={c.category}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                  style={{
                    backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                  }}
                />
                <span className="truncate text-slate-700">{c.category}</span>
              </div>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="font-semibold text-slate-900">
                  {formatCurrency(c.total)}
                </span>
                <span className="text-xs text-slate-400">({pct}%)</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InvoiceStatusDonut({ data, loading }) {
  if (loading) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <Skeleton className="h-[160px] w-[160px] rounded-full" />
      </div>
    );
  }
  const items = [];
  if (data?.paid?.count) {
    items.push({
      key: 'PAID',
      label: 'Paid',
      count: data.paid.count,
      total: data.paid.total,
      color: STATUS_COLORS.PAID,
    });
  }
  if (data?.unpaid?.count) {
    items.push({
      key: 'UNPAID',
      label: 'Unpaid',
      count: data.unpaid.count,
      total: data.unpaid.total,
      color: STATUS_COLORS.UNPAID,
    });
  }
  if (data?.overdue?.count) {
    items.push({
      key: 'OVERDUE',
      label: 'Overdue',
      count: data.overdue.count,
      total: data.overdue.total,
      color: STATUS_COLORS.OVERDUE,
    });
  }
  if (items.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500">
        <p className="font-medium text-slate-700">No invoices in range</p>
        <p>Invoice statuses will show up here.</p>
      </div>
    );
  }
  const total = items.reduce((s, i) => s + Number(i.count || 0), 0);
  return (
    <div className="grid h-[260px] grid-cols-1 gap-3 sm:grid-cols-[170px_1fr]">
      <div className="relative h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="count"
              nameKey="label"
              innerRadius={48}
              outerRadius={78}
              stroke="#fff"
              strokeWidth={2}
              paddingAngle={2}
            >
              {items.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold text-slate-900">
                      {p.label}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {p.count} invoice{p.count === 1 ? '' : 's'} · {formatCurrency(p.total)}
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            invoices
          </span>
          <span className="text-base font-semibold tabular-nums text-slate-900">
            {total}
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 self-center text-sm">
        {items.map((it) => (
          <li
            key={it.key}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: it.color }}
              />
              <span className="text-slate-700">{it.label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {it.count}
              </span>
            </div>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(it.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [range, setRange] = useState('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const p = { range };
    if (range === 'custom') {
      if (from) p.from = from;
      if (to) p.to = to;
    }
    return p;
  }, [range, from, to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.summary(params);
      setData(res?.data ?? null);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load report'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format) => {
    try {
      const res =
        format === 'pdf'
          ? await reportsApi.exportPdf(params)
          : await reportsApi.exportCsv(params);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const blob =
        res.data instanceof Blob ? res.data : new Blob([res.data], { type: mime });
      const cd = res.headers?.['content-disposition'] || '';
      const m = /filename="?([^"]+)"?/i.exec(cd);
      const filename = m
        ? m[1]
        : `bizautomate-report-${range}-${todayISO()}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${ext.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not export'));
    }
  };

  const kpis = data?.kpis;
  const series = data?.series;
  const granularity = data?.range?.granularity || 'month';
  const fromDate = data?.range?.from
    ? new Date(data.range.from).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const toDate = data?.range?.to
    ? new Date(data.range.to).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <PieIcon className="h-5 w-5" />
            </span>
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time business intelligence — every number is computed from
            your invoices, payments, and expenses.
          </p>
          {fromDate && toDate && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              {fromDate} → {toDate}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="h-10"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <ExportMenu
            onExport={handleExport}
            disabled={loading}
            label="Export report"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          />
        </div>
      </div>

      {range === 'custom' && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:max-w-md">
          <div>
            <label className="text-xs font-medium text-slate-500">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
          <p className="font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue"
          icon={Wallet}
          accent="from-indigo-500 to-blue-500"
          value={formatCurrency(kpis?.revenue ?? 0)}
          delta={<DeltaPill pct={kpis?.revenue_pct} />}
          hint={
            kpis
              ? `${kpis.payment_count} payment${
                  kpis.payment_count === 1 ? '' : 's'
                } · prev ${formatCurrency(kpis.revenue_prev)}`
              : 'vs previous period'
          }
          loading={loading && !data}
        />
        <KpiCard
          label="Expenses"
          icon={Receipt}
          accent="from-rose-500 to-pink-500"
          value={formatCurrency(kpis?.expenses ?? 0)}
          delta={<DeltaPill pct={kpis?.expenses_pct} lowerIsBetter />}
          hint={
            kpis
              ? `${kpis.expense_count} entr${
                  kpis.expense_count === 1 ? 'y' : 'ies'
                } · prev ${formatCurrency(kpis.expenses_prev)}`
              : 'vs previous period'
          }
          loading={loading && !data}
        />
        <KpiCard
          label="Net Profit"
          icon={BarChart3}
          accent="from-emerald-500 to-teal-500"
          value={formatCurrency(kpis?.profit ?? 0)}
          delta={<DeltaPill pct={kpis?.profit_pct} />}
          hint={
            kpis
              ? `Margin ${kpis.margin}% · prev ${formatCurrency(kpis.profit_prev)}`
              : 'revenue − expenses'
          }
          loading={loading && !data}
          highlight
        />
        <KpiCard
          label="Tax (GST) collected"
          icon={FileBarChart}
          accent="from-violet-500 to-fuchsia-500"
          value={formatCurrency(kpis?.tax ?? 0)}
          delta={
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              <Crown className="h-3 w-3" />
              from invoices
            </span>
          }
          hint={
            kpis
              ? `${kpis.invoice_count} invoice${
                  kpis.invoice_count === 1 ? '' : 's'
                } · ${formatCurrency(kpis.invoiced)} invoiced`
              : 'on invoices issued in range'
          }
          loading={loading && !data}
        />
      </div>

      {/* Revenue vs Expenses chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">
              Trend
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              Revenue vs Expenses
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cash basis — revenue from payments received in range, expenses
              by date.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              Revenue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              Expenses
            </span>
          </div>
        </div>
        <div className="mt-5">
          <RevenueExpenseChart
            series={series}
            loading={loading && !data}
            granularity={granularity}
          />
        </div>
      </section>

      {/* Two columns: Categories + Invoice status */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-rose-600">
                Spend
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Expenses by category
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Where your money went in this period.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <CategoryDonut
              data={data?.expenses_by_category}
              loading={loading && !data}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600">
                Receivables
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Invoice status
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Issued in this period — paid, unpaid, and overdue.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <InvoiceStatusDonut
              data={data?.invoice_status}
              loading={loading && !data}
            />
          </div>
        </div>
      </section>

      {/* Top customers */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-col gap-1 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
              People
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              <Trophy className="mr-1 inline h-4 w-4 text-amber-500" />
              Top customers by revenue
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Based on payments received in the selected period.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading && !data ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : data?.top_customers?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_customers.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-slate-500">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          i === 0
                            ? 'bg-amber-100 text-amber-700'
                            : i === 1
                              ? 'bg-slate-200 text-slate-700'
                              : i === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/customers/${c.id}`}
                        className="group inline-flex items-center gap-3 hover:text-indigo-600"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                          {(c.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 group-hover:text-indigo-600">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {c.email || c.phone || '\u2014'}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {c.invoiceCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency(c.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center text-sm text-slate-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-slate-700">
                  No customer revenue yet
                </p>
                <p className="text-xs">
                  Once you record payments, top customers will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
