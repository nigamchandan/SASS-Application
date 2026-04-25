const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const { sendCsv, isoDate } = require('../utils/csv');
const { streamPdfReport, fmtINR, fmtDate } = require('../utils/pdfReport');

async function loadOwnedInvoice(userId, invoiceId, tx = prisma) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { id: true, totalAmount: true, paidAmount: true, status: true },
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
}

async function recomputeInvoicePaid(invoiceId, tx) {
  const agg = await tx.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const paidAmount = round2(Number(agg._sum.amount || 0));
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { totalAmount: true },
  });
  const status =
    paidAmount + 1e-6 >= Number(invoice.totalAmount) ? 'PAID' : 'UNPAID';
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, status },
  });
  return { paidAmount, status };
}

const list = asyncHandler(async (req, res) => {
  await loadOwnedInvoice(req.user.id, req.params.invoiceId);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: req.params.invoiceId, userId: req.user.id },
    orderBy: { paymentDate: 'desc' },
  });
  res.json({ success: true, data: { items: payments } });
});

const add = asyncHandler(async (req, res) => {
  const { amount, paymentDate, method, note } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await loadOwnedInvoice(
      req.user.id,
      req.params.invoiceId,
      tx
    );

    const payment = await tx.payment.create({
      data: {
        userId: req.user.id,
        invoiceId: invoice.id,
        amount: round2(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        method,
        note: note ?? null,
      },
    });

    const updated = await recomputeInvoicePaid(invoice.id, tx);

    return { payment, ...updated };
  });

  res.status(201).json({
    success: true,
    data: {
      payment: result.payment,
      invoice: {
        id: req.params.invoiceId,
        paidAmount: result.paidAmount,
        status: result.status,
      },
    },
  });
});

const remove = asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: req.params.paymentId,
        invoiceId: req.params.invoiceId,
        userId: req.user.id,
      },
      select: { id: true, invoiceId: true },
    });
    if (!payment) throw new ApiError(404, 'Payment not found');

    await tx.payment.delete({ where: { id: payment.id } });
    return recomputeInvoicePaid(payment.invoiceId, tx);
  });

  res.json({
    success: true,
    message: 'Payment deleted',
    data: {
      invoice: {
        id: req.params.invoiceId,
        paidAmount: result.paidAmount,
        status: result.status,
      },
    },
  });
});

