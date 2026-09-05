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
const dashboardSource = await readFile(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8");
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
  assert.match(nightStyles, /#root \.booking-calendar-card \.calendar-day \{[\s\S]*?min-height: 62px !important/);
  assert.match(nightStyles, /#root \.booking-calendar-card \.calendar-header \{[\s\S]*?min-height: 40px !important/);
});

test("dashboard calendar uses booking dots and the day-detail overlay", () => {
  assert.match(dashboardSource, /className="calendar-booking-dots"/);
  assert.match(dashboardSource, /dayBookings\.slice\(0, 3\)/);
  assert.match(dashboardSource, /className="dashboard-schedule-overlay"/);
  assert.match(dashboardSource, /if \(!day \|\| !dayBookings\.length\) return/);
  assert.doesNotMatch(dashboardSource, /className="calendar-booking"/);
});

test("dashboard booking detail keeps equal cards and visible values", async () => {
  const dashboardStyles = await readFile(new URL("../src/pages/Dashboard.css", import.meta.url), "utf8");

  assert.match(dashboardStyles, /\.dashboard-schedule-detail-grid\{[\s\S]*?grid-auto-rows:90px/);
  assert.match(dashboardStyles, /\.dashboard-schedule-detail-grid strong\{[\s\S]*?color:#f4f4f1/);
  assert.match(dashboardStyles, /\.dashboard-schedule-notes p\{[\s\S]*?color:#f4f4f1/);
  assert.match(dashboardStyles, /\.dashboard-schedule-detail-grid\{[\s\S]*?gap:12px/);
});

test("dashboard revenue and booking columns share the same bottom edge", async () => {
  const dashboardStyles = await readFile(new URL("../src/pages/Dashboard.css", import.meta.url), "utf8");

  assert.match(dashboardStyles, /\.dashboard-content-grid\{[\s\S]*?align-items:stretch/);
  assert.match(dashboardStyles, /\.dashboard-left-stack\{[\s\S]*?height:100%/);
  assert.match(dashboardStyles, /\.booking-calendar-card\{[\s\S]*?height:100%/);
  assert.match(dashboardStyles, /\.revenue-card\{[\s\S]*?height:100%/);
});
