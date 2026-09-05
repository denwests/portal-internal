function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatScheduleDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
}

export function formatScheduleTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}.${match[2]}` : "-";
}

export function getScheduleHeading(bookingDate, today = new Date()) {
  const todayKey = localDateKey(today);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  if (bookingDate === todayKey) return "Jadwal Foto Hari Ini 📸";
  if (bookingDate === tomorrowKey) return "Jadwal Foto Besok 📸";
  return `Jadwal Foto ${formatScheduleDate(bookingDate)} 📸`;
}

function buildBookingDetails(booking) {
  return [
    `Tanggal & Waktu : ${formatScheduleTime(booking?.start_time)} - ${formatScheduleDate(booking?.booking_date)}`,
    `Nama Client : ${booking?.customer_name || "-"}`,
    `Paket : ${booking?.package || "-"}`,
    `Notes : ${booking?.notes || "-"}`,
  ].join("\n");
}

export function buildBookingScheduleMessage(booking, today = new Date()) {
  return `${getScheduleHeading(booking?.booking_date, today)}\n\n${buildBookingDetails(booking)}`;
}

export function buildBookingScheduleMessages(bookings, today = new Date()) {
  const grouped = new Map();
  for (const booking of bookings || []) {
    const date = booking?.booking_date || "";
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(booking);
  }
  return Array.from(grouped.entries())
    .map(([date, dateBookings]) => [
      getScheduleHeading(date, today),
      "",
      dateBookings.map(buildBookingDetails).join("\n\n"),
    ].join("\n"))
    .join("\n\n──────────\n\n");
}
