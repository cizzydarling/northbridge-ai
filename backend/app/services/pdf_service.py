from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Iterable, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from xml.sax.saxutils import escape


NB_INK = colors.HexColor("#111827")
NB_MUTED = colors.HexColor("#64748B")
NB_LINE = colors.HexColor("#E2E8F0")
NB_SOFT = colors.HexColor("#F8FAFC")
NB_PANEL = colors.HexColor("#F4F1EA")
NB_GOLD = colors.HexColor("#C58A22")
NB_DARK = colors.HexColor("#121417")
NB_TEAL = colors.HexColor("#0F766E")
NB_RED = colors.HexColor("#B91C1C")


def _clean_text(value: Optional[Any]) -> str:
    return escape(str(value or "").strip())


def _compact_text(value: Optional[Any], fallback: str = "--") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _safe_number(value: Any, fallback: str = "--") -> str:
    if isinstance(value, float):
        return f"{value:.0f}"
    if isinstance(value, int):
        return str(value)
    return _compact_text(value, fallback)


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _profile_get(profile: Any, field_name: str, default: Any = None) -> Any:
    if isinstance(profile, dict):
        return profile.get(field_name, default)
    return getattr(profile, field_name, default)


def _display_text(value: Any, fallback: str = "--") -> str:
    if isinstance(value, dict):
        value = (
            value.get("name")
            or value.get("pathway")
            or value.get("title")
            or value.get("program")
            or value.get("label")
            or value.get("summary")
            or value.get("value")
        )
    return _compact_text(value, fallback)


def _display_list(value: Any) -> list[str]:
    if isinstance(value, (list, tuple, set)):
        items = list(value)
    elif value:
        items = [value]
    else:
        items = []
    return [text for text in (_display_text(item, "") for item in items) if text]


def _build_styles():
    styles = getSampleStyleSheet()

    return {
        "cover_kicker": ParagraphStyle(
            "NBCoverKicker",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=NB_GOLD,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "NBCoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=31,
            textColor=colors.white,
            alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "cover_body": ParagraphStyle(
            "NBCoverBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=17,
            textColor=colors.HexColor("#CBD5E1"),
            alignment=TA_LEFT,
        ),
        "title": ParagraphStyle(
            "NBTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=26,
            textColor=NB_INK,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "NBSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=NB_MUTED,
            spaceAfter=12,
        ),
        "section": ParagraphStyle(
            "NBSection",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=NB_INK,
            spaceBefore=14,
            spaceAfter=7,
        ),
        "body": ParagraphStyle(
            "NBBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.7,
            leading=15,
            textColor=NB_INK,
            spaceAfter=6,
        ),
        "muted": ParagraphStyle(
            "NBMuted",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=12,
            textColor=NB_MUTED,
            spaceAfter=5,
        ),
        "label": ParagraphStyle(
            "NBLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=10,
            textColor=NB_MUTED,
        ),
        "metric": ParagraphStyle(
            "NBMetric",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            textColor=NB_INK,
        ),
        "table_header": ParagraphStyle(
            "NBTableHeader",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "NBTableCell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11.5,
            textColor=NB_INK,
            alignment=TA_LEFT,
        ),
        "table_cell_bold": ParagraphStyle(
            "NBTableCellBold",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.4,
            leading=11.5,
            textColor=NB_INK,
            alignment=TA_LEFT,
        ),
        "notice": ParagraphStyle(
            "NBNotice",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=12,
            textColor=NB_MUTED,
        ),
        "center": ParagraphStyle(
            "NBCenter",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=12,
            textColor=NB_MUTED,
            alignment=TA_CENTER,
        ),
    }


def _p(text: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_clean_text(text), style)


def _draw_page_chrome(canvas, doc):
    width, height = letter

    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)

    canvas.setStrokeColor(NB_LINE)
    canvas.setLineWidth(0.7)
    canvas.line(doc.leftMargin, height - 0.44 * inch, width - doc.rightMargin, height - 0.44 * inch)

    canvas.setFillColor(NB_INK)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(doc.leftMargin, height - 0.32 * inch, "NorthBridgeAI")

    canvas.setFillColor(NB_MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(width - doc.rightMargin, height - 0.32 * inch, "Premium Strategy Export")

    canvas.setStrokeColor(NB_LINE)
    canvas.line(doc.leftMargin, 0.44 * inch, width - doc.rightMargin, 0.44 * inch)

    canvas.setFillColor(NB_MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(doc.leftMargin, 0.27 * inch, "Informational planning support. Verify official IRCC requirements before filing.")
    canvas.drawRightString(width - doc.rightMargin, 0.27 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _make_doc(buffer: BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.65 * inch,
    )


def _add_rule(elements: list, color=NB_LINE):
    elements.append(
        HRFlowable(width="100%", thickness=0.7, color=color, spaceBefore=4, spaceAfter=10)
    )


def _add_section(
    elements: list,
    styles: dict,
    heading: str,
    *,
    paragraphs: Optional[Iterable[Any]] = None,
    bullets: Optional[Iterable[Any]] = None,
):
    elements.append(_p(heading, styles["section"]))
    _add_rule(elements)

    for paragraph in paragraphs or []:
        text = _display_text(paragraph, "")
        if text:
            elements.append(_p(text, styles["body"]))

    bullet_items = _display_list(list(bullets or []))
    if bullet_items:
        rows = []
        for item in bullet_items:
            rows.append([
                _p("-", styles["table_cell_bold"]),
                _p(item, styles["table_cell"]),
            ])
        table = Table(rows, colWidths=[0.18 * inch, 6.0 * inch], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("TEXTCOLOR", (0, 0), (0, -1), NB_GOLD),
                ]
            )
        )
        elements.append(table)
    elements.append(Spacer(1, 8))


def _metric_card(label: str, value: str, styles: dict):
    return [
        _p(label.upper(), styles["label"]),
        _p(value, styles["metric"]),
    ]


def _add_metric_grid(elements: list, styles: dict, metrics: list[tuple[str, str]], doc: SimpleDocTemplate):
    rows = []
    for index in range(0, len(metrics), 3):
        row = []
        for label, value in metrics[index:index + 3]:
            row.append(_metric_card(label, value, styles))
        while len(row) < 3:
            row.append("")
        rows.append(row)

    table = Table(rows, colWidths=[doc.width / 3 - 5, doc.width / 3 - 5, doc.width / 3 - 5])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NB_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.7, NB_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.7, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 14))


