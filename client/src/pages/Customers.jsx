import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import CustomerFormDialog from '@/components/customers/CustomerFormDialog';
import DeleteCustomerDialog from '@/components/customers/DeleteCustomerDialog';
import { customersApi, downloadBlob, extractApiError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 10;

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_e) {
    return '';
  }
};

export default function Customers() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const handleExport = async (format) => {
    try {
      const params = { q: debouncedSearch || undefined };
      const res =
        format === 'pdf'
          ? await customersApi.exportPdf(params)
          : await customersApi.exportCsv(params);
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const filename = `bizautomate-customers-${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      downloadBlob(res.data, filename, mime);
      toast.success(`Customers exported as ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(extractApiError(err, 'Export failed'));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersApi.list({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearch || undefined,
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
      toast.error(extractApiError(err, 'Could not load customers'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleAdd = () => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  const handleDelete = (customer) => {
    setDeletingCustomer(customer);
    setDeleteOpen(true);
  };

  const onSaved = () => {
    if (!editingCustomer && page !== 1) {
      setPage(1);
    } else {
      fetchData();
    }
  };

  const onDeleted = () => {
    if (items.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      fetchData();
    }
  };

  const totalLabel = useMemo(() => {
    const { total } = pagination;
    if (total === 0) return '0 customers';
    if (total === 1) return '1 customer';
    return `${total} customers`;
  }, [pagination]);

  const showingFrom = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = items.length === 0 ? 0 : showingFrom + items.length - 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customers and their billing details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            onExport={handleExport}
            disabled={pagination.total === 0}
          />
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All customers</CardTitle>
            <CardDescription>{totalLabel} in your workspace</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, email, GST..."
                className="w-full pl-9 sm:w-72"
              />
            </div>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">
                    GST Number
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Address
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Added
                  </TableHead>
                  <TableHead className="w-[140px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading customers...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Users className="h-5 w-5" />
                        </div>
                        <p className="font-medium text-foreground">
                          {debouncedSearch
                            ? 'No matching customers'
                            : 'No customers yet'}
                        </p>
                        <p>
                          {debouncedSearch
                            ? 'Try a different search term.'
                            : 'Add your first customer to start sending invoices.'}
                        </p>
                        {!debouncedSearch && (
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={handleAdd}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add customer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/customers/${c.id}`}
                          className="text-slate-900 hover:text-indigo-600 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          {c.phone && <span>{c.phone}</span>}
                          {c.email && (
                            <span className="text-muted-foreground">
                              {c.email}
                            </span>
                          )}
                          {!c.phone && !c.email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.gstNumber || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-xs truncate">
                        {c.address || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            aria-label={`View ${c.name}`}
                          >
                            <Link to={`/customers/${c.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(c)}
                            aria-label={`Edit ${c.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(c)}
                            aria-label={`Delete ${c.name}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
        onSaved={onSaved}
      />
      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customer={deletingCustomer}
        onDeleted={onDeleted}
      />
    </div>
  );
}
