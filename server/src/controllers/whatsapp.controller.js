const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendWhatsAppMessage,
  getProvider,
} = require('../services/whatsapp');
const {
  buildInvoiceMessage,
  buildReminderMessage,
} = require('../services/whatsapp/templates');
const { sendCsv, isoDateTime } = require('../utils/csv');
const { streamPdfReport, fmtDateTime } = require('../utils/pdfReport');

async function loadInvoiceForUser(userId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { customer: true },
  });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
}

async function dispatch({ user, invoice, kind, customMessage, customPhone }) {
  const customer = invoice.customer;
  const phone = customPhone || customer.phone;
  if (!phone || !String(phone).trim()) {
    throw new ApiError(
      400,
      'Add a phone number to the customer before sending WhatsApp messages'
    );
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: user.id },
  });
  const business = {
    name: profile?.businessName || user.name,
    email: profile?.email || user.email,
    phone: profile?.phone || null,
  };
  const message =
    customMessage ||
    (kind === 'INVOICE'
      ? buildInvoiceMessage({ invoice, customer, business })
      : buildReminderMessage({ invoice, customer, business }));

  let result = null;
  let error = null;
  let status = 'FAILED';

  try {
    result = await sendWhatsAppMessage(phone, message, {
      kind,
      invoiceNumber: invoice.invoiceNumber,
    });
    status = result.status || 'SENT';
  } catch (err) {
    error = err.message || 'Send failed';
    if (err.statusCode) throw err;
  }

  const record = await prisma.whatsAppMessage.create({
    data: {
      userId: user.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      phone,
      message,
      kind,
      status,
      provider: result?.provider || getProvider().name,
      providerMessageId: result?.providerMessageId || null,
      error,
    },
  });

  if (error) {
    return { record, ok: false, error };
  }
  return { record, ok: true };
}

const sendInvoice = asyncHandler(async (req, res) => {
  const invoice = await loadInvoiceForUser(req.user.id, req.params.id);
  const { ok, record, error } = await dispatch({
    user: req.user,
    invoice,
    kind: 'INVOICE',
    customMessage: req.body.message,
    customPhone: req.body.phone,
  });
  if (!ok) {
    return res
      .status(502)
      .json({ success: false, message: error, data: { message: record } });
  }
  res.status(201).json({
    success: true,
    message: 'Invoice sent via WhatsApp',
    data: { message: record },
  });
});

const sendReminder = asyncHandler(async (req, res) => {
  const invoice = await loadInvoiceForUser(req.user.id, req.params.id);
  const { ok, record, error } = await dispatch({
    user: req.user,
    invoice,
    kind: 'REMINDER',
    customMessage: req.body.message,
    customPhone: req.body.phone,
  });
  if (!ok) {
    return res
      .status(502)
      .json({ success: false, message: error, data: { message: record } });
  }
  res.status(201).json({
    success: true,
    message: 'Reminder sent via WhatsApp',
    data: { message: record },
  });
});

const list = asyncHandler(async (req, res) => {
  await loadInvoiceForUser(req.user.id, req.params.id);
  const items = await prisma.whatsAppMessage.findMany({
    where: { invoiceId: req.params.id, userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { items } });
});

const previewTemplates = asyncHandler(async (req, res) => {
  const invoice = await loadInvoiceForUser(req.user.id, req.params.id);
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
    phone: profile?.phone || null,
  };
  res.json({
    success: true,
    data: {
      provider: getProvider().name,
      to: invoice.customer.phone || null,
      templates: {
        INVOICE: buildInvoiceMessage({
          invoice,
          customer: invoice.customer,
          business,
        }),
        REMINDER: buildReminderMessage({
          invoice,
          customer: invoice.customer,
          business,
        }),
      },
    },
  });
});

