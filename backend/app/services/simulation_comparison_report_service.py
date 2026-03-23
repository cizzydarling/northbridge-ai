from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _safe(value):
    if value in (None, "", []):
        return "-"
    return str(value)


def _yes_no(value):
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if value in (None, "", []):
        return "-"
    return str(value)


def _format_change_label(field: str) -> str:
    return field.replace("_", " ").title()


def _build_recommendation_text(first_name: str, second_name: str, comparison: dict) -> str:
    crs = comparison.get("crs", {}) or {}
    pathways = comparison.get("pathways", {}) or {}

    first_score = crs.get("first_score")
    second_score = crs.get("second_score")
    difference = crs.get("difference")

    second_only = pathways.get("second_only", []) or []
    first_only = pathways.get("first_only", []) or []
    shared = pathways.get("shared", []) or []

    if isinstance(first_score, int) and isinstance(second_score, int):
        if second_score > first_score:
            if second_only:
                return (
                    f"{second_name} appears stronger overall with a higher projected CRS score "
                    f"and additional unique pathway opportunities: {', '.join(second_only)}."
                )
            return (
                f"{second_name} appears stronger overall with a higher projected CRS score "
                f"than {first_name}."
            )

        if first_score > second_score:
            if first_only:
                return (
                    f"{first_name} appears stronger overall with a higher projected CRS score "
                    f"and additional unique pathway opportunities: {', '.join(first_only)}."
                )
            return (
                f"{first_name} appears stronger overall with a higher projected CRS score "
                f"than {second_name}."
            )

    if shared:
        return (
            f"Both scenarios are closely matched. Shared pathway options include "
            f"{', '.join(shared)}. Focus on the scenario that is more realistic to achieve."
        )

    return (
        "Neither scenario clearly dominates across all indicators. Review the score delta, "
        "pathway access, and feasibility of each change before choosing a preferred strategy."
    )


def build_simulation_comparison_report_pdf(
    client_name: str,
    first_name: str,
    second_name: str,
    comparison_payload: dict,
) -> bytes:
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    heading_style = styles["Heading2"]
    body_style = styles["BodyText"]

    body_small = ParagraphStyle(
        "BodySmall",
        parent=body_style,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
    )

    muted_label = ParagraphStyle(
        "MutedLabel",
        parent=body_style,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )

    story = []

    story.append(Paragraph("NorthBridgeAI - Simulation Comparison Report", title_style))
    story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph(f"<b>Client:</b> {_safe(client_name)}", body_style))
    story.append(Paragraph(f"<b>Scenario A:</b> {_safe(first_name)}", body_style))
    story.append(Paragraph(f"<b>Scenario B:</b> {_safe(second_name)}", body_style))
    story.append(Spacer(1, 0.2 * inch))

    comparison = comparison_payload.get("comparison", {}) or {}
    crs = comparison.get("crs", {}) or {}
    pathways = comparison.get("pathways", {}) or {}
    simulated_changes = comparison.get("simulated_changes", {}) or {}

    story.append(Paragraph("Executive Recommendation", heading_style))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        Paragraph(
            _build_recommendation_text(first_name, second_name, comparison),
            body_small,
        )
    )
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("CRS Comparison", heading_style))
    story.append(Spacer(1, 0.06 * inch))

    crs_table = Table(
        [
            ["Metric", first_name, second_name],
            ["Projected CRS", _safe(crs.get("first_score")), _safe(crs.get("second_score"))],
            ["Difference", "-", _safe(crs.get("difference"))],
        ],
        colWidths=[2.1 * inch, 2.1 * inch, 2.1 * inch],
    )
    crs_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(crs_table)
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("Pathway Analysis", heading_style))
    story.append(Spacer(1, 0.06 * inch))

    pathway_table = Table(
        [
            ["Category", "Details"],
            [
                f"Only in {first_name}",
                ", ".join(pathways.get("first_only", []) or []) or "None",
            ],
            [
                f"Only in {second_name}",
                ", ".join(pathways.get("second_only", []) or []) or "None",
            ],
            [
                "Shared Pathways",
                ", ".join(pathways.get("shared", []) or []) or "None",
            ],
        ],
        colWidths=[2.2 * inch, 4.0 * inch],
    )
    pathway_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(pathway_table)
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("Simulated Changes Side by Side", heading_style))
    story.append(Spacer(1, 0.06 * inch))

    first_changes = simulated_changes.get("first", {}) or {}
    second_changes = simulated_changes.get("second", {}) or {}
    all_keys = sorted(set(first_changes.keys()) | set(second_changes.keys()))

    change_rows = [["Field", first_name, second_name]]
    for key in all_keys:
        change_rows.append(
            [
                _format_change_label(key),
                _yes_no(first_changes.get(key)),
                _yes_no(second_changes.get(key)),
            ]
        )

    if len(change_rows) == 1:
        change_rows.append(["Changes", "None", "None"])

    changes_table = Table(
        change_rows,
        colWidths=[2.1 * inch, 2.1 * inch, 2.1 * inch],
        repeatRows=1,
    )
    changes_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(changes_table)
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("Advisor Notes", heading_style))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        Paragraph(
            "Use this comparison to choose the scenario that offers the best combination "
            "of projected score improvement, pathway access, and practical achievability. "
            "A stronger score is valuable, but realistic execution matters just as much.",
            body_small,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        Paragraph(
            "Tip: prioritize the scenario that balances score gain with changes the client "
            "can realistically complete in the shortest time window.",
            muted_label,
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes