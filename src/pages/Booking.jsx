import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Booking.css";


/* =========================================================
   HELPERS
========================================================= */

const BOOKINGS_PER_PAGE = 10;

function getTodayParts() {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const lastDay = String(
    new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate()
  ).padStart(2, "0");

  return {
    year,
    month,
    date: `${year}-${month}-${day}`,
    monthStart: `${year}-${month}-01`,
    monthEnd: `${year}-${month}-${lastDay}`,
  };
}

function getInitialPeriodFilter() {
  const current = getTodayParts();
  const params = new URLSearchParams(window.location.search);
  const requestedType = params.get("period");

  const type = ["date", "month", "year"].includes(requestedType)
    ? requestedType
    : "date";

  /* Backward compatible with old shared links using ?date=YYYY-MM-DD */
  const requestedSingleDate = params.get("date");
  const requestedStartDate = params.get("start");
  const requestedEndDate = params.get("end");
  const requestedMonth = params.get("month");
  const requestedYear = params.get("year");

  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "");

  const fallbackStart = validDate(requestedSingleDate)
    ? requestedSingleDate
    : current.monthStart;

  const fallbackEnd = validDate(requestedSingleDate)
    ? requestedSingleDate
    : current.monthEnd;

  const startDate = validDate(requestedStartDate)
    ? requestedStartDate
    : fallbackStart;

  const endDate = validDate(requestedEndDate)
    ? requestedEndDate
    : fallbackEnd;

  return {
    type,
    startDate: startDate <= endDate ? startDate : endDate,
    endDate: startDate <= endDate ? endDate : startDate,
    month: /^(0[1-9]|1[0-2])$/.test(requestedMonth || "")
      ? requestedMonth
      : current.month,
    year: /^\d{4}$/.test(requestedYear || "")
      ? requestedYear
      : current.year,
  };
}

function formatNumberInput(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const numeric = String(value).replace(/\D/g, "");
  if (!numeric) return "";

  return Number(numeric).toLocaleString("id-ID");
}

function parseMoney(value) {
  return Number(String(value || "0").replace(/\D/g, "")) || 0;
}

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatDate(date) {
  if (!date) return "-";

  const parsed = new Date(`${date}T00:00:00`);

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) return "-";
  return String(time).substring(0, 5);
}

function getPaymentStatus(packagePrice, paidAmount) {
  const price = Number(packagePrice || 0);
  const paid = Number(paidAmount || 0);

  if (paid <= 0) return "Unpaid";
  if (price > 0 && paid >= price) return "Paid";
  return "Partial";
}

function calculateMdr(amount, paymentMethod) {
  const gross = Number(amount || 0);

  /*
   * Fixed QRIS MDR rule:
   * - Cash = 0%
   * - QRIS up to Rp500.000 = 0%
   * - QRIS above Rp500.000 = 0.3%
   *
   * The rule is based on the amount of each payment transaction,
   * not on the total package price.
   */
  const percentage =
    paymentMethod === "QRIS" && gross > 500000
      ? 0.3
      : 0;

  const mdrAmount = Math.round(
    gross * (percentage / 100)
  );

  return {
    percentage,
    mdrAmount,
    netAmount: gross - mdrAmount,
  };
}