def _add_table(
    elements: list,
    styles: dict,
    headers: list[str],
    rows: list[list[Any]],
    col_widths: list[float],
):
    if not rows:
        return

    data = [[_p(header, styles["table_header"]) for header in headers]]
    for row in rows:
        data.append([_p(_display_text(cell), styles["table_cell"]) for cell in row])

    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NB_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, NB_SOFT]),
                ("BOX", (0, 0), (-1, -1), 0.7, NB_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, NB_LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 12))


def _build_cover(
    *,
    title: str,
    subtitle: str,
    prepared_for: str,
    language: str,
    styles: dict,
    doc: SimpleDocTemplate,
):
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meta = (
        f"Prepared for: {prepared_for} | Generated: {generated}"
        if language == "en"
        else f"Prepare pour: {prepared_for} | Genere: {generated}"
    )

    cover = Table(
        [
            [_p("NORTHBRIDGEAI", styles["cover_kicker"])],
            [_p(title, styles["cover_title"])],
            [_p(subtitle, styles["cover_body"])],
            [_p(meta, styles["cover_body"])],
        ],
        colWidths=[doc.width],
    )
    cover.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NB_DARK),
                ("BOX", (0, 0), (-1, -1), 0, NB_DARK),
                ("LEFTPADDING", (0, 0), (-1, -1), 28),
                ("RIGHTPADDING", (0, 0), (-1, -1), 28),
                ("TOPPADDING", (0, 0), (-1, 0), 26),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING", (0, 1), (-1, 1), 8),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 12),
                ("TOPPADDING", (0, 2), (-1, 2), 0),
                ("BOTTOMPADDING", (0, 2), (-1, 2), 28),
                ("TOPPADDING", (0, 3), (-1, 3), 16),
                ("BOTTOMPADDING", (0, 3), (-1, 3), 26),
            ]
        )
    )
    return cover


