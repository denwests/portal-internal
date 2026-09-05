import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK = [24, 24, 25];
const MUTED = [112, 113, 118];
const LINE = [205, 206, 210];
const SOFT = [246, 246, 247];

export function formatInvoiceCurrency(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export function formatInvoiceDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatGeneratedAt(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(".", ":");
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function buildSmmInvoicePdf(invoice) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = width - (margin * 2);

  doc.setProperties({
    title: safeText(invoice.title, "Invoice"),
    subject: `Invoice ${safeText(invoice.invoice_number)}`,
    author: safeText(invoice.brand_name, "Vanguena"),
    creator: "PLUNO Studio Internal Portal",
  });

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(safeText(invoice.brand_name, "VANGUENA").toUpperCase(), width / 2, 29, { align: "center" });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(margin, 40, width - margin, 40);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`Dear, ${safeText(invoice.client_name, "Client")}`, width / 2, 59, { align: "center" });
  doc.text(`Thank you for trusting ${safeText(invoice.brand_name, "Vanguena")}.`, width / 2, 69, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Please keep a copy of this invoice for your records.", width / 2, 77, { align: "center" });

  doc.setFillColor(...SOFT);
  doc.roundedRect(margin, 89, contentWidth, 28, 2, 2, "F");

  const meta = [
    ["INVOICE ID", safeText(invoice.invoice_number)],
    ["INVOICE DATE", formatInvoiceDate(invoice.invoice_date)],
  ];
  const columnWidth = contentWidth / meta.length;
  meta.forEach(([label, value], index) => {
    const x = margin + (columnWidth * index) + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, x, 98);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(value, x, 108);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(safeText(invoice.title, "HERE IS YOUR INVOICE").toUpperCase(), margin, 132);

  autoTable(doc, {
    startY: 137,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [["DESCRIPTION", "PRICE", "INFORMATION"]],
    body: [[
      safeText(invoice.description),
      formatInvoiceCurrency(invoice.amount),
      safeText(invoice.information),
    ]],
    foot: [["TOTAL", formatInvoiceCurrency(invoice.amount), ""]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.25,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: INK,
      fontStyle: "bold",
      halign: "left",
    },
    footStyles: {
      fillColor: SOFT,
      textColor: INK,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 69 },
      1: { cellWidth: 42 },
      2: { cellWidth: contentWidth - 111 },
    },
  });

  const paymentY = Math.min((doc.lastAutoTable?.finalY || 165) + 18, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("PAYMENT", margin, paymentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const paymentLines = doc.splitTextToSize(safeText(invoice.payment_information, "Payment information has not been configured."), contentWidth);
  doc.text(paymentLines, margin, paymentY + 7);

  const height = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE);
  doc.line(margin, height - 20, width - margin, height - 20);
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${formatGeneratedAt(invoice.generated_at)} WIB`, margin, height - 13);
  doc.text(safeText(invoice.brand_name, "Vanguena"), width - margin, height - 13, { align: "right" });

  return doc;
}

export function downloadSmmInvoicePdf(invoice) {
  const doc = buildSmmInvoicePdf(invoice);
  doc.save(`${safeText(invoice.invoice_number, "smm-invoice")}.pdf`);
}

export function previewSmmInvoicePdf(invoice) {
  const doc = buildSmmInvoicePdf(invoice);
  const blobUrl = URL.createObjectURL(doc.output("blob"));
  const popup = window.open("", "_blank");
  if (popup) {
    popup.opener = null;
    popup.location.href = blobUrl;
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return Boolean(popup);
}
