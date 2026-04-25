import { Badge } from '@/components/ui/badge';

export default function InvoiceStatusBadge({
  status,
  paidAmount,
  totalAmount,
  dueDate,
}) {
  const paid = Number(paidAmount) || 0;
  const total = Number(totalAmount) || 0;

  if (status === 'PAID') {
    return <Badge variant="success">Paid</Badge>;
  }

  const isOverdue =
    status !== 'PAID' &&
    dueDate &&
    new Date(dueDate).getTime() < Date.now();

  if (isOverdue) {
    return (
      <Badge
        variant="warning"
        className="bg-red-100 text-red-700 hover:bg-red-200"
      >
        Overdue
      </Badge>
    );
  }

  if (paid > 0 && paid + 0.001 < total) {
    return (
      <Badge
        variant="warning"
        className="bg-blue-100 text-blue-700 hover:bg-blue-200"
      >
        Partial
      </Badge>
    );
  }

  return <Badge variant="warning">Pending</Badge>;
}
