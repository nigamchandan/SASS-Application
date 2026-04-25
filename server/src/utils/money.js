function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function computeLineItem({ quantity, price, tax }) {
  const qty = Number(quantity) || 0;
  const unit = Number(price) || 0;
  const taxPct = Number(tax) || 0;

  const amount = round2(qty * unit);
  const taxValue = round2(amount * (taxPct / 100));
  const total = round2(amount + taxValue);

  return { quantity: qty, price: unit, tax: taxPct, amount, taxValue, total };
}

function computeInvoiceTotals(items) {
  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const taxAmount = round2(items.reduce((s, i) => s + i.taxValue, 0));
  const totalAmount = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, totalAmount };
}

module.exports = { round2, computeLineItem, computeInvoiceTotals };