function buildPaymentWhere({ userId, q, method, dateFrom, dateTo, customerId }) {
  const where = { userId };
  if (method && method !== 'ALL') where.method = method;
  if (dateFrom || dateTo) {
    where.paymentDate = {};
    if (dateFrom) where.paymentDate.gte = new Date(dateFrom);
    if (dateTo) {
      // include the entire end day
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.paymentDate.lte = end;
    }
  }
  if (customerId) {
    where.invoice = { customerId };
  }
  if (q) {
    where.OR = [
      { note: { contains: q, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      {
        invoice: {
          customer: { name: { contains: q, mode: 'insensitive' } },
        },
      },
    ];
  }
  return where;
}

const listAll = asyncHandler(async (req, res) => {
  const { q, method, dateFrom, dateTo, customerId, page, pageSize, sortBy, sortOrder } =
    req.validatedQuery;
  const where = buildPaymentWhere({
    userId: req.user.id,
    q,
    method,
    dateFrom,
    dateTo,
    customerId,
  });

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        method: true,
        paymentDate: true,
        note: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
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

const summary = asyncHandler(async (req, res) => {
  const { q, method, dateFrom, dateTo, customerId } = req.validatedQuery;
  const where = buildPaymentWhere({
    userId: req.user.id,
    q,
    method,
    dateFrom,
    dateTo,
    customerId,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agg, byMethod, monthAgg] = await Promise.all([
    prisma.payment.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, paymentDate: { ...(where.paymentDate || {}), gte: monthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      total: round2(Number(agg._sum.amount || 0)),
      count: agg._count._all || 0,
      thisMonth: round2(Number(monthAgg._sum.amount || 0)),
      thisMonthCount: monthAgg._count._all || 0,
      byMethod: byMethod
        .map((m) => ({
          method: m.method,
          total: round2(Number(m._sum.amount || 0)),
          count: m._count._all || 0,
        }))
        .sort((a, b) => b.total - a.total),
    },
  });
});

const removeById = asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, invoiceId: true },
    });
    if (!payment) throw new ApiError(404, 'Payment not found');
    await tx.payment.delete({ where: { id: payment.id } });
    return {
      invoiceId: payment.invoiceId,
      ...(await recomputeInvoicePaid(payment.invoiceId, tx)),
    };
  });

  res.json({
    success: true,
    message: 'Payment deleted',
    data: {
      invoice: {
        id: result.invoiceId,
        paidAmount: result.paidAmount,
        status: result.status,
      },
    },
  });
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const where = buildPaymentWhere({
    userId,
    q: (req.query.q || '').toString().trim(),
    method: (req.query.method || '').toString().trim(),
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
    customerId: req.query.customerId
      ? req.query.customerId.toString()
      : null,
  });

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    select: {
      amount: true,
      method: true,
      paymentDate: true,
      note: true,
      createdAt: true,
      invoice: {
        select: {
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          customer: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  const rows = payments.map((p) => [
    isoDate(p.paymentDate),
    p.invoice?.invoiceNumber || '',
    p.invoice?.customer?.name || '',
    p.invoice?.customer?.email || '',
    p.invoice?.customer?.phone || '',
    p.method,
    round2(p.amount),
    round2(p.invoice?.totalAmount || 0),
    p.invoice?.status || '',
    p.note || '',
  ]);

  const filename = `bizautomate-payments-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  sendCsv(
    res,
    filename,
    [
      'Date',
      'Invoice #',
      'Customer',
      'Email',
      'Phone',
      'Method',
      'Amount',
      'Invoice Total',
      'Invoice Status',
      'Note',
    ],
    rows
  );
});

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const where = buildPaymentWhere({
    userId,
    q: (req.query.q || '').toString().trim(),
    method: (req.query.method || '').toString().trim(),
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
    customerId: req.query.customerId ? req.query.customerId.toString() : null,
  });

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    select: {
      amount: true,
      method: true,
      paymentDate: true,
      note: true,
      invoice: {
        select: {
          invoiceNumber: true,
          customer: { select: { name: true } },
        },
      },
    },
  });

  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    select: { businessName: true, email: true },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
  };

  const rows = payments.map((p) => ({
    paymentDate: p.paymentDate,
    invoiceNumber: p.invoice?.invoiceNumber || '-',
    customer: p.invoice?.customer?.name || '-',
    method: p.method,
    amount: p.amount,
    note: p.note || '',
  }));

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byMethodMap = rows.reduce((m, r) => {
    m[r.method] = (m[r.method] || 0) + Number(r.amount || 0);
    return m;
  }, {});
  const topMethod = Object.entries(byMethodMap).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const filename = `bizautomate-payments-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  streamPdfReport(res, {
    filename,
    title: 'Payments',
    subtitle: `${rows.length} payment${rows.length === 1 ? '' : 's'}`,
    business,
    kpis: [
      { label: 'Payments', value: String(rows.length) },
      { label: 'Total received', value: fmtINR(total) },
      {
        label: 'Top method',
        value: topMethod ? `${topMethod[0]} (${fmtINR(topMethod[1])})` : '-',
      },
      {
        label: 'Avg payment',
        value: fmtINR(rows.length > 0 ? total / rows.length : 0),
      },
    ],
    columns: [
      { key: 'paymentDate', label: 'Date', width: 1, format: fmtDate },
      { key: 'invoiceNumber', label: 'Invoice #', width: 1.2 },
      { key: 'customer', label: 'Customer', width: 1.8 },
      { key: 'method', label: 'Method', width: 0.8 },
      {
        key: 'amount',
        label: 'Amount',
        width: 1.1,
        align: 'right',
        format: fmtINR,
      },
      { key: 'note', label: 'Note', width: 1.6 },
    ],
    rows,
    totals: [{ label: 'Total received', value: fmtINR(total) }],
    emptyMessage: 'No payments match the current filters.',
  });
});

module.exports = { list, add, remove, listAll, summary, removeById, exportCsv, exportPdf };
