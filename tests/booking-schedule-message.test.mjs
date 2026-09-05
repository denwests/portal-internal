import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBookingScheduleMessage,
  buildBookingScheduleMessages,
  formatScheduleDate,
  formatScheduleTime,
  getScheduleHeading,
} from "../src/lib/bookingScheduleMessage.js";

const bookingPageSource = await readFile(new URL("../src/pages/Booking.jsx", import.meta.url), "utf8");
const nightStyles = await readFile(new URL("../src/pluno-night.css", import.meta.url), "utf8");

test("booking schedule message follows the WhatsApp-ready format", () => {
  const message = buildBookingScheduleMessage({
    booking_date: "2026-09-05",
    start_time: "13:00:00",
    customer_name: "ichan",
    package: "Basic Group",
    notes: "21 (cowo 4, sisanya cewe) background putih",
  }, new Date(2026, 8, 4, 10, 0));

  assert.equal(message, [
    "Jadwal Foto Besok 📸",
    "",
    "Tanggal & Waktu : 13.00 - 05/09/2026",
    "Nama Client : ichan",
    "Paket : Basic Group",
    "Notes : 21 (cowo 4, sisanya cewe) background putih",
  ].join("\n"));
});

test("booking schedule helpers remain numeric and date-aware", () => {
  assert.equal(formatScheduleDate("2026-09-05"), "05/09/2026");
  assert.equal(formatScheduleTime("08:30:00"), "08.30");
  assert.equal(getScheduleHeading("2026-09-04", new Date(2026, 8, 4, 8, 0)), "Jadwal Foto Hari Ini 📸");
  assert.equal(getScheduleHeading("2026-09-08", new Date(2026, 8, 4, 8, 0)), "Jadwal Foto 08/09/2026 📸");
});

test("booking list copies row information instead of the current URL", () => {
  assert.match(bookingPageSource, /copyBookingInfo\(booking\)/);
  assert.match(bookingPageSource, /Copy Info/);
  assert.doesNotMatch(bookingPageSource, /const shareUrl = window\.location\.href/);
});

test("copy all schedule joins every selected-date booking", () => {
  const bookings = [
    { booking_date: "2026-09-05", start_time: "09:00", customer_name: "A", package: "Basic", notes: "One" },
    { booking_date: "2026-09-05", start_time: "13:30", customer_name: "B", package: "Group", notes: "Two" },
  ];
  const message = buildBookingScheduleMessages(bookings, new Date(2026, 8, 4, 10, 0));
  assert.match(message, /Nama Client : A/);
  assert.match(message, /Nama Client : B/);
  assert.equal((message.match(/Jadwal Foto Besok 📸/g) || []).length, 1);
});

test("dashboard booking schedule uses compact calendar dimensions", () => {
  assert.match(nightStyles, /#root \.booking-calendar-card \.calendar-day \{[\s\S]*?min-height: 58px !important/);
  assert.match(nightStyles, /#root \.booking-calendar-card \.calendar-header \{[\s\S]*?min-height: 40px !important/);
});
