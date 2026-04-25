import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import ExportMenu from '@/components/common/ExportMenu';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import ExpenseFormDialog from '@/components/expenses/ExpenseFormDialog';
import { expensesApi, downloadBlob, extractApiError } from '@/lib/api';
import { EXPENSE_CATEGORIES } from '@/lib/validators';
import { formatCurrency, formatDate } from '@/lib/format';

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

const CATEGORY_TONE = {
  Utilities: 'bg-amber-50 text-amber-700 ring-amber-100',
  'Office Supplies': 'bg-sky-50 text-sky-700 ring-sky-100',
  Travel: 'bg-violet-50 text-violet-700 ring-violet-100',
  'Food & Drinks': 'bg-rose-50 text-rose-700 ring-rose-100',
  Marketing: 'bg-pink-50 text-pink-700 ring-pink-100',
  Software: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  Salaries: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Rent: 'bg-orange-50 text-orange-700 ring-orange-100',
  Maintenance: 'bg-slate-100 text-slate-700 ring-slate-200',
  Taxes: 'bg-red-50 text-red-700 ring-red-100',
  Other: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const isoFor = (d) => new Date(d).toISOString().slice(0, 10);

function rangeToDates(range) {
  const now = new Date();
  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: isoFor(start), dateTo: isoFor(end) };
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { dateFrom: isoFor(start), dateTo: isoFor(end) };
  }
  if (range === 'last_3_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { dateFrom: isoFor(start), dateTo: todayISO() };
  }
  if (range === 'last_6_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return { dateFrom: isoFor(start), dateTo: todayISO() };
  }
  if (range === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { dateFrom: isoFor(start), dateTo: todayISO() };
  }
  return { dateFrom: '', dateTo: '' };
}

function CategoryPill({ category }) {
  const tone =
    CATEGORY_TONE[category] || 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      <Tag className="h-2.5 w-2.5" />
      {category || 'Uncategorized'}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'indigo',
  loading,
  delta,
}) {
  const TONES = {
    indigo:
      'from-indigo-500 to-violet-500 shadow-indigo-500/30 text-indigo-600',
    rose: 'from-rose-500 to-pink-500 shadow-rose-500/30 text-rose-600',
    emerald:
      'from-emerald-500 to-teal-500 shadow-emerald-500/30 text-emerald-600',
    amber:
      'from-amber-500 to-orange-500 shadow-amber-500/30 text-amber-600',
  };
  const halo = TONES[tone] || TONES.indigo;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${halo} opacity-0 blur-3xl transition-opacity group-hover:opacity-25`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${halo} text-white shadow-md transition-transform group-hover:scale-110`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              delta.kind === 'up'
                ? 'bg-rose-50 text-rose-700'
                : delta.kind === 'down'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {delta.kind === 'up' ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : delta.kind === 'down' ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {delta.label}
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-3.5 w-24" />
          <Skeleton className="mt-2 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-28" />
        </>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </>
      )}
    </div>
  );
}

