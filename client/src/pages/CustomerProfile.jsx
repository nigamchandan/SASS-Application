import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import Avatar from '@/components/common/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge';
import CustomerFormDialog from '@/components/customers/CustomerFormDialog';
import DeleteCustomerDialog from '@/components/customers/DeleteCustomerDialog';
import { customersApi, extractApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

const METHOD_TONE = {
  CASH: 'bg-emerald-100 text-emerald-700',
  UPI: 'bg-violet-100 text-violet-700',
  BANK: 'bg-sky-100 text-sky-700',
  CARD: 'bg-indigo-100 text-indigo-700',
  CHEQUE: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

function StatTile({ icon: Icon, label, value, hint, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function InfoLine({ icon: Icon, value, fallback = '-' }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-sm text-slate-700">
        {value || <span className="text-slate-400">{fallback}</span>}
      </div>
    </div>
  );
}

function Section({ title, description, action, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="border-t border-slate-100">{children}</div>
    </div>
  );
}

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customersApi.summary(id);
      setData(res?.data ?? null);
    } catch (err) {
      setError(extractApiError(err, 'Could not load customer'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const customer = data?.customer;
  const stats = data?.stats;
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-44" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
          <div>
            <p className="font-medium text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const onSaved = () => fetchAll();
  const onDeleted = () => {
    toast.success('Customer deleted');
    navigate('/customers', { replace: true });
  };

  return (
    <div className="space-y-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={customer.name} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
                {customer.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {stats?.invoiceCount || 0}{' '}
                {(stats?.invoiceCount || 0) === 1 ? 'invoice' : 'invoices'}
                {' \u2022 '}
                Joined {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <Link
              to={`/invoices/new?customerId=${customer.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-purple-700"
            >
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <InfoLine icon={Phone} value={customer.phone} />
          <InfoLine icon={Mail} value={customer.email} />
          <InfoLine icon={Building2} value={customer.gstNumber} fallback="No GST" />
          <InfoLine icon={MapPin} value={customer.address} fallback="No address" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total spent"
          value={formatCurrency(stats?.totalSpent ?? 0)}
          hint={`${stats?.paymentCount ?? 0} payment${(stats?.paymentCount ?? 0) === 1 ? '' : 's'}`}
          tone="emerald"
        />
        <StatTile
          icon={TrendingUp}
          label="Pending amount"
          value={formatCurrency(stats?.pending ?? 0)}
          hint={
            stats?.overdueCount
              ? `${stats.overdueCount} overdue`
              : stats?.unpaidInvoiceCount
                ? `${stats.unpaidInvoiceCount} unpaid`
                : 'All clear'
          }
          tone="amber"
        />
        <StatTile
          icon={Receipt}
          label="Total invoiced"
          value={formatCurrency(stats?.totalInvoiced ?? 0)}
          hint={`${stats?.invoiceCount ?? 0} invoice${(stats?.invoiceCount ?? 0) === 1 ? '' : 's'}`}
          tone="indigo"
        />
        <StatTile
          icon={CreditCard}
          label="Invoices status"
          value={`${stats?.paidInvoiceCount ?? 0} / ${stats?.invoiceCount ?? 0}`}
          hint={`${stats?.paidInvoiceCount ?? 0} paid, ${stats?.unpaidInvoiceCount ?? 0} unpaid`}
          tone="sky"
        />
      </div>

      <Section
        title="Invoice history"
        description={`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'} for this customer`}
        action={
          <Link
            to={`/invoices/new?customerId=${customer.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New invoice
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
            <FileText className="h-6 w-6" />
            <p className="font-medium text-slate-700">No invoices yet</p>
            <p>Create the first invoice for {customer.name} to see it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Issued</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">
                    Due
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                    Balance
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const balance = Math.max(
                    0,
                    Number(inv.totalAmount) - Number(inv.paidAmount || 0)
                  );
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="hidden px-5 py-3 text-slate-600 md:table-cell">
                        {inv.dueDate ? formatDate(inv.dueDate) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="hidden px-5 py-3 text-right tabular-nums text-slate-700 sm:table-cell">
                        {balance > 0 ? (
                          formatCurrency(balance)
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <InvoiceStatusBadge
                          status={inv.status}
                          paidAmount={inv.paidAmount}
                          totalAmount={inv.totalAmount}
                          dueDate={inv.dueDate}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Payment history"
        description={`${payments.length} ${payments.length === 1 ? 'payment' : 'payments'} recorded`}
      >
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
            <CreditCard className="h-6 w-6" />
            <p className="font-medium text-slate-700">No payments yet</p>
            <p>Record a payment from any of this customer&apos;s invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">
                    Note
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
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
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          METHOD_TONE[p.method] || METHOD_TONE.OTHER
                        }`}
                      >
                        {p.method}
                      </span>
                    </td>
                    <td className="hidden max-w-[260px] truncate px-5 py-3 text-slate-500 md:table-cell">
                      {p.note || '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSaved={onSaved}
      />
      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customer={customer}
        onDeleted={onDeleted}
      />
    </div>
  );
}
