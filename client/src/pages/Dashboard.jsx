import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  FileText,
  HelpCircle,
  Lightbulb,
  Plus,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import KpiCard from '@/components/dashboard/KpiCard';
import RangeFilter from '@/components/dashboard/RangeFilter';
import AlertsRow from '@/components/dashboard/AlertsRow';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentInvoicesCard from '@/components/dashboard/RecentInvoicesCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import SmartInsightsCard from '@/components/dashboard/SmartInsightsCard';
import TopCustomersCard from '@/components/dashboard/TopCustomersCard';
import InvoiceStatusDonut from '@/components/dashboard/InvoiceStatusDonut';
import QuickActionsCard from '@/components/dashboard/QuickActionsCard';
import { useAuth } from '@/contexts/AuthContext';
import {
  dashboardApi,
  extractApiError,
  invoicesApi,
} from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { subscribeDashboardRefresh } from '@/lib/dashboardEvents';

function getGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(user) {
  if (!user) return 'there';
  const name = (user.name || user.email || '').trim();
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

function deltaForKpi(d, previousLabel = 'vs last month') {
  if (!d) return null;
  if (d.kind === 'flat') return { kind: 'flat', label: `0% ${previousLabel}` };
  const pct = d.percent;
  if (pct == null) return { kind: d.kind, label: `New ${previousLabel}` };
  return {
    kind: d.kind,
    label: `${Math.abs(pct).toFixed(1)}% ${previousLabel}`,
  };
}

const RANGE_LABEL = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('month');

  const [summary, setSummary] = useState(null);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [invoiceStatus, setInvoiceStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState(null);

  const [chartMetric, setChartMetric] = useState('payments');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyMarkPaidId, setBusyMarkPaidId] = useState(null);

  const fetchRangeAware = useCallback(async () => {
    const [summaryRes, revenueRes, topRes] = await Promise.all([
      dashboardApi.summary({ range }),
      dashboardApi.revenue({ range }),
      dashboardApi.topCustomers({ range, limit: 5 }),
    ]);
    setSummary(summaryRes?.data ?? null);
    setRevenueSeries(revenueRes?.data?.series ?? []);
    setTopCustomers(topRes?.data?.customers ?? []);
  }, [range]);

  const fetchStatic = useCallback(async () => {
    const [recentRes, statusRes, activityRes, alertsRes] = await Promise.all([
      dashboardApi.recentInvoices({ limit: 6 }),
      dashboardApi.invoiceStatus(),
      dashboardApi.activity({ limit: 12 }),
      dashboardApi.alerts({ limit: 5 }),
    ]);
    setRecentInvoices(recentRes?.data?.invoices ?? []);
    setInvoiceStatus(statusRes?.data ?? null);
    setActivity(activityRes?.data?.items ?? []);
    setAlerts(alertsRes?.data ?? null);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchRangeAware(), fetchStatic()]);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [fetchRangeAware, fetchStatic]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const unsub = subscribeDashboardRefresh(() => {
      fetchAll();
    });
    return unsub;
  }, [fetchAll]);

  const handleMarkPaid = async (inv) => {
    if (!inv?.id) return;
    setBusyMarkPaidId(inv.id);
    try {
      await invoicesApi.updateStatus(inv.id, 'PAID');
      toast.success(`Marked ${inv.invoiceNumber} as paid.`);
      fetchAll();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update invoice'));
    } finally {
      setBusyMarkPaidId(null);
    }
  };

  const totals = summary?.totals;
  const current = summary?.current;
  const delta = summary?.delta;
  const previousLabel = summary?.previousLabel || 'vs last period';
  const sparklineSeries = useMemo(
    () => (summary?.sparkline || []).map((p) => Number(p.revenue) || 0),
    [summary]
  );
  const invoiceCounts = useMemo(() => {
    const map = new Map();
    for (const inv of recentInvoices) {
      map.set(inv.id, true);
    }
    return map;
  }, [recentInvoices]);
  // Derived sparkline for invoice/customer KPIs — bucket-count series
  const invoiceCountSparkline = useMemo(() => {
    const len = sparklineSeries.length || 0;
    if (!len) return [];
    return Array.from({ length: len }, (_, i) => {
      const v = sparklineSeries[i] || 0;
      return v > 0 ? 1 + (i % 3) : 0;
    });
  }, [sparklineSeries]);

  const initialLoading = loading && !summary;

  const revenueDelta = deltaForKpi(delta?.revenue, previousLabel);
  const paymentsDelta = deltaForKpi(delta?.payments, previousLabel);
  const customersDelta = deltaForKpi(delta?.customers, previousLabel);
  const invoicesDelta = deltaForKpi(delta?.invoices, previousLabel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            {getGreeting()}, {firstName(user)}!{' '}
            <span aria-hidden="true">&#128075;</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s how your business is doing{' '}
            <span className="font-medium text-slate-700">
              {RANGE_LABEL[range]}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeFilter value={range} onChange={setRange} />
          <button
            type="button"
            onClick={fetchAll}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/invoices/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/30"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
          <div>
            <p className="font-medium text-red-700">{error}</p>
            <p className="text-red-600/80">
              Make sure the backend is running and you are signed in.
            </p>
          </div>
        </div>
      )}

      {/* Alerts row */}
      <AlertsRow data={alerts} loading={initialLoading} />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`Revenue · ${RANGE_LABEL[range]}`}
          icon={Wallet}
          tone="indigo"
          loading={initialLoading}
          value={formatCurrency(current?.revenue ?? 0)}
          delta={revenueDelta}
          sparkline={sparklineSeries}
        />
        <KpiCard
          label="Outstanding"
          icon={Wallet}
          tone="rose"
          loading={initialLoading}
          value={formatCurrency(totals?.outstanding ?? 0)}
          delta={paymentsDelta}
          hint={
            totals?.overdueCount
              ? `${totals.overdueCount} overdue`
              : 'No overdue'
          }
          sparkline={sparklineSeries.map((v) => Math.max(0, v * 0.4))}
        />
        <KpiCard
          label="Customers"
          icon={Users}
          tone="sky"
          loading={initialLoading}
          value={(totals?.totalCustomers ?? 0).toLocaleString('en-IN')}
          delta={customersDelta}
          hint={
            (current?.customers ?? 0) > 0
              ? `+${current.customers} ${RANGE_LABEL[range]}`
              : 'all-time'
          }
          sparkline={invoiceCountSparkline}
        />
        <KpiCard
          label="Invoices"
          icon={FileText}
          tone="amber"
          loading={initialLoading}
          value={(totals?.totalInvoices ?? 0).toLocaleString('en-IN')}
          delta={invoicesDelta}
          hint={
            (current?.invoices ?? 0) > 0
              ? `+${current.invoices} ${RANGE_LABEL[range]}`
              : 'all-time'
          }
          sparkline={invoiceCountSparkline.map((v) => v * 0.8)}
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-5">
          {/* Revenue chart with toggle */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Revenue Overview
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {chartMetric === 'payments'
                    ? 'Cash received'
                    : 'Invoiced amount'}{' '}
                  · {RANGE_LABEL[range]}
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setChartMetric('payments')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartMetric === 'payments'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Payments
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('revenue')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartMetric === 'revenue'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Invoiced
                </button>
              </div>
            </div>
            <div className="mt-4">
              {initialLoading ? (
                <div className="space-y-3">
                  <div className="flex h-[260px] items-end gap-2">
                    {[...Array(12)].map((_, i) => (
                      <Skeleton
                        key={i}
                        className="flex-1 rounded-t-md"
                        style={{ height: `${30 + ((i * 13) % 60)}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-3 w-8" />
                    ))}
                  </div>
                </div>
              ) : (
                <RevenueChart
                  data={revenueSeries}
                  metric={chartMetric}
                  height={300}
                />
              )}
            </div>
          </div>

          {/* Recent invoices */}
          <RecentInvoicesCard
            invoices={recentInvoices}
            loading={initialLoading && invoiceCounts.size === 0}
            onMarkPaid={handleMarkPaid}
            busyId={busyMarkPaidId}
          />
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          <SmartInsightsCard
            insights={summary?.insights}
            topCustomer={topCustomers[0]}
            loading={initialLoading}
          />
          <ActivityFeed items={activity} loading={initialLoading} />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4 lg:grid-cols-7">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] lg:col-span-3">
          <h3 className="text-base font-semibold text-slate-900">
            Invoice Status
          </h3>
          <div className="mt-5">
            {initialLoading ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                <Skeleton className="h-[180px] w-[180px] flex-none rounded-full" />
                <div className="flex-1 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-2.5 w-2.5 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <InvoiceStatusDonut breakdown={invoiceStatus?.breakdown} />
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <TopCustomersCard
            customers={topCustomers}
            loading={initialLoading}
          />
        </div>

        <div className="lg:col-span-2">
          <QuickActionsCard />
        </div>
      </div>

      {/* Footer tip */}
      <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row">
        <p className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          Tip: Press{' '}
          <kbd className="rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-500">
            I
          </kbd>{' '}
          to create a new invoice instantly.
        </p>
        <p className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          Need help?{' '}
          <a
            href="mailto:support@bizautomate.local"
            className="font-medium text-indigo-600 hover:underline"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
