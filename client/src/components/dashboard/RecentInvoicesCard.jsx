import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FileText } from 'lucide-react';

import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/format';

export default function RecentInvoicesCard({
  invoices,
  loading,
  onMarkPaid,
  busyId,
}) {
  const navigate = useNavigate();
  const items = Array.isArray(invoices) ? invoices : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Recent Invoices
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Latest activity across your invoices
          </p>
        </div>
        <Link
          to="/invoices"
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <FileText className="h-6 w-6" />
            <p className="font-medium text-slate-700">No invoices yet</p>
            <p>Create your first invoice to see it here.</p>
            <Link
              to="/invoices/new"
              className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
            >
              + Create invoice
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-2 font-medium">Invoice #</th>
                <th className="pb-3 pr-2 font-medium">Customer</th>
                <th className="pb-3 pr-2 font-medium">Due</th>
                <th className="pb-3 pr-2 text-right font-medium">Amount</th>
                <th className="pb-3 pr-2 text-right font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((inv) => {
                const isPaid = inv.status === 'PAID';
                const busy = busyId === inv.id;
                return (
                  <tr
                    key={inv.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={(e) => {
                      if (e.target.closest('[data-row-action]')) return;
                      navigate(`/invoices/${inv.id}`);
                    }}
                  >
                    <td className="py-3 pr-2 font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 pr-2 text-slate-600">
                      {inv.customer?.name ?? '-'}
                    </td>
                    <td className="py-3 pr-2 text-slate-500">
                      {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                    </td>
                    <td className="py-3 pr-2 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <InvoiceStatusBadge
                        status={inv.status}
                        paidAmount={inv.paidAmount}
                        totalAmount={inv.totalAmount}
                        dueDate={inv.dueDate}
                      />
                    </td>
                    <td className="py-3 text-right">
                      <div
                        className="inline-flex items-center gap-1"
                        data-row-action
                      >
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title="View"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        {!isPaid && onMarkPaid && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkPaid(inv);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                            title="Mark as paid"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {busy ? '...' : 'Mark Paid'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