function Booking() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [payingBooking, setPayingBooking] = useState(null);

  const [periodFilter, setPeriodFilter] = useState(
    getInitialPeriodFilter
  );
  const [shareCopied, setShareCopied] = useState(false);

  const [settlementMethod, setSettlementMethod] = useState("Cash");

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    bookingDate: "",
    startTime: "",
    packageName: "",
    packagePrice: "",
    status: "Complete",
    notes: "",
    initialPayment: "",
    paymentMethod: "Cash",
  });


  /* =========================================================
     STATIC OPTIONS
  ========================================================= */

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const timeOptions = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      timeOptions.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      );
    }
  }


  /* =========================================================
     FETCH
  ========================================================= */

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("BOOKING FETCH ERROR:", error);
      setErrorMessage(`Gagal mengambil data booking: ${error.message}`);
      setBookings([]);
    } else {
      setBookings(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  /* =========================================================
     PERIOD FILTER + SHARE LINK
  ========================================================= */

  const bookingYears = bookings
    .map((booking) =>
      booking.booking_date
        ? booking.booking_date.substring(0, 4)
        : null
    )
    .filter(Boolean);

  const currentYear = new Date().getFullYear();

  const yearOptions = Array.from(
    new Set([
      String(currentYear - 2),
      String(currentYear - 1),
      String(currentYear),
      String(currentYear + 1),
      String(currentYear + 2),
      ...bookingYears,
    ])
  ).sort();

  const periodBookings = useMemo(() => {
    const today = getTodayParts().date;

    return bookings.filter((booking) => {
      if (!booking.booking_date) return false;

      /*
       * Booking List is an operational schedule, not an archive.
       * Past booking dates and canceled bookings stay in the database,
       * but are intentionally hidden from this list.
       */
      if (booking.booking_date < today) return false;
      if (booking.status === "Canceled") return false;

      const [year, month] = booking.booking_date.split("-");

      if (periodFilter.type === "date") {
        return (
          booking.booking_date >= periodFilter.startDate &&
          booking.booking_date <= periodFilter.endDate
        );
      }

      if (periodFilter.type === "month") {
        return (
          year === periodFilter.year &&
          month === periodFilter.month
        );
      }

      return year === periodFilter.year;
    });
  }, [bookings, periodFilter]);

  const periodLabel =
    periodFilter.type === "date"
      ? `${formatDate(periodFilter.startDate)} - ${formatDate(periodFilter.endDate)}`
      : periodFilter.type === "month"
      ? `${monthNames[Number(periodFilter.month) - 1] || "-"} ${periodFilter.year}`
      : periodFilter.year;

  const updatePeriodFilter = (field, value) => {
    setPeriodFilter((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "startDate" && value > next.endDate) {
        next.endDate = value;
      }

      if (field === "endDate" && value < next.startDate) {
        next.startDate = value;
      }

      return next;
    });

    setShareCopied(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    params.delete("date");
    params.delete("start");
    params.delete("end");
    params.delete("month");
    params.delete("year");
    params.set("period", periodFilter.type);

    if (periodFilter.type === "date") {
      params.set("start", periodFilter.startDate);
      params.set("end", periodFilter.endDate);
    }

    if (periodFilter.type === "month") {
      params.set("month", periodFilter.month);
      params.set("year", periodFilter.year);
    }

    if (periodFilter.type === "year") {
      params.set("year", periodFilter.year);
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;

    window.history.replaceState(null, "", nextUrl);
  }, [
    periodFilter.type,
    periodFilter.startDate,
    periodFilter.endDate,
    periodFilter.month,
    periodFilter.year,
  ]);

  const handleShare = async () => {
    try {
      const shareUrl = window.location.href;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      console.error("SHARE ERROR:", error);
      setErrorMessage("Gagal menyalin link booking.");
    }
  };


  /* =========================================================
     SEARCH + PAGINATION
  ========================================================= */

  const filteredBookings = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return periodBookings;

    return periodBookings.filter((booking) =>
      `${booking.customer_name || ""} ${booking.customer_phone || ""} ${booking.package || ""} ${booking.status || ""} ${booking.payment_status || ""}`
        .toLowerCase()
        .includes(keyword)
    );
  }, [periodBookings, search]);

  const totalPages = Math.ceil(
    filteredBookings.length / BOOKINGS_PER_PAGE
  );

  const safeCurrentPage = totalPages === 0
    ? 0
    : Math.min(currentPage, totalPages - 1);

  const visibleBookings = filteredBookings.slice(
    safeCurrentPage * BOOKINGS_PER_PAGE,
    safeCurrentPage * BOOKINGS_PER_PAGE + BOOKINGS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [
    search,
    periodFilter.type,
    periodFilter.startDate,
    periodFilter.endDate,
    periodFilter.month,
    periodFilter.year,
  ]);


  /* =========================================================
     FORM
  ========================================================= */

  const resetForm = () => {
    setForm({
      customerName: "",
      customerPhone: "",
      bookingDate: "",
      startTime: "",
      packageName: "",
      packagePrice: "",
      status: "Complete",
      notes: "",
      initialPayment: "",
      paymentMethod: "Cash",
    });

    setEditingBooking(null);
  };

  const openAddForm = () => {
    resetForm();
    setErrorMessage("");
    setShowView(false);
    setShowForm(true);
  };

  const openEditForm = (booking) => {
    setEditingBooking(booking);

    setForm({
      customerName: booking.customer_name || "",
      customerPhone: booking.customer_phone || "",
      bookingDate: booking.booking_date || "",
      startTime: booking.start_time
        ? booking.start_time.substring(0, 5)
        : "",
      packageName: booking.package || "",
      packagePrice: formatNumberInput(booking.package_price || 0),
      status: booking.status === "Canceled" ? "Canceled" : "Complete",
      notes: booking.notes || "",
      initialPayment: "",
      paymentMethod: "Cash",
    });

    setErrorMessage("");
    setShowView(false);
    setShowForm(true);
  };

  const openViewBooking = (booking) => {
    setViewingBooking(booking);
    setErrorMessage("");
    setShowView(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    resetForm();
    setErrorMessage("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    if (name === "packagePrice" || name === "initialPayment") {
      setForm((current) => ({
        ...current,
        [name]: formatNumberInput(value),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };


  /* =========================================================
     CUSTOMER CREATION WHEN FULLY PAID
  ========================================================= */

  const createCustomerFromBooking = async (booking, customerStatus = "Selesai") => {
    const customerTotal =
      customerStatus === "Canceled"
        ? Number(booking.paid_amount || 0)
        : Number(booking.package_price || 0);

    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          name: booking.customer_name || "",
          phone: booking.customer_phone || "",
          package: booking.package || "",
          date: booking.booking_date || null,
          price: Number(booking.package_price || 0),
          addon: 0,
          addon_note: "",
          total: customerTotal,
          status: customerStatus,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  };


  const updateCustomerFromBooking = async (
    booking,
    customerId,
    customerStatus = "Selesai"
  ) => {
    if (!customerId) return;

    const customerTotal =
      customerStatus === "Canceled"
        ? Number(booking.paid_amount || 0)
        : Number(booking.package_price || 0);

    const { error } = await supabase
      .from("customers")
      .update({
        name: booking.customer_name || "",
        phone: booking.customer_phone || "",
        package: booking.package || "",
        date: booking.booking_date || null,
        price: Number(booking.package_price || 0),
        total: customerTotal,
        status: customerStatus,
      })
      .eq("id", customerId);

    if (error) {
      throw error;
    }
  };


  const unlinkAndDeleteCustomerFromBooking = async (booking) => {
    if (!booking?.customer_id) {
      return booking;
    }

    const customerId = booking.customer_id;

    const { error: transactionUnlinkError } = await supabase
      .from("transactions")
      .update({ customer_id: null })
      .eq("booking_id", String(booking.id));

    if (transactionUnlinkError) {
      throw transactionUnlinkError;
    }

    const { data: unlinkedBooking, error: bookingUnlinkError } = await supabase
      .from("bookings")
      .update({ customer_id: null })
      .eq("id", booking.id)
      .select()
      .single();

    if (bookingUnlinkError) {
      await supabase
        .from("transactions")
        .update({ customer_id: String(customerId) })
        .eq("booking_id", String(booking.id));

      throw bookingUnlinkError;
    }

    const { error: customerDeleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    if (customerDeleteError) {
      await supabase
        .from("bookings")
        .update({ customer_id: customerId })
        .eq("id", booking.id);

      await supabase
        .from("transactions")
        .update({ customer_id: String(customerId) })
        .eq("booking_id", String(booking.id));

      throw customerDeleteError;
    }

    return unlinkedBooking;
  };


  /* =========================================================
     CREATE / EDIT BOOKING
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const packagePrice = parseMoney(form.packagePrice);
    const initialPayment = parseMoney(form.initialPayment);

    if (
      !form.customerName.trim() ||
      !form.customerPhone.trim() ||
      !form.bookingDate ||
      !form.startTime ||
      !form.packageName.trim() ||
      packagePrice <= 0
    ) {
      setErrorMessage(
        "Nama, nomor telepon, tanggal, waktu, package, dan harga package wajib diisi."
      );
      return;
    }

    if (!editingBooking && initialPayment > packagePrice) {
      setErrorMessage(
        "Initial payment tidak boleh lebih besar dari harga package."
      );
      return;
    }

    if (
      !editingBooking &&
      form.status === "Complete" &&
      initialPayment <= 0
    ) {
      setErrorMessage(
        "Booking berstatus Complete wajib memiliki pembayaran DP atau pembayaran penuh."
      );
      return;
    }

    if (
      editingBooking &&
      packagePrice < Number(editingBooking.paid_amount || editingBooking.down_payment || 0)
    ) {
      setErrorMessage(
        "Harga package tidak boleh lebih kecil dari pembayaran yang sudah diterima."
      );
      return;
    }

    setSaving(true);

    /* ---------------------------------------------------------
       EDIT BOOKING
    --------------------------------------------------------- */

    if (editingBooking) {
      const paidAmount = Number(
        editingBooking.paid_amount || editingBooking.down_payment || 0
      );
      const remainingAmount = Math.max(packagePrice - paidAmount, 0);
      const paymentStatus = getPaymentStatus(packagePrice, paidAmount);

      const { data, error } = await supabase
        .from("bookings")
        .update({
          customer_name: form.customerName.trim(),
          customer_phone: form.customerPhone.trim(),
          booking_date: form.bookingDate,
          start_time: form.startTime,
          package: form.packageName.trim(),
          package_price: packagePrice,
          status: form.status,
          notes: form.notes || null,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          payment_status: paymentStatus,
        })
        .eq("id", editingBooking.id)
        .select()
        .single();

      if (error) {
        console.error("BOOKING UPDATE ERROR:", error);
        setErrorMessage(`Gagal memperbarui booking: ${error.message}`);
        setSaving(false);
        return;
      }

      let finalUpdatedBooking = data;

      /*
       * Customer Data is client history, not a revenue ledger.
       * Rules:
       * - Complete + Paid   -> Customer Data = Selesai
       * - Complete + Partial/Unpaid -> no Customer Data yet
       * - Canceled + paid > 0 -> Customer Data = Canceled
       * - Canceled + paid = 0 -> no Customer Data
       */
      const shouldHaveCustomer =
        (form.status === "Canceled" && paidAmount > 0) ||
        (form.status !== "Canceled" && paymentStatus === "Paid");

      const targetCustomerStatus =
        form.status === "Canceled" ? "Canceled" : "Selesai";

      try {
        if (shouldHaveCustomer) {
          if (data.customer_id) {
            await updateCustomerFromBooking(
              data,
              data.customer_id,
              targetCustomerStatus
            );
          } else {
            const customerData = await createCustomerFromBooking(
              data,
              targetCustomerStatus
            );

            const {
              data: linkedBooking,
              error: linkError,
            } = await supabase
              .from("bookings")
              .update({
                customer_id: customerData.id,
              })
              .eq("id", data.id)
              .select()
              .single();

            if (linkError) {
              await supabase
                .from("customers")
                .delete()
                .eq("id", customerData.id);
              throw linkError;
            }

            finalUpdatedBooking = linkedBooking;

            const { error: transactionLinkError } = await supabase
              .from("transactions")
              .update({
                customer_id: String(customerData.id),
              })
              .eq("booking_id", String(data.id));

            if (transactionLinkError) {
              throw transactionLinkError;
            }
          }
        } else if (data.customer_id) {
          finalUpdatedBooking = await unlinkAndDeleteCustomerFromBooking(data);
        }
      } catch (customerError) {
        console.error(
          "BOOKING CUSTOMER SYNC ERROR:",
          customerError
        );
        setErrorMessage(
          `Booking sudah diperbarui, tetapi Customer Data gagal disinkronkan: ${customerError.message}`
        );
        setSaving(false);
        return;
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === editingBooking.id
            ? finalUpdatedBooking
            : booking
        )
      );

      setSaving(false);
      closeForm();
      return;
    }

    /* ---------------------------------------------------------
       CREATE BOOKING
    --------------------------------------------------------- */

    const paidAmount = initialPayment;
    const remainingAmount = Math.max(packagePrice - paidAmount, 0);
    const paymentStatus = getPaymentStatus(packagePrice, paidAmount);

    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          customer_name: form.customerName.trim(),
          customer_phone: form.customerPhone.trim(),
          booking_date: form.bookingDate,
          start_time: form.startTime,
          package: form.packageName.trim(),
          package_price: packagePrice,
          status: form.status,
          notes: form.notes || null,
          down_payment: paidAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          payment_status: paymentStatus,
          customer_id: null,
        },
      ])
      .select()
      .single();

    if (bookingError) {
      console.error("BOOKING INSERT ERROR:", bookingError);
      setErrorMessage(`Gagal menyimpan booking: ${bookingError.message}`);
      setSaving(false);
      return;
    }

    let insertedTransaction = null;
    let insertedCustomer = null;
    let finalBooking = newBooking;

    try {
      if (paidAmount > 0) {
        const mdr = calculateMdr(
          paidAmount,
          form.paymentMethod
        );

        const { data: transactionData, error: transactionError } = await supabase
          .from("transactions")
          .insert([
            {
              transaction_date: getTodayParts().date,
              customer: form.customerName.trim(),
              payment_type:
                paymentStatus === "Paid"
                  ? "Full Payment"
                  : "Down Payment",
              description: `${form.packageName.trim()} · ${
                paymentStatus === "Paid" ? "Full Payment" : "Down Payment"
              }`,
              amount: paidAmount,
              payment_method: form.paymentMethod,
              mdr_percentage: mdr.percentage,
              mdr_amount: mdr.mdrAmount,
              net_amount: mdr.netAmount,
              information: "Auto generated from Booking",
              booking_id: String(newBooking.id),
              customer_id: null,
            },
          ])
          .select()
          .single();

        if (transactionError) throw transactionError;
        insertedTransaction = transactionData;
      }

      if (
        paymentStatus === "Paid" ||
        (form.status === "Canceled" && paidAmount > 0)
      ) {
        insertedCustomer = await createCustomerFromBooking(
          newBooking,
          form.status === "Canceled" ? "Canceled" : "Selesai"
        );

        const { data: updatedBooking, error: customerLinkError } = await supabase
          .from("bookings")
          .update({
            customer_id: insertedCustomer.id,
          })
          .eq("id", newBooking.id)
          .select()
          .single();

        if (customerLinkError) throw customerLinkError;
        finalBooking = updatedBooking;

        if (insertedTransaction) {
          await supabase
            .from("transactions")
            .update({ customer_id: String(insertedCustomer.id) })
            .eq("id", insertedTransaction.id);
        }
      }
    } catch (error) {
      console.error("AUTO PAYMENT FLOW ERROR:", error);

      if (insertedTransaction?.id) {
        await supabase
          .from("transactions")
          .delete()
          .eq("id", insertedTransaction.id);
      }

      if (insertedCustomer?.id) {
        await supabase
          .from("customers")
          .delete()
          .eq("id", insertedCustomer.id);
      }

      await supabase
        .from("bookings")
        .delete()
        .eq("id", newBooking.id);

      setErrorMessage(
        `Booking dibatalkan karena proses transaksi gagal: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setBookings((current) => [...current, finalBooking]);
    setSaving(false);
    closeForm();
  };


  /* =========================================================
     PAID / SETTLEMENT
  ========================================================= */

  const openPaymentModal = (booking) => {
    const packagePrice = Number(booking.package_price || 0);

    if (packagePrice <= 0) {
      setErrorMessage(
        "Harga package booking ini belum tersedia. Edit booking dan isi harga package terlebih dahulu."
      );
      return;
    }

    setPayingBooking(booking);
    setSettlementMethod("Cash");
    setErrorMessage("");
    setShowView(false);
    setShowPayment(true);
  };

  const closePaymentModal = () => {
    if (saving) return;
    setShowPayment(false);
    setPayingBooking(null);
    setErrorMessage("");
  };

  const handleConfirmPayment = async () => {
    if (!payingBooking) return;

    const packagePrice = Number(payingBooking.package_price || 0);
    const alreadyPaid = Number(
      payingBooking.paid_amount || payingBooking.down_payment || 0
    );
    const remaining = Math.max(packagePrice - alreadyPaid, 0);

    if (remaining <= 0) {
      setErrorMessage("Booking ini sudah lunas.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const mdr = calculateMdr(
      remaining,
      settlementMethod
    );

    let transactionData = null;
    let customerData = null;

    try {
      const { data: insertedTransaction, error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            transaction_date: getTodayParts().date,
            customer: payingBooking.customer_name || "",
            payment_type: "Final Payment",
            description: `${payingBooking.package || "Package"} · Final Payment`,
            amount: remaining,
            payment_method: settlementMethod,
            mdr_percentage: mdr.percentage,
            mdr_amount: mdr.mdrAmount,
            net_amount: mdr.netAmount,
            information: "Auto generated from Booking settlement",
            booking_id: String(payingBooking.id),
            customer_id: payingBooking.customer_id
              ? String(payingBooking.customer_id)
              : null,
          },
        ])
        .select()
        .single();

      if (transactionError) throw transactionError;
      transactionData = insertedTransaction;

      let customerId = payingBooking.customer_id || null;

      if (!customerId) {
        customerData = await createCustomerFromBooking(payingBooking);
        customerId = customerData.id;
      }

      const { data: updatedBooking, error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({
          paid_amount: packagePrice,
          remaining_amount: 0,
          payment_status: "Paid",
          customer_id: customerId,
        })
        .eq("id", payingBooking.id)
        .select()
        .single();

      if (bookingUpdateError) throw bookingUpdateError;

      await updateCustomerFromBooking(
        updatedBooking,
        customerId,
        "Selesai"
      );

      if (transactionData?.id && customerId) {
        await supabase
          .from("transactions")
          .update({ customer_id: String(customerId) })
          .eq("id", transactionData.id);
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === updatedBooking.id
            ? updatedBooking
            : booking
        )
      );

      setViewingBooking(updatedBooking);
      setSaving(false);
      closePaymentModal();
    } catch (error) {
      console.error("SETTLEMENT ERROR:", error);

      if (transactionData?.id) {
        await supabase
          .from("transactions")
          .delete()
          .eq("id", transactionData.id);
      }

      if (customerData?.id) {
        await supabase
          .from("customers")
          .delete()
          .eq("id", customerData.id);
      }

      setErrorMessage(`Gagal memproses pelunasan: ${error.message}`);
      setSaving(false);
    }
  };


  /* =========================================================
     DELETE
  ========================================================= */

  const handleDeleteBooking = async (booking) => {
    if (!booking?.id) return;

    setErrorMessage("");

    /* ---------------------------------------------------------
       CHECK RELATED TRANSACTIONS
       We use the transaction ledger as the source of truth,
       not paid_amount / down_payment stored on the booking.
    --------------------------------------------------------- */

    const {
      data: relatedTransactions,
      error: transactionLookupError,
    } = await supabase
      .from("transactions")
      .select("id, amount, payment_type")
      .eq("booking_id", String(booking.id));

    if (transactionLookupError) {
      console.error(
        "BOOKING TRANSACTION LOOKUP ERROR:",
        transactionLookupError
      );

      setErrorMessage(
        `Gagal memeriksa transaksi booking: ${transactionLookupError.message}`
      );

      return;
    }

    const transactions = relatedTransactions || [];

    const transactionTotal = transactions.reduce(
      (total, transaction) =>
        total + Number(transaction.amount || 0),
      0
    );

    const customerName =
      booking.customer_name ||
      "Unnamed Customer";

    let confirmMessage =
      `Hapus booking "${customerName}"?`;

    if (transactions.length > 0) {
      confirmMessage =
        `Hapus booking "${customerName}"?\n\n` +
        `Booking ini memiliki ${transactions.length} transaksi dengan total pembayaran ${formatCurrency(
          transactionTotal
        )}.\n\n` +
        "Seluruh transaksi yang terkait dengan booking ini juga akan dihapus. " +
        "Gross Revenue, MDR, dan Net Revenue akan otomatis ikut berkurang.\n\n" +
        "Customer Data tidak akan ikut dihapus.\n\n" +
        "Lanjutkan?";
    }

    const confirmed =
      window.confirm(
        confirmMessage
      );

    if (!confirmed) return;

    /* ---------------------------------------------------------
       DELETE RELATED TRANSACTIONS FIRST
    --------------------------------------------------------- */

    if (transactions.length > 0) {
      const {
        error: transactionDeleteError,
      } = await supabase
        .from("transactions")
        .delete()
        .eq(
          "booking_id",
          String(booking.id)
        );

      if (transactionDeleteError) {
        console.error(
          "BOOKING TRANSACTION DELETE ERROR:",
          transactionDeleteError
        );

        setErrorMessage(
          `Booking belum dihapus karena transaksi terkait gagal dihapus: ${transactionDeleteError.message}`
        );

        return;
      }
    }

    /* ---------------------------------------------------------
       DELETE BOOKING
    --------------------------------------------------------- */

    const {
      error: bookingDeleteError,
    } = await supabase
      .from("bookings")
      .delete()
      .eq("id", booking.id);

    if (bookingDeleteError) {
      console.error(
        "BOOKING DELETE ERROR:",
        bookingDeleteError
      );

      /*
       * Related transactions have already been removed.
       * If deleting the booking itself fails, reset its payment
       * state so the remaining booking still matches the ledger.
       */
      const packagePrice =
        Number(
          booking.package_price ||
          0
        );

      const {
        data: resetBooking,
      } = await supabase
        .from("bookings")
        .update({
          down_payment: 0,
          paid_amount: 0,
          remaining_amount:
            packagePrice > 0
              ? packagePrice
              : 0,
          payment_status:
            "Unpaid",
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (resetBooking) {
        setBookings(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                resetBooking.id
                  ? resetBooking
                  : item
            )
        );
      }

      setErrorMessage(
        `Transaksi terkait sudah dihapus, tetapi booking gagal dihapus: ${bookingDeleteError.message}`
      );

      return;
    }

    /* ---------------------------------------------------------
       UPDATE UI
    --------------------------------------------------------- */

    setBookings(
      (current) =>
        current.filter(
          (item) =>
            item.id !== booking.id
        )
    );

    if (
      viewingBooking?.id ===
      booking.id
    ) {
      setShowView(false);
      setViewingBooking(null);
    }

    if (
      payingBooking?.id ===
      booking.id
    ) {
      closePaymentModal();
    }
  };


  /* =========================================================
     PAYMENT PREVIEWS
  ========================================================= */

  const addPackagePrice = parseMoney(form.packagePrice);
  const addPayment = parseMoney(form.initialPayment);
  const addRemaining = Math.max(addPackagePrice - addPayment, 0);
  const addMdr = calculateMdr(
    addPayment,
    form.paymentMethod
  );

  const settlementRemaining = payingBooking
    ? Math.max(
        Number(payingBooking.package_price || 0) -
          Number(payingBooking.paid_amount || payingBooking.down_payment || 0),
        0
      )
    : 0;

  const settlementMdr = calculateMdr(
    settlementRemaining,
    settlementMethod
  );


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="booking-page">
      <Sidebar activePage="booking" />

      <main className="booking-main">
        <div className="booking-page-header">
          <div>
            <div className="booking-eyebrow">
              PLUNO STUDIO / OPERATIONS
            </div>
            <h1>Booking List</h1>
          </div>

          <div className="booking-header-actions">
            <div className="booking-period-filter">
              <select
                className="booking-period-type"
                value={periodFilter.type}
                onChange={(event) =>
                  updatePeriodFilter("type", event.target.value)
                }
                aria-label="Booking period type"
              >
                <option value="date">Date</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>

              {periodFilter.type === "date" && (
                <div className="booking-date-range">
                  <input
                    type="date"
                    className="booking-period-date"
                    value={periodFilter.startDate}
                    max={periodFilter.endDate}
                    onChange={(event) =>
                      updatePeriodFilter("startDate", event.target.value)
                    }
                    aria-label="Booking start date"
                  />

                  <span className="booking-date-range-separator">
                    to
                  </span>

                  <input
                    type="date"
                    className="booking-period-date"
                    value={periodFilter.endDate}
                    min={periodFilter.startDate}
                    onChange={(event) =>
                      updatePeriodFilter("endDate", event.target.value)
                    }
                    aria-label="Booking end date"
                  />
                </div>
              )}

              {periodFilter.type === "month" && (
                <>
                  <select
                    value={periodFilter.month}
                    onChange={(event) =>
                      updatePeriodFilter("month", event.target.value)
                    }
                    aria-label="Booking month"
                  >
                    {monthNames.map((month, index) => (
                      <option
                        key={month}
                        value={String(index + 1).padStart(2, "0")}
                      >
                        {month}
                      </option>
                    ))}
                  </select>

                  <select
                    value={periodFilter.year}
                    onChange={(event) =>
                      updatePeriodFilter("year", event.target.value)
                    }
                    aria-label="Booking year"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {periodFilter.type === "year" && (
                <select
                  value={periodFilter.year}
                  onChange={(event) =>
                    updatePeriodFilter("year", event.target.value)
                  }
                  aria-label="Booking year"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              className={`booking-share-button ${shareCopied ? "copied" : ""}`}
              onClick={handleShare}
            >
              {shareCopied ? "Copied" : "Share"}
            </button>

            <button
              type="button"
              className="booking-add-button"
              onClick={openAddForm}
            >
              Add
            </button>
          </div>
        </div>

        {errorMessage && !showForm && !showPayment && (
          <div className="booking-error">{errorMessage}</div>
        )}

        <section className="booking-list-section">
          <div className="booking-list-header">
            <div className="booking-section-label">
              BOOKING DATABASE
            </div>

            <div className="booking-list-tools">
              <div className="booking-active-period">
                {periodLabel}
              </div>

              <div className="booking-count">
                {filteredBookings.length} BOOKING
              </div>

              <div className="booking-search">
                <span>/</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="booking-table-scroll">
            <table className="booking-table booking-table-v2">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>DATE</th>
                  <th>TIME</th>
                  <th>PACKAGE</th>
                  <th>PACKAGE PRICE</th>
                  <th>PAYMENT</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="booking-empty">
                      Loading booking...
                    </td>
                  </tr>
                ) : visibleBookings.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="booking-empty">
                      No booking found.
                    </td>
                  </tr>
                ) : (
                  visibleBookings.map((booking) => {
                    const paidAmount = Number(
                      booking.paid_amount || booking.down_payment || 0
                    );
                    const packagePrice = Number(booking.package_price || 0);
                    const remainingAmount = packagePrice > 0
                      ? Math.max(packagePrice - paidAmount, 0)
                      : Number(booking.remaining_amount || 0);
                    const paymentStatus = booking.payment_status ||
                      getPaymentStatus(packagePrice, paidAmount);

                    return (
                      <tr key={booking.id}>
                        <td>
                          <div className="booking-customer-name">
                            {booking.customer_name || "Unnamed Customer"}
                          </div>
                        </td>
                        <td>{formatDate(booking.booking_date)}</td>
                        <td>{formatTime(booking.start_time)}</td>
                        <td>
                          <div className="booking-package">
                            {booking.package || "-"}
                          </div>
                        </td>
                        <td>
                          {packagePrice > 0
                            ? formatCurrency(packagePrice)
                            : "-"}
                        </td>
                        <td>
                          <div className="booking-payment-cell">
                            <span
                              className={`booking-payment-status ${paymentStatus.toLowerCase()}`}
                            >
                              {paymentStatus}
                            </span>
                            {paymentStatus !== "Paid" && packagePrice > 0 && (
                              <small>
                                Sisa {formatCurrency(remainingAmount)}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`booking-status ${
                              booking.status === "Canceled"
                                ? "booking-status-canceled"
                                : "booking-status-complete"
                            }`}
                          >
                            {booking.status === "Canceled" ? "Canceled" : "Complete"}
                          </span>
                        </td>
                        <td>
                          <div className="booking-actions booking-actions-v2">
                            <button
                              type="button"
                              className="view"
                              onClick={() => openViewBooking(booking)}
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="edit"
                              onClick={() => openEditForm(booking)}
                            >
                              Edit
                            </button>

                            {remainingAmount > 0 && booking.status !== "Canceled" && (
                              <button
                                type="button"
                                className="paid"
                                onClick={() => openPaymentModal(booking)}
                              >
                                Paid
                              </button>
                            )}

                            <button
                              type="button"
                              className="delete"
                              onClick={() => handleDeleteBooking(booking)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="booking-pagination">
              <button
                type="button"
                className="booking-page-arrow"
                onClick={() =>
                  setCurrentPage((current) => Math.max(current - 1, 0))
                }
                disabled={safeCurrentPage === 0}
              >
                ←
              </button>

              <span className="booking-page-indicator">
                {safeCurrentPage + 1}<span>/</span>{totalPages}
              </span>

              <button
                type="button"
                className="booking-page-arrow"
                onClick={() =>
                  setCurrentPage((current) =>
                    Math.min(current + 1, Math.max(totalPages - 1, 0))
                  )
                }
                disabled={safeCurrentPage >= totalPages - 1}
              >
                →
              </button>
            </div>
          )}
        </section>

        <footer className="booking-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>


      {/* =====================================================
          ADD / EDIT MODAL
      ===================================================== */}

      {showForm && (
        <div
          className="booking-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div className="booking-form-box booking-form-box-v2">
            <div className="booking-form-header">
              <div>
                <div className="booking-form-kicker">
                  {editingBooking ? "EDIT BOOKING" : "NEW BOOKING"}
                </div>
                <h2>{editingBooking ? "Edit Booking" : "Add Booking"}</h2>
                <p>
                  {editingBooking
                    ? "Update booking information. Payment history cannot be edited here."
                    : "Create booking and record the first payment in one flow."}
                </p>
              </div>

              <button
                type="button"
                className="booking-close"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="booking-form-grid">
                <div className="booking-field">
                  <label>CUSTOMER</label>
                  <input
                    type="text"
                    name="customerName"
                    placeholder="Customer name"
                    value={form.customerName}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>PHONE</label>
                  <input
                    type="text"
                    name="customerPhone"
                    placeholder="08xxxxxxxxxx"
                    value={form.customerPhone}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>PACKAGE</label>
                  <input
                    type="text"
                    name="packageName"
                    placeholder="Package description"
                    value={form.packageName}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>PACKAGE PRICE</label>
                  <input
                    type="text"
                    name="packagePrice"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={form.packagePrice}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>BOOKING DATE</label>
                  <input
                    type="date"
                    name="bookingDate"
                    value={form.bookingDate}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>START TIME</label>
                  <select
                    name="startTime"
                    value={form.startTime}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select time</option>
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="booking-field">
                  <label>BOOKING STATUS</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    <option value="Complete">Complete</option>
                    <option value="Canceled">Canceled</option>
                  </select>
                </div>

                {!editingBooking && (
                  <div className="booking-field">
                    <label>INITIAL PAYMENT / DP</label>
                    <input
                      type="text"
                      name="initialPayment"
                      inputMode="numeric"
                      placeholder="Rp 0"
                      value={form.initialPayment}
                      onChange={handleFormChange}
                    />
                  </div>
                )}

                {!editingBooking && (
                  <div className="booking-field">
                    <label>PAYMENT METHOD</label>
                    <select
                      name="paymentMethod"
                      value={form.paymentMethod}
                      onChange={handleFormChange}
                    >
                      <option value="Cash">Cash</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="booking-field booking-notes-field">
                <label>NOTES</label>
                <textarea
                  name="notes"
                  rows="4"
                  placeholder="Additional notes..."
                  value={form.notes}
                  onChange={handleFormChange}
                />
              </div>

              {!editingBooking ? (
                <div className="booking-payment-preview">
                  <div>
                    <span>PACKAGE PRICE</span>
                    <strong>{formatCurrency(addPackagePrice)}</strong>
                  </div>
                  <div>
                    <span>INITIAL PAYMENT</span>
                    <strong>{formatCurrency(addPayment)}</strong>
                  </div>
                  <div>
                    <span>REMAINING</span>
                    <strong>{formatCurrency(addRemaining)}</strong>
                  </div>
                  <div>
                    <span>MDR</span>
                    <strong>
                      {form.paymentMethod === "QRIS" && addPayment > 0
                        ? `${addMdr.percentage}% · ${formatCurrency(addMdr.mdrAmount)}`
                        : "Rp 0"}
                    </strong>
                  </div>
                  <div>
                    <span>NET RECEIVED</span>
                    <strong>{formatCurrency(addMdr.netAmount)}</strong>
                  </div>
                </div>
              ) : (
                <div className="booking-payment-preview">
                  <div>
                    <span>ALREADY PAID</span>
                    <strong>
                      {formatCurrency(
                        Number(
                          editingBooking.paid_amount ||
                          editingBooking.down_payment ||
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>REMAINING AFTER SAVE</span>
                    <strong>
                      {formatCurrency(
                        Math.max(
                          addPackagePrice -
                            Number(
                              editingBooking.paid_amount ||
                              editingBooking.down_payment ||
                              0
                            ),
                          0
                        )
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="booking-form-error">{errorMessage}</div>
              )}

              <div className="booking-form-footer">
                <button
                  type="button"
                  className="booking-cancel"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="booking-save"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingBooking
                    ? "Update Booking"
                    : "Save Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =====================================================
          VIEW MODAL
      ===================================================== */}

      {showView && viewingBooking && (
        <div
          className="booking-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowView(false);
              setViewingBooking(null);
            }
          }}
        >
          <div className="booking-view-box">
            <div className="booking-form-header">
              <div>
                <div className="booking-form-kicker">BOOKING DETAIL</div>
                <h2>{viewingBooking.customer_name || "Unnamed Customer"}</h2>
                <p>Booking and payment information</p>
              </div>

              <button
                type="button"
                className="booking-close"
                onClick={() => {
                  setShowView(false);
                  setViewingBooking(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="booking-detail-grid booking-detail-grid-v2">
              <div className="booking-detail-item">
                <span>CUSTOMER</span>
                <strong>{viewingBooking.customer_name || "-"}</strong>
              </div>

              <div className="booking-detail-item">
                <span>PHONE</span>
                <strong>{viewingBooking.customer_phone || "-"}</strong>
              </div>

              <div className="booking-detail-item">
                <span>PACKAGE</span>
                <strong>{viewingBooking.package || "-"}</strong>
              </div>

              <div className="booking-detail-item">
                <span>PACKAGE PRICE</span>
                <strong>
                  {Number(viewingBooking.package_price || 0) > 0
                    ? formatCurrency(viewingBooking.package_price)
                    : "-"}
                </strong>
              </div>

              <div className="booking-detail-item">
                <span>BOOKING DATE</span>
                <strong>{formatDate(viewingBooking.booking_date)}</strong>
              </div>

              <div className="booking-detail-item">
                <span>START TIME</span>
                <strong>{formatTime(viewingBooking.start_time)}</strong>
              </div>

              <div className="booking-detail-item">
                <span>BOOKING STATUS</span>
                <strong>{viewingBooking.status === "Canceled" ? "Canceled" : "Complete"}</strong>
              </div>

              <div className="booking-detail-item">
                <span>PAYMENT STATUS</span>
                <strong>
                  {viewingBooking.payment_status ||
                    getPaymentStatus(
                      viewingBooking.package_price,
                      viewingBooking.paid_amount || viewingBooking.down_payment
                    )}
                </strong>
              </div>

              <div className="booking-detail-item">
                <span>PAID</span>
                <strong>
                  {formatCurrency(
                    viewingBooking.paid_amount ||
                    viewingBooking.down_payment ||
                    0
                  )}
                </strong>
              </div>

              <div className="booking-detail-item">
                <span>REMAINING</span>
                <strong>
                  {formatCurrency(
                    Math.max(
                      Number(viewingBooking.package_price || 0) -
                        Number(
                          viewingBooking.paid_amount ||
                          viewingBooking.down_payment ||
                          0
                        ),
                      0
                    )
                  )}
                </strong>
              </div>
            </div>

            <div className="booking-detail-notes">
              <span>NOTES</span>
              <p>{viewingBooking.notes || "No notes."}</p>
            </div>

            <div className="booking-view-footer booking-view-footer-v2">
              <button
                type="button"
                className="booking-cancel"
                onClick={() => {
                  setShowView(false);
                  setViewingBooking(null);
                }}
              >
                Close
              </button>

              {Math.max(
                Number(viewingBooking.package_price || 0) -
                  Number(
                    viewingBooking.paid_amount ||
                    viewingBooking.down_payment ||
                    0
                  ),
                0
              ) > 0 && viewingBooking.status !== "Canceled" && (
                <button
                  type="button"
                  className="booking-paid-primary"
                  onClick={() => openPaymentModal(viewingBooking)}
                >
                  Paid
                </button>
              )}

              <button
                type="button"
                className="booking-save"
                onClick={() => openEditForm(viewingBooking)}
              >
                Edit Booking
              </button>
            </div>
          </div>
        </div>
      )}


      {/* =====================================================
          PAID MODAL
      ===================================================== */}

      {showPayment && payingBooking && (
        <div
          className="booking-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePaymentModal();
            }
          }}
        >
          <div className="booking-payment-modal">
            <div className="booking-form-header">
              <div>
                <div className="booking-form-kicker">PAYMENT SETTLEMENT</div>
                <h2>Complete Payment</h2>
                <p>{payingBooking.customer_name || "Customer"}</p>
              </div>

              <button
                type="button"
                className="booking-close"
                onClick={closePaymentModal}
              >
                ×
              </button>
            </div>

            <div className="booking-payment-summary">
              <div>
                <span>PACKAGE</span>
                <strong>{payingBooking.package || "-"}</strong>
              </div>
              <div>
                <span>PACKAGE PRICE</span>
                <strong>{formatCurrency(payingBooking.package_price)}</strong>
              </div>
              <div>
                <span>ALREADY PAID</span>
                <strong>
                  {formatCurrency(
                    payingBooking.paid_amount ||
                    payingBooking.down_payment ||
                    0
                  )}
                </strong>
              </div>
              <div className="remaining">
                <span>REMAINING PAYMENT</span>
                <strong>{formatCurrency(settlementRemaining)}</strong>
              </div>
            </div>

            <div className="booking-field booking-payment-method-field">
              <label>PAYMENT METHOD</label>
              <select
                value={settlementMethod}
                onChange={(event) => setSettlementMethod(event.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>

            <div className="booking-payment-preview settlement">
              <div>
                <span>GROSS PAYMENT</span>
                <strong>{formatCurrency(settlementRemaining)}</strong>
              </div>
              <div>
                <span>MDR</span>
                <strong>
                  {settlementMethod === "QRIS"
                    ? `${settlementMdr.percentage}% · ${formatCurrency(settlementMdr.mdrAmount)}`
                    : "Rp 0"}
                </strong>
              </div>
              <div>
                <span>NET RECEIVED</span>
                <strong>{formatCurrency(settlementMdr.netAmount)}</strong>
              </div>
            </div>

            {errorMessage && (
              <div className="booking-form-error">{errorMessage}</div>
            )}

            <div className="booking-form-footer">
              <button
                type="button"
                className="booking-cancel"
                onClick={closePaymentModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="booking-save"
                onClick={handleConfirmPayment}
                disabled={saving}
              >
                {saving ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

export default Booking;
