const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const HOUR_LABEL = (h) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${period}`;
};

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function addHours(d, n) {
  const x = new Date(d);
  x.setHours(x.getHours() + n);
  return x;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hourKey(date) {
  return `${dayKey(date)}-${String(date.getHours()).padStart(2, '0')}`;
}

function buildMonthBuckets(now, count = 12) {
  const buckets = {};
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    buckets[key] = {
      key,
      month: key,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      revenue: 0,
      payments: 0,
    };
  }
  return buckets;
}

/**
 * Returns the boundaries + sparkline bucket plan for a given range.
 * - today: hourly buckets for last 24 hours; previous = yesterday's same window
 * - week:  rolling 7 days; previous = 7 days before
 * - month: from start of current month → now; previous = full last month
 * - year:  from start of current year → now; previous = full last year
 */
function resolveRange(range, now = new Date()) {
  if (range === 'today') {
    const start = startOfDay(now);
    const end = now;
    const prevStart = addDays(start, -1);
    const prevEnd = new Date(start);
    return {
      range,
      start,
      end,
      prevStart,
      prevEnd,
      bucket: 'hour',
      buckets: 24,
      seriesStart: addHours(now, -23),
    };
  }
  if (range === 'week') {
    const start = addDays(startOfDay(now), -6);
    const end = now;
    const prevStart = addDays(start, -7);
    const prevEnd = start;
    return {
      range,
      start,
      end,
      prevStart,
      prevEnd,
      bucket: 'day',
      buckets: 7,
      seriesStart: start,
    };
  }
  if (range === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = now;
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(now.getFullYear(), 0, 1);
    return {
      range,
      start,
      end,
      prevStart,
      prevEnd,
      bucket: 'month',
      buckets: 12,
      seriesStart: start,
    };
  }
  // default: month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = now;
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = start;
  // Day-bucketed series across the active month so we get a smooth sparkline
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    range: 'month',
    start,
    end,
    prevStart,
    prevEnd,
    bucket: 'day',
    buckets: daysInMonth,
    seriesStart: start,
  };
}

function buildSeriesBuckets({ bucket, buckets, seriesStart }) {
  const out = [];
  if (bucket === 'hour') {
    for (let i = 0; i < buckets; i++) {
      const d = addHours(seriesStart, i);
      out.push({
        key: hourKey(d),
        label: HOUR_LABEL(d.getHours()),
        date: d.toISOString(),
        revenue: 0,
        payments: 0,
      });
    }
  } else if (bucket === 'day') {
    for (let i = 0; i < buckets; i++) {
      const d = addDays(seriesStart, i);
      out.push({
        key: dayKey(d),
        label: `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`,
        date: d.toISOString(),
        revenue: 0,
        payments: 0,
      });
    }
  } else {
    for (let i = 0; i < buckets; i++) {
      const d = new Date(seriesStart.getFullYear(), seriesStart.getMonth() + i, 1);
      out.push({
        key: monthKey(d),
        label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        date: d.toISOString(),
        revenue: 0,
        payments: 0,
      });
    }
  }
  return out;
}

function bucketKeyFor(bucket, date) {
  if (bucket === 'hour') return hourKey(date);
  if (bucket === 'day') return dayKey(date);
  return monthKey(date);
}

function pctChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) {
    if (c === 0) return { kind: 'flat', percent: 0 };
    return { kind: 'up', percent: null };
  }
  const pct = ((c - p) / p) * 100;
  if (Math.abs(pct) < 0.05) return { kind: 'flat', percent: 0 };
  return { kind: pct > 0 ? 'up' : 'down', percent: round2(pct) };
}

const PREVIOUS_LABEL = {
  today: 'vs yesterday',
  week: 'vs previous 7 days',
  month: 'vs last month',
  year: 'vs last year',
};

/* ---------- /summary ---------- */
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range } = req.validatedQuery;
  const now = new Date();
  const r = resolveRange(range, now);

  const [
    totalCustomers,
    totalInvoices,
    paidCount,
    unpaidCount,
    overdueCount,
    customersInRange,
    invoicesInRange,
    customersInPrev,
    invoicesInPrev,
    revenueAllAgg,
    revenueRangeAgg,
    revenuePrevAgg,
    paymentsCountRange,
    paymentsCountPrev,
    unpaidAgg,
    paymentsForChart,
  ] = await Promise.all([
    prisma.customer.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId, status: 'PAID' } }),
    prisma.invoice.count({ where: { userId, status: 'UNPAID' } }),
    prisma.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
    }),
    prisma.customer.count({
      where: { userId, createdAt: { gte: r.start, lte: r.end } },
    }),
    prisma.invoice.count({
      where: { userId, createdAt: { gte: r.start, lte: r.end } },
    }),
    prisma.customer.count({
      where: { userId, createdAt: { gte: r.prevStart, lt: r.prevEnd } },
    }),
    prisma.invoice.count({
      where: { userId, createdAt: { gte: r.prevStart, lt: r.prevEnd } },
    }),
    prisma.payment.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { userId, paymentDate: { gte: r.start, lte: r.end } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { userId, paymentDate: { gte: r.prevStart, lt: r.prevEnd } },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: { userId, paymentDate: { gte: r.start, lte: r.end } },
    }),
    prisma.payment.count({
      where: { userId, paymentDate: { gte: r.prevStart, lt: r.prevEnd } },
    }),
    prisma.invoice.aggregate({
      where: { userId, status: 'UNPAID' },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.payment.findMany({
      where: { userId, paymentDate: { gte: r.seriesStart, lte: r.end } },
      select: { amount: true, paymentDate: true },
    }),
  ]);

  const totalRevenue = round2(Number(revenueAllAgg._sum.amount || 0));
  const rangeRevenue = round2(Number(revenueRangeAgg._sum.amount || 0));
  const prevRevenue = round2(Number(revenuePrevAgg._sum.amount || 0));
  const outstanding = round2(
    Math.max(
      0,
      Number(unpaidAgg._sum.totalAmount || 0) -
        Number(unpaidAgg._sum.paidAmount || 0)
    )
  );

  // Build sparkline series based on the range's bucket plan
  const series = buildSeriesBuckets(r);
  const seriesByKey = new Map(series.map((b) => [b.key, b]));
  for (const p of paymentsForChart) {
    const key = bucketKeyFor(r.bucket, p.paymentDate);
    const bucket = seriesByKey.get(key);
    if (bucket) {
      bucket.revenue += Number(p.amount) || 0;
      bucket.payments += 1;
    }
  }
  const sparkline = series.map((b) => ({
    label: b.label,
    revenue: round2(b.revenue),
  }));

  const pendingCount = Math.max(0, unpaidCount - overdueCount);
  const previousLabel = PREVIOUS_LABEL[r.range] || PREVIOUS_LABEL.month;

  // Smart insights
  const insights = [];
  const revDelta = pctChange(rangeRevenue, prevRevenue);
  if (revDelta.percent != null && revDelta.kind !== 'flat') {
    insights.push({
      kind: revDelta.kind === 'up' ? 'positive' : 'warning',
      icon: revDelta.kind === 'up' ? 'trend-up' : 'trend-down',
      label:
        revDelta.kind === 'up'
          ? `Revenue grew ${Math.abs(revDelta.percent).toFixed(1)}% ${previousLabel}`
          : `Revenue dipped ${Math.abs(revDelta.percent).toFixed(1)}% ${previousLabel}`,
    });
  } else if (rangeRevenue > 0 && prevRevenue === 0) {
    insights.push({
      kind: 'positive',
      icon: 'trend-up',
      label: 'Fresh revenue this period — keep the momentum going.',
    });
  }
  if (overdueCount > 0) {
    insights.push({
      kind: 'warning',
      icon: 'alert',
      label: `${overdueCount} overdue ${overdueCount === 1 ? 'invoice needs' : 'invoices need'} attention`,
    });
  }
  if (paymentsCountRange > 0) {
    insights.push({
      kind: 'positive',
      icon: 'check',
      label: `${paymentsCountRange} payment${paymentsCountRange === 1 ? '' : 's'} received this period`,
    });
  }
  if (insights.length === 0) {
    insights.push({
      kind: 'neutral',
      icon: 'sparkle',
      label: 'No activity yet for this range — try creating a new invoice.',
    });
  }

  res.json({
    success: true,
    data: {
      range: r.range,
      previousLabel,
      totals: {
        totalRevenue,
        totalCustomers,
        totalInvoices,
        paidCount,
        unpaidCount,
        overdueCount,
        pendingCount,
        outstanding,
      },
      current: {
        revenue: rangeRevenue,
        invoices: invoicesInRange,
        customers: customersInRange,
        payments: paymentsCountRange,
        outstanding,
      },
      previous: {
        revenue: prevRevenue,
        invoices: invoicesInPrev,
        customers: customersInPrev,
        payments: paymentsCountPrev,
      },
      delta: {
        revenue: pctChange(rangeRevenue, prevRevenue),
        invoices: pctChange(invoicesInRange, invoicesInPrev),
        customers: pctChange(customersInRange, customersInPrev),
        payments: pctChange(paymentsCountRange, paymentsCountPrev),
      },
      sparkline,
      insights,
    },
  });
});

/* ---------- /revenue ---------- */
const getRevenue = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range } = req.validatedQuery;
  const r = resolveRange(range);

  const [paymentsForChart, invoicesForChart] = await Promise.all([
    prisma.payment.findMany({
      where: { userId, paymentDate: { gte: r.seriesStart, lte: r.end } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.invoice.findMany({
      where: { userId, createdAt: { gte: r.seriesStart, lte: r.end } },
      select: { totalAmount: true, createdAt: true },
    }),
  ]);

  const series = buildSeriesBuckets(r);
  const byKey = new Map(series.map((b) => [b.key, b]));

  for (const p of paymentsForChart) {
    const key = bucketKeyFor(r.bucket, p.paymentDate);
    const bucket = byKey.get(key);
    if (bucket) bucket.payments += Number(p.amount) || 0;
  }
  for (const inv of invoicesForChart) {
    const key = bucketKeyFor(r.bucket, inv.createdAt);
    const bucket = byKey.get(key);
    if (bucket) bucket.revenue += Number(inv.totalAmount) || 0;
  }

  const data = series.map((b) => ({
    label: b.label,
    date: b.date,
    revenue: round2(b.revenue),
    payments: round2(b.payments),
  }));

  res.json({
    success: true,
    data: { range: r.range, bucket: r.bucket, series: data },
  });
});

/* ---------- /recent-invoices ---------- */
const getRecentInvoices = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit } = req.validatedQuery;

  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { customer: { select: { id: true, name: true } } },
  });

  res.json({ success: true, data: { invoices } });
});

/* ---------- /invoice-status ---------- */
const getInvoiceStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  const [paid, unpaid, overdue, total] = await Promise.all([
    prisma.invoice.count({ where: { userId, status: 'PAID' } }),
    prisma.invoice.count({ where: { userId, status: 'UNPAID' } }),
    prisma.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
    }),
    prisma.invoice.count({ where: { userId } }),
  ]);

  const pending = Math.max(0, unpaid - overdue);
  res.json({
    success: true,
    data: {
      breakdown: { paid, pending, overdue },
      total,
    },
  });
});

/* ---------- /top-customers ---------- */
const getTopCustomers = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range, limit } = req.validatedQuery;
  const r = resolveRange(range);

  const grouped = await prisma.payment.groupBy({
    by: ['invoiceId'],
    where: { userId, paymentDate: { gte: r.start, lte: r.end } },
    _sum: { amount: true },
  });
  if (grouped.length === 0) {
    return res.json({ success: true, data: { customers: [] } });
  }

  const invoiceIds = grouped.map((g) => g.invoiceId);
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: {
      id: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
    },
  });
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

  const totals = new Map();
  for (const g of grouped) {
    const inv = invoiceById.get(g.invoiceId);
    if (!inv) continue;
    const id = inv.customerId;
    const existing = totals.get(id) || {
      customerId: id,
      name: inv.customer?.name || 'Unknown',
      paid: 0,
      invoiceCount: 0,
    };
    existing.paid += Number(g._sum.amount) || 0;
    existing.invoiceCount += 1;
    totals.set(id, existing);
  }

  const customers = Array.from(totals.values())
    .map((c) => ({ ...c, paid: round2(c.paid) }))
    .filter((c) => c.paid > 0)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, limit);

  res.json({ success: true, data: { customers } });
});

/* ---------- /activity ---------- */
const getActivity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit } = req.validatedQuery;

  const [invoices, payments, messages] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        method: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.whatsAppMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        kind: true,
        status: true,
        phone: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customer: { select: { id: true, name: true } },
          },
        },
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  const items = [];
  for (const inv of invoices) {
    items.push({
      id: `inv-${inv.id}`,
      type: 'invoice_created',
      createdAt: inv.createdAt,
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: Number(inv.totalAmount) || 0,
      },
      customer: inv.customer,
    });
  }
  for (const p of payments) {
    items.push({
      id: `pay-${p.id}`,
      type: 'payment_received',
      createdAt: p.createdAt,
      payment: {
        id: p.id,
        amount: Number(p.amount) || 0,
        method: p.method,
      },
      invoice: p.invoice
        ? {
            id: p.invoice.id,
            invoiceNumber: p.invoice.invoiceNumber,
          }
        : null,
      customer: p.invoice?.customer || null,
    });
  }
  for (const m of messages) {
    items.push({
      id: `msg-${m.id}`,
      type:
        m.kind === 'REMINDER'
          ? 'reminder_sent'
          : m.kind === 'INVOICE'
            ? 'invoice_sent'
            : 'message_sent',
      createdAt: m.createdAt,
      message: { id: m.id, kind: m.kind, status: m.status, phone: m.phone },
      invoice: m.invoice
        ? {
            id: m.invoice.id,
            invoiceNumber: m.invoice.invoiceNumber,
          }
        : null,
      customer: m.customer || m.invoice?.customer || null,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({ success: true, data: { items: items.slice(0, limit) } });
});

/* ---------- /alerts ---------- */
const getAlerts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit } = req.validatedQuery;
  const now = new Date();
  const sevenDaysAgo = addDays(startOfDay(now), -7);

  const [
    overdueCount,
    pendingCount,
    recentPaymentsCount,
    overdueInvoices,
    pendingInvoices,
    recentPayments,
  ] = await Promise.all([
    prisma.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
    }),
    prisma.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
        OR: [{ dueDate: null }, { dueDate: { gte: now } }],
      },
    }),
    prisma.payment.count({
      where: { userId, paymentDate: { gte: sevenDaysAgo, lte: now } },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        status: 'UNPAID',
        OR: [{ dueDate: null }, { dueDate: { gte: now } }],
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { userId, paymentDate: { gte: sevenDaysAgo, lte: now } },
      orderBy: { paymentDate: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        method: true,
        paymentDate: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      counts: {
        overdue: overdueCount,
        pending: pendingCount,
        recentPayments: recentPaymentsCount,
      },
      overdue: overdueInvoices,
      pending: pendingInvoices,
      recentPayments,
    },
  });
});

/* ---------- /stats (legacy) ---------- */
const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    totalCustomers,
    totalInvoices,
    paidCount,
    unpaidCount,
    overdueCount,
    customersThisMonth,
    invoicesThisMonth,
    invoiceTotalsAgg,
    unpaidAgg,
    revenueAllAgg,
    revenueMonthAgg,
    revenueLastMonthAgg,
    invoicedBeforeMonthAgg,
    paymentsBeforeMonthAgg,
    paymentsForChart,
    invoicesForCustomers,
    recentInvoices,
  ] = await Promise.all([
    prisma.customer.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId, status: 'PAID' } }),
    prisma.invoice.count({ where: { userId, status: 'UNPAID' } }),
    prisma.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { not: null, lt: now },
      },
    }),
    prisma.customer.count({
      where: { userId, createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.invoice.count({
      where: { userId, createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.invoice.aggregate({
      where: { userId },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { userId, status: 'UNPAID' },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        userId,
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        userId,
        paymentDate: { gte: lastMonthStart, lt: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { userId, createdAt: { lt: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { userId, paymentDate: { lt: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { userId, paymentDate: { gte: seriesStart, lt: monthEnd } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.invoice.findMany({
      where: { userId, paidAmount: { gt: 0 } },
      select: {
        customerId: true,
        paidAmount: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  const totalRevenue = round2(Number(revenueAllAgg._sum.amount || 0));
  const monthRevenue = round2(Number(revenueMonthAgg._sum.amount || 0));
  const lastMonthRevenue = round2(
    Number(revenueLastMonthAgg._sum.amount || 0)
  );
  const invoicedTotal = round2(Number(invoiceTotalsAgg._sum.totalAmount || 0));
  const outstanding = round2(
    Number(unpaidAgg._sum.totalAmount || 0) -
      Number(unpaidAgg._sum.paidAmount || 0)
  );
  const lastMonthOutstanding = Math.max(
    0,
    round2(
      Number(invoicedBeforeMonthAgg._sum.totalAmount || 0) -
        Number(paymentsBeforeMonthAgg._sum.amount || 0)
    )
  );

  const pendingCount = Math.max(0, unpaidCount - overdueCount);
  const invoiceStatusBreakdown = {
    paid: paidCount,
    pending: pendingCount,
    overdue: overdueCount,
  };

  const buckets = buildMonthBuckets(now, 12);
  for (const p of paymentsForChart) {
    const key = monthKey(p.paymentDate);
    if (buckets[key]) {
      buckets[key].revenue += Number(p.amount) || 0;
    }
  }
  const monthlyRevenue = Object.values(buckets).map((b) => ({
    month: b.month,
    label: b.label,
    revenue: round2(b.revenue),
  }));

  const customerTotals = new Map();
  for (const inv of invoicesForCustomers) {
    const id = inv.customerId;
    const existing = customerTotals.get(id) || {
      customerId: id,
      name: inv.customer.name,
      paid: 0,
      invoiceCount: 0,
    };
    existing.paid += Number(inv.paidAmount) || 0;
    existing.invoiceCount += 1;
    customerTotals.set(id, existing);
  }
  const topCustomers = Array.from(customerTotals.values())
    .map((c) => ({ ...c, paid: round2(c.paid) }))
    .filter((c) => c.paid > 0)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 5);

  res.json({
    success: true,
    data: {
      stats: {
        totalCustomers,
        totalInvoices,
        paidCount,
        unpaidCount,
        overdueCount,
        pendingCount,
        customersThisMonth,
        invoicesThisMonth,
        invoicedTotal,
        totalRevenue,
        monthRevenue,
        lastMonthRevenue,
        outstanding,
        lastMonthOutstanding,
      },
      invoiceStatusBreakdown,
      monthlyRevenue,
      topCustomers,
      recentInvoices,
    },
  });
});

module.exports = {
  getStats,
  getSummary,
  getRevenue,
  getRecentInvoices,
  getInvoiceStatus,
  getTopCustomers,
  getActivity,
  getAlerts,
};
