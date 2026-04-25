const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const { streamPdfReport, fmtINR, fmtDate } = require('../utils/pdfReport');

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  x.setMilliseconds(-1);
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth()+n, d.getDate()); }
function diffDays(a, b) { return Math.round((b - a) / 86400000); }

/**
 * Resolve a `range` keyword (or `custom` with `from`/`to`) to a concrete
 * { start, end } window plus a previous-period { prevStart, prevEnd } for
 * comparison KPIs.
 */
function resolveRange({ range, from, to }) {
  const now = new Date();
  let start;
  let end;

  switch (range) {
    case 'this_month':
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case 'last_month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = startOfMonth(lm);
      end = endOfMonth(lm);
      break;
    }
    case 'last_3_months':
      start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      end = endOfDay(now);
      break;
    case 'last_6_months':
      start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      end = endOfDay(now);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end = endOfDay(now);
      break;
    case 'last_year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    case 'all':
      start = new Date(2000, 0, 1);
      end = endOfDay(now);
      break;
    case 'custom':
      start = from ? startOfDay(new Date(from)) : startOfMonth(now);
      end = to ? endOfDay(new Date(to)) : endOfDay(now);
      if (end < start) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      break;
    default:
      start = startOfMonth(now);
      end = endOfMonth(now);
  }

  // Previous period of equal length, immediately before the current window.
  const len = end - start;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - len);

  return { start, end, prevStart, prevEnd };
}

function chooseGranularity(start, end, requested = 'auto') {
  if (requested === 'day' || requested === 'month') return requested;
  const days = Math.max(1, diffDays(start, end));
  return days <= 35 ? 'day' : 'month';
}

function dateKey(d, gran) {
  if (gran === 'day') {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }
  // month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateLabel(d, gran) {
  if (gran === 'day') {
    return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
  }
  return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function buildBuckets(start, end, gran) {
  const buckets = [];
  if (gran === 'day') {
    let cur = startOfDay(start);
    const last = startOfDay(end);
    while (cur <= last) {
      buckets.push({
        key: dateKey(cur, 'day'),
        label: dateLabel(cur, 'day'),
        revenue: 0,
        expenses: 0,
      });
      cur = addDays(cur, 1);
    }
  } else {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      buckets.push({
        key: dateKey(cur, 'month'),
        label: dateLabel(cur, 'month'),
        revenue: 0,
        expenses: 0,
      });
      cur = addMonths(cur, 1);
    }
  }
  return buckets;
}

function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return round2(((curr - prev) / prev) * 100);
}