function MonthlyBarChart({ data, height = 240 }) {
  const safe = Array.isArray(data) ? data : [];
  const hasAny = safe.some((d) => Number(d.total) > 0);
  if (!hasAny) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500"
      >
        <p className="font-medium text-slate-700">No expenses yet</p>
        <p>Track your first expense to see the trend.</p>
      </div>
    );
  }
  const compact = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={safe}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="expBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0.6} />
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
            tickFormatter={(v) => String(v).split(' ')[0]}
          />
          <YAxis
            tickFormatter={(v) => `\u20B9${compact(v)}`}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(244, 63, 94, 0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold text-slate-900">{p.label}</div>
                  <div className="mt-0.5 text-slate-500">
                    Total:{' '}
                    <span className="font-semibold text-rose-600">
                      {formatCurrency(p.total)}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {p.count} {p.count === 1 ? 'expense' : 'expenses'}
                  </div>
                </div>
              );
            }}
          />
          <Bar
            dataKey="total"
            fill="url(#expBarFill)"
            radius={[8, 8, 0, 0]}
            isAnimationActive
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryPie({ data, height = 240 }) {
  const safe = (Array.isArray(data) ? data : [])
    .filter((c) => Number(c.total) > 0)
    .slice(0, 8);
  if (safe.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500"
      >
        <p className="font-medium text-slate-700">No category data</p>
        <p>Add expenses to see breakdown.</p>
      </div>
    );
  }
  const total = safe.reduce((s, c) => s + Number(c.total || 0), 0);
  return (
    <div style={{ height }} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safe}
              dataKey="total"
              nameKey="category"
              innerRadius={50}
              outerRadius={80}
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
          <span className="text-base font-semibold tabular-nums text-slate-900">
            {formatCurrency(total)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            this month
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

const PAGE_SIZE = 10;

export default function Expenses() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [filteredTotal, setFilteredTotal] = useState(0);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [range, setRange] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  const dateBounds = useMemo(() => {
    if (range === 'custom') {
      return { dateFrom: customFrom || '', dateTo: customTo || '' };
    }
    return rangeToDates(range);
  }, [range, customFrom, customTo]);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await expensesApi.summary();
      setSummary(res?.data ?? null);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load summary'));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const params = {
        q: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
        sortBy: 'date',
        sortOrder: 'desc',
      };
      if (category && category !== 'all') params.category = category;
      if (dateBounds.dateFrom) params.dateFrom = dateBounds.dateFrom;
      if (dateBounds.dateTo) params.dateTo = dateBounds.dateTo;
      const res = await expensesApi.list(params);
      setItems(res?.data?.expenses ?? []);
      setPagination(res?.data?.pagination ?? pagination);
      setFilteredTotal(res?.data?.filteredTotal ?? 0);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load expenses'));
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, dateBounds.dateFrom, dateBounds.dateTo, page]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const refreshAll = useCallback(() => {
    fetchSummary();
    fetchList();
  }, [fetchSummary, fetchList]);

  const handleExport = async (format) => {
    try {
      const params = { q: debouncedSearch || undefined };
      if (category && category !== 'all') params.category = category;
      if (dateBounds.dateFrom) params.dateFrom = dateBounds.dateFrom;
      if (dateBounds.dateTo) params.dateTo = dateBounds.dateTo;
      const res =
        format === 'pdf'
          ? await expensesApi.exportPdf(params)
          : await expensesApi.exportCsv(params);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const filename = `bizautomate-expenses-${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      downloadBlob(res.data, filename, mime);
      toast.success(`Expenses exported as ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(extractApiError(err, 'Export failed'));
    }
  };

  const handleAdd = () => {
    setFormInitial(null);
    setFormOpen(true);
  };

  const handleEdit = (expense) => {
    setFormInitial(expense);
    setFormOpen(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (formInitial) {
        await expensesApi.update(formInitial.id, values);
        toast.success('Expense updated');
      } else {
        await expensesApi.create(values);
        toast.success('Expense added');
      }
      setFormOpen(false);
      setFormInitial(null);
      refreshAll();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save expense'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await expensesApi.remove(pendingDelete.id);
      toast.success('Expense deleted');
      setPendingDelete(null);
      // If we just removed the last entry on this page, step back
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      refreshAll();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete expense'));
    } finally {
      setDeleting(false);
    }
  };

  const pctChange = Number(summary?.percentage_change || 0);
  const pctDelta = useMemo(() => {
    if (!summary) return null;
    if (Math.abs(pctChange) < 0.05) {
      return { kind: 'flat', label: '0% vs last month' };
    }
    return {
      kind: pctChange > 0 ? 'up' : 'down',
      label: `${Math.abs(pctChange).toFixed(1)}% vs last month`,
    };
  }, [summary, pctChange]);

  const totalPages = pagination.totalPages || 1;
  const initialLoading = loadingList && items.length === 0 && !error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25">
              <Receipt className="h-5 w-5" />
            </span>
            Expenses
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track every rupee that leaves the business — categorized,
            searchable, and insight-ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            onExport={handleExport}
            disabled={pagination.total === 0 && !loadingList}
          />
          <Button
            type="button"
            variant="outline"
            onClick={refreshAll}
            disabled={loadingList || loadingSummary}
            className="h-10"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loadingList || loadingSummary ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            className="h-10 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25 hover:from-rose-600 hover:to-pink-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
          <p className="font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="This month"
          value={formatCurrency(summary?.total_this_month ?? 0)}
          icon={Wallet}
          tone="rose"
          loading={loadingSummary && !summary}
          delta={pctDelta}
          hint={
            summary?.count_this_month
              ? `${summary.count_this_month} expense${
                  summary.count_this_month === 1 ? '' : 's'
                }`
              : 'No expenses yet'
          }
        />
        <KpiCard
          label="Last month"
          value={formatCurrency(summary?.total_last_month ?? 0)}
          icon={CalendarRange}
          tone="amber"
          loading={loadingSummary && !summary}
          hint="for comparison"
        />
        <KpiCard
          label="% Change"
          value={
            summary
              ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`
              : '—'
          }
          icon={pctChange >= 0 ? TrendingUp : TrendingDown}
          tone={pctChange > 0 ? 'rose' : 'emerald'}
          loading={loadingSummary && !summary}
          hint={pctChange > 0 ? 'spending up' : 'spending down'}
        />
        <KpiCard
          label="All-time spend"
          value={formatCurrency(summary?.total_all_time ?? 0)}
          icon={Receipt}
          tone="indigo"
          loading={loadingSummary && !summary}
          hint={`${summary?.count_all_time ?? 0} entries total`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-rose-600">
                Trend
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Monthly expenses
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Last 6 months</p>
            </div>
          </div>
          <div className="mt-4">
            {loadingSummary && !summary ? (
              <div className="flex h-[240px] items-end gap-3 pt-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-t-md"
                    style={{ height: `${30 + ((i * 11) % 60)}%` }}
                  />
                ))}
              </div>
            ) : (
              <MonthlyBarChart data={summary?.by_month} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">
                Breakdown
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Categories this month
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Where your money went
              </p>
            </div>
          </div>
          <div className="mt-4">
            {loadingSummary && !summary ? (
              <div className="flex h-[240px] items-center justify-center">
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
              </div>
            ) : (
              <CategoryPie data={summary?.by_category} />
            )}
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              All expenses
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {pagination.total} entries · {formatCurrency(filteredTotal)}{' '}
              total in current view
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or notes..."
                className="h-10 w-full pl-9 sm:w-64"
              />
            </div>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={range}
              onValueChange={(v) => {
                setRange(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-44">
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
          </div>
        </div>

        {range === 'custom' && (
          <div className="grid gap-2 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:max-w-md">
            <div>
              <label className="text-xs font-medium text-slate-500">
                From
              </label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className="mt-1 h-10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">To</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className="mt-1 h-10"
              />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {initialLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40 flex-1" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-slate-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Receipt className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-slate-700">
                  No expenses found
                </p>
                <p className="text-xs">
                  Try a different filter or add your first expense.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAdd}
                className="mt-1 h-9 bg-gradient-to-r from-rose-500 to-pink-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add expense
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-slate-600">
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {e.title}
                      </div>
                      {e.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {e.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <CategoryPill category={e.category} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(e)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(e)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {items.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
            <p className="text-xs text-slate-500">
              Page <span className="font-medium text-slate-900">{page}</span>{' '}
              of <span className="font-medium text-slate-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loadingList}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loadingList}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setFormInitial(null);
        }}
        initial={formInitial}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  This will permanently remove{' '}
                  <span className="font-medium text-foreground">
                    {pendingDelete.title}
                  </span>{' '}
                  ({formatCurrency(pendingDelete.amount)}). This action can't
                  be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
