const prisma = require('../lib/prisma');

async function getInvoicePrefix(userId, tx = prisma) {
  const profile = await tx.businessProfile.findUnique({
    where: { userId },
    select: { invoicePrefix: true },
  });
  const raw = profile?.invoicePrefix?.trim();
  return raw && raw.length > 0 ? raw : 'INV';
}

async function generateInvoiceNumber(userId, tx = prisma) {
  const year = new Date().getFullYear();
  const userPrefix = await getInvoicePrefix(userId, tx);
  const prefix = `${userPrefix}-${year}-`;

  const last = await tx.invoice.findFirst({
    where: { userId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (last) {
    const tail = last.invoiceNumber.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

module.exports = { generateInvoiceNumber, getInvoicePrefix };
