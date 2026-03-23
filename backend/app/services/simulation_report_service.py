from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _yes_no(value):
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if value in (None, "", []):
        return "-"
    return str(value)


def _safe(value):
    if value in (None, "", []):
        return "-"
    return str(value)


def build_simulation_report_pdf(
    client_name: str,
    scenario_name: str,
    scenario_notes: str | None,
    simulation_data: dict,
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

    small_label = ParagraphStyle(
        "SmallLabel",
        parent=body_style,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )

    body_small = ParagraphStyle(
        "BodySmall",
        parent=body_style,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
    )

    story = []

    story.append(Paragraph("NorthBridgeAI - Simulation Report", title_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f"<b>Client:</b> {_safe(client_name)}", body_style))
    story.append(Paragraph(f"<b>Scenario:</b> {_safe(scenario_name)}", body_style))
    story.append(
        Paragraph(
            f"<b>Notes:</b> {_safe(scenario_notes) if scenario_notes else '-'}",
            body_style,
        )
    )
    story.append(Spacer(1, 0.22 * inch))

    crs = simulation_data.get("crs_comparison", {}) or {}
    pathways = simulation_data.get("pathway_comparison", {}) or {}
    simulated_result = simulation_data.get("simulated_result", {}) or {}
    current_profile = simulation_data.get("current_profile", {}) or {}
    simulated_changes = simulation_data.get("simulated_changes", {}) or {}

    story.append(Paragraph("CRS Summary", heading_style))
    story.append(Spacer(1, 0.08 * inch))

    crs_table = Table(
        [
            ["Metric", "Value"],
            ["Current CRS", _safe(crs.get("current_crs_score"))],
            ["Simulated CRS", _safe(crs.get("simulated_crs_score"))],
            ["Difference", _safe(crs.get("difference"))],
        ],
        colWidths=[2.8 * inch, 3.2 * inch],
    )
    crs_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(crs_table)
    story.append(Spacer(1, 0.22 * inch))

    story.append(Paragraph("Profile Snapshot", heading_style))
    story.append(Spacer(1, 0.08 * inch))

    profile_rows = [
        ["Field", "Current Profile", "Simulated Change"],
        ["Age", _safe(current_profile.get("age")), "-"],
        ["Education", _safe(current_profile.get("education")), "-"],
        [
            "Language Score",
            _safe(current_profile.get("language_score")),
            _safe(simulated_changes.get("language_score")),
        ],
        [
            "Experience Years",
            _safe(current_profile.get("experience_years")),
            _safe(simulated_changes.get("experience_years")),
        ],
        [
            "Has Job Offer",
            _yes_no(current_profile.get("has_job_offer")),
            _yes_no(simulated_changes.get("has_job_offer")),
        ],
        [
            "Canadian Experience",
            _yes_no(current_profile.get("has_canadian_experience")),
            _yes_no(simulated_changes.get("has_canadian_experience")),
        ],
        [
            "Studied in Canada",
            _yes_no(current_profile.get("studied_in_canada")),
            _yes_no(simulated_changes.get("studied_in_canada")),
        ],
        ["Occupation", _safe(current_profile.get("occupation")), "-"],
        ["NOC Code", _safe(current_profile.get("noc_code")), "-"],
        ["Preferred Province", _safe(current_profile.get("preferred_province")), "-"],
    ]

    profile_table = Table(
        profile_rows,
        colWidths=[2.0 * inch, 2.1 * inch, 2.1 * inch],
        repeatRows=1,
    )
    profile_table.setStyle(
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
    story.append(profile_table)
    story.append(Spacer(1, 0.22 * inch))

    story.append(Paragraph("Pathway Comparison", heading_style))
    story.append(Spacer(1, 0.08 * inch))

    current_pathways = pathways.get("current_eligible_pathways", []) or []
    simulated_pathways = pathways.get("simulated_eligible_pathways", []) or []
    unlocked_pathways = pathways.get("newly_unlocked_pathways", []) or []

    pathway_table = Table(
        [
            ["Category", "Details"],
            [
                "Current Eligible Pathways",
                ", ".join(current_pathways) if current_pathways else "None",
            ],
            [
                "Simulated Eligible Pathways",
                ", ".join(simulated_pathways) if simulated_pathways else "None",
            ],
            [
                "Newly Unlocked Pathways",
                ", ".join(unlocked_pathways) if unlocked_pathways else "None",
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
    story.append(Spacer(1, 0.22 * inch))

    story.append(Paragraph("Simulation Insights", heading_style))
    story.append(Spacer(1, 0.08 * inch))

    for label, items in [
        ("Strengths", simulated_result.get("strengths", []) or []),
        ("Weaknesses", simulated_result.get("weaknesses", []) or []),
        ("Next Steps", simulated_result.get("next_steps", []) or []),
    ]:
        story.append(Paragraph(label, small_label))
        if items:
            for item in items:
                story.append(Paragraph(f"- {_safe(item)}", body_small))
        else:
            story.append(Paragraph("-", body_small))
        story.append(Spacer(1, 0.1 * inch))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes