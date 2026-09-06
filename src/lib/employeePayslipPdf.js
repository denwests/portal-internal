import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK = [25, 25, 27];
const MUTED = [105, 106, 111];
const LINE = [209, 210, 214];
const SOFT = [246, 246, 247];

export function formatPayslipCurrency(value) {
  return `Rp${Math.round(Number(value || 0)).toLocaleString("id-ID")}`;
}

export function formatPayslipPeriod(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return "-";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function calculatePayslipTotals(payslip) {
  const entries = Array.isArray(payslip.entries) ? payslip.entries : [];
  const totalFor = (type) => entries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const baseSalary = Number(payslip.base_salary || 0);
  const overtime = totalFor("Overtime");
  const incentive = totalFor("Incentive");
  const otherIncome = totalFor("Other");
  const deduction = Number(payslip.deduction || 0);
  return {
    baseSalary,
    overtime,
    incentive,
    otherIncome,
    grossPay: baseSalary + overtime + incentive + otherIncome,
    deduction,
    netPay: baseSalary + overtime + incentive + otherIncome - deduction,
  };
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function buildEmployeePayslipPdf(payslip) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = width - (margin * 2);
  const totals = calculatePayslipTotals(payslip);
  const entries = (Array.isArray(payslip.entries) ? payslip.entries : []).filter((entry) => Number(entry.amount || 0) > 0 || String(entry.description || "").trim());

  doc.setProperties({
    title: `${safeText(payslip.brand_name)} Employee Payslip`,
    subject: safeText(payslip.payslip_number),
    author: safeText(payslip.brand_name),
    creator: "PLUNO Studio Internal Portal",
  });

  doc.setFillColor(...INK);
  doc.rect(0, 0, width, 31, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(247, 247, 248);
  doc.text(safeText(payslip.brand_name).toUpperCase(), margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(181, 182, 187);
  doc.text("EMPLOYEE PAYSLIP", margin, 22);
  doc.setTextColor(247, 247, 248);
  doc.text(safeText(payslip.payslip_number), width - margin, 18, { align: "right" });

  const meta = [
    ["EMPLOYEE", safeText(payslip.employee_name)],
    ["POSITION", safeText(payslip.position)],
    ["PERIOD", formatPayslipPeriod(payslip.period)],
  ];
  const metaWidth = contentWidth / 3;
  meta.forEach(([label, value], index) => {
    const x = margin + (index * metaWidth);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x + (index ? 2 : 0), 43, metaWidth - 2, 25, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 5, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(value, metaWidth - 10);
    doc.text(lines.slice(0, 2), x + 5, 61);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("PAY SUMMARY", margin, 83);

  autoTable(doc, {
    startY: 88,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: "grid",
    head: [["DESCRIPTION", "AMOUNT"]],
    body: [
      ["Base Salary", formatPayslipCurrency(totals.baseSalary)],
      ["Overtime", formatPayslipCurrency(totals.overtime)],
      ["Incentive", formatPayslipCurrency(totals.incentive)],
      ["Other Income", formatPayslipCurrency(totals.otherIncome)],
      ["Deductions", totals.deduction ? `- ${formatPayslipCurrency(totals.deduction)}` : formatPayslipCurrency(0)],
    ],
    foot: [["NET PAY", formatPayslipCurrency(totals.netPay)]],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3.6, lineColor: LINE, lineWidth: 0.2, textColor: INK },
    headStyles: { fillColor: INK, textColor: [247, 247, 248], fontStyle: "normal" },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold", fontSize: 10 },
    columnStyles: { 0: { cellWidth: contentWidth - 48 }, 1: { cellWidth: 48, halign: "right" } },
  });

  let nextY = (doc.lastAutoTable?.finalY || 132) + 14;
  if (entries.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text("OVERTIME AND INCENTIVE DETAILS", margin, nextY);
    autoTable(doc, {
      startY: nextY + 5,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: "grid",
      head: [["DATE", "TYPE", "DESCRIPTION", "AMOUNT"]],
      body: entries.map((entry) => [formatDate(entry.date), safeText(entry.type), safeText(entry.description), formatPayslipCurrency(entry.amount)]),
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3, lineColor: LINE, lineWidth: 0.2, textColor: INK },
      headStyles: { fillColor: INK, textColor: [247, 247, 248], fontStyle: "normal" },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 28 }, 2: { cellWidth: contentWidth - 90 }, 3: { cellWidth: 35, halign: "right" } },
    });
    nextY = (doc.lastAutoTable?.finalY || nextY) + 12;
  }

  if (payslip.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text("NOTES", margin, nextY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(safeText(payslip.notes), contentWidth), margin, nextY + 6);
  }

  doc.setDrawColor(...LINE);
  doc.line(margin, height - 20, width - margin, height - 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("CONFIDENTIAL - INTERNAL EMPLOYEE DOCUMENT", margin, height - 13);
  doc.text(`Generated ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(new Date(payslip.generated_at || Date.now()))}`, width - margin, height - 13, { align: "right" });

  return doc;
}

export function downloadEmployeePayslipPdf(payslip) {
  buildEmployeePayslipPdf(payslip).save(`${safeText(payslip.payslip_number, "employee-payslip")}.pdf`);
}

export function previewEmployeePayslipPdf(payslip) {
  const blobUrl = URL.createObjectURL(buildEmployeePayslipPdf(payslip).output("blob"));
  const popup = window.open("", "_blank");
  if (popup) {
    popup.opener = null;
    popup.location.href = blobUrl;
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return Boolean(popup);
}
