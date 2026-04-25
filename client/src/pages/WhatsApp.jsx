import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import ExportMenu from '@/components/common/ExportMenu';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { whatsappApi, downloadBlob, extractApiError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 10;

const KIND_LABEL = {
  INVOICE: 'Invoice',
  REMINDER: 'Reminder',
  OTHER: 'Other',
};

const KIND_TONE = {
  INVOICE: 'bg-emerald-100 text-emerald-700',
  REMINDER: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

const STATUS_TONE = {
  SENT: 'bg-emerald-100 text-emerald-700',
  QUEUED: 'bg-sky-100 text-sky-700',
  FAILED: 'bg-red-100 text-red-700',
};

const STATUS_ICON = {
  SENT: CheckCircle2,
  QUEUED: Send,
  FAILED: XCircle,
};

const STAT_TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
};

function StatTile({ icon: Icon, label, value, hint, tone = 'indigo', loading }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${STAT_TONES[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
          {value}
        </div>
      )}
      {!loading && hint && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${formatDate(iso)} • ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch (_e) {
    return formatDate(iso);
  }
}

export default function WhatsApp() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const queryParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      kind,
      status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [debouncedSearch, kind, status, dateFrom, dateTo]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappApi.listAll({
        ...queryParams,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res?.data?.items ?? []);
      setPagination(
        res?.data?.pagination ?? {
          page,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load WhatsApp messages'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, page]);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await whatsappApi.summary(queryParams);
      setSummary(res?.data ?? null);
    } catch (_err) {
      // informational; do not toast
    } finally {
      setLoadingSummary(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setPage(1);
  }, [queryParams]);

  const refreshAll = () => {
    fetchList();
    fetchSummary();
  };

  const handleExport = async (format) => {
    try {
      const res =
        format === 'pdf'
          ? await whatsappApi.exportPdf(queryParams)
          : await whatsappApi.exportCsv(queryParams);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const filename = `bizautomate-whatsapp-${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      downloadBlob(res.data, filename, mime);
      toast.success(`Messages exported as ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(extractApiError(err, 'Export failed'));
    }
  };

  const hasActiveFilters =
    kind !== 'ALL' ||
    status !== 'ALL' ||
    dateFrom ||
    dateTo ||
    debouncedSearch;

  const clearFilters = () => {
    setSearch('');
    setKind('ALL');
    setStatus('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const showingFrom = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = items.length === 0 ? 0 : showingFrom + items.length - 1;

  const totalCount = summary?.total ?? 0;
  const sentCount = summary?.byStatus?.SENT ?? 0;
  const failedCount = summary?.byStatus?.FAILED ?? 0;
  const remindersCount = summary?.byKind?.REMINDER ?? 0;
  const successRate =
    totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              WhatsApp
            </h1>
            {summary?.provider && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                <Smartphone className="h-3 w-3" />
                {summary.provider}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            All invoice and reminder messages sent via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <ExportMenu
            onExport={handleExport}
            disabled={pagination.total === 0 && !loading}
          />
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || loadingSummary}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || loadingSummary ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={MessageSquare}
          label="Messages sent"
          value={totalCount}
          hint={`${summary?.thisMonth ?? 0} this month`}
          tone="emerald"
          loading={loadingSummary}
        />
        <StatTile
          icon={CheckCircle2}
          label="Delivery rate"
          value={`${successRate}%`}
          hint={`${sentCount} delivered • ${failedCount} failed`}
          tone="indigo"
          loading={loadingSummary}
        />
        <StatTile
          icon={Bell}
          label="Reminders sent"
          value={remindersCount}
          hint={`${(summary?.byKind?.INVOICE ?? 0)} invoice messages`}
          tone="amber"
          loading={loadingSummary}
        />
        <StatTile
          icon={Users}
          label="Unique recipients"
          value={summary?.uniqueRecipients ?? 0}
          hint="distinct phone numbers"
          tone="sky"
          loading={loadingSummary}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4 text-slate-400" />
              Filters
            </div>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone, message, customer or invoice #"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All types</option>
              <option value="INVOICE">Invoice</option>
              <option value="REMINDER">Reminder</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED">Failed</option>
            </select>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
                className="h-10 w-[140px] bg-transparent text-sm text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
                className="h-10 w-[140px] bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading && items.length === 0 ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2 px-5 py-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-sm text-slate-500">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="font-medium text-slate-700">
                  {hasActiveFilters
                    ? 'No matching messages'
                    : 'No WhatsApp messages yet'}
                </p>
                <p>
                  {hasActiveFilters
                    ? 'Try clearing filters or adjusting the date range.'
                    : 'Open any invoice and click "Send via WhatsApp" to get started.'}
                </p>
                {!hasActiveFilters && (
                  <Link
                    to="/invoices"
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                  >
                    Go to invoices
                  </Link>
                )}
              </div>
            </div>
          ) : (
            items.map((m) => {
              const StatusIcon = STATUS_ICON[m.status] || AlertCircle;
              return (
                <div
                  key={m.id}
                  className="px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                        KIND_TONE[m.kind] || KIND_TONE.OTHER
                      }`}
                    >
                      {KIND_LABEL[m.kind] || m.kind}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        STATUS_TONE[m.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {m.status}
                    </span>
                    {m.invoice && (
                      <Link
                        to={`/invoices/${m.invoice.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        {m.invoice.invoiceNumber}
                      </Link>
                    )}
                    {m.customer && (
                      <Link
                        to={`/customers/${m.customer.id}`}
                        className="text-slate-600 hover:text-indigo-600 hover:underline"
                      >
                        {m.customer.name}
                      </Link>
                    )}
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Phone className="h-3 w-3" />
                      {m.phone}
                    </span>
                    <span className="ml-auto text-slate-400">
                      {formatDateTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {m.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span className="font-mono">via {m.provider}</span>
                    {m.providerMessageId && (
                      <span className="font-mono">
                        id: {m.providerMessageId}
                      </span>
                    )}
                    {m.error && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-normal normal-case tracking-normal text-red-700">
                        {m.error}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pagination.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:flex-row">
            <p className="text-slate-500">
              Showing <strong className="text-slate-700">{showingFrom}</strong>{' '}
              to <strong className="text-slate-700">{showingTo}</strong> of{' '}
              <strong className="text-slate-700">{pagination.total}</strong>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-slate-500">
                Page <strong className="text-slate-700">{pagination.page}</strong>{' '}
                of{' '}
                <strong className="text-slate-700">
                  {pagination.totalPages}
                </strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page >= pagination.totalPages || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
