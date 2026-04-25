export const formatCurrency = (amount, currency = 'INR') => {
  const value = Number(amount) || 0;
  try {
    return value.toLocaleString('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (_e) {
    return `Rs. ${value.toFixed(2)}`;
  }
};

export const formatDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_e) {
    return '-';
  }
};
