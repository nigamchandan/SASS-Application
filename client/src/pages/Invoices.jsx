import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import ExportMenu from '@/components/common/ExportMenu';
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
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge';
import { invoicesApi, downloadBlob, extractApiError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate } from '@/lib/format';

const PAGE_SIZE = 10;

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const debouncedSearch = useDebounce(search, 350);
  const [loading, setLoading] = useState(false);
  const handleExport = async (format) => {
    try {
      const params = {
        q: debouncedSearch || undefined,
        status: statusFilter,
      };
      const res =
        format === 'pdf'
          ? await invoicesApi.exportPdf(params)
          : await invoicesApi.exportCsv(params);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const filename = `bizautomate-invoices-${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      downloadBlob(res.data, filename, mime);
      toast.success(`Invoices exported as ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(extractApiError(err, 'Export failed'));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.list({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: statusFilter,
      });
      setItems(res?.data?.items ?? []);
      setPagination(
        res?.data?.pagination ?? {
          page,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load invoices'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const showingFrom = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = items.length === 0 ? 0 : showingFrom + items.length - 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Create, track, and download invoices for your customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            onExport={handleExport}
            disabled={pagination.total === 0}
          />
          <Button asChild>
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All invoices</CardTitle>
            <CardDescription>
              {pagination.total === 0
                ? 'No invoices yet'
                : `${pagination.total} ${
                    pagination.total === 1 ? 'invoice' : 'invoices'
                  }`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice # or customer..."
                className="w-full pl-9 sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All status</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Issue date
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Due date
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading invoices...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="font-medium text-foreground">
                          {debouncedSearch || statusFilter !== 'ALL'
                            ? 'No matching invoices'
                            : 'No invoices yet'}
                        </p>
                        <p>
                          {debouncedSearch || statusFilter !== 'ALL'
                            ? 'Try clearing filters or changing your search.'
                            : 'Create your first invoice to start billing.'}
                        </p>
                        {!debouncedSearch && statusFilter === 'ALL' && (
                          <Button asChild size="sm" className="mt-2">
                            <Link to="/invoices/new">
                              <Plus className="mr-2 h-4 w-4" />
                              New invoice
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.customer?.name ?? '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDate(inv.issueDate)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge
                          status={inv.status}
                          paidAmount={inv.paidAmount}
                          totalAmount={inv.totalAmount}
                          dueDate={inv.dueDate}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            to={`/invoices/${inv.id}`}
                            aria-label={`View ${inv.invoiceNumber}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                Showing <strong>{showingFrom}</strong> to{' '}
                <strong>{showingTo}</strong> of{' '}
                <strong>{pagination.total}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-muted-foreground">
                  Page <strong>{pagination.page}</strong> of{' '}
                  <strong>{pagination.totalPages}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={page >= pagination.totalPages || loading}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
