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
