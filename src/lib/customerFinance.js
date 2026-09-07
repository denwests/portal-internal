export function customerFinanceToRevenueRow(customer) {
  return {
    id: `customer-${customer.id}`,
    customer_id: customer.id,
    customer: customer.name || "",
    description: customer.package || "Customer final value",
    payment_type: "Customer Final Value",
    payment_method:
      Number(customer.total_mdr_value || 0) > 0
        ? "Includes MDR"
        : "No MDR",
    transaction_date: customer.date || null,
    revenue_date: customer.date || null,
    amount: Number(customer.total_package_value || 0),
    mdr_amount: Number(customer.total_mdr_value || 0),
    net_amount: Number(customer.total_net_value || 0),
    linked_transaction_count: Number(
      customer.linked_transaction_count || 0
    ),
    reconciliation_status:
      customer.reconciliation_status || "not_calculated",
  };
}

export function summarizeCustomerFinance(customers) {
  return (customers || []).reduce(
    (summary, customer) => ({
      customerCount: summary.customerCount + 1,
      totalPackageValue:
        summary.totalPackageValue +
        Number(customer.totalPackageValue || 0),
      totalMdrValue:
        summary.totalMdrValue +
        Number(customer.totalMdrValue || 0),
      totalNetValue:
        summary.totalNetValue +
        Number(customer.totalNetValue || 0),
    }),
    {
      customerCount: 0,
      totalPackageValue: 0,
      totalMdrValue: 0,
      totalNetValue: 0,
    }
  );
}

export function buildCustomerNetRevenueSeries(customers, year) {
  const series = Array(12).fill(0);
  const yearPrefix = `${Number(year)}-`;

  for (const customer of customers || []) {
    const date = String(customer.date || "");
    if (!date.startsWith(yearPrefix)) continue;

    const monthIndex = Number(date.slice(5, 7)) - 1;
    if (monthIndex < 0 || monthIndex > 11) continue;

    series[monthIndex] += Number(
      customer.total_net_value ?? customer.totalNetValue ?? 0
    );
  }

  return series;
}