async function gatherWindow(userId, start, end) {
  const [paymentsAgg, expensesAgg, paymentsList, expensesList, invoicesInRange] =
    await Promise.all([
      prisma.payment.aggregate({
        where: { userId, paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.expense.aggregate({
        where: { userId, date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: { userId, paymentDate: { gte: start, lte: end } },
        select: { amount: true, paymentDate: true },
      }),
      prisma.expense.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: { amount: true, date: true },
      }),
      prisma.invoice.findMany({
        where: { userId, issueDate: { gte: start, lte: end } },
        select: { taxAmount: true, totalAmount: true, status: true },
      }),
    ]);

  return {
    revenue: round2(Number(paymentsAgg._sum.amount || 0)),
    paymentCount: paymentsAgg._count._all,
    expenses: round2(Number(expensesAgg._sum.amount || 0)),
    expenseCount: expensesAgg._count._all,
    paymentsList,
    expensesList,
    invoicesInRange,
  };
}

const summary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range, from, to, granularity } = req.validatedQuery;
  const { start, end, prevStart, prevEnd } = resolveRange({ range, from, to });
  const gran = chooseGranularity(start, end, granularity || 'auto');

  // Run heavy queries in parallel: current window + previous window for
  // delta KPIs, plus by-category and top-customers (current window only).
  const now = new Date();
  const [
    cur,
    prev,
    expensesByCategoryRaw,
    topCustomersRaw,
    invoicesByStatus,
    overdueInvoicesAgg,
  ] = await Promise.all([
    gatherWindow(userId, start, end),
    gatherWindow(userId, prevStart, prevEnd),
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId, date: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['invoiceId'],
      where: { userId, paymentDate: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { userId, issueDate: { gte: start, lte: end } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { lt: now },
        issueDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
  ]);

  // Build per-bucket revenue + expenses time series
  const buckets = buildBuckets(start, end, gran);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const p of cur.paymentsList) {
    const k = dateKey(p.paymentDate, gran);
    const b = byKey.get(k);
    if (b) b.revenue += Number(p.amount) || 0;
  }
  for (const e of cur.expensesList) {
    const k = dateKey(e.date, gran);
    const b = byKey.get(k);
    if (b) b.expenses += Number(e.amount) || 0;
  }
  const series = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    revenue: round2(b.revenue),
    expenses: round2(b.expenses),
    profit: round2(b.revenue - b.expenses),
  }));

  // GST / tax for invoices issued in this window
  const taxAmount = round2(
    cur.invoicesInRange.reduce(
      (s, i) => s + (Number(i.taxAmount) || 0),
      0
    )
  );
  const invoicedAmount = round2(
    cur.invoicesInRange.reduce(
      (s, i) => s + (Number(i.totalAmount) || 0),
      0
    )
  );

  const profit = round2(cur.revenue - cur.expenses);
  const margin =
    cur.revenue > 0 ? round2((profit / cur.revenue) * 100) : 0;
  const prevProfit = round2(prev.revenue - prev.expenses);

  const expensesByCategory = expensesByCategoryRaw
    .map((c) => ({
      category: c.category,
      total: round2(Number(c._sum.amount || 0)),
      count: c._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  // Resolve top customers from invoiceId aggregations
  let topCustomers = [];
  if (topCustomersRaw.length > 0) {
    const invoiceIds = topCustomersRaw.map((r) => r.invoiceId);
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: {
        id: true,
        customerId: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    const invMap = new Map(invoices.map((i) => [i.id, i]));
    const tally = new Map();
    for (const r of topCustomersRaw) {
      const inv = invMap.get(r.invoiceId);
      if (!inv) continue;
      const cust = inv.customer;
      if (!cust) continue;
      const cur = tally.get(cust.id) || {
        id: cust.id,
        name: cust.name,
        email: cust.email,
        phone: cust.phone,
        revenue: 0,
        invoiceCount: 0,
      };
      cur.revenue += Number(r._sum.amount || 0);
      cur.invoiceCount += 1;
      tally.set(cust.id, cur);
    }
    topCustomers = Array.from(tally.values())
      .map((c) => ({ ...c, revenue: round2(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  // Invoice status counts (PAID / UNPAID / OVERDUE)
  let paidCount = 0;
  let paidTotal = 0;
  let unpaidCount = 0;
  let unpaidTotal = 0;
  for (const row of invoicesByStatus) {
    const total = Number(row._sum.totalAmount || 0);
    if (row.status === 'PAID') {
      paidCount += row._count._all;
      paidTotal += total;
    } else {
      unpaidCount += row._count._all;
      unpaidTotal += total;
    }
  }
  const overdueCount = overdueInvoicesAgg._count._all || 0;
  const overdueTotal = round2(
    Number(overdueInvoicesAgg._sum.totalAmount || 0) -
      Number(overdueInvoicesAgg._sum.paidAmount || 0)
  );
  const totalInvoices = paidCount + unpaidCount;

  res.json({
    success: true,
    data: {
      range: {
        key: range,
        from: start.toISOString(),
        to: end.toISOString(),
        prevFrom: prevStart.toISOString(),
        prevTo: prevEnd.toISOString(),
        granularity: gran,
      },
      kpis: {
        revenue: cur.revenue,
        revenue_prev: prev.revenue,
        revenue_pct: pctChange(cur.revenue, prev.revenue),
        expenses: cur.expenses,
        expenses_prev: prev.expenses,
        expenses_pct: pctChange(cur.expenses, prev.expenses),
        profit,
        profit_prev: prevProfit,
        profit_pct: pctChange(profit, prevProfit),
        margin,
        tax: taxAmount,
        invoiced: invoicedAmount,
        payment_count: cur.paymentCount,
        expense_count: cur.expenseCount,
        invoice_count: totalInvoices,
      },
      series,
      expenses_by_category: expensesByCategory,
      top_customers: topCustomers,
      invoice_status: {
        total: totalInvoices,
        paid: { count: paidCount, total: round2(paidTotal) },
        unpaid: { count: unpaidCount, total: round2(unpaidTotal) },
        overdue: { count: overdueCount, total: overdueTotal },
      },
    },
  });
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range, from, to, granularity } = req.validatedQuery;
  const { start, end } = resolveRange({ range, from, to });
  const gran = chooseGranularity(start, end, granularity || 'auto');

  const cur = await gatherWindow(userId, start, end);
  const buckets = buildBuckets(start, end, gran);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const p of cur.paymentsList) {
    const b = byKey.get(dateKey(p.paymentDate, gran));
    if (b) b.revenue += Number(p.amount) || 0;
  }
  for (const e of cur.expensesList) {
    const b = byKey.get(dateKey(e.date, gran));
    if (b) b.expenses += Number(e.amount) || 0;
  }
  const series = buckets.map((b) => ({
    label: b.label,
    revenue: round2(b.revenue),
    expenses: round2(b.expenses),
    profit: round2(b.revenue - b.expenses),
  }));

  const expensesByCategoryRaw = await prisma.expense.groupBy({
    by: ['category'],
    where: { userId, date: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const profit = round2(cur.revenue - cur.expenses);
  const margin =
    cur.revenue > 0 ? round2((profit / cur.revenue) * 100) : 0;

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [];
  lines.push(`Report,${range}`);
  lines.push(`From,${start.toISOString().slice(0, 10)}`);
  lines.push(`To,${end.toISOString().slice(0, 10)}`);
  lines.push(`Granularity,${gran}`);
  lines.push('');
  lines.push('=== KPIs ===');
  lines.push('Metric,Value');
  lines.push(`Revenue,${cur.revenue}`);
  lines.push(`Expenses,${cur.expenses}`);
  lines.push(`Net Profit,${profit}`);
  lines.push(`Margin %,${margin}`);
  lines.push(`Payments,${cur.paymentCount}`);
  lines.push(`Expense entries,${cur.expenseCount}`);
  lines.push('');
  lines.push('=== Revenue vs Expenses ===');
  lines.push('Period,Revenue,Expenses,Profit');
  for (const s of series) {
    lines.push(
      `${escape(s.label)},${s.revenue},${s.expenses},${s.profit}`
    );
  }
  lines.push('');
  lines.push('=== Expenses by Category ===');
  lines.push('Category,Total,Count');
  for (const c of expensesByCategoryRaw) {
    lines.push(
      `${escape(c.category)},${round2(Number(c._sum.amount || 0))},${c._count._all}`
    );
  }

  const filename = `bizautomate-report-${range}-${start
    .toISOString()
    .slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.send(lines.join('\n'));
});

const RANGE_LABELS = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  this_year: 'This year',
  last_year: 'Last year',
  all: 'All time',
  custom: 'Custom range',
};

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range, from, to, granularity } = req.validatedQuery;
  const { start, end, prevStart, prevEnd } = resolveRange({ range, from, to });
  const gran = chooseGranularity(start, end, granularity || 'auto');
  const now = new Date();

  const [
    cur,
    prev,
    expensesByCategoryRaw,
    topCustomersRaw,
    invoicesByStatus,
    overdueAgg,
  ] = await Promise.all([
    gatherWindow(userId, start, end),
    gatherWindow(userId, prevStart, prevEnd),
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId, date: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['invoiceId'],
      where: { userId, paymentDate: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { userId, issueDate: { gte: start, lte: end } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: {
        userId,
        status: 'UNPAID',
        dueDate: { lt: now },
        issueDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),
  ]);

  const profit = round2(cur.revenue - cur.expenses);
  const margin = cur.revenue > 0 ? round2((profit / cur.revenue) * 100) : 0;
  const taxAmount = round2(
    cur.invoicesInRange.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0)
  );

  const expensesByCategory = expensesByCategoryRaw
    .map((c) => ({
      category: c.category,
      total: round2(Number(c._sum.amount || 0)),
      count: c._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  // Top customers
  let topCustomers = [];
  if (topCustomersRaw.length > 0) {
    const invoiceIds = topCustomersRaw.map((r) => r.invoiceId);
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, customer: { select: { id: true, name: true } } },
    });
    const invMap = new Map(invoices.map((i) => [i.id, i]));
    const tally = new Map();
    for (const r of topCustomersRaw) {
      const inv = invMap.get(r.invoiceId);
      if (!inv?.customer) continue;
      const cust = inv.customer;
      const ctr = tally.get(cust.id) || {
        id: cust.id,
        name: cust.name,
        revenue: 0,
        invoiceCount: 0,
      };
      ctr.revenue += Number(r._sum.amount || 0);
      ctr.invoiceCount += 1;
      tally.set(cust.id, ctr);
    }
    topCustomers = Array.from(tally.values())
      .map((c) => ({ ...c, revenue: round2(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  let paidCount = 0;
  let paidTotal = 0;
  let unpaidCount = 0;
  let unpaidTotal = 0;
  for (const row of invoicesByStatus) {
    const total = Number(row._sum.totalAmount || 0);
    if (row.status === 'PAID') {
      paidCount += row._count._all;
      paidTotal += total;
    } else {
      unpaidCount += row._count._all;
      unpaidTotal += total;
    }
  }
  const overdueCount = overdueAgg._count._all || 0;
  const overdueTotal = round2(
    Number(overdueAgg._sum.totalAmount || 0) -
      Number(overdueAgg._sum.paidAmount || 0)
  );

  const PDFDocument = require('pdfkit');
  const PAGE_MARGIN = 40;
  const PAGE_WIDTH = 595.28;
  const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    bufferPages: true,
  });

  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    select: { businessName: true, email: true },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
  };

  const filename = `bizautomate-report-${range}-${start
    .toISOString()
    .slice(0, 10)}_${end.toISOString().slice(0, 10)}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/[^\w.-]+/g, '_')}"`
  );
  doc.pipe(res);

  // === Header ===
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#0f172a')
    .text('Business Report', PAGE_MARGIN, PAGE_MARGIN);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#64748b')
    .text(
      `${RANGE_LABELS[range] || range}  ·  ${fmtDate(start)} – ${fmtDate(end)}`,
      PAGE_MARGIN,
      doc.y + 2
    );

  const rightX = PAGE_MARGIN + USABLE_WIDTH * 0.55;
  const rightW = USABLE_WIDTH * 0.45;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0f172a')
    .text(business.name, rightX, PAGE_MARGIN, { width: rightW, align: 'right' });
  if (business.email) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(business.email, rightX, doc.y + 1, {
        width: rightW,
        align: 'right',
      });
  }
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(`Generated ${new Date().toLocaleString('en-IN')}`, rightX, doc.y + 1, {
      width: rightW,
      align: 'right',
    });

  doc.y = Math.max(doc.y, 105);
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + USABLE_WIDTH, doc.y)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke();
  doc.y += 14;

  // === KPI cards (2x4 grid) ===
  const kpis = [
    { label: 'Revenue', value: fmtINR(cur.revenue), sub: `vs ${fmtINR(prev.revenue)} prev` },
    { label: 'Expenses', value: fmtINR(cur.expenses), sub: `vs ${fmtINR(prev.expenses)} prev` },
    { label: 'Net Profit', value: fmtINR(profit), sub: `${margin}% margin` },
    { label: 'Tax Collected', value: fmtINR(taxAmount), sub: `${cur.invoicesInRange.length} invoices` },
    { label: 'Payments', value: String(cur.paymentCount), sub: 'in window' },
    { label: 'Invoices Paid', value: String(paidCount), sub: fmtINR(paidTotal) },
    { label: 'Invoices Unpaid', value: String(unpaidCount), sub: fmtINR(unpaidTotal) },
    { label: 'Invoices Overdue', value: String(overdueCount), sub: fmtINR(overdueTotal) },
  ];
  const cols = 4;
  const rows = Math.ceil(kpis.length / cols);
  const cardW = USABLE_WIDTH / cols;
  const cardH = 64;
  const kpiTop = doc.y;
  kpis.forEach((kpi, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = PAGE_MARGIN + c * cardW;
    const y = kpiTop + r * (cardH + 6);
    doc
      .roundedRect(x + 2, y, cardW - 4, cardH, 6)
      .fillColor('#f8fafc')
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .fillAndStroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(kpi.label, x + 10, y + 8, { width: cardW - 20 });
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#0f172a')
      .text(kpi.value, x + 10, y + 22, { width: cardW - 20 });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(kpi.sub, x + 10, y + 44, { width: cardW - 20 });
  });
  doc.y = kpiTop + rows * (cardH + 6) + 14;

  // === Expenses by Category section ===
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text('Expenses by Category', PAGE_MARGIN, doc.y);
  doc.y += 8;

  const totalCatSpend = expensesByCategory.reduce((s, c) => s + c.total, 0);
  if (expensesByCategory.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text('No expenses in this period.', PAGE_MARGIN, doc.y);
    doc.y += 18;
  } else {
    const headerY = doc.y;
    doc
      .rect(PAGE_MARGIN, headerY, USABLE_WIDTH, 22)
      .fillColor('#f1f5f9')
      .fill();
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text('Category', PAGE_MARGIN + 8, headerY + 7, { width: 220 })
      .text('Entries', PAGE_MARGIN + 240, headerY + 7, {
        width: 80,
        align: 'right',
      })
      .text('Total', PAGE_MARGIN + 330, headerY + 7, {
        width: 100,
        align: 'right',
      })
      .text('Share', PAGE_MARGIN + 440, headerY + 7, {
        width: 70,
        align: 'right',
      });
    doc.y = headerY + 22;

    expensesByCategory.forEach((cat, idx) => {
      const top = doc.y;
      if (idx % 2 === 1) {
        doc
          .rect(PAGE_MARGIN, top, USABLE_WIDTH, 20)
          .fillColor('#f8fafc')
          .fill();
      }
      const share =
        totalCatSpend > 0
          ? `${Math.round((cat.total / totalCatSpend) * 100)}%`
          : '-';
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(cat.category, PAGE_MARGIN + 8, top + 6, { width: 220 })
        .text(String(cat.count), PAGE_MARGIN + 240, top + 6, {
          width: 80,
          align: 'right',
        })
        .text(fmtINR(cat.total), PAGE_MARGIN + 330, top + 6, {
          width: 100,
          align: 'right',
        })
        .text(share, PAGE_MARGIN + 440, top + 6, {
          width: 70,
          align: 'right',
        });
      doc
        .moveTo(PAGE_MARGIN, top + 20)
        .lineTo(PAGE_MARGIN + USABLE_WIDTH, top + 20)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();
      doc.y = top + 20;
    });
    doc.y += 10;
  }

  // === Top customers section ===
  if (doc.y > 700) {
    doc.addPage();
    doc.y = PAGE_MARGIN;
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text('Top Customers by Revenue', PAGE_MARGIN, doc.y);
  doc.y += 8;

  if (topCustomers.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text('No customer revenue in this period.', PAGE_MARGIN, doc.y);
    doc.y += 18;
  } else {
    const headerY = doc.y;
    doc
      .rect(PAGE_MARGIN, headerY, USABLE_WIDTH, 22)
      .fillColor('#f1f5f9')
      .fill();
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text('Customer', PAGE_MARGIN + 8, headerY + 7, { width: 280 })
      .text('Invoices Paid', PAGE_MARGIN + 300, headerY + 7, {
        width: 100,
        align: 'right',
      })
      .text('Revenue', PAGE_MARGIN + 410, headerY + 7, {
        width: 100,
        align: 'right',
      });
    doc.y = headerY + 22;

    topCustomers.forEach((c, idx) => {
      const top = doc.y;
      if (idx % 2 === 1) {
        doc
          .rect(PAGE_MARGIN, top, USABLE_WIDTH, 20)
          .fillColor('#f8fafc')
          .fill();
      }
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(c.name, PAGE_MARGIN + 8, top + 6, { width: 280 })
        .text(String(c.invoiceCount), PAGE_MARGIN + 300, top + 6, {
          width: 100,
          align: 'right',
        })
        .text(fmtINR(c.revenue), PAGE_MARGIN + 410, top + 6, {
          width: 100,
          align: 'right',
        });
      doc
        .moveTo(PAGE_MARGIN, top + 20)
        .lineTo(PAGE_MARGIN + USABLE_WIDTH, top + 20)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();
      doc.y = top + 20;
    });
  }

  // === Footer page numbers ===
  const range2 = doc.bufferedPageRange();
  for (let i = range2.start; i < range2.start + range2.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        `Page ${i - range2.start + 1} of ${range2.count} · BizAutomate · ${
          RANGE_LABELS[range] || range
        }`,
        PAGE_MARGIN,
        841 - PAGE_MARGIN + 10,
        { width: USABLE_WIDTH, align: 'center' }
      );
  }

  doc.end();
});

module.exports = { summary, exportCsv, exportPdf };
