/**
 * Seeds production-style demo data across every section.
 *   - 10 customers (skipped if same phone already exists)
 *   - 10 invoices (mix of paid / partial / overdue / unpaid)
 *   - Payments are added inline as part of paid / partial invoices
 *   - 10 expenses spread across recent months
 *   - 6 WhatsApp messages (3 INVOICE + 3 REMINDER, mock provider)
 *
 * Usage:   node src/scripts/seed_demo_data.js [email]
 * Default email: nigam@gmail.com
 *
 * Notes:
 *   - DOES NOT delete existing data.
 *   - Re-runnable: existing customers (matched by phone) are reused, invoice
 *     numbers auto-increment, expenses just append.
 */

const prisma = require('../lib/prisma');
const { computeLineItem, computeInvoiceTotals, round2 } = require('../utils/money');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');

const TARGET_EMAIL = process.argv[2] || 'nigam@gmail.com';

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};

// ---------------------------------------------------------------------------
// Customers — realistic Indian SMB profiles
// ---------------------------------------------------------------------------
const CUSTOMERS = [
  {
    name: 'Nair & Sons Catering',
    phone: '+91 98410 11221',
    email: 'orders@nairsoncatering.in',
    gstNumber: '33AAACN1122B1Z5',
    address: '12, Anna Salai, Chennai 600002, TN',
  },
  {
    name: 'Bhavna Sharma',
    phone: '+91 98998 55102',
    email: 'bhavna.sharma@designstudio.in',
    gstNumber: null,
    address: 'B-204, DLF Phase 4, Gurugram 122009, HR',
  },
  {
    name: 'RK Auto Spares Pvt Ltd',
    phone: '+91 99220 78410',
    email: 'accounts@rkautospares.co.in',
    gstNumber: '27AABCR1188Q1ZK',
    address: 'Shop 18, Lamington Road, Mumbai 400007, MH',
  },
  {
    name: 'Cafe Kalimirch',
    phone: '+91 87654 32109',
    email: 'hello@kalimirch.cafe',
    gstNumber: '29AAACK4467F1Z3',
    address: '110, Indiranagar 100ft Rd, Bengaluru 560038, KA',
  },
  {
    name: 'Lakshmi Boutique',
    phone: '+91 90041 56781',
    email: 'lakshmiboutique@gmail.com',
    gstNumber: null,
    address: '7-A, Pondy Bazaar, T. Nagar, Chennai 600017, TN',
  },
  {
    name: 'Mehta Tax Services',
    phone: '+91 93207 11456',
    email: 'admin@mehtatax.in',
    gstNumber: '24AAFCM3344K1Z9',
    address: '402, Iscon Mega Mall, Ahmedabad 380015, GJ',
  },
  {
    name: 'Quick Print Hub',
    phone: '+91 88002 33415',
    email: 'sales@quickprinthub.in',
    gstNumber: '07AAGCQ4421L1Z2',
    address: 'Shop 56, Nehru Place, New Delhi 110019, DL',
  },
  {
    name: 'Spectra IT Solutions',
    phone: '+91 70090 88421',
    email: 'finance@spectra-it.com',
    gstNumber: '29AAGCS9988T1ZK',
    address: 'Module 12, ITPL Whitefield, Bengaluru 560066, KA',
  },
  {
    name: 'Aarav Plumbing & Sanitary',
    phone: '+91 96321 47896',
    email: 'aarav.plumbing@yahoo.in',
    gstNumber: null,
    address: '14, Sadar Bazar, Jaipur 302001, RJ',
  },
  {
    name: 'Greenleaf Organic Farms',
    phone: '+91 73879 11220',
    email: 'orders@greenleaforganics.in',
    gstNumber: '36AAGCG5511H1Z2',
    address: 'Plot 9, Outer Ring Rd, Hyderabad 500032, TS',
  },
];

