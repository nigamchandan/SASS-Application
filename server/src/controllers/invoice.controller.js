const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  computeLineItem,
  computeInvoiceTotals,
} = require('../utils/money');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { streamInvoicePdf } = require('../utils/invoicePdf');
const { sendCsv, isoDate } = require('../utils/csv');
const { round2 } = require('../utils/money');
const { streamPdfReport, fmtINR, fmtDate } = require('../utils/pdfReport');

const buildInvoiceWhere = ({ userId, q, status }) => {
  const where = { userId };
  if (status === 'OVERDUE') {
    where.status = 'UNPAID';
    where.dueDate = { not: null, lt: new Date() };
  } else if (status && status !== 'ALL') {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return where;
};

const list = asyncHandler(async (req, res) => {
  const { q, status, page, pageSize, sortBy, sortOrder } =
    req.validatedQuery;
  const where = buildInvoiceWhere({ userId: req.user.id, q, status });

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const { customerId, notes, dueDate, status, items } = req.body;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId: req.user.id },
    select: { id: true },
  });
  if (!customer) {
    throw new ApiError(404, 'Customer not found in your workspace');
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
    select: { defaultTaxRate: true, defaultDueDays: true, invoiceFooterNote: true },
  });
  const defaultTax = profile?.defaultTaxRate ?? 0;

  const itemsWithDefaults = items.map((it) => ({
    ...it,
    tax: it.tax !== undefined && it.tax !== null && it.tax !== '' ? it.tax : defaultTax,
  }));

  const computedItems = itemsWithDefaults.map(computeLineItem).map((c, idx) => ({
    itemName: itemsWithDefaults[idx].itemName,
    ...c,
  }));
  const totals = computeInvoiceTotals(computedItems);

  let resolvedDueDate = null;
  if (dueDate) {
    resolvedDueDate = new Date(dueDate);
  } else if (profile?.defaultDueDays && profile.defaultDueDays > 0) {
    resolvedDueDate = new Date(Date.now() + profile.defaultDueDays * 24 * 60 * 60 * 1000);
  }

  const resolvedNotes =
    notes !== undefined && notes !== null && notes !== ''
      ? notes
      : profile?.invoiceFooterNote || null;

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(req.user.id, tx);
    return tx.invoice.create({
      data: {
        userId: req.user.id,
        customerId: customer.id,
        invoiceNumber,
        notes: resolvedNotes,
        dueDate: resolvedDueDate,
        status,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        items: {
          create: computedItems.map((it) => ({
            itemName: it.itemName,
            quantity: it.quantity,
            price: it.price,
            tax: it.tax,
            amount: it.amount,
            taxValue: it.taxValue,
            total: it.total,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });
  });

  res.status(201).json({ success: true, data: { invoice } });
});

const getOne = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      items: true,
      customer: true,
      payments: { orderBy: { paymentDate: 'desc' } },
      whatsappMessages: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  res.json({ success: true, data: { invoice } });
});

const updateStatus = asyncHandler(async (req, res) => {
  const existing = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Invoice not found');

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: req.body.status },
    include: { items: true, customer: true },
  });

  res.json({ success: true, data: { invoice } });
});

const update = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const existing = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId },
    include: { items: true },
  });
  if (!existing) throw new ApiError(404, 'Invoice not found');

  const { customerId, notes, dueDate, status, items } = req.body;
  const wantsItemEdit = Array.isArray(items);

  if (wantsItemEdit && Number(existing.paidAmount || 0) > 0) {
    throw new ApiError(
      400,
      'Cannot edit items on an invoice that already has payments. Remove payments first.'
    );
  }

  if (customerId && customerId !== existing.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId },
      select: { id: true },
    });
    if (!customer) {
      throw new ApiError(404, 'Customer not found in your workspace');
    }
  }

  const data = {};
  if (customerId) data.customerId = customerId;
  if (notes !== undefined) data.notes = notes;
  if (dueDate !== undefined) {
    data.dueDate = dueDate ? new Date(dueDate) : null;
  }
  if (status) data.status = status;

  let computedItems = null;
  if (wantsItemEdit) {
    computedItems = items.map(computeLineItem).map((c, idx) => ({
      itemName: items[idx].itemName,
      ...c,
    }));
    const totals = computeInvoiceTotals(computedItems);
    data.subtotal = totals.subtotal;
    data.taxAmount = totals.taxAmount;
    data.totalAmount = totals.totalAmount;
    if (!status) {
      data.status = totals.totalAmount <= 0 ? 'PAID' : 'UNPAID';
    }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (wantsItemEdit) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoiceItem.createMany({
        data: computedItems.map((it) => ({
          invoiceId: existing.id,
          itemName: it.itemName,
          quantity: it.quantity,
          price: it.price,
          tax: it.tax,
          amount: it.amount,
          taxValue: it.taxValue,
          total: it.total,
        })),
      });
    }
    return tx.invoice.update({
      where: { id: existing.id },
      data,
      include: { items: true, customer: true },
    });
  });

  res.json({ success: true, data: { invoice } });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Invoice not found');

  await prisma.invoice.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Invoice deleted' });
});

const downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      customer: true,
    },
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found');

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });

  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
    phone: profile?.phone || null,
    address: profile?.address || null,
    gstNumber: profile?.gstNumber || null,
    currency: profile?.currency || 'INR',
    footerNote: profile?.invoiceFooterNote || null,
  };

  streamInvoicePdf(
    {
      invoice,
      customer: invoice.customer,
      business,
    },
    res
  );
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const q = (req.query.q || '').toString().trim();
  const status = (req.query.status || '').toString().trim();
  const where = buildInvoiceWhere({ userId, q, status });

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      customer: { select: { name: true, email: true, phone: true, gstNumber: true } },
    },
  });

  const now = new Date();
  const rows = invoices.map((inv) => {
    const balance = round2(
      Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)
    );
    const isOverdue =
      inv.status === 'UNPAID' && inv.dueDate && new Date(inv.dueDate) < now;
    const display = isOverdue ? 'OVERDUE' : inv.status;
    return [
      inv.invoiceNumber,
      isoDate(inv.issueDate),
      isoDate(inv.dueDate),
      inv.customer?.name || '',
      inv.customer?.email || '',
      inv.customer?.phone || '',
      inv.customer?.gstNumber || '',
      display,
      round2(inv.subtotal),
      round2(inv.taxAmount),
      round2(inv.totalAmount),
      round2(inv.paidAmount),
      balance,
      inv.notes || '',
    ];
  });

  const filename = `bizautomate-invoices-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  sendCsv(
    res,
    filename,
    [
      'Invoice #',
      'Issue Date',
      'Due Date',
      'Customer',
      'Email',
      'Phone',
      'GST',
      'Status',
      'Subtotal',
      'Tax',
      'Total',
      'Paid',
      'Balance',
      'Notes',
    ],
    rows
  );
});

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const q = (req.query.q || '').toString().trim();
  const status = (req.query.status || '').toString().trim();
  const where = buildInvoiceWhere({ userId, q, status });

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    include: { customer: { select: { name: true } } },
  });

  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    select: { businessName: true, email: true },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
  };

  const now = new Date();
  const rows = invoices.map((inv) => {
    const balance = round2(
      Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)
    );
    const isOverdue =
      inv.status === 'UNPAID' && inv.dueDate && new Date(inv.dueDate) < now;
    return {
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      customer: inv.customer?.name || '-',
      status: isOverdue ? 'OVERDUE' : inv.status,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balance,
    };
  });

  const sumTotal = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const sumPaid = rows.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
  const sumBalance = rows.reduce((s, r) => s + r.balance, 0);
  const overdueCount = rows.filter((r) => r.status === 'OVERDUE').length;
  const paidCount = rows.filter((r) => r.status === 'PAID').length;

  const filename = `bizautomate-invoices-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  streamPdfReport(res, {
    filename,
    title: 'Invoices',
    subtitle: `${rows.length} invoice${rows.length === 1 ? '' : 's'}${
      status && status !== 'ALL' ? ` · status: ${status}` : ''
    }${q ? ` · matching "${q}"` : ''}`,
    business,
    kpis: [
      { label: 'Total invoices', value: String(rows.length) },
      { label: 'Paid', value: String(paidCount) },
      { label: 'Overdue', value: String(overdueCount) },
      { label: 'Outstanding', value: fmtINR(sumBalance) },
    ],
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #', width: 1.2 },
      { key: 'issueDate', label: 'Issued', width: 1, format: fmtDate },
      { key: 'dueDate', label: 'Due', width: 1, format: fmtDate },
      { key: 'customer', label: 'Customer', width: 1.8 },
      { key: 'status', label: 'Status', width: 0.9 },
      {
        key: 'totalAmount',
        label: 'Total',
        width: 1.1,
        align: 'right',
        format: fmtINR,
      },
      {
        key: 'paidAmount',
        label: 'Paid',
        width: 1.1,
        align: 'right',
        format: fmtINR,
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 1.1,
        align: 'right',
        format: fmtINR,
      },
    ],
    rows,
    totals: [
      { label: 'Total billed', value: fmtINR(sumTotal) },
      { label: 'Total received', value: fmtINR(sumPaid) },
      { label: 'Outstanding', value: fmtINR(sumBalance) },
    ],
    emptyMessage: 'No invoices match the current filters.',
  });
});

module.exports = { list, create, getOne, update, updateStatus, remove, downloadPdf, exportCsv, exportPdf };
