export function getRevenueDate(transaction) {
  return transaction?.revenue_date || transaction?.transaction_date || null;
}

export function isRevenueInMonth(transaction, year, month) {
  const revenueDate = getRevenueDate(transaction);

  if (!revenueDate) return false;

  return (
    revenueDate.slice(0, 4) === String(year) &&
    revenueDate.slice(5, 7) === String(month).padStart(2, "0")
  );
}

export function isRevenueInRange(transaction, fromDate, toDate) {
  const revenueDate = getRevenueDate(transaction);

  if (!revenueDate || !fromDate || !toDate) return false;

  return revenueDate >= fromDate && revenueDate <= toDate;
}