// ---------------------------------------------------------------------------
// Invoices — keyed by customer phone so we can resolve customer ids at runtime.
// Each entry decides outcome via `kind`:
//   PAID      → fully paid + Payment record
//   PARTIAL   → partially paid (~50%) + Payment record (status remains UNPAID)
//   UNPAID    → recent unpaid invoice (no payments)
//   OVERDUE   → unpaid with dueDate in the past
// ---------------------------------------------------------------------------
const INVOICES = [
  {
    customerPhone: '+91 98410 11221',
    issueDaysAgo: 12,
    dueDaysAgo: -3,
    kind: 'PAID',
    paymentMethod: 'UPI',
    paymentNote: 'Settled via PhonePe',
    notes: 'Wedding lunch — 250 plates',
    items: [
      { itemName: 'Veg meals (per plate)',    quantity: 180, price: 320, tax: 5 },
      { itemName: 'Non-veg meals (per plate)',quantity: 70,  price: 460, tax: 5 },
      { itemName: 'Service staff',            quantity: 6,   price: 1200, tax: 18 },
    ],
  },
  {
    customerPhone: '+91 98998 55102',
    issueDaysAgo: 8,
    dueDaysAgo: -7,
    kind: 'PARTIAL',
    paymentMethod: 'BANK',
    paymentNote: 'Advance for milestone 1',
    notes: 'Logo + brand guideline package',
    items: [
      { itemName: 'Brand discovery workshop', quantity: 1, price: 18000, tax: 18 },
      { itemName: 'Logo concepts + revisions',quantity: 1, price: 32000, tax: 18 },
    ],
  },
  {
    customerPhone: '+91 99220 78410',
    issueDaysAgo: 21,
    dueDaysAgo: -6,
    kind: 'PAID',
    paymentMethod: 'BANK',
    paymentNote: 'NEFT received',
    notes: 'Bulk parts supply order #4421',
    items: [
      { itemName: 'Brake pads (set)',  quantity: 40, price: 850,  tax: 18 },
      { itemName: 'Air filter element',quantity: 60, price: 320,  tax: 18 },
      { itemName: 'Engine oil 5L',     quantity: 25, price: 1450, tax: 18 },
    ],
  },
  {
    customerPhone: '+91 87654 32109',
    issueDaysAgo: 5,
    dueDaysAgo: -10,
    kind: 'UNPAID',
    notes: 'Crockery rental for July events',
    items: [
      { itemName: 'Plates (per dozen)', quantity: 25, price: 280, tax: 12 },
      { itemName: 'Glassware set',      quantity: 8,  price: 950, tax: 12 },
    ],
  },
  {
    customerPhone: '+91 90041 56781',
    issueDaysAgo: 35,
    dueDaysAgo: 10, // due 10 days ago → overdue
    kind: 'OVERDUE',
    notes: 'Festive collection — payment overdue',
    items: [
      { itemName: 'Cotton sarees (festive lot)', quantity: 12, price: 1850, tax: 5 },
      { itemName: 'Embroidery work charges',     quantity: 1,  price: 4500, tax: 18 },
    ],
  },
  {
    customerPhone: '+91 93207 11456',
    issueDaysAgo: 18,
    dueDaysAgo: -2,
    kind: 'PAID',
    paymentMethod: 'CHEQUE',
    paymentNote: 'Cheque #884122 cleared',
    notes: 'Annual GST filing retainer',
    items: [
      { itemName: 'GST returns filing (12 mo)', quantity: 1, price: 36000, tax: 18 },
      { itemName: 'TDS quarterly filings',      quantity: 4, price: 2500,  tax: 18 },
    ],
  },
  {
    customerPhone: '+91 88002 33415',
    issueDaysAgo: 45,
    dueDaysAgo: 20, // overdue
    kind: 'OVERDUE',
    notes: 'Brochure printing — payment pending',
    items: [
      { itemName: 'A4 colour brochure (4-page)', quantity: 2000, price: 14, tax: 12 },
      { itemName: 'Lamination + binding',         quantity: 200,  price: 35, tax: 12 },
    ],
  },
  {
    customerPhone: '+91 70090 88421',
    issueDaysAgo: 3,
    dueDaysAgo: -27,
    kind: 'UNPAID',
    notes: 'AMC invoice — Q1 software support',
    items: [
      { itemName: 'On-site engineer (hours)', quantity: 24, price: 1500, tax: 18 },
      { itemName: 'Cloud monitoring license', quantity: 1,  price: 12000, tax: 18 },
    ],
  },
  {
    customerPhone: '+91 96321 47896',
    issueDaysAgo: 9,
    dueDaysAgo: -1,
    kind: 'PARTIAL',
    paymentMethod: 'CASH',
    paymentNote: 'Part payment received in cash',
    notes: 'Bathroom fittings replacement job',
    items: [
      { itemName: 'Faucet (premium series)',  quantity: 4, price: 2200, tax: 18 },
      { itemName: 'Plumbing labour (hours)',  quantity: 6, price: 600,  tax: 0  },
    ],
  },
  {
    customerPhone: '+91 73879 11220',
    issueDaysAgo: 14,
    dueDaysAgo: -16,
    kind: 'PAID',
    paymentMethod: 'CARD',
    paymentNote: 'Razorpay txn pay_KSdh22',
    notes: 'Weekly produce supply — week 12',
    items: [
      { itemName: 'Organic vegetables (kg)', quantity: 220, price: 65,  tax: 0 },
      { itemName: 'Cold-pressed oil 1L',     quantity: 30,  price: 540, tax: 5 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Expenses — realistic categories spread across recent months
// ---------------------------------------------------------------------------
const EXPENSES = [
  { title: 'Office Rent — Apr 2026',  category: 'Rent',            amount: 28000, dateOffset: -4,  description: 'April rent paid to landlord' },
  { title: 'Office Rent — Mar 2026',  category: 'Rent',            amount: 28000, dateOffset: -34, description: 'March rent paid to landlord' },
  { title: 'Electricity Bill',        category: 'Utilities',       amount: 1685,  dateOffset: -6,  description: 'BESCOM Apr cycle' },
  { title: 'Internet — 100 Mbps',     category: 'Utilities',       amount: 1199,  dateOffset: -3,  description: 'ACT Fibernet' },
  { title: 'Adobe Creative Cloud',    category: 'Software',        amount: 4999,  dateOffset: -10, description: 'Annual subscription' },
  { title: 'Google Workspace',        category: 'Software',        amount: 2160,  dateOffset: -15, description: '12 seats × monthly' },
  { title: 'Team Lunch — Sprint Kickoff', category: 'Food & Drinks', amount: 3450, dateOffset: -7,  description: 'Pizza + drinks for the team' },
  { title: 'Cab to Client (Whitefield)', category: 'Travel',       amount: 720,   dateOffset: -2,  description: 'Onsite client meeting' },
  { title: 'Bangalore Trip — Spectra', category: 'Travel',         amount: 9450,  dateOffset: -22, description: 'Flight + 1N stay' },
  { title: 'Facebook Ads — April Boost', category: 'Marketing',    amount: 6500,  dateOffset: -8,  description: 'Lead gen campaign' },
  { title: 'Office Supplies',          category: 'Office Supplies', amount: 1820,  dateOffset: -18, description: 'Printer paper, pens, files' },
  { title: 'Laptop Maintenance',       category: 'Maintenance',     amount: 2500,  dateOffset: -28, description: 'Service + RAM upgrade' },
];

// ---------------------------------------------------------------------------
// WhatsApp message seeds — keyed by 0-based index into the just-created
// invoices list. Each emits one message record using the mock provider.
// ---------------------------------------------------------------------------
const WHATSAPP_MESSAGES = [
  { invoiceIdx: 0, kind: 'INVOICE',  status: 'SENT',   ageDaysAgo: 12, body: 'Hi Nair & Sons, your invoice for the wedding lunch is ready. Total ₹{TOTAL}. View attached PDF.' },
  { invoiceIdx: 2, kind: 'INVOICE',  status: 'SENT',   ageDaysAgo: 21, body: 'Hi RK Auto, please find your bulk supply invoice. Amount ₹{TOTAL}.' },
  { invoiceIdx: 4, kind: 'INVOICE',  status: 'SENT',   ageDaysAgo: 35, body: 'Lakshmi Boutique — your festive collection invoice is attached. Amount ₹{TOTAL}.' },
  { invoiceIdx: 4, kind: 'REMINDER', status: 'SENT',   ageDaysAgo: 5,  body: 'Friendly reminder: invoice {NUM} of ₹{TOTAL} is now overdue. Please settle at your earliest.' },
  { invoiceIdx: 6, kind: 'REMINDER', status: 'QUEUED', ageDaysAgo: 1,  body: 'Quick Print Hub — invoice {NUM} for ₹{TOTAL} is past its due date. Kindly process payment.' },
  { invoiceIdx: 1, kind: 'INVOICE',  status: 'SENT',   ageDaysAgo: 8,  body: 'Hi Bhavna, share the brand kit deposit invoice — milestone 1 of ₹{TOTAL} is attached.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ensureCustomer(userId, c) {
  const existing = await prisma.customer.findFirst({
    where: { userId, phone: c.phone },
    select: { id: true, name: true },
  });
  if (existing) return { customer: existing, created: false };
  const customer = await prisma.customer.create({
    data: { ...c, userId },
  });
  return { customer, created: true };
}

async function createInvoiceWithItems(userId, spec, customerId) {
  const items = spec.items.map(computeLineItem).map((c, i) => ({
    itemName: spec.items[i].itemName,
    ...c,
  }));
  const totals = computeInvoiceTotals(items);
  const issueDate = daysAgo(spec.issueDaysAgo);
  const dueDate = daysAgo(spec.dueDaysAgo);

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(userId, tx);

    const invoice = await tx.invoice.create({
      data: {
        userId,
        customerId,
        invoiceNumber,
        notes: spec.notes,
        issueDate,
        dueDate,
        status: 'UNPAID',
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paidAmount: 0,
        items: {
          create: items.map((it) => ({
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
      include: { customer: true },
    });

    let paymentAmount = 0;
    if (spec.kind === 'PAID') {
      paymentAmount = totals.totalAmount;
    } else if (spec.kind === 'PARTIAL') {
      paymentAmount = round2(totals.totalAmount * 0.5);
    }

    if (paymentAmount > 0) {
      await tx.payment.create({
        data: {
          userId,
          invoiceId: invoice.id,
          amount: paymentAmount,
          method: spec.paymentMethod || 'UPI',
          note: spec.paymentNote || null,
          paymentDate: daysAgo(Math.max(spec.issueDaysAgo - 2, 1)),
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: paymentAmount,
          status: paymentAmount + 1e-6 >= totals.totalAmount ? 'PAID' : 'UNPAID',
        },
      });
    }

    return invoice;
  });
}

async function createWhatsAppMessage(userId, invoice, spec) {
  const body = spec.body
    .replace('{TOTAL}', Math.round(invoice.totalAmount).toLocaleString('en-IN'))
    .replace('{NUM}', invoice.invoiceNumber);
  await prisma.whatsAppMessage.create({
    data: {
      userId,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      phone: invoice.customer?.phone || '+91 0000000000',
      message: body,
      kind: spec.kind,
      status: spec.status,
      provider: 'mock',
      providerMessageId: `mock_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      createdAt: daysAgo(spec.ageDaysAgo),
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.error(`User not found for email: ${TARGET_EMAIL}`);
    console.error('Pass an existing email as the first argument, e.g.:');
    console.error('  node src/scripts/seed_demo_data.js you@example.com');
    process.exit(1);
  }

  console.log(`\nSeeding demo data for: ${TARGET_EMAIL}`);
  console.log('---------------------------------------------------------');

  // 1. Customers
  const customerByPhone = new Map();
  let createdCustomers = 0;
  for (const c of CUSTOMERS) {
    const { customer, created } = await ensureCustomer(user.id, c);
    customerByPhone.set(c.phone, customer);
    if (created) createdCustomers += 1;
  }
  console.log(
    `Customers   : ${createdCustomers} new / ${CUSTOMERS.length - createdCustomers} already existed`
  );

  // 2. Invoices (always additive)
  const createdInvoices = [];
  for (const spec of INVOICES) {
    const cust = customerByPhone.get(spec.customerPhone);
    if (!cust) {
      console.warn(`  ! customer not found for phone ${spec.customerPhone}, skipping invoice`);
      continue;
    }
    const inv = await createInvoiceWithItems(user.id, spec, cust.id);
    createdInvoices.push(inv);
  }
  const paidCount = INVOICES.filter((i) => i.kind === 'PAID').length;
  const partialCount = INVOICES.filter((i) => i.kind === 'PARTIAL').length;
  const overdueCount = INVOICES.filter((i) => i.kind === 'OVERDUE').length;
  const unpaidCount = INVOICES.filter((i) => i.kind === 'UNPAID').length;
  console.log(
    `Invoices    : ${createdInvoices.length} created  (${paidCount} paid · ${partialCount} partial · ${overdueCount} overdue · ${unpaidCount} unpaid)`
  );
  console.log(
    `Payments    : ${paidCount + partialCount} created  (auto-linked to paid + partial invoices)`
  );

  // 3. Expenses (always additive)
  const expenseRows = EXPENSES.map((e) => ({
    userId: user.id,
    title: e.title,
    category: e.category,
    amount: round2(e.amount),
    date: daysAgo(Math.abs(e.dateOffset)),
    description: e.description || null,
  }));
  await prisma.expense.createMany({ data: expenseRows });
  console.log(`Expenses    : ${expenseRows.length} created`);

  // 4. WhatsApp messages (always additive)
  let waCount = 0;
  for (const spec of WHATSAPP_MESSAGES) {
    const inv = createdInvoices[spec.invoiceIdx];
    if (!inv) continue;
    await createWhatsAppMessage(user.id, inv, spec);
    waCount += 1;
  }
  console.log(`WhatsApp    : ${waCount} messages created (mock provider)`);

  console.log('---------------------------------------------------------');
  console.log('Done. Refresh the app to see the new data.\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
