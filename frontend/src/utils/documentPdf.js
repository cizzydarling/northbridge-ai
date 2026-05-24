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

function isLikelySectionHeading(paragraph) {
  const value = String(paragraph || "").trim();

  if (!value) return false;
  if (value.length > 80) return false;
  if (value.endsWith(":")) return true;
  if (/^[A-Z][A-Za-z\s/&-]{2,60}$/.test(value)) return true;
  if (/^[À-ÿA-Z][À-ÿA-Za-z\s/&'-]{2,60}$/.test(value) && value.split(" ").length <= 8) {
    return true;
  }

  return false;
}

function normalizeParagraph(paragraph) {
  return String(paragraph || "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function safeText(value, fallback = "--") {
  const text = String(value || "").trim();
  return text || fallback;
}

function createPdfLayout(doc, language, title) {
  const lang = normalizeLanguage(language);
  const marginX = 56;
  const topStart = 60;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 28;

  let y = topStart;
  let pageNumber = 1;

  function drawHeader(isFirstPage = false, subtitle = "") {
    if (isFirstPage) {
      doc.setFillColor(18, 20, 23);
      doc.roundedRect(marginX, y - 8, usableWidth, 122, 16, 16, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(197, 138, 34);
      doc.text("NORTHBRIDGEAI", marginX + 22, y + 18);

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      const titleLines = doc.splitTextToSize(title || "NorthBridgeAI", usableWidth - 44);
      doc.text(titleLines, marginX + 22, y + 48);

      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(203, 213, 225);
        const lines = doc.splitTextToSize(subtitle, usableWidth - 44);
        doc.text(lines, marginX + 22, y + 80);
      }

      doc.setTextColor(0, 0, 0);
      y += 144;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text("NorthBridgeAI", marginX, 28);
      doc.setDrawColor(230, 235, 240);
      doc.line(marginX, 36, pageWidth - marginX, 36);
      doc.setTextColor(0, 0, 0);
      y = 56;
    }
  }

  function drawFooter() {
    doc.setDrawColor(230, 235, 240);
    doc.line(marginX, footerY - 12, pageWidth - marginX, footerY - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      lang === "fr"
        ? "Export PDF Premium - verifiez les exigences officielles avant le depot."
        : "Premium PDF export - verify official requirements before filing.",
      marginX,
      footerY
    );
    doc.text(
      `${lang === "fr" ? "Page" : "Page"} ${pageNumber}`,
      pageWidth - marginX,
      footerY,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
  }

  function ensureSpace(requiredHeight = 24) {
    if (y + requiredHeight > footerY - 20) {
      drawFooter();
      doc.addPage();
      pageNumber += 1;
      drawHeader(false);
    }
  }

  function drawBodyText(text, fontSize = 11, extraSpacing = 10) {
    const lines = doc.splitTextToSize(String(text || ""), usableWidth);
    const estimatedHeight = lines.length * (fontSize + 4) + extraSpacing;
    ensureSpace(estimatedHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(17, 24, 39);
    doc.text(lines, marginX, y);
    doc.setTextColor(0, 0, 0);
    y += estimatedHeight;
  }

  function drawMutedText(text, fontSize = 10, extraSpacing = 8) {
    const lines = doc.splitTextToSize(String(text || ""), usableWidth);
    const estimatedHeight = lines.length * (fontSize + 3) + extraSpacing;
    ensureSpace(estimatedHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(90, 102, 114);
    doc.text(lines, marginX, y);
    doc.setTextColor(0, 0, 0);
    y += estimatedHeight;
  }

  function drawSectionHeading(text) {
    ensureSpace(28);
    doc.setFillColor(197, 138, 34);
    doc.roundedRect(marginX, y - 9, 4, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(String(text || "").replace(/:\s*$/, ""), marginX + 12, y);
    doc.setTextColor(0, 0, 0);
    y += 20;
  }

  function drawSmallLabelValue(label, value) {
    const text = `${label}: ${value}`;
    const lines = doc.splitTextToSize(text, usableWidth);
    const estimatedHeight = lines.length * 13 + 8;
    ensureSpace(estimatedHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, marginX, y);
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(String(value || ""), usableWidth - labelWidth), marginX + labelWidth, y);
    y += estimatedHeight;
  }

  function drawBulletList(items, options = {}) {
    const safeItems = safeArray(items);
    const fontSize = options.fontSize || 11;
    const bulletIndent = marginX + 12;
    const textIndent = marginX + 24;
    const bulletWidth = usableWidth - 24;

    if (!safeItems.length) {
      return;
    }

    safeItems.forEach((item) => {
      const lines = doc.splitTextToSize(String(item || ""), bulletWidth);
      const estimatedHeight = lines.length * (fontSize + 4) + 6;
      ensureSpace(estimatedHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.text("-", bulletIndent, y);
      doc.text(lines, textIndent, y);
      y += estimatedHeight;
    });
  }

  function drawKeyValueGrid(items) {
    const safeItems = safeArray(items);
    if (!safeItems.length) return;

    const colGap = 12;
    const colWidth = (usableWidth - colGap) / 2;
    let currentX = marginX;
    let rowHeight = 0;

    safeItems.forEach((item, index) => {
      const label = safeText(item?.label);
      const value = safeText(item?.value);
      const labelLines = doc.splitTextToSize(label, colWidth - 16);
      const valueLines = doc.splitTextToSize(value, colWidth - 16);
      const boxHeight = Math.max(56, 18 + labelLines.length * 11 + valueLines.length * 15);

      if (index % 2 === 0) {
        ensureSpace(boxHeight + 8);
        currentX = marginX;
        rowHeight = boxHeight;
      } else {
        currentX = marginX + colWidth + colGap;
        rowHeight = Math.max(rowHeight, boxHeight);
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(currentX, y, colWidth, boxHeight, 12, 12, "FD");
      doc.setFillColor(197, 138, 34);
      doc.roundedRect(currentX + 8, y + 8, 22, 3, 2, 2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(labelLines, currentX + 8, y + 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(valueLines, currentX + 8, y + 42);

      doc.setTextColor(0, 0, 0);

      if (index % 2 === 1 || index === safeItems.length - 1) {
        y += rowHeight + 12;
      }
    });
  }

  function finish() {
    drawFooter();
  }

  return {
    lang,
    marginX,
    usableWidth,
    drawHeader,
    drawFooter,
    ensureSpace,
    drawBodyText,
    drawMutedText,
    drawSectionHeading,
    drawSmallLabelValue,
    drawBulletList,
    drawKeyValueGrid,
    finish,
    getY: () => y,
    setY: (nextY) => {
      y = nextY;
    },
  };
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

  const layout = createPdfLayout(doc, lang, title || "NorthBridgeAI Document");

  const metaLine = [
    "NorthBridgeAI",
    documentTypeLabel
      ? `${lang === "fr" ? "Type" : "Type"}: ${documentTypeLabel}`
      : null,
    tone ? `${lang === "fr" ? "Ton" : "Tone"}: ${tone}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  layout.drawHeader(true, metaLine);

  const paragraphs = splitParagraphs(content).map(normalizeParagraph).filter(Boolean);

  if (!paragraphs.length) {
    layout.drawBodyText(
      lang === "fr"
        ? "Aucun contenu disponible pour l’export PDF."
        : "No content available for PDF export."
    );
  } else {
    paragraphs.forEach((paragraph, index) => {
      if (isLikelySectionHeading(paragraph)) {
        if (index > 0) {
          layout.setY(layout.getY() + 4);
        }
        layout.drawSectionHeading(paragraph);
      } else {
        layout.drawBodyText(paragraph);
      }
    });
  }

  layout.finish();
  doc.save(buildFileName(title, lang));
}

export function exportStrategyReportToPdf({
  strategy,
  language = "en",
  applicantName = "",
}) {
  const lang = normalizeLanguage(language);
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
  });

  const title =
    lang === "fr"
      ? "Rapport stratégique NorthBridgeAI"
      : "NorthBridgeAI Strategy Report";

  const layout = createPdfLayout(doc, lang, title);

  const subtitleParts = [
    applicantName || null,
    lang === "fr" ? "Rapport personnalisé de stratégie d’immigration" : "Personalized immigration strategy report",
  ].filter(Boolean);

  layout.drawHeader(true, subtitleParts.join(" | "));

  const crsScore = strategy?.crs_score;
  const crsBandLabel = strategy?.crs_band?.label;
  const timelineSummary = strategy?.timeline_summary;
  const bestPathway = strategy?.best_pathway?.name;
  const confidence = strategy?.best_pathway?.confidence;

  layout.drawKeyValueGrid([
    {
      label: lang === "fr" ? "Score CRS" : "CRS Score",
      value: typeof crsScore !== "undefined" && crsScore !== null ? String(crsScore) : "--",
    },
    {
      label: lang === "fr" ? "Force du profil" : "Profile strength",
      value: safeText(crsBandLabel),
    },
    {
      label: lang === "fr" ? "Meilleur parcours" : "Best pathway",
      value: safeText(bestPathway),
    },
    {
      label: lang === "fr" ? "Confiance" : "Confidence",
      value: safeText(confidence),
    },
  ]);

  if (strategy?.strategy_headline) {
    layout.drawSectionHeading(lang === "fr" ? "Lecture stratégique" : "Strategic read");
    layout.drawBodyText(strategy.strategy_headline);
  }

  if (strategy?.crs_band?.description) {
    layout.drawSectionHeading(lang === "fr" ? "Lecture du score" : "Score interpretation");
    layout.drawBodyText(strategy.crs_band.description);
  }

  if (timelineSummary) {
    layout.drawSectionHeading(lang === "fr" ? "Délai estimé" : "Estimated timeline");
    layout.drawBodyText(timelineSummary);
  }

  if (Array.isArray(strategy?.best_pathway?.reasons) && strategy.best_pathway.reasons.length) {
    layout.drawSectionHeading(lang === "fr" ? "Pourquoi ce parcours" : "Why this pathway");
    layout.drawBulletList(strategy.best_pathway.reasons);
  }

  if (safeArray(strategy?.recommended_programs).length) {
    layout.drawSectionHeading(lang === "fr" ? "Programmes recommandés" : "Recommended programs");
    layout.drawBulletList(strategy.recommended_programs);
  }

  if (safeArray(strategy?.strengths).length) {
    layout.drawSectionHeading(lang === "fr" ? "Forces" : "Strengths");
    layout.drawBulletList(strategy.strengths);
  }

  if (safeArray(strategy?.weaknesses).length) {
    layout.drawSectionHeading(lang === "fr" ? "Faiblesses" : "Weaknesses");
    layout.drawBulletList(strategy.weaknesses);
  }

  if (safeArray(strategy?.next_steps).length) {
    layout.drawSectionHeading(lang === "fr" ? "Prochaines étapes" : "Next steps");
    layout.drawBulletList(strategy.next_steps);
  }

  if (safeArray(strategy?.roadmap).length) {
    layout.drawSectionHeading(lang === "fr" ? "Feuille de route" : "Roadmap");
    strategy.roadmap.forEach((step, index) => {
      const titleLine =
        `${index + 1}. ${safeText(step?.title)}` +
        (typeof step?.estimated_crs_gain === "number" && step.estimated_crs_gain > 0
          ? ` (${lang === "fr" ? "gain estimé" : "estimated gain"}: +${step.estimated_crs_gain} CRS)`
          : "");

      layout.drawBodyText(titleLine, 11, 6);

      if (step?.reason) {
        layout.drawMutedText(step.reason, 10, 6);
      }

      if (step?.difficulty) {
        layout.drawMutedText(
          `${lang === "fr" ? "Difficulté" : "Difficulty"}: ${step.difficulty}`,
          10,
          8
        );
      }
    });
  }

  if (safeArray(strategy?.province_recommendations).length) {
    layout.drawSectionHeading(
      lang === "fr" ? "Provinces recommandées" : "Recommended provinces"
    );

    strategy.province_recommendations.forEach((item) => {
      layout.drawBodyText(
        `${safeText(item?.province)} - ${safeText(item?.program)}`,
        11,
        4
      );

      if (item?.chance) {
        layout.drawMutedText(
          `${lang === "fr" ? "Probabilité" : "Likelihood"}: ${item.chance}`,
          10,
          4
        );
      }

      if (item?.reason) {
        layout.drawMutedText(item.reason, 10, 8);
      }
    });
  }

  if (safeArray(strategy?.risk_analysis).length) {
    layout.drawSectionHeading(lang === "fr" ? "Risques à surveiller" : "Risks to watch");

    strategy.risk_analysis.forEach((risk) => {
      layout.drawBodyText(safeText(risk?.risk), 11, 4);

      if (risk?.impact) {
        layout.drawMutedText(
          `${lang === "fr" ? "Impact" : "Impact"}: ${risk.impact}`,
          10,
          4
        );
      }

      if (risk?.mitigation) {
        layout.drawMutedText(
          `${lang === "fr" ? "Atténuation" : "Mitigation"}: ${risk.mitigation}`,
          10,
          8
        );
      }
    });
  }

  if (strategy?.advisor_summary) {
    layout.drawSectionHeading(lang === "fr" ? "Résumé conseiller" : "Advisor summary");
    layout.drawBodyText(strategy.advisor_summary);
  }

  if (strategy?.ai_strategy) {
    layout.drawSectionHeading(lang === "fr" ? "Analyse IA" : "AI analysis");
    splitParagraphs(strategy.ai_strategy).forEach((paragraph) => {
      layout.drawBodyText(paragraph);
    });
  }

  layout.drawSectionHeading(lang === "fr" ? "Avis important" : "Important notice");
  layout.drawMutedText(
    lang === "fr"
      ? "Ce rapport est fourni à titre informatif seulement et ne constitue pas un avis juridique ou réglementaire."
      : "This report is provided for informational purposes only and does not constitute legal or regulatory advice.",
    10,
    8
  );

  layout.finish();

  const fileName =
    lang === "fr"
      ? buildFileName("rapport_strategie_northbridgeai", lang)
      : buildFileName("northbridgeai_strategy_report", lang);

  doc.save(fileName);
}