def generate_pdf_from_text(title: str, content: str) -> BytesIO:
    buffer = BytesIO()
    doc = _make_doc(buffer)
    styles = _build_styles()
    elements = [_p(title, styles["title"]), _p("NorthBridgeAI document export", styles["subtitle"])]
    _add_rule(elements, NB_GOLD)

    for raw_line in str(content or "").splitlines():
        line = raw_line.strip()
        if not line:
            elements.append(Spacer(1, 8))
            continue
        elements.append(_p(line, styles["body"]))

    doc.build(elements, onFirstPage=_draw_page_chrome, onLaterPages=_draw_page_chrome)
    buffer.seek(0)
    return buffer


def generate_pdf_from_sections(
    title: str,
    sections: Iterable[dict],
    subtitle: Optional[str] = None,
) -> BytesIO:
    buffer = BytesIO()
    doc = _make_doc(buffer)
    styles = _build_styles()
    elements = [_p(title, styles["title"])]

    if subtitle:
        elements.append(_p(subtitle, styles["subtitle"]))
    _add_rule(elements, NB_GOLD)

    for section in sections or []:
        section = section or {}
        _add_section(
            elements,
            styles,
            _compact_text(section.get("heading"), "Section"),
            paragraphs=section.get("paragraphs") or [],
            bullets=section.get("bullets") or [],
        )

    doc.build(elements, onFirstPage=_draw_page_chrome, onLaterPages=_draw_page_chrome)
    buffer.seek(0)
    return buffer


def _probability_display(strategy: dict) -> str:
    probability = strategy.get("probability_estimate") or strategy.get("probability") or {}
    probability = _as_dict(probability) if isinstance(probability, dict) else {"score": probability}
    value = (
        probability.get("overall_probability")
        or probability.get("chance_of_pr_within_12_months")
        or probability.get("score")
        or probability.get("probability")
    )
    if isinstance(value, (int, float)):
        return f"{round(value)}%"
    return _compact_text(value)


def _timeline_display(strategy: dict) -> str:
    timeline = strategy.get("timeline_estimate") or {}
    if isinstance(timeline, dict):
        value = (
            timeline.get("estimated_timeline")
            or timeline.get("timeline")
            or timeline.get("label")
            or timeline.get("range")
        )
        if value:
            return str(value)
    return _compact_text(strategy.get("timeline_summary"))


def _profile_name(profile: Any, user_email: Optional[str]) -> str:
    first = _compact_text(_profile_get(profile, "first_name", ""), "")
    last = _compact_text(_profile_get(profile, "last_name", ""), "")
    full = " ".join(part for part in [first, last] if part).strip()
    return full or _compact_text(user_email, "NorthBridgeAI user")


def _format_noc_line(strategy: dict, profile: Any, language: str) -> str:
    noc_summary = _as_dict(
        strategy.get("noc_summary")
        or strategy.get("noc_profile")
        or strategy.get("noc_advantage")
        or {}
    )
    code = (
        noc_summary.get("noc_code")
        or noc_summary.get("resolved_noc_code")
        or noc_summary.get("suggested_noc_code")
        or strategy.get("noc_code")
        or _profile_get(profile, "noc_code")
    )
    title = (
        noc_summary.get("noc_title")
        or noc_summary.get("resolved_title")
        or noc_summary.get("suggested_title")
        or strategy.get("noc_title")
        or _profile_get(profile, "occupation")
    )
    parts = [str(part) for part in [code, title] if str(part or "").strip()]
    return " - ".join(parts) if parts else ("Non disponible" if language == "fr" else "Not available")


