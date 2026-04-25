import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CreditCard,
  Download,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge';
import AddPaymentDialog from '@/components/invoices/AddPaymentDialog';
import SendWhatsAppDialog from '@/components/invoices/SendWhatsAppDialog';
import {
  invoicesApi,
  paymentsApi,
  extractApiError,
} from '@/lib/api';
import { emitDashboardRefresh } from '@/lib/dashboardEvents';
import { formatCurrency, formatDate } from '@/lib/format';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const [pendingDeletePayment, setPendingDeletePayment] = useState(null);
  const [removingPayment, setRemovingPayment] = useState(false);

  const [revertingStatus, setRevertingStatus] = useState(false);

  const [waOpen, setWaOpen] = useState(false);
  const [waInitialKind, setWaInitialKind] = useState('INVOICE');

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.getOne(id);
      setInvoice(res?.data?.invoice ?? null);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load invoice'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await invoicesApi.downloadPdf(invoice.id, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not download PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setDeleting(true);
    try {
      await invoicesApi.remove(invoice.id);
      toast.success('Invoice deleted');
      emitDashboardRefresh('invoice:deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete invoice'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleAddPayment = async (values) => {
    if (!invoice) return;
    setSavingPayment(true);
    try {
      await paymentsApi.add(invoice.id, {
        amount: Number(values.amount),
        paymentDate: values.paymentDate || '',
        method: values.method,
        note: values.note || '',
      });
      toast.success('Payment recorded');
      setPayOpen(false);
      emitDashboardRefresh('payment:added');
      await fetchInvoice();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save payment'));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!invoice || !pendingDeletePayment) return;
    setRemovingPayment(true);
    try {
      await paymentsApi.remove(invoice.id, pendingDeletePayment.id);
      toast.success('Payment removed');
      setPendingDeletePayment(null);
      emitDashboardRefresh('payment:removed');
      await fetchInvoice();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not remove payment'));
    } finally {
      setRemovingPayment(false);
    }
  };

  const handleRevertToUnpaid = async () => {
    if (!invoice) return;
    setRevertingStatus(true);
    try {
      const res = await invoicesApi.updateStatus(invoice.id, 'UNPAID');
      setInvoice(res.data.invoice);
      toast.success('Marked as unpaid');
      emitDashboardRefresh('invoice:status');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update status'));
    } finally {
      setRevertingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-lg font-semibold">Invoice not found</p>
          <Button asChild variant="outline">
            <Link to="/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to invoices
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const customer = invoice.customer || {};
  const payments = invoice.payments ?? [];
  const paid = round2(invoice.paidAmount ?? 0);
  const balance = round2((invoice.totalAmount ?? 0) - paid);
  const isFullyPaid = invoice.status === 'PAID' || balance <= 0;
  const isOverdue =
    !isFullyPaid &&
    invoice.dueDate &&
    new Date(invoice.dueDate).getTime() < Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/invoices" aria-label="Back to invoices">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusBadge
                status={invoice.status}
                paidAmount={paid}
                totalAmount={invoice.totalAmount}
                dueDate={invoice.dueDate}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.issueDate)}
              {invoice.dueDate && ` - Due ${formatDate(invoice.dueDate)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isFullyPaid && (
            <Button onClick={() => setPayOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              {paid > 0 ? 'Add payment' : 'Mark as paid'}
            </Button>
          )}
          {isFullyPaid && (
            <Button
              variant="outline"
              onClick={handleRevertToUnpaid}
              disabled={revertingStatus}
            >
              {revertingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Mark as unpaid
            </Button>
          )}
          {isOverdue && (
            <Button
              onClick={() => {
                setWaInitialKind('REMINDER');
                setWaOpen(true);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Bell className="mr-2 h-4 w-4" />
              Send reminder
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setWaInitialKind(isFullyPaid ? 'INVOICE' : 'REMINDER');
              setWaOpen(true);
            }}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Send via WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete invoice"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isOverdue && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <p className="font-medium">This invoice is overdue.</p>
            <p className="mt-0.5 text-red-700">
              Due {formatDate(invoice.dueDate)} - balance{' '}
              {formatCurrency(Math.max(0, balance))}. Send a reminder via
              WhatsApp or record a payment.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill to</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-base font-semibold">{customer.name}</p>
            {customer.phone && (
              <p className="text-muted-foreground">{customer.phone}</p>
            )}
            {customer.email && (
              <p className="text-muted-foreground">{customer.email}</p>
            )}
            {customer.address && (
              <p className="text-muted-foreground">{customer.address}</p>
            )}
            {customer.gstNumber && (
              <p className="text-muted-foreground">
                GSTIN: {customer.gstNumber}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>Auto-calculated from line items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (GST)</span>
              <span className="tabular-nums text-foreground">
                {formatCurrency(invoice.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand total</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-sm text-emerald-700 dark:text-emerald-400">
              <span>Paid so far</span>
              <span className="tabular-nums">{formatCurrency(paid)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Balance due</span>
              <span
                className={`tabular-nums ${
                  balance > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {formatCurrency(Math.max(0, balance))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {it.itemName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(it.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.tax}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(it.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Payments</CardTitle>
            <CardDescription>
              {payments.length === 0
                ? 'No payments recorded yet'
                : `${payments.length} ${
                    payments.length === 1 ? 'payment' : 'payments'
                  } - ${formatCurrency(paid)} received`}
            </CardDescription>
          </div>
          {!isFullyPaid && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPayOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Record the first payment to start tracking.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paymentDate)}</TableCell>
                      <TableCell>
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {p.note || '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDeletePayment(p)}
                          aria-label="Remove payment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">WhatsApp history</CardTitle>
            <CardDescription>
              {invoice.whatsappMessages && invoice.whatsappMessages.length > 0
                ? `${invoice.whatsappMessages.length} ${
                    invoice.whatsappMessages.length === 1
                      ? 'message'
                      : 'messages'
                  } sent`
                : 'No WhatsApp messages sent yet'}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => {
              setWaInitialKind(isFullyPaid ? 'INVOICE' : 'REMINDER');
              setWaOpen(true);
            }}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            New message
          </Button>
        </CardHeader>
        {invoice.whatsappMessages && invoice.whatsappMessages.length > 0 && (
          <CardContent className="space-y-3 border-t pt-4">
            {invoice.whatsappMessages.map((m) => (
              <div
                key={m.id}
                className="rounded-md border bg-muted/40 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      m.kind === 'REMINDER'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {m.kind === 'REMINDER' ? 'Reminder' : 'Invoice'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      m.status === 'SENT'
                        ? 'bg-emerald-100 text-emerald-700'
                        : m.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {m.status}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(m.createdAt)} - {m.phone}
                  </span>
                  <span className="ml-auto font-mono text-[10px] uppercase">
                    via {m.provider}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {m.message}
                </p>
                {m.error && (
                  <p className="mt-1 text-xs text-destructive">{m.error}</p>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.notes}
          </CardContent>
        </Card>
      )}

      <SendWhatsAppDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        invoiceId={invoice.id}
        defaultPhone={customer.phone || ''}
        initialKind={waInitialKind}
        onSent={fetchInvoice}
      />

      <AddPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        balance={balance > 0 ? balance : invoice.totalAmount}
        invoiceTotal={invoice.totalAmount}
        onSubmit={handleAddPayment}
        submitting={savingPayment}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.invoiceNumber} and all of its payments will be
              permanently removed.
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
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeletePayment}
        onOpenChange={(o) => !o && setPendingDeletePayment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePayment
                ? `${formatCurrency(pendingDeletePayment.amount)} on ${formatDate(
                    pendingDeletePayment.paymentDate
                  )} will be deleted. The invoice status will be recalculated.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingPayment}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePayment();
              }}
              disabled={removingPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingPayment && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
