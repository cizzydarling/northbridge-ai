import jsPDF from "jspdf";

function normalizeLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function buildFileName(title, language) {
  const fallback =
    normalizeLanguage(language) === "fr"
      ? "document_northbridgeai"
      : "northbridgeai_document";

  const safe = String(title || fallback)
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);

  return `${safe || fallback}.pdf`;
}

function splitParagraphs(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function exportDocumentToPdf({
  title,
  documentTypeLabel,
  language = "en",
  tone,
  content,
}) {
  const lang = normalizeLanguage(language);
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
  });

  const marginX = 56;
  const topStart = 60;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 28;

  let y = topStart;
  let pageNumber = 1;

  function drawHeader(isFirstPage = false) {
    if (isFirstPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(title || "NorthBridgeAI Document", marginX, y);

      y += 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const metaLine = [
        "NorthBridgeAI",
        documentTypeLabel ? `${lang === "fr" ? "Type" : "Type"}: ${documentTypeLabel}` : null,
        tone ? `${lang === "fr" ? "Ton" : "Tone"}: ${tone}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      doc.text(metaLine, marginX, y);
      y += 24;

      doc.setDrawColor(220, 226, 232);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 26;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("NorthBridgeAI", marginX, 28);
      doc.setDrawColor(230, 235, 240);
      doc.line(marginX, 36, pageWidth - marginX, 36);
      y = 56;
    }
  }

  function drawFooter() {
    doc.setDrawColor(230, 235, 240);
    doc.line(marginX, footerY - 12, pageWidth - marginX, footerY - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${lang === "fr" ? "Page" : "Page"} ${pageNumber}`,
      pageWidth - marginX,
      footerY,
      { align: "right" }
    );
  }

  function ensureSpace(requiredHeight = 24) {
    if (y + requiredHeight > footerY - 20) {
      drawFooter();
      doc.addPage();
      pageNumber += 1;
      drawHeader(false);
    }
  }

  drawHeader(true);

  const paragraphs = splitParagraphs(content);

  if (!paragraphs.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(
      lang === "fr"
        ? "Aucun contenu disponible pour l’export PDF."
        : "No content available for PDF export.",
      marginX,
      y
    );
  } else {
    paragraphs.forEach((paragraph) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      const lines = doc.splitTextToSize(paragraph, usableWidth);
      const estimatedHeight = lines.length * 15 + 10;

      ensureSpace(estimatedHeight);
      doc.text(lines, marginX, y);
      y += estimatedHeight;
    });
  }

  drawFooter();
  doc.save(buildFileName(title, lang));
}