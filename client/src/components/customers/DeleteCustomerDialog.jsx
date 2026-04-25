import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { customersApi, extractApiError } from '@/lib/api';

export default function DeleteCustomerDialog({
  open,
  onOpenChange,
  customer,
  onDeleted,
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (!customer) return;

    setSubmitting(true);
    try {
      await customersApi.remove(customer.id);
      toast.success('Customer deleted');
      onDeleted?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete customer'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
          <AlertDialogDescription>
            {customer
              ? `"${customer.name}" will be permanently removed. This action cannot be undone.`
              : 'This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
