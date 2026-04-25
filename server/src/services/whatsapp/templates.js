const formatINR = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function buildInvoiceMessage({ invoice, customer, business }) {
  const lines = [
    `Hi ${customer.name},`,
    '',
    `Here is your invoice ${invoice.invoiceNumber} from ${business.name || 'us'}.`,
    `Total: ${formatINR(invoice.totalAmount)}`,
  ];
  const due = formatDate(invoice.dueDate);
  if (due) lines.push(`Due date: ${due}`);
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount || 0);
  if (balance > 0 && Number(invoice.paidAmount) > 0) {
    lines.push(`Paid: ${formatINR(invoice.paidAmount)}`);
    lines.push(`Balance: ${formatINR(balance)}`);
  }
  lines.push('');
  lines.push('Thanks for your business!');
  if (business.name) lines.push(`- ${business.name}`);
  return lines.join('\n');
}

function buildReminderMessage({ invoice, customer, business }) {
  const balance = Math.max(
    0,
    Number(invoice.totalAmount) - Number(invoice.paidAmount || 0)
  );
  const due = formatDate(invoice.dueDate);
  const lines = [
    `Hi ${customer.name},`,
    '',
    `This is a friendly reminder about invoice ${invoice.invoiceNumber}.`,
    `Outstanding balance: ${formatINR(balance)}`,
  ];
  if (due) lines.push(`Due date: ${due}`);
  lines.push('');
  lines.push('Please make the payment at your earliest convenience.');
  lines.push('Thanks!');
  if (business.name) lines.push(`- ${business.name}`);
  return lines.join('\n');
}

module.exports = { buildInvoiceMessage, buildReminderMessage };
