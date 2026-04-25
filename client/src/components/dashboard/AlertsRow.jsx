import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/format';

const TONES = {
  red: {
    border: 'border-rose-200',
    bg: 'bg-gradient-to-br from-rose-50 via-white to-rose-50',
    icon: 'bg-rose-100 text-rose-600',
    pill: 'bg-rose-100 text-rose-700',
    halo: 'from-rose-400 to-pink-400',
    cta: 'text-rose-700 hover:text-rose-800',
  },
  yellow: {
    border: 'border-amber-200',
    bg: 'bg-gradient-to-br from-amber-50 via-white to-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    pill: 'bg-amber-100 text-amber-700',
    halo: 'from-amber-400 to-orange-400',
    cta: 'text-amber-700 hover:text-amber-800',
  },
  green: {
    border: 'border-emerald-200',
    bg: 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    pill: 'bg-emerald-100 text-emerald-700',
    halo: 'from-emerald-400 to-teal-400',
    cta: 'text-emerald-700 hover:text-emerald-800',
  },
};

function AlertItemList({ items, render, emptyText }) {
  if (!items || items.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">{emptyText}</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {items.slice(0, 3).map((it) => (
        <li
          key={it.id}
          className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs shadow-sm shadow-slate-900/[0.02] backdrop-blur"
        >
          {render(it)}
        </li>
      ))}
    </ul>
  );
}

function AlertCard({
  tone,
  icon: Icon,
  label,
  count,
  description,
  cta,
  ctaTo,
  children,
  loading,
}) {
  const t = TONES[tone] || TONES.red;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${t.border} ${t.bg} p-4 shadow-sm shadow-slate-900/[0.02] transition-all hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${t.halo} opacity-15 blur-3xl`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.icon}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {loading ? <Skeleton className="h-6 w-10" /> : count}
            </p>
          </div>
        </div>
        {ctaTo && (
          <Link
            to={ctaTo}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${t.cta}`}
          >
            {cta}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {description && (
        <p className="relative mt-2 text-xs text-slate-500">{description}</p>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export default function AlertsRow({ data, loading }) {
  const counts = data?.counts ?? {};
  const overdue = data?.overdue ?? [];
  const pending = data?.pending ?? [];
  const recent = data?.recentPayments ?? [];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AlertCard
        tone="red"
        icon={AlertTriangle}
        label="Overdue invoices"
        count={(counts.overdue ?? 0).toLocaleString('en-IN')}
        cta="Review"
        ctaTo="/invoices?status=OVERDUE"
        loading={loading && !data}
        description={
          (counts.overdue ?? 0) > 0
            ? 'These invoices are past their due date.'
            : 'You are all caught up — no overdue invoices.'
        }
      >
        <AlertItemList
          items={overdue}
          emptyText="Nothing overdue right now."
          render={(inv) => (
            <>
              <Link
                to={`/invoices/${inv.id}`}
                className="flex min-w-0 items-center gap-2 truncate font-medium text-slate-700 hover:text-rose-700"
              >
                <span className="truncate">{inv.invoiceNumber}</span>
                <span className="shrink-0 text-slate-400">·</span>
                <span className="truncate text-slate-500">
                  {inv.customer?.name || '—'}
                </span>
              </Link>
              <span className="shrink-0 text-rose-700 tabular-nums">
                {formatCurrency(
                  Math.max(
                    0,
                    Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)
                  )
                )}
              </span>
            </>
          )}
        />
      </AlertCard>

      <AlertCard
        tone="yellow"
        icon={Clock}
        label="Pending payments"
        count={(counts.pending ?? 0).toLocaleString('en-IN')}
        cta="Send reminder"
        ctaTo="/invoices?status=UNPAID"
        loading={loading && !data}
        description={
          (counts.pending ?? 0) > 0
            ? 'Awaiting payment but not yet due.'
            : 'No pending payments — nice!'
        }
      >
        <AlertItemList
          items={pending}
          emptyText="No pending payments to chase."
          render={(inv) => (
            <>
              <Link
                to={`/invoices/${inv.id}`}
                className="flex min-w-0 items-center gap-2 truncate font-medium text-slate-700 hover:text-amber-700"
              >
                <span className="truncate">{inv.invoiceNumber}</span>
                <span className="shrink-0 text-slate-400">·</span>
                <span className="truncate text-slate-500">
                  {inv.customer?.name || '—'}
                </span>
              </Link>
              <span className="shrink-0 text-slate-600">
                {inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : 'No due date'}
              </span>
            </>
          )}
        />
      </AlertCard>

      <AlertCard
        tone="green"
        icon={CheckCircle2}
        label="Recent payments"
        count={(counts.recentPayments ?? 0).toLocaleString('en-IN')}
        cta="View all"
        ctaTo="/payments"
        loading={loading && !data}
        description={
          (counts.recentPayments ?? 0) > 0
            ? 'Payments received in the last 7 days.'
            : 'No payments received this week.'
        }
      >
        <AlertItemList
          items={recent}
          emptyText="No payments received yet."
          render={(p) => (
            <>
              <Link
                to={p.invoice ? `/invoices/${p.invoice.id}` : '/payments'}
                className="flex min-w-0 items-center gap-2 truncate font-medium text-slate-700 hover:text-emerald-700"
              >
                <span className="truncate">
                  {p.invoice?.invoiceNumber || 'Payment'}
                </span>
                <span className="shrink-0 text-slate-400">·</span>
                <span className="truncate text-slate-500">
                  {p.invoice?.customer?.name || '—'}
                </span>
              </Link>
              <span className="shrink-0 font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(p.amount)}
              </span>
            </>
          )}
        />
      </AlertCard>
    </section>
  );
}
