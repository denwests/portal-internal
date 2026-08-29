import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import {
  getRevenueDate,
  isRevenueInMonth,
} from "../lib/revenuePeriod";
import "./Transactions.css";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


function formatRupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatDate(date) {
  if (!date) return "-";

  const [year, month, day] = date.split("-");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function formatRevenuePeriod(date) {
  if (!date) return "-";

  const [year, month] = String(date).split("-");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${months[Number(month) - 1] || month} ${year}`;
}



function formatTime(time) {
  if (!time) return "-";
  return String(time).substring(0, 5);
}

function formatPaymentType(value) {
  if (value === "Down Payment") return "Down Payment (DP)";
  if (value === "Full Payment") return "Pembayaran Penuh";
  if (value === "Final Payment") return "Pelunasan";
  return value || "Pembayaran";
}

function makeInvoiceNumber(transaction) {
  const date = String(transaction?.transaction_date || "").replace(/-/g, "");
  const id = String(transaction?.id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `INV-${date || "PAYMENT"}-${id || "PLUNO"}`;
}

function safeFileName(value) {
  return String(value || "client")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";
}

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );

  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );

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

  const currentYear = new Date().getFullYear();
  const yearOptions = [];

  for (let year = currentYear - 5; year <= currentYear + 5; year += 1) {
    yearOptions.push(String(year));
  }


  /* =========================================================
     FETCH
  ========================================================= */

  const fetchTransactions = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("TRANSACTION FETCH ERROR:", error);
      setErrorMessage(`Gagal mengambil transaksi: ${error.message}`);
      setTransactions([]);
      setLoading(false);
      return;
    }

    const transactionList = data || [];

    const bookingIds = Array.from(
      new Set(
        transactionList
          .map((item) => item.booking_id)
          .filter(Boolean)
          .map(String)
      )
    );

    let bookingMap = {};

    if (bookingIds.length > 0) {
      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from("bookings")
        .select("id, status, booking_date")
        .in("id", bookingIds);

      if (bookingError) {
        console.error(
          "TRANSACTION BOOKING STATUS ERROR:",
          bookingError
        );
      } else {
        bookingMap = Object.fromEntries(
          (bookingData || []).map((booking) => [
            String(booking.id),
            {
              status:
                booking.status === "Canceled"
                  ? "Canceled"
                  : "Complete",
              bookingDate: booking.booking_date || null,
            },
          ])
        );
      }
    }

    setTransactions(
      transactionList.map((item) => ({
        ...item,
        booking_status: item.booking_id
          ? bookingMap[String(item.booking_id)]?.status || "Complete"
          : "Complete",
        revenue_date:
          bookingMap[String(item.booking_id)]?.bookingDate ||
          getRevenueDate(item),
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);


  /* =========================================================
     DELETE TRANSACTION + RECALCULATE BOOKING
  ========================================================= */

  const syncCustomerAfterTransactionChange = async (
    booking,
    { paidAmount, paymentStatus }
  ) => {
    if (!booking?.id) return;

    const shouldHaveCustomer =
      (booking.status === "Canceled" && paidAmount > 0) ||
      (booking.status !== "Canceled" && paymentStatus === "Paid");

    const customerStatus =
      booking.status === "Canceled" ? "Canceled" : "Selesai";

    const customerTotal =
      customerStatus === "Canceled"
        ? paidAmount
        : Number(booking.package_price || 0);

    if (shouldHaveCustomer) {
      let customerId = booking.customer_id || null;

      if (customerId) {
        const { error: customerUpdateError } = await supabase
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

        if (customerUpdateError) {
          throw customerUpdateError;
        }
      } else {
        const { data: customerData, error: customerCreateError } = await supabase
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

        if (customerCreateError) {
          throw customerCreateError;
        }

        customerId = customerData.id;

        const { error: bookingLinkError } = await supabase
          .from("bookings")
          .update({ customer_id: customerId })
          .eq("id", booking.id);

        if (bookingLinkError) {
          await supabase
            .from("customers")
            .delete()
            .eq("id", customerId);

          throw bookingLinkError;
        }
      }

      const { error: transactionLinkError } = await supabase
        .from("transactions")
        .update({ customer_id: String(customerId) })
        .eq("booking_id", String(booking.id));

      if (transactionLinkError) {
        throw transactionLinkError;
      }

      return;
    }

    if (!booking.customer_id) {
      return;
    }

    const customerId = booking.customer_id;

    const { error: transactionUnlinkError } = await supabase
      .from("transactions")
      .update({ customer_id: null })
      .eq("booking_id", String(booking.id));

    if (transactionUnlinkError) {
      throw transactionUnlinkError;
    }

    const { error: bookingUnlinkError } = await supabase
      .from("bookings")
      .update({ customer_id: null })
      .eq("id", booking.id);

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
  };


  const handleDeleteTransaction = async (transaction) => {
    if (!transaction?.id) return;

    const confirmed = window.confirm(
      `Hapus transaksi ${transaction.payment_type || "Payment"} milik ${
        transaction.customer || "customer"
      } sebesar ${formatRupiah(transaction.amount)}?\n\nJika transaksi terhubung ke Booking, Booking dan Customer Data akan disinkronkan otomatis.`
    );

    if (!confirmed) return;

    setDeletingTransactionId(transaction.id);
    setErrorMessage("");

    let bookingSnapshot = null;
    let bookingWasUpdated = false;
    let recalculatedBooking = null;
    let recalculatedPaymentState = null;

    try {
      if (transaction.booking_id) {
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .select(
            "id, customer_id, customer_name, customer_phone, booking_date, package, package_price, status, down_payment, paid_amount, remaining_amount, payment_status"
          )
          .eq("id", transaction.booking_id)
          .maybeSingle();

        if (bookingError) {
          throw bookingError;
        }

        if (booking) {
          bookingSnapshot = {
            down_payment: Number(booking.down_payment || 0),
            paid_amount: Number(booking.paid_amount || 0),
            remaining_amount: Number(booking.remaining_amount || 0),
            payment_status: booking.payment_status || "Unpaid",
          };

          const { data: remainingTransactions, error: remainingError } =
            await supabase
              .from("transactions")
              .select("id, amount, payment_type")
              .eq("booking_id", String(transaction.booking_id))
              .neq("id", transaction.id);

          if (remainingError) {
            throw remainingError;
          }

          const paidAmount = (remainingTransactions || []).reduce(
            (total, item) => total + Number(item.amount || 0),
            0
          );

          const downPayment = (remainingTransactions || [])
            .filter((item) => item.payment_type === "Down Payment")
            .reduce(
              (total, item) => total + Number(item.amount || 0),
              0
            );

          const packagePrice = Number(booking.package_price || 0);
          const remainingAmount =
            packagePrice > 0
              ? Math.max(packagePrice - paidAmount, 0)
              : 0;

          let paymentStatus = "Unpaid";

          if (paidAmount > 0) {
            paymentStatus =
              packagePrice > 0 && paidAmount >= packagePrice
                ? "Paid"
                : "Partial";
          }

          const { error: bookingUpdateError } = await supabase
            .from("bookings")
            .update({
              down_payment: downPayment,
              paid_amount: paidAmount,
              remaining_amount: remainingAmount,
              payment_status: paymentStatus,
            })
            .eq("id", booking.id);

          if (bookingUpdateError) {
            throw bookingUpdateError;
          }

          bookingWasUpdated = true;
          recalculatedBooking = {
            ...booking,
            down_payment: downPayment,
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            payment_status: paymentStatus,
          };
          recalculatedPaymentState = {
            paidAmount,
            paymentStatus,
          };
        }
      }

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);

      if (deleteError) {
        if (
          bookingWasUpdated &&
          bookingSnapshot &&
          transaction.booking_id
        ) {
          await supabase
            .from("bookings")
            .update(bookingSnapshot)
            .eq("id", transaction.booking_id);
        }

        throw deleteError;
      }

      setTransactions((current) =>
        current.filter((item) => item.id !== transaction.id)
      );

      if (recalculatedBooking && recalculatedPaymentState) {
        try {
          await syncCustomerAfterTransactionChange(
            recalculatedBooking,
            recalculatedPaymentState
          );
        } catch (customerSyncError) {
          console.error(
            "TRANSACTION CUSTOMER SYNC ERROR:",
            customerSyncError
          );

          setErrorMessage(
            `Transaksi sudah dihapus dan Booking sudah dihitung ulang, tetapi Customer Data gagal disinkronkan: ${
              customerSyncError.message || "Unknown error"
            }`
          );
        }
      }
    } catch (error) {
      console.error("TRANSACTION DELETE ERROR:", error);
      setErrorMessage(
        `Gagal menghapus transaksi: ${error.message || "Unknown error"}`
      );
    } finally {
      setDeletingTransactionId(null);
    }
  };


  /* =========================================================
     FILTER + SUMMARY
  ========================================================= */

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      if (!item.transaction_date) return false;

      return (
        item.transaction_date.slice(0, 4) === selectedYear &&
        item.transaction_date.slice(5, 7) === selectedMonth
      );
    });
  }, [transactions, selectedMonth, selectedYear]);

  const fixedRevenueTransactions = useMemo(() => {
    return transactions.filter((item) =>
      isRevenueInMonth(item, selectedYear, selectedMonth)
    );
  }, [transactions, selectedMonth, selectedYear]);

  const totalTransaction = filteredTransactions.length;

  const totalGross = filteredTransactions.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const totalMdr = filteredTransactions.reduce(
    (total, item) => total + Number(item.mdr_amount || 0),
    0
  );

  const totalNet = filteredTransactions.reduce(
    (total, item) => total + Number(item.net_amount ?? item.amount ?? 0),
    0
  );

  const fixedRevenueGross = fixedRevenueTransactions.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const fixedRevenueMdr = fixedRevenueTransactions.reduce(
    (total, item) => total + Number(item.mdr_amount || 0),
    0
  );

  const fixedRevenueNet = fixedRevenueTransactions.reduce(
    (total, item) => total + Number(item.net_amount ?? item.amount ?? 0),
    0
  );


  /* =========================================================
     CLIENT PAYMENT INVOICE / RECEIPT
     - Generated per transaction.
     - Payment totals are calculated only up to the selected transaction,
       so a DP receipt keeps its historical remaining balance even if the
       booking is paid later.
  ========================================================= */

  const handleDownloadInvoice = async (transaction) => {
    if (!transaction?.id) return;

    setGeneratingInvoiceId(transaction.id);
    setErrorMessage("");

    try {
      let booking = null;
      let bookingTransactions = [];

      if (transaction.booking_id) {
        const {
          data: bookingData,
          error: bookingError,
        } = await supabase
          .from("bookings")
          .select(
            "id, customer_name, customer_phone, booking_date, start_time, package, package_price, status, payment_status"
          )
          .eq("id", transaction.booking_id)
          .maybeSingle();

        if (bookingError) {
          throw bookingError;
        }

        booking = bookingData || null;

        const {
          data: paymentData,
          error: paymentError,
        } = await supabase
          .from("transactions")
          .select(
            "id, transaction_date, created_at, amount, payment_type, payment_method"
          )
          .eq("booking_id", String(transaction.booking_id))
          .order("transaction_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (paymentError) {
          throw paymentError;
        }

        bookingTransactions = paymentData || [];
      }

      if (bookingTransactions.length === 0) {
        bookingTransactions = [transaction];
      }

      const selectedIndex = bookingTransactions.findIndex(
        (item) => String(item.id) === String(transaction.id)
      );

      const transactionsUntilSelected =
        selectedIndex >= 0
          ? bookingTransactions.slice(0, selectedIndex + 1)
          : bookingTransactions;

      const totalPaidUntilSelected = transactionsUntilSelected.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

      const packagePrice = Number(booking?.package_price || 0);
      const remainingAmount =
        packagePrice > 0
          ? Math.max(packagePrice - totalPaidUntilSelected, 0)
          : null;

      const bookingCanceled = booking?.status === "Canceled";
      const isPaid =
        !bookingCanceled &&
        packagePrice > 0 &&
        totalPaidUntilSelected >= packagePrice;

      const paymentStatus = bookingCanceled
        ? "DIBATALKAN"
        : isPaid
        ? "LUNAS"
        : totalPaidUntilSelected > 0
        ? "DP / BELUM LUNAS"
        : "BELUM BAYAR";

      const customerName =
        booking?.customer_name || transaction.customer || "-";
      const customerPhone = booking?.customer_phone || "-";
      const packageName =
        booking?.package || transaction.description || "-";
      const invoiceNumber = makeInvoiceNumber(transaction);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);
      doc.setTextColor(95, 95, 95);
      doc.text("PLUNO STUDIO", 16, 16);

      doc.setFontSize(20);
      doc.setTextColor(25, 25, 25);
      doc.text("INVOICE PEMBAYARAN", 16, 27);

      doc.setFontSize(8);
      doc.setTextColor(105, 105, 105);
      doc.text(`No. Invoice: ${invoiceNumber}`, 16, 34);
      doc.text(`Tanggal Pembayaran: ${formatDate(transaction.transaction_date)}`, 16, 39);

      const statusText = paymentStatus;
      doc.setFontSize(10);
      doc.setTextColor(25, 25, 25);
      doc.text(statusText, 194, 27, { align: "right" });

      doc.setDrawColor(220, 220, 220);
      doc.line(16, 45, 194, 45);

      autoTable(doc, {
        startY: 51,
        theme: "plain",
        head: [["KLIEN", "BOOKING"]],
        body: [[
          `${customerName}\n${customerPhone}`,
          `${packageName}\nSesi: ${formatDate(booking?.booking_date)} - ${formatTime(
            booking?.start_time
          )}`,
        ]],
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 4,
          textColor: [40, 40, 40],
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
        },
        headStyles: {
          fontSize: 7,
          textColor: [105, 105, 105],
          fontStyle: "normal",
          fillColor: [248, 248, 248],
        },
        columnStyles: {
          0: { cellWidth: 89 },
          1: { cellWidth: 89 },
        },
        margin: { left: 16, right: 16 },
      });

      const paymentY = (doc.lastAutoTable?.finalY || 78) + 8;

      autoTable(doc, {
        startY: paymentY,
        head: [["RINCIAN PEMBAYARAN", "NILAI"]],
        body: [
          ["Jenis Pembayaran", formatPaymentType(transaction.payment_type)],
          ["Metode Pembayaran", transaction.payment_method || "-"],
          ["Pembayaran Diterima", formatRupiah(transaction.amount)],
          [
            "Harga Paket",
            packagePrice > 0 ? formatRupiah(packagePrice) : "-",
          ],
          ["Total Dibayar", formatRupiah(totalPaidUntilSelected)],
          [
            "Sisa Pembayaran",
            bookingCanceled
              ? "-"
              : remainingAmount === null
              ? "-"
              : formatRupiah(remainingAmount),
          ],
          ["Status Pembayaran", paymentStatus],
        ],
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 3.4,
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
          textColor: [40, 40, 40],
        },
        headStyles: {
          fillColor: [25, 25, 25],
          textColor: [240, 240, 240],
          fontStyle: "normal",
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 88, textColor: [100, 100, 100] },
          1: { cellWidth: 90 },
        },
        margin: { left: 16, right: 16 },
      });

      let noteY = (doc.lastAutoTable?.finalY || paymentY + 55) + 11;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);

      if (bookingCanceled) {
        const lines = doc.splitTextToSize(
          "Status booking: Dibatalkan. Pembayaran yang sudah diterima tetap tercatat sebagai pembayaran dan tidak dikembalikan.",
          178
        );
        doc.text(lines, 16, noteY);
        noteY += lines.length * 4 + 3;
      } else if (isPaid) {
        doc.text(
          "Pembayaran telah diterima lunas. Sisa pembayaran: Rp 0.",
          16,
          noteY
        );
        noteY += 7;
      } else if (remainingAmount !== null) {
        doc.text(
          `Pembayaran telah diterima. Sisa pembayaran: ${formatRupiah(
            remainingAmount
          )}.`,
          16,
          noteY
        );
        noteY += 7;
      }

      doc.setDrawColor(225, 225, 225);
      doc.line(16, noteY + 3, 194, noteY + 3);

      doc.setFontSize(7);
      doc.setTextColor(125, 125, 125);
      doc.text(
        "Dokumen ini dibuat dari catatan pembayaran Pluno Studio.",
        16,
        noteY + 10
      );

      const filename = `invoice-${safeFileName(customerName)}-${
        transaction.transaction_date || "payment"
      }.pdf`;

      doc.save(filename);
    } catch (error) {
      console.error("INVOICE PDF ERROR:", error);
      setErrorMessage(
        `Gagal membuat invoice: ${error.message || "Unknown error"}`
      );
    } finally {
      setGeneratingInvoiceId(null);
    }
  };


  /* =========================================================
     MONTHLY TRANSACTION PDF
  ========================================================= */

  const handleDownloadPDF = () => {
    if (
      filteredTransactions.length === 0 &&
      fixedRevenueTransactions.length === 0
    ) {
      window.alert(
        `Tidak ada arus uang atau pendapatan fix untuk ${monthNames[Number(selectedMonth) - 1]} ${selectedYear}.`
      );
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("PLUNO INTERNAL SYSTEM", 14, 14);

    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text("Transaction & Revenue Performance", 14, 24);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Cash flow and fixed revenue · ${monthNames[Number(selectedMonth) - 1]} ${selectedYear}`,
      14,
      31
    );

    if (filteredTransactions.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(45, 45, 45);
      doc.text("Cash In — by Payment Date", 14, 39);

      autoTable(doc, {
        startY: 43,
        head: [[
          "Payment Date",
          "Event Date",
          "Revenue Period",
          "Customer",
          "Payment Type",
          "Package / Description",
          "Method",
          "Gross",
          "MDR",
          "Net",
          "Status",
        ]],
        body: filteredTransactions.map((item) => [
          formatDate(item.transaction_date),
          formatDate(getRevenueDate(item)),
          formatRevenuePeriod(getRevenueDate(item)),
          item.customer || "-",
          item.payment_type || "-",
          item.description || "-",
          item.payment_method || "-",
          formatRupiah(item.amount),
          Number(item.mdr_amount || 0) > 0
            ? `${item.mdr_percentage || 0}% · ${formatRupiah(item.mdr_amount)}`
            : "-",
          formatRupiah(item.net_amount ?? item.amount),
          item.booking_status === "Canceled"
            ? "Canceled"
            : "Complete",
        ]),
        styles: {
          font: "helvetica",
          fontSize: 6.3,
          cellPadding: 2.2,
        },
        headStyles: {
          fillColor: [25, 25, 25],
          textColor: [235, 235, 235],
          fontStyle: "normal",
        },
      });
    }

    const finalY = doc.lastAutoTable?.finalY || 43;

    autoTable(doc, {
      startY: finalY + 6,
      head: [["Payment Transactions", "Cash Received", "Cash MDR", "Net Cash Received"]],
      body: [[
        String(totalTransaction),
        formatRupiah(totalGross),
        formatRupiah(totalMdr),
        formatRupiah(totalNet),
      ]],
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [80, 80, 80],
        fontStyle: "normal",
      },
    });

    const fixedStartY = (doc.lastAutoTable?.finalY || finalY) + 10;

    doc.setFontSize(10);
    doc.setTextColor(45, 45, 45);
    doc.text("Fixed Revenue — by Event Date", 14, fixedStartY);

    if (fixedRevenueTransactions.length > 0) {
      autoTable(doc, {
        startY: fixedStartY + 4,
        head: [[
          "Payment Date",
          "Event Date",
          "Revenue Period",
          "Customer",
          "Payment Type",
          "Gross",
          "MDR",
          "Net",
        ]],
        body: fixedRevenueTransactions.map((item) => [
          formatDate(item.transaction_date),
          formatDate(getRevenueDate(item)),
          formatRevenuePeriod(getRevenueDate(item)),
          item.customer || "-",
          item.payment_type || "-",
          formatRupiah(item.amount),
          formatRupiah(item.mdr_amount || 0),
          formatRupiah(item.net_amount ?? item.amount),
        ]),
        styles: {
          font: "helvetica",
          fontSize: 6.8,
          cellPadding: 2.3,
        },
        headStyles: {
          fillColor: [25, 25, 25],
          textColor: [235, 235, 235],
          fontStyle: "normal",
        },
      });
    } else {
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text("No fixed revenue for this period.", 14, fixedStartY + 6);
    }

    autoTable(doc, {
      startY:
        fixedRevenueTransactions.length > 0
          ? (doc.lastAutoTable?.finalY || fixedStartY + 4) + 5
          : fixedStartY + 10,
      head: [[
        "Revenue Transactions",
        "Fixed Gross Revenue",
        "Fixed MDR",
        "Fixed Net Revenue",
      ]],
      body: [[
        String(fixedRevenueTransactions.length),
        formatRupiah(fixedRevenueGross),
        formatRupiah(fixedRevenueMdr),
        formatRupiah(fixedRevenueNet),
      ]],
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [80, 80, 80],
        fontStyle: "normal",
      },
    });

    doc.save(
      `transactions-${selectedYear}-${selectedMonth}.pdf`
    );
  };


  return (
    <div className="transactions-page">
      <Sidebar activePage="transactions" />

      <main className="transactions-main">
        <div className="transactions-section-heading">
          <div>
            <div className="transactions-section-label">
              PLUNO STUDIO / FINANCE
            </div>
            <h2>Transaction Performance</h2>
          </div>

          <div className="transactions-performance-filter">
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
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
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMessage && (
          <div className="transactions-error">
            {errorMessage}
          </div>
        )}

        <div className="transactions-summary">
          <div>
            <span>PAYMENT TRANSACTIONS</span>
            <strong>{totalTransaction}</strong>
          </div>

          <div>
            <span>CASH RECEIVED</span>
            <strong>{formatRupiah(totalGross)}</strong>
          </div>

          <div>
            <span>CASH MDR</span>
            <strong>{formatRupiah(totalMdr)}</strong>
          </div>

          <div>
            <span>NET CASH RECEIVED</span>
            <strong>{formatRupiah(totalNet)}</strong>
          </div>

          <div>
            <span>FIXED GROSS REVENUE</span>
            <strong>{formatRupiah(fixedRevenueGross)}</strong>
          </div>

          <div>
            <span>FIXED NET REVENUE</span>
            <strong>{formatRupiah(fixedRevenueNet)}</strong>
          </div>
        </div>

        <section className="transactions-card">
          <div className="transactions-card-header">
            <div>
              <span>TRANSACTION LEDGER</span>
              <h2>Booking Payments</h2>
            </div>

            <div className="transactions-header-actions">
              <button
                type="button"
                className="transactions-pdf-button"
                onClick={handleDownloadPDF}
                disabled={
                  loading ||
                  (
                    filteredTransactions.length === 0 &&
                    fixedRevenueTransactions.length === 0
                  )
                }
                title={
                  filteredTransactions.length === 0 &&
                  fixedRevenueTransactions.length === 0
                    ? "Tidak ada data untuk diekspor"
                    : "Download transaction PDF"
                }
              >
                Download PDF
              </button>
            </div>
          </div>

          <div className="transactions-table-scroll">
            <table className="transactions-table transactions-table-v2">
              <thead>
                <tr>
                  <th>PAYMENT DATE</th>
                  <th>EVENT DATE</th>
                  <th>FIXED REVENUE</th>
                  <th>CUSTOMER</th>
                  <th>PAYMENT TYPE</th>
                  <th>PACKAGE / DESCRIPTION</th>
                  <th>PAYMENT</th>
                  <th>GROSS</th>
                  <th>MDR</th>
                  <th>NET</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="12"
                      className="transactions-empty table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        Loading transactions...
                      </span>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan="12"
                      className="transactions-empty table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        No transactions found.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.transaction_date)}</td>
                      <td>{formatDate(getRevenueDate(item))}</td>
                      <td>
                        <span className="transactions-revenue-period">
                          {formatRevenuePeriod(getRevenueDate(item))}
                        </span>
                      </td>
                      <td>{item.customer || "-"}</td>
                      <td>
                        <span
                          className={`transactions-payment-type ${
                            item.payment_type === "Final Payment"
                              ? "final"
                              : item.payment_type === "Full Payment"
                              ? "final"
                              : "down-payment"
                          }`}
                        >
                          {item.payment_type || "Payment"}
                        </span>
                      </td>
                      <td>{item.description || "-"}</td>
                      <td>
                        <span
                          className={`transactions-payment ${
                            item.payment_method === "QRIS"
                              ? "qris"
                              : "cash"
                          }`}
                        >
                          {item.payment_method || "-"}
                        </span>
                      </td>
                      <td>{formatRupiah(item.amount)}</td>
                      <td>
                        {Number(item.mdr_amount || 0) > 0
                          ? `${item.mdr_percentage || 0}% · ${formatRupiah(item.mdr_amount)}`
                          : "-"}
                      </td>
                      <td>
                        {formatRupiah(item.net_amount ?? item.amount)}
                      </td>
                      <td>
                        <span
                          className={`transactions-booking-status ${
                            item.booking_status === "Canceled"
                              ? "canceled"
                              : "complete"
                          }`}
                        >
                          {item.booking_status === "Canceled"
                            ? "Canceled"
                            : "Complete"}
                        </span>
                      </td>
                      <td>
                        <div className="transactions-row-actions">
                          <button
                            type="button"
                            className="transactions-invoice"
                            onClick={() => handleDownloadInvoice(item)}
                            disabled={
                              generatingInvoiceId === item.id ||
                              deletingTransactionId === item.id
                            }
                          >
                            {generatingInvoiceId === item.id
                              ? "Generating..."
                              : "Invoice"}
                          </button>

                          <button
                            type="button"
                            className="transactions-delete"
                            onClick={() => handleDeleteTransaction(item)}
                            disabled={
                              deletingTransactionId === item.id ||
                              generatingInvoiceId === item.id
                            }
                          >
                            {deletingTransactionId === item.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="transactions-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>
    </div>
  );
}

export default Transactions;
