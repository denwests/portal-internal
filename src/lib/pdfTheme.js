export const PDF_COLORS = {
  ink: [29, 30, 31],
  muted: [104, 106, 108],
  line: [220, 220, 214],
  paperSoft: [247, 247, 243],
  header: [22, 23, 25],
  headerText: [242, 242, 237],
  accent: [118, 118, 122],
};

export function drawPdfHeader(doc, {
  kicker = "PLUNO STUDIO · INTERNAL PORTAL",
  title,
  subtitle,
  rightLabel,
}) {
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_COLORS.header);
  doc.rect(0, 0, width, 36, "F");

  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 35.2, width, 0.8, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_COLORS.accent);
  doc.text(kicker.toUpperCase(), 14, 10);

  doc.setFontSize(17);
  doc.setTextColor(...PDF_COLORS.headerText);
  doc.text(title, 14, 21);

  if (subtitle) {
    doc.setFontSize(7.5);
    doc.setTextColor(158, 160, 162);
    doc.text(subtitle, 14, 28.5);
  }

  if (rightLabel) {
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.headerText);
    doc.text(rightLabel, width - 14, 20, { align: "right" });
  }

  doc.setTextColor(...PDF_COLORS.ink);
}

export function plunoTableTheme(fontSize = 8) {
  return {
    styles: {
      font: "helvetica",
      fontSize,
      cellPadding: 2.7,
      textColor: PDF_COLORS.ink,
      lineColor: PDF_COLORS.line,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: PDF_COLORS.header,
      textColor: PDF_COLORS.headerText,
      fontStyle: "normal",
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.paperSoft,
    },
  };
}

export function drawPdfFooter(doc, label = "PLUNO STUDIO - INTERNAL DOCUMENT") {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.setLineWidth(0.2);
    doc.line(14, height - 12, width - 14, height - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, 14, height - 7);
    doc.text(`PAGE ${page} / ${pageCount}`, width - 14, height - 7, { align: "right" });
  }

  doc.setPage(currentPage);
}
