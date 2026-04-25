import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { customersApi, extractApiError } from '@/lib/api';
import { customerSchema } from '@/lib/validators';

const emptyValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstNumber: '',
};

export default function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}) {
  const isEdit = Boolean(customer?.id);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        address: customer?.address ?? '',
        gstNumber: customer?.gstNumber ?? '',
      });
    }
  }, [open, customer, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        phone: values.phone || '',
        email: values.email || '',
        address: values.address || '',
        gstNumber: values.gstNumber || '',
      };

      if (isEdit) {
        await customersApi.update(customer.id, payload);
        toast.success('Customer updated');
      } else {
        await customersApi.create(payload);
        toast.success('Customer added');
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save customer'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit customer' : 'Add new customer'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details for this customer.'
              : 'Capture customer details to start invoicing.'}
          </DialogDescription>
        </DialogHeader>

        <form
          id="customer-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Acme Traders"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="hello@acme.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="gstNumber">GST Number</Label>
            <Input
              id="gstNumber"
              placeholder="22AAAAA0000A1Z5"
              {...register('gstNumber')}
            />
            {errors.gstNumber && (
              <p className="text-xs text-destructive">
                {errors.gstNumber.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Street, city, pincode..."
              rows={3}
              {...register('address')}
            />
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="customer-form" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
