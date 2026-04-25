import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import ExportMenu from '@/components/common/ExportMenu';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
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
import { paymentsApi, downloadBlob, extractApiError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate } from '@/lib/format';

const PAGE_SIZE = 10;

const METHODS = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'OTHER'];

const METHOD_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

const METHOD_TONE = {
  CASH: 'bg-emerald-100 text-emerald-700',
  UPI: 'bg-violet-100 text-violet-700',
  BANK: 'bg-sky-100 text-sky-700',
  CARD: 'bg-indigo-100 text-indigo-700',
  CHEQUE: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

const STAT_TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
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
        <Skeleton className="mt-2 h-7 w-32" />
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

export default function Payments() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const queryParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      method,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [debouncedSearch, method, dateFrom, dateTo]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentsApi.listAll({
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
      toast.error(extractApiError(err, 'Could not load payments'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, page]);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await paymentsApi.summary(queryParams);
      setSummary(res?.data ?? null);
    } catch (_err) {
      // do not toast; summary is informational
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
          ? await paymentsApi.exportPdf(queryParams)
          : await paymentsApi.exportCsv(queryParams);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const filename = `bizautomate-payments-${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      downloadBlob(res.data, filename, mime);
      toast.success(`Payments exported as ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(extractApiError(err, 'Export failed'));
    }
  };

  const hasActiveFilters =
    method !== 'ALL' || dateFrom || dateTo || debouncedSearch;

  const clearFilters = () => {
    setSearch('');
    setMethod('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await paymentsApi.removeById(pendingDelete.id);
      toast.success('Payment removed');
      setPendingDelete(null);
      refreshAll();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete payment'));
    } finally {
      setDeleting(false);
    }
  };

  const showingFrom = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = items.length === 0 ? 0 : showingFrom + items.length - 1;

  const topMethod = summary?.byMethod?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track every payment received across all invoices.
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
          icon={Wallet}
          label="Total received"
          value={formatCurrency(summary?.total ?? 0)}
          hint={`${summary?.count ?? 0} payment${(summary?.count ?? 0) === 1 ? '' : 's'} matching filters`}
          tone="emerald"
          loading={loadingSummary}
        />
        <StatTile
          icon={TrendingUp}
          label="This month"
          value={formatCurrency(summary?.thisMonth ?? 0)}
          hint={`${summary?.thisMonthCount ?? 0} payment${(summary?.thisMonthCount ?? 0) === 1 ? '' : 's'}`}
          tone="indigo"
          loading={loadingSummary}
        />
        <StatTile
          icon={Receipt}
          label="Avg payment"
          value={formatCurrency(
            summary && summary.count > 0 ? summary.total / summary.count : 0
          )}
          hint={summary?.count ? 'across filtered results' : 'no payments yet'}
          tone="sky"
          loading={loadingSummary}
        />
        <StatTile
          icon={Banknote}
          label="Top method"
          value={
            topMethod
              ? `${METHOD_LABELS[topMethod.method] || topMethod.method}`
              : '-'
          }
          hint={
            topMethod
              ? `${formatCurrency(topMethod.total)} • ${topMethod.count} payment${topMethod.count === 1 ? '' : 's'}`
              : 'No payments to compare'
          }
          tone="violet"
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
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice #, customer, or note..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All methods</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">
                  Note
                </th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="w-[48px] px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-sm text-slate-500">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <p className="font-medium text-slate-700">
                        {hasActiveFilters
                          ? 'No matching payments'
                          : 'No payments recorded yet'}
                      </p>
                      <p>
                        {hasActiveFilters
                          ? 'Try clearing filters or changing the date range.'
                          : 'Record a payment from any invoice to see it here.'}
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
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">
                      {formatDate(p.paymentDate)}
                    </td>
                    <td className="px-5 py-3">
                      {p.invoice ? (
                        <Link
                          to={`/invoices/${p.invoice.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {p.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {p.invoice?.customer ? (
                        <Link
                          to={`/customers/${p.invoice.customer.id}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {p.invoice.customer.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          METHOD_TONE[p.method] || METHOD_TONE.OTHER
                        }`}
                      >
                        {METHOD_LABELS[p.method] || p.method}
                      </span>
                    </td>
                    <td className="hidden max-w-[260px] truncate px-5 py-3 text-slate-500 md:table-cell">
                      {p.note || '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(p)}
                        aria-label="Remove payment"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${formatCurrency(pendingDelete.amount)} on ${formatDate(
                    pendingDelete.paymentDate
                  )} for invoice ${pendingDelete.invoice?.invoiceNumber || ''} will be deleted. The invoice status will be recalculated.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removing...' : 'Remove payment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
