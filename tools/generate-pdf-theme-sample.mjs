import { mkdir, writeFile } from "node:fs/promises";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  drawPdfFooter,
  drawPdfHeader,
  PDF_COLORS,
  plunoTableTheme,
} from "../src/lib/pdfTheme.js";

const outputDirectory = new URL("../output/pdf/", import.meta.url);
const outputFile = new URL("pluno-internal-pdf-style-sample.pdf", outputDirectory);

await mkdir(outputDirectory, { recursive: true });

const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

drawPdfHeader(doc, {
  title: "Monthly Financial Summary",
  subtitle: "STANDARDIZED OUTPUT PREVIEW",
  rightLabel: "AUGUST 2026",
});

doc.setFont("helvetica", "normal");
doc.setFontSize(8.5);
doc.setTextColor(...PDF_COLORS.muted);
doc.text(
  "A compact monochrome layout shared by transactions, spending, customers, timelines, and bookkeeping exports.",
  14,
  47,
);

autoTable(doc, {
  startY: 56,
  margin: { left: 14, right: 14, bottom: 20 },
  head: [["DATE", "DESCRIPTION", "CATEGORY", "STATUS", "AMOUNT"]],
  body: [
    ["04 Aug 2026", "Studio equipment rental", "Studio Expenses", "Paid", "Rp 2.450.000"],
    ["11 Aug 2026", "Campaign production deposit", "QRIS Revenue", "Received", "Rp 8.750.000"],
    ["18 Aug 2026", "Production transport", "Cash Spending", "Complete", "Rp 680.000"],
    ["27 Aug 2026", "Editing service payment", "Non-QRIS Revenue", "Received", "Rp 4.200.000"],
  ],
  columnStyles: {
    0: { cellWidth: 30 },
    2: { cellWidth: 43 },
    3: { cellWidth: 30 },
    4: { halign: "right", cellWidth: 42 },
  },
  ...plunoTableTheme(8),
});

const summaryY = doc.lastAutoTable.finalY + 14;
doc.setDrawColor(...PDF_COLORS.line);
doc.line(181, summaryY, 283, summaryY);
doc.setFontSize(7);
doc.setTextColor(...PDF_COLORS.muted);
doc.text("NET TOTAL", 181, summaryY + 8);
doc.setFontSize(14);
doc.setTextColor(...PDF_COLORS.ink);
doc.text("Rp 9.820.000", 283, summaryY + 8, { align: "right" });

drawPdfFooter(doc, "PLUNO STUDIO - INTERNAL FINANCIAL DOCUMENT");

const bytes = new Uint8Array(doc.output("arraybuffer"));
await writeFile(outputFile, bytes);

console.log(outputFile.pathname);