def generate_strategy_pdf(
    strategy: dict,
    *,
    language: str = "en",
    profile: Optional[dict] = None,
    user_email: Optional[str] = None,
) -> BytesIO:
    strategy = strategy if isinstance(strategy, dict) else {}
    profile = profile if isinstance(profile, dict) else (getattr(profile, "__dict__", {}) or {})
    language = "fr" if str(language or "").lower() == "fr" else "en"

    def label(en: str, fr: str) -> str:
        return fr if language == "fr" else en

    buffer = BytesIO()
    doc = _make_doc(buffer)
    styles = _build_styles()
    elements: list = []

    title = label("NorthBridgeAI Premium Strategy Report", "Rapport strategique premium NorthBridgeAI")
    subtitle = label(
        "A structured case-readiness export with pathway ranking, action priorities, risk signals, and document preparation guidance.",
        "Un export structure avec classement des voies, priorites d'action, signaux de risque et preparation documentaire.",
    )
    prepared_for = _profile_name(profile, user_email)

    elements.append(
        _build_cover(
            title=title,
            subtitle=subtitle,
            prepared_for=prepared_for,
            language=language,
            styles=styles,
            doc=doc,
        )
    )
    elements.append(Spacer(1, 18))

    crs_score = strategy.get("crs_score", "--")
    crs_band = _as_dict(strategy.get("crs_band"))
    best_pathway = _as_dict(strategy.get("best_pathway"))
    probability = _as_dict(strategy.get("probability_estimate"))
    noc_line = _format_noc_line(strategy, profile, language)
    timeline_value = _timeline_display(strategy)

    metrics = [
        (label("CRS score", "Score CRS"), _safe_number(crs_score)),
        (label("Profile strength", "Force du profil"), _display_text(crs_band.get("label"))),
        (label("Best pathway", "Meilleur parcours"), _display_text(best_pathway)),
        (label("Probability", "Probabilite"), _probability_display(strategy)),
        (label("Timeline", "Delai"), timeline_value),
        (label("NOC signal", "Signal CNP"), noc_line),
    ]
    _add_metric_grid(elements, styles, metrics, doc)

    executive_paragraphs = [
        strategy.get("strategy_headline"),
        crs_band.get("description"),
        strategy.get("advisor_summary"),
    ]
    _add_section(
        elements,
        styles,
        label("Executive Read", "Lecture executive"),
        paragraphs=[item for item in executive_paragraphs if item],
    )

    scored_programs = [
        item for item in (strategy.get("scored_programs") or []) if isinstance(item, dict)
    ]
    if scored_programs:
        rows = []
        for index, item in enumerate(scored_programs[:6], start=1):
            reasons = _display_list(item.get("reasons"))[:2]
            rows.append(
                [
                    str(index),
                    _display_text(item.get("program")),
                    _safe_number(item.get("score")),
                    "; ".join(reasons) if reasons else "--",
                ]
            )
        _add_section(elements, styles, label("Pathway Ranking", "Classement des voies"))
        _add_table(
            elements,
            styles,
            [label("Rank", "Rang"), label("Pathway", "Voie"), label("Score", "Score"), label("Why it matters", "Pourquoi")],
            rows,
            [0.45 * inch, 1.8 * inch, 0.65 * inch, 3.25 * inch],
        )
    else:
        _add_section(
            elements,
            styles,
            label("Recommended Programs", "Programmes recommandes"),
            bullets=strategy.get("recommended_programs") or [],
        )

    roadmap = [item for item in (strategy.get("roadmap") or []) if isinstance(item, dict)]
    if roadmap:
        rows = []
        for index, item in enumerate(roadmap[:7], start=1):
            gain = item.get("estimated_crs_gain")
            gain_text = f"+{gain}" if isinstance(gain, (int, float)) and gain > 0 else "--"
            rows.append(
                [
                    str(index),
                    _display_text(item.get("title")),
                    _display_text(item.get("reason")),
                    gain_text,
                    _display_text(item.get("difficulty")),
                ]
            )
        _add_section(elements, styles, label("Action Roadmap", "Feuille de route"))
        _add_table(
            elements,
            styles,
            [
                "#",
                label("Action", "Action"),
                label("Strategic reason", "Raison strategique"),
                label("CRS", "CRS"),
                label("Effort", "Effort"),
            ],
            rows,
            [0.35 * inch, 1.55 * inch, 2.65 * inch, 0.55 * inch, 1.05 * inch],
        )

    province_rows = []
    for item in (strategy.get("province_recommendations") or [])[:5]:
        if isinstance(item, dict):
            province_rows.append(
                [
                    item.get("province"),
                    item.get("program"),
                    item.get("chance") or item.get("confidence") or "--",
                    item.get("reason"),
                ]
            )
    if province_rows:
        _add_section(elements, styles, label("Province Focus", "Ciblage provincial"))
        _add_table(
            elements,
            styles,
            [label("Province", "Province"), label("Stream", "Volet"), label("Fit", "Compatibilite"), label("Reason", "Raison")],
            province_rows,
            [1.15 * inch, 1.55 * inch, 0.75 * inch, 2.75 * inch],
        )

    probability_paragraphs = []
    if probability:
        probability_paragraphs.extend(
            [
                f"{label('Overall probability', 'Probabilite globale')}: {_probability_display(strategy)}",
                f"{label('Express Entry', 'Entree express')}: {_safe_number(probability.get('chance_via_express_entry'))}%",
                f"{label('PNP', 'PCP')}: {_safe_number(probability.get('chance_via_pnp'))}%",
                f"{label('Strongest path', 'Voie la plus forte')}: {_display_text(probability.get('strongest_path'))}",
                _display_text(probability.get("strongest_path_reason"), ""),
            ]
        )
    draw_prediction = _as_dict(strategy.get("draw_prediction"))
    if draw_prediction:
        probability_paragraphs.append(
            f"{label('Draw signal', 'Signal de tirage')}: {_display_text(draw_prediction.get('summary') or draw_prediction.get('recommendation') or draw_prediction)}"
        )
    if probability_paragraphs:
        _add_section(
            elements,
            styles,
            label("Probability and Draw Signals", "Probabilite et signaux de tirage"),
            paragraphs=probability_paragraphs,
        )

    _add_section(
        elements,
        styles,
        label("Strengths", "Forces"),
        bullets=strategy.get("strengths") or [],
    )
    _add_section(
        elements,
        styles,
        label("Risks to Watch", "Risques a surveiller"),
        bullets=[
            (
                f"{_display_text(risk.get('risk'))}: {_display_text(risk.get('impact'), '')} "
                f"{_display_text(risk.get('mitigation'), '')}"
            )
            for risk in (strategy.get("risk_analysis") or [])
            if isinstance(risk, dict)
        ]
        or strategy.get("weaknesses")
        or [],
    )
    _add_section(
        elements,
        styles,
        label("Next Steps", "Prochaines etapes"),
        bullets=strategy.get("next_steps") or [],
    )

    family_docs = [
        item for item in (strategy.get("family_document_requirements") or []) if isinstance(item, dict)
    ]
    completion = _as_dict(strategy.get("completion_signals"))
    document_notes = []
    if completion:
        yes = label("yes", "oui")
        no = label("no", "non")
        document_notes = [
            f"{label('Language score captured', 'Score linguistique saisi')}: {yes if completion.get('has_language_score') else no}",
            f"{label('Occupation captured', 'Profession saisie')}: {yes if completion.get('has_occupation') else no}",
            f"{label('NOC captured or detected', 'CNP saisi ou detecte')}: {yes if completion.get('has_noc_code') or completion.get('has_detected_noc') else no}",
            f"{label('Preferred province captured', 'Province preferee saisie')}: {yes if completion.get('has_preferred_province') else no}",
        ]
    if family_docs:
        document_notes.extend(
            f"{_display_text(item.get('label'))} ({_display_text(item.get('person'))})"
            for item in family_docs[:6]
        )
    if document_notes:
        _add_section(
            elements,
            styles,
            label("Document Readiness", "Preparation documentaire"),
            bullets=document_notes,
        )

    ai_strategy = strategy.get("ai_strategy")
    if ai_strategy:
        ai_paragraphs = [
            paragraph.strip()
            for paragraph in str(ai_strategy).split("\n\n")
            if paragraph.strip()
        ][:4]
        _add_section(
            elements,
            styles,
            label("AI Strategy Notes", "Notes strategiques IA"),
            paragraphs=ai_paragraphs,
        )

    notice = label(
        "This Premium export is a planning aid. Immigration programs, draws, NOC interpretation, and document requirements can change. Always verify current official IRCC requirements before filing or relying on this report.",
        "Cet export Premium est un outil de planification. Les programmes, tirages, interpretations CNP et exigences documentaires peuvent changer. Verifiez toujours les exigences officielles d'IRCC avant de deposer un dossier ou de vous fier a ce rapport.",
    )
    notice_box = Table(
        [[_p(notice, styles["notice"])]],
        colWidths=[doc.width],
    )
    notice_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NB_PANEL),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E7D7B6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(KeepTogether([_p(label("Important Notice", "Avis important"), styles["section"]), notice_box]))

    doc.build(elements, onFirstPage=_draw_page_chrome, onLaterPages=_draw_page_chrome)
    buffer.seek(0)
    return buffer
