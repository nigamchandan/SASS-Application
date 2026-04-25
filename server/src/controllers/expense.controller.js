const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const { sendCsv, isoDate } = require('../utils/csv');
const { streamPdfReport, fmtINR, fmtDate } = require('../utils/pdfReport');

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthBuckets(now, count = 6) {
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      month: monthKey(d),
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      total: 0,
      count: 0,
    });
  }
  return buckets;
}

function buildWhere(userId, q) {
  const where = { userId };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { description: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  if (q.category) where.category = q.category;
  if (q.dateFrom || q.dateTo) {
    where.date = {};
    if (q.dateFrom) where.date.gte = new Date(q.dateFrom);
    if (q.dateTo) {
      // Make dateTo inclusive — interpret as end of that day
      const to = new Date(q.dateTo);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }
  return where;
}

const list = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const q = req.validatedQuery;
  const where = buildWhere(userId, q);

  const [total, items, totalAggregate] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { [q.sortBy]: q.sortOrder },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  res.json({
    success: true,
    data: {
      expenses: items,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      },
      filteredTotal: round2(Number(totalAggregate._sum.amount || 0)),
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, category, amount, date, description } = req.body;

  const expense = await prisma.expense.create({
    data: {
      userId,
      title,
      category,
      amount: round2(amount),
      date: new Date(date),
      description: description || null,
    },
  });

  res.status(201).json({ success: true, data: { expense } });
});

const getOne = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const expense = await prisma.expense.findFirst({ where: { id, userId } });
  if (!expense) throw new ApiError(404, 'Expense not found');
  res.json({ success: true, data: { expense } });
});

const update = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, 'Expense not found');

  const data = {};
  const allowed = ['title', 'category', 'amount', 'date', 'description'];
  for (const k of allowed) {
    if (k in req.body) data[k] = req.body[k];
  }
  if ('amount' in data) data.amount = round2(data.amount);
  if ('date' in data) data.date = new Date(data.date);
  if ('description' in data && data.description === '') data.description = null;

  const expense = await prisma.expense.update({ where: { id }, data });
  res.json({ success: true, data: { expense } });
});

const remove = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, 'Expense not found');
  await prisma.expense.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});

const summary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 6 months

  const [
    totalAllAgg,
    countAll,
    monthAgg,
    monthCount,
    lastMonthAgg,
    monthExpenses,
    categoryBreakdownRaw,
  ] = await Promise.all([
    prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.expense.count({ where: { userId } }),
    prisma.expense.aggregate({
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.expense.count({
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.expense.aggregate({
      where: { userId, date: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: { userId, date: { gte: seriesStart, lt: monthEnd } },
      select: { amount: true, date: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalAll = round2(Number(totalAllAgg._sum.amount || 0));
  const totalThisMonth = round2(Number(monthAgg._sum.amount || 0));
  const totalLastMonth = round2(Number(lastMonthAgg._sum.amount || 0));
  let percentageChange = 0;
  if (totalLastMonth === 0) {
    percentageChange = totalThisMonth > 0 ? 100 : 0;
  } else {
    percentageChange = round2(
      ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
    );
  }

  // Build month buckets (last 6 months)
  const buckets = buildMonthBuckets(now, 6);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of monthExpenses) {
    const key = monthKey(e.date);
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.total += Number(e.amount) || 0;
      bucket.count += 1;
    }
  }
  const byMonth = buckets.map((b) => ({
    month: b.month,
    label: b.label,
    total: round2(b.total),
    count: b.count,
  }));

  // Category breakdown for this month
  const byCategory = categoryBreakdownRaw
    .map((c) => ({
      category: c.category,
      total: round2(Number(c._sum.amount || 0)),
      count: c._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  res.json({
    success: true,
    data: {
      total_this_month: totalThisMonth,
      total_last_month: totalLastMonth,
      percentage_change: percentageChange,
      total_all_time: totalAll,
      count_all_time: countAll,
      count_this_month: monthCount,
      by_month: byMonth,
      by_category: byCategory,
    },
  });
});

const exportCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const where = buildWhere(userId, {
    q: (req.query.q || '').toString().trim(),
    category: (req.query.category || '').toString().trim(),
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
  });

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const rows = expenses.map((e) => [
    isoDate(e.date),
    e.title,
    e.category,
    round2(e.amount),
    e.description || '',
  ]);

  const filename = `bizautomate-expenses-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  sendCsv(
    res,
    filename,
    ['Date', 'Title', 'Category', 'Amount', 'Description'],
    rows
  );
});

const exportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const filters = {
    q: (req.query.q || '').toString().trim(),
    category: (req.query.category || '').toString().trim(),
    dateFrom: req.query.dateFrom ? req.query.dateFrom.toString() : null,
    dateTo: req.query.dateTo ? req.query.dateTo.toString() : null,
  };
  const where = buildWhere(userId, filters);

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    select: { businessName: true, email: true },
  });
  const business = {
    name: profile?.businessName || req.user.name,
    email: profile?.email || req.user.email,
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCategory = expenses.reduce((m, e) => {
    m[e.category] = (m[e.category] || 0) + Number(e.amount || 0);
    return m;
  }, {});
  const topCategory = Object.entries(byCategory).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const subtitleBits = [];
  if (filters.category) subtitleBits.push(`category: ${filters.category}`);
  if (filters.dateFrom || filters.dateTo) {
    subtitleBits.push(
      `${filters.dateFrom || '...'} to ${filters.dateTo || '...'}`
    );
  }
  if (filters.q) subtitleBits.push(`matching "${filters.q}"`);

  const filename = `bizautomate-expenses-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  streamPdfReport(res, {
    filename,
    title: 'Expenses',
    subtitle:
      `${expenses.length} expense${expenses.length === 1 ? '' : 's'}` +
      (subtitleBits.length ? ` · ${subtitleBits.join(' · ')}` : ''),
    business,
    kpis: [
      { label: 'Entries', value: String(expenses.length) },
      { label: 'Total spend', value: fmtINR(total) },
      {
        label: 'Top category',
        value: topCategory ? topCategory[0] : '-',
      },
      {
        label: 'Top spend',
        value: topCategory ? fmtINR(topCategory[1]) : fmtINR(0),
      },
    ],
    columns: [
      { key: 'date', label: 'Date', width: 1, format: fmtDate },
      { key: 'title', label: 'Title', width: 2 },
      { key: 'category', label: 'Category', width: 1.2 },
      {
        key: 'amount',
        label: 'Amount',
        width: 1.1,
        align: 'right',
        format: fmtINR,
      },
      { key: 'description', label: 'Description', width: 1.8 },
    ],
    rows: expenses,
    totals: [{ label: 'Total expenses', value: fmtINR(total) }],
    emptyMessage: 'No expenses match the current filters.',
  });
});

module.exports = { list, create, getOne, update, remove, summary, exportCsv, exportPdf };
