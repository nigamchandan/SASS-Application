import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  FileText,
  MessageCircle,
  Send,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

function iconFor(type) {
  switch (type) {
    case 'invoice_created':
      return { Icon: FileText, tone: 'bg-indigo-100 text-indigo-600' };
    case 'payment_received':
      return { Icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-600' };
    case 'reminder_sent':
      return { Icon: Send, tone: 'bg-amber-100 text-amber-600' };
    case 'invoice_sent':
      return { Icon: MessageCircle, tone: 'bg-emerald-100 text-emerald-600' };
    default:
      return { Icon: MessageCircle, tone: 'bg-sky-100 text-sky-600' };
  }
}

function ItemTitle({ item }) {
  const customer = item.customer?.name || '—';
  switch (item.type) {
    case 'invoice_created':
      return (
        <span>
          New invoice{' '}
          {item.invoice ? (
            <Link
              to={`/invoices/${item.invoice.id}`}
              className="font-semibold text-slate-900 hover:underline"
            >
              {item.invoice.invoiceNumber}
            </Link>
          ) : null}{' '}
          for <span className="font-medium text-slate-700">{customer}</span>
        </span>
      );
    case 'payment_received':
      return (
        <span>
          Payment of{' '}
          <span className="font-semibold text-emerald-700 tabular-nums">
            {formatCurrency(item.payment?.amount)}
          </span>{' '}
          received
          {item.invoice ? (
            <>
              {' '}
              on{' '}
              <Link
                to={`/invoices/${item.invoice.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {item.invoice.invoiceNumber}
              </Link>
            </>
          ) : null}
        </span>
      );
    case 'reminder_sent':
      return (
        <span>
          Reminder sent
          {item.invoice ? (
            <>
              {' '}
              for{' '}
              <Link
                to={`/invoices/${item.invoice.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {item.invoice.invoiceNumber}
              </Link>
            </>
          ) : null}{' '}
          to <span className="font-medium text-slate-700">{customer}</span>
        </span>
      );
    case 'invoice_sent':
      return (
        <span>
          Invoice
          {item.invoice ? (
            <>
              {' '}
              <Link
                to={`/invoices/${item.invoice.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {item.invoice.invoiceNumber}
              </Link>
            </>
          ) : null}{' '}
          shared via WhatsApp with{' '}
          <span className="font-medium text-slate-700">{customer}</span>
        </span>
      );
    default:
      return (
        <span>
          Message sent to{' '}
          <span className="font-medium text-slate-700">{customer}</span>
        </span>
      );
  }
}

export default function ActivityFeed({ items, loading }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Activity feed
            </h3>
            <p className="text-xs text-slate-500">
              Real-time business signals
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Live
        </span>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        {loading && list.length === 0 ? (
          <ul className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <li key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 py-10 text-center text-sm text-slate-500">
            <Activity className="h-6 w-6 text-slate-300" />
            <p className="font-medium text-slate-700">No recent activity</p>
            <p>Create an invoice or record a payment to see it here.</p>
          </div>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-100 pl-4">
            {list.map((item) => {
              const { Icon, tone } = iconFor(item.type);
              return (
                <li key={item.id} className="relative">
                  <span
                    className={`absolute -left-[1.55rem] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${tone}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm leading-snug text-slate-700">
                    <ItemTitle item={item} />
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                    {timeAgo(item.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