function buildMessageWhere({ userId, q, kind, status, customerId, invoiceId, dateFrom, dateTo }) {
  const where = { userId };
  if (kind && kind !== 'ALL') where.kind = kind;
  if (status && status !== 'ALL') where.status = status;
  if (customerId) where.customerId = customerId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (q) {
    where.OR = [
      { phone: { contains: q, mode: 'insensitive' } },
      { message: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return where;
}

const listAll = asyncHandler(async (req, res) => {
  const { q, kind, status, customerId, invoiceId, dateFrom, dateTo, page, pageSize } =
    req.validatedQuery;
  const where = buildMessageWhere({
    userId: req.user.id,
    q,
    kind,
    status,
    customerId,
    invoiceId,
    dateFrom,
    dateTo,
  });

  const [items, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        message: true,
        kind: true,
        status: true,
        provider: true,
        providerMessageId: true,
        error: true,
        createdAt: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.whatsAppMessage.count({ where }),
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
      provider: getProvider().name,
    },
  });
});

const summary = asyncHandler(async (req, res) => {
  const { q, kind, status, customerId, invoiceId, dateFrom, dateTo } =
    req.validatedQuery;
  const where = buildMessageWhere({
    userId: req.user.id,
    q,
    kind,
    status,
    customerId,
    invoiceId,
    dateFrom,
    dateTo,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agg, byKind, byStatus, monthAgg, recipients] = await Promise.all([
    prisma.whatsAppMessage.count({ where }),
    prisma.whatsAppMessage.groupBy({
      by: ['kind'],
      where,
      _count: { _all: true },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.whatsAppMessage.count({
      where: {
        ...where,
        createdAt: { ...(where.createdAt || {}), gte: monthStart },
      },
    }),
    prisma.whatsAppMessage.findMany({
      where,
      select: { phone: true, customerId: true },
      distinct: ['phone'],
      take: 1000,
    }),
  ]);

  res.json({
    success: true,
    data: {
      total: agg,
      thisMonth: monthAgg,
      uniqueRecipients: recipients.length,
      byKind: byKind.reduce((acc, g) => {
        acc[g.kind] = g._count._all;
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, g) => {
        acc[g.status] = g._count._all;
        return acc;
      }, {}),
      provider: getProvider().name,
    },
  });
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const where = buildMessageWhere({
    userId,
    q: (req.query.q || '').toString().trim(),
    kind: (req.query.kind || '').toString().trim(),
    status: (req.query.status || '').toString().trim(),
    customerId: req.query.customerId
      ? req.query.customerId.toString()
      : null,
    invoiceId: req.query.invoiceId ? req.query.invoiceId.toString() : null,
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
  });

  const messages = await prisma.whatsAppMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      phone: true,
      message: true,
      kind: true,
      status: true,
      provider: true,
      providerMessageId: true,
      error: true,
      createdAt: true,
      invoice: { select: { invoiceNumber: true } },
      customer: { select: { name: true } },
    },
  });

  const rows = messages.map((m) => [
    isoDateTime(m.createdAt),
    m.kind,
    m.status,
    m.phone,
    m.customer?.name || '',
    m.invoice?.invoiceNumber || '',
    m.provider || '',
    m.providerMessageId || '',
    m.error || '',
    (m.message || '').replace(/\r?\n/g, ' ').slice(0, 1000),
  ]);

  const filename = `bizautomate-whatsapp-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  sendCsv(
    res,
    filename,
    [
      'Sent At',
      'Kind',
      'Status',
      'Phone',
      'Customer',
      'Invoice #',
      'Provider',
      'Provider Message Id',
      'Error',
      'Message',
    ],
    rows
  );
});

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const where = buildMessageWhere({
    userId,
    q: (req.query.q || '').toString().trim(),
    kind: (req.query.kind || '').toString().trim(),
    status: (req.query.status || '').toString().trim(),
    customerId: req.query.customerId
      ? req.query.customerId.toString()
      : null,
    invoiceId: req.query.invoiceId ? req.query.invoiceId.toString() : null,
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
  });

  const messages = await prisma.whatsAppMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      phone: true,
      message: true,
      kind: true,
      status: true,
      provider: true,
      createdAt: true,
      invoice: { select: { invoiceNumber: true } },
      customer: { select: { name: true } },
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

  const rows = messages.map((m) => ({
    createdAt: m.createdAt,
    kind: m.kind,
    status: m.status,
    phone: m.phone,
    customer: m.customer?.name || '-',
    invoiceNumber: m.invoice?.invoiceNumber || '-',
    message: (m.message || '').replace(/\r?\n/g, ' '),
  }));

  const sentCount = rows.filter((r) => r.status === 'SENT').length;
  const failedCount = rows.filter((r) => r.status === 'FAILED').length;
  const reminderCount = rows.filter((r) => r.kind === 'REMINDER').length;
  const successRate = rows.length
    ? Math.round((sentCount / rows.length) * 100)
    : 0;

  const filename = `bizautomate-whatsapp-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  streamPdfReport(res, {
    filename,
    title: 'WhatsApp Messages',
    subtitle: `${rows.length} message${rows.length === 1 ? '' : 's'}`,
    business,
    kpis: [
      { label: 'Messages', value: String(rows.length) },
      { label: 'Delivered', value: `${sentCount} (${successRate}%)` },
      { label: 'Reminders', value: String(reminderCount) },
      { label: 'Failed', value: String(failedCount) },
    ],
    columns: [
      { key: 'createdAt', label: 'Sent At', width: 1.4, format: fmtDateTime },
      { key: 'kind', label: 'Kind', width: 0.8 },
      { key: 'status', label: 'Status', width: 0.8 },
      { key: 'phone', label: 'Phone', width: 1.3 },
      { key: 'customer', label: 'Customer', width: 1.4 },
      { key: 'invoiceNumber', label: 'Invoice #', width: 1.2 },
      { key: 'message', label: 'Message', width: 2.8 },
    ],
    rows,
    emptyMessage: 'No WhatsApp messages match the current filters.',
  });
});

module.exports = {
  sendInvoice,
  sendReminder,
  list,
  previewTemplates,
  listAll,
  summary,
  exportCsv,
  exportPdf,
};
