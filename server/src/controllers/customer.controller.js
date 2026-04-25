const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const { sendCsv, isoDate } = require('../utils/csv');
const { streamPdfReport, fmtINR, fmtDate } = require('../utils/pdfReport');

const buildSearchWhere = (userId, q) => {
  const base = { userId };
  if (!q) return base;
  return {
    ...base,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { gstNumber: { contains: q, mode: 'insensitive' } },
    ],
  };
};

const list = asyncHandler(async (req, res) => {
  const { q, page, pageSize, sortBy, sortOrder } = req.validatedQuery;
  const where = buildSearchWhere(req.user.id, q);

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
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
  const customer = await prisma.customer.create({
    data: { ...req.body, userId: req.user.id },
  });
  res.status(201).json({ success: true, data: { customer } });
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: { customer } });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Customer not found');

  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: req.body,
  });
  res.json({ success: true, data: { customer } });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Customer not found');

  await prisma.customer.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Customer deleted' });
});

const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const customerId = req.params.id;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId },
  });
  if (!customer) throw new ApiError(404, 'Customer not found');

  const now = new Date();

  const [
    invoiceTotalsAgg,
    paidAgg,
    overdueCount,
    paidInvoiceCount,
    unpaidInvoiceCount,
    invoices,
    payments,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { userId, customerId },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { userId, invoice: { customerId } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.invoice.count({
      where: {
        userId,
        customerId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
    }),
    prisma.invoice.count({
      where: { userId, customerId, status: 'PAID' },
    }),
    prisma.invoice.count({
      where: { userId, customerId, status: 'UNPAID' },
    }),
    prisma.invoice.findMany({
      where: { userId, customerId },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      where: { userId, invoice: { customerId } },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        amount: true,
        method: true,
        paymentDate: true,
        note: true,
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    }),
  ]);

  const totalInvoiced = round2(
    Number(invoiceTotalsAgg._sum.totalAmount || 0)
  );
  const totalSpent = round2(Number(paidAgg._sum.amount || 0));
  const pending = Math.max(
    0,
    round2(
      Number(invoiceTotalsAgg._sum.totalAmount || 0) -
        Number(invoiceTotalsAgg._sum.paidAmount || 0)
    )
  );

  res.json({
    success: true,
    data: {
      customer,
      stats: {
        totalInvoiced,
        totalSpent,
        pending,
        invoiceCount: invoiceTotalsAgg._count._all || 0,
        paymentCount: paidAgg._count._all || 0,
        paidInvoiceCount,
        unpaidInvoiceCount,
        overdueCount,
      },
      invoices,
      payments,
    },
  });
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const q = (req.query.q || '').toString().trim();
  const sortBy = ['name', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const where = buildSearchWhere(userId, q);

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    include: {
      _count: { select: { invoices: true } },
      invoices: {
        select: { totalAmount: true, paidAmount: true },
      },
    },
  });

  const rows = customers.map((c) => {
    const totalInvoiced = c.invoices.reduce(
      (s, i) => s + (Number(i.totalAmount) || 0),
      0
    );
    const totalPaid = c.invoices.reduce(
      (s, i) => s + (Number(i.paidAmount) || 0),
      0
    );
    return [
      c.name,
      c.phone || '',
      c.email || '',
      c.gstNumber || '',
      c.address || '',
      c._count.invoices,
      round2(totalInvoiced),
      round2(totalPaid),
      round2(Math.max(0, totalInvoiced - totalPaid)),
      isoDate(c.createdAt),
    ];
  });

  const filename = `bizautomate-customers-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  sendCsv(
    res,
    filename,
    [
      'Name',
      'Phone',
      'Email',
      'GST',
      'Address',
      'Invoices',
      'Total Invoiced',
      'Total Paid',
      'Balance',
      'Customer Since',
    ],
    rows
  );
});

async function loadCustomersWithStats(userId, q, sortBy, sortOrder) {
  const where = buildSearchWhere(userId, q);
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    include: {
      _count: { select: { invoices: true } },
      invoices: { select: { totalAmount: true, paidAmount: true } },
    },
  });
  return customers.map((c) => {
    const totalInvoiced = c.invoices.reduce(
      (s, i) => s + (Number(i.totalAmount) || 0),
      0
    );
    const totalPaid = c.invoices.reduce(
      (s, i) => s + (Number(i.paidAmount) || 0),
      0
    );
    return {
      ...c,
      totalInvoiced: round2(totalInvoiced),
      totalPaid: round2(totalPaid),
      balance: round2(Math.max(0, totalInvoiced - totalPaid)),
      invoiceCount: c._count.invoices,
    };
  });
}

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const q = (req.query.q || '').toString().trim();
  const sortBy = ['name', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

  const rows = await loadCustomersWithStats(userId, q, sortBy, sortOrder);

  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    select: { businessName: true, email: true },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
  };

  const totalInvoiced = rows.reduce((s, r) => s + r.totalInvoiced, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  const filename = `bizautomate-customers-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  streamPdfReport(res, {
    filename,
    title: 'Customers',
    subtitle: `${rows.length} customer${rows.length === 1 ? '' : 's'}${
      q ? ` · matching "${q}"` : ''
    }`,
    business,
    kpis: [
      { label: 'Customers', value: String(rows.length) },
      { label: 'Total invoiced', value: fmtINR(totalInvoiced) },
      { label: 'Total received', value: fmtINR(totalPaid) },
      { label: 'Outstanding', value: fmtINR(totalBalance) },
    ],
    columns: [
      { key: 'name', label: 'Name', width: 1.5 },
      { key: 'phone', label: 'Phone', width: 1.1 },
      { key: 'email', label: 'Email', width: 1.6 },
      { key: 'gstNumber', label: 'GSTIN', width: 1.1 },
      { key: 'invoiceCount', label: 'Invoices', width: 0.6, align: 'right' },
      {
        key: 'totalInvoiced',
        label: 'Invoiced',
        width: 1,
        align: 'right',
        format: fmtINR,
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 1,
        align: 'right',
        format: fmtINR,
      },
      {
        key: 'createdAt',
        label: 'Since',
        width: 0.9,
        align: 'right',
        format: fmtDate,
      },
    ],
    rows,
    totals: [
      { label: 'Total invoiced', value: fmtINR(totalInvoiced) },
      { label: 'Total received', value: fmtINR(totalPaid) },
      { label: 'Outstanding balance', value: fmtINR(totalBalance) },
    ],
    emptyMessage: 'No customers match the current filters.',
  });
});

module.exports = { list, create, getOne, update, remove, getSummary, exportCsv, exportPdf };
