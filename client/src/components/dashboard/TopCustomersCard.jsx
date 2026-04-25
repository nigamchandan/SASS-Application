import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

import Avatar from '@/components/common/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

export default function TopCustomersCard({ customers, loading = false }) {
  const items = Array.isArray(customers) ? customers : [];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Top Customers
        </h3>
        <Link
          to="/customers"
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <ul className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-slate-500">
          <Users className="h-6 w-6" />
          <p className="font-medium text-slate-700">No paid invoices yet</p>
          <p>Record a payment to start ranking customers.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((c) => (
            <li
              key={c.customerId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={c.name} size="sm" />
                <span className="truncate font-medium text-slate-700">
                  {c.name}
                </span>
              </div>
              <span className="tabular-nums font-semibold text-slate-900">
                {formatCurrency(c.paid)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
