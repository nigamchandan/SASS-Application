import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  customersApi,
  invoicesApi,
  extractApiError,
} from '@/lib/api';
import { emitDashboardRefresh } from '@/lib/dashboardEvents';
import { invoiceSchema } from '@/lib/validators';
import { formatCurrency } from '@/lib/format';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const blankItem = { itemName: '', quantity: 1, price: 0, tax: 0 };

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const params = useParams();
  const editingId = params.id || null;
  const isEdit = Boolean(editingId);
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingInvoice, setLoadingInvoice] = useState(isEdit);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState('');
  const [itemsLocked, setItemsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: preselectedCustomerId,
      status: 'UNPAID',
      dueDate: '',
      notes: '',
      items: [{ ...blankItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  const totals = useMemo(() => {
    const list = (watchedItems || []).map((it) => {
      const qty = Number(it?.quantity) || 0;
      const unit = Number(it?.price) || 0;
      const taxPct = Number(it?.tax) || 0;
      const amount = round2(qty * unit);
      const taxValue = round2(amount * (taxPct / 100));
      const total = round2(amount + taxValue);
      return { amount, taxValue, total };
    });
    const subtotal = round2(list.reduce((s, i) => s + i.amount, 0));
    const taxAmount = round2(list.reduce((s, i) => s + i.taxValue, 0));
    const totalAmount = round2(subtotal + taxAmount);
    return { list, subtotal, taxAmount, totalAmount };
  }, [watchedItems]);

  useEffect(() => {
    let mounted = true;
    setLoadingCustomers(true);
    customersApi
      .list({ page: 1, pageSize: 100 })
      .then((res) => {
        if (!mounted) return;
        const items = res?.data?.items ?? [];
        setCustomers(items);
        if (
          !isEdit &&
          preselectedCustomerId &&
          items.some((c) => c.id === preselectedCustomerId)
        ) {
          setValue('customerId', preselectedCustomerId, {
            shouldValidate: true,
          });
        }
      })
      .catch((err) =>
        toast.error(extractApiError(err, 'Could not load customers'))
      )
      .finally(() => {
        if (mounted) setLoadingCustomers(false);
      });
    return () => {
      mounted = false;
    };
  }, [isEdit, preselectedCustomerId, setValue]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let mounted = true;
    setLoadingInvoice(true);
    invoicesApi
      .getOne(editingId)
      .then((res) => {
        if (!mounted) return;
        const inv = res?.data?.invoice;
        if (!inv) {
          toast.error('Invoice not found');
          navigate('/invoices', { replace: true });
          return;
        }
        setEditingInvoiceNumber(inv.invoiceNumber);
        setItemsLocked(Number(inv.paidAmount || 0) > 0);
        reset({
          customerId: inv.customerId,
          status: inv.status,
          dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
          notes: inv.notes || '',
          items:
            inv.items && inv.items.length > 0
              ? inv.items.map((it) => ({
                  itemName: it.itemName,
                  quantity: it.quantity,
                  price: it.price,
                  tax: it.tax,
                }))
              : [{ ...blankItem }],
        });
      })
      .catch((err) => {
        toast.error(extractApiError(err, 'Could not load invoice'));
        navigate('/invoices', { replace: true });
      })
      .finally(() => {
        if (mounted) setLoadingInvoice(false);
      });
    return () => {
      mounted = false;
    };
  }, [isEdit, editingId, navigate, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const itemsPayload = values.items.map((it) => ({
        itemName: it.itemName,
        quantity: Number(it.quantity),
        price: Number(it.price),
        tax: Number(it.tax) || 0,
      }));
      const payload = {
        customerId: values.customerId,
        status: values.status,
        notes: values.notes || '',
        dueDate: values.dueDate || '',
      };
      if (!isEdit || !itemsLocked) {
        payload.items = itemsPayload;
      }
      let res;
      if (isEdit) {
        res = await invoicesApi.update(editingId, payload);
        toast.success(`Invoice ${res.data.invoice.invoiceNumber} updated`);
      } else {
        res = await invoicesApi.create(payload);
        toast.success(`Invoice ${res.data.invoice.invoiceNumber} created`);
      }
      emitDashboardRefresh(isEdit ? 'invoice:updated' : 'invoice:created');
      navigate(`/invoices/${res.data.invoice.id}`);
    } catch (err) {
      toast.error(
        extractApiError(
          err,
          isEdit ? 'Could not update invoice' : 'Could not create invoice'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && loadingInvoice) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading invoice...
      </div>
    );
  }

  const backTo = isEdit ? `/invoices/${editingId}` : '/invoices';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to={backTo} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit
                ? `Edit ${editingInvoiceNumber || 'invoice'}`
                : 'New invoice'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? itemsLocked
                  ? 'This invoice has payments - items are locked. You can still update status, due date, customer, and notes.'
                  : 'Update details and line items - totals recalculate automatically.'
                : 'Add line items - totals are calculated automatically.'}
            </p>
          </div>
        </div>
      </div>

      {isEdit && itemsLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <p className="font-medium">Line items are locked</p>
            <p className="mt-0.5 text-amber-700">
              Remove all payments from this invoice on the detail page to enable
              editing items.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            <CardDescription>
              Pick a customer and set the invoice metadata.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="customerId">Customer *</Label>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingCustomers}
                  >
                    <SelectTrigger id="customerId">
                      <SelectValue
                        placeholder={
                          loadingCustomers
                            ? 'Loading customers...'
                            : customers.length === 0
                              ? 'No customers - add one first'
                              : 'Select a customer'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.phone ? ` - ${c.phone}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerId && (
                <p className="text-xs text-destructive">
                  {errors.customerId.message}
                </p>
              )}
              {!loadingCustomers && customers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  You need at least one customer.{' '}
                  <Link to="/customers" className="text-primary underline">
                    Add a customer
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNPAID">Unpaid</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Line items</CardTitle>
              <CardDescription>
                Tax is per line, in percent (e.g. 18 for 18% GST).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...blankItem })}
              disabled={itemsLocked}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[140px]">Unit price</TableHead>
                    <TableHead className="w-[100px]">Tax %</TableHead>
                    <TableHead className="w-[140px] text-right">
                      Line total
                    </TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="align-top">
                      <TableCell>
                        <Input
                          placeholder="Service or product name"
                          disabled={itemsLocked}
                          {...register(`items.${index}.itemName`)}
                        />
                        {errors.items?.[index]?.itemName && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.items[index].itemName.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={itemsLocked}
                          {...register(`items.${index}.quantity`)}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.items[index].quantity.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={itemsLocked}
                          {...register(`items.${index}.price`)}
                        />
                        {errors.items?.[index]?.price && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.items[index].price.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          disabled={itemsLocked}
                          {...register(`items.${index}.tax`)}
                        />
                        {errors.items?.[index]?.tax && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.items[index].tax.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(totals.list[index]?.total ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1 || itemsLocked}
                          aria-label="Remove item"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {errors.items?.message && (
              <p className="border-t px-4 py-2 text-sm text-destructive">
                {errors.items.message}
              </p>
            )}

            <div className="flex justify-end border-t bg-muted/30 p-4">
              <div className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (GST)</span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(totals.taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Grand total</span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Optional - shown on the PDF below the totals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder="Payment terms, thank-you note, etc."
              {...register('notes')}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link to={backTo}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting || loadingCustomers}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
