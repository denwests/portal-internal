export function getActiveBookingDeposit(booking) {
  if (
    !booking ||
    booking.status === "Canceled" ||
    booking.payment_status === "Paid"
  ) return 0;

  const paidAmount = Number(
    booking.paid_amount || booking.down_payment || 0
  );
  const packagePrice = Number(booking.package_price || 0);

  if (paidAmount <= 0 || (packagePrice > 0 && paidAmount >= packagePrice)) {
    return 0;
  }

  return paidAmount;
}

export function sumActiveBookingDeposits(bookings) {
  return (bookings || []).reduce(
    (total, booking) => total + getActiveBookingDeposit(booking),
    0
  );
}
