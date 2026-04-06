from io import BytesIO
from typing import Iterable, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from xml.sax.saxutils import escape


def _clean_text(value: Optional[str]) -> str:
    return escape(str(value or "").strip())


def _build_styles():
    styles = getSampleStyleSheet()

    title_style = styles["Title"]
    heading_style = ParagraphStyle(
        "NBHeading",
        parent=styles["Heading2"],
        spaceAfter=8,
        spaceBefore=14,
    )
    body_style = ParagraphStyle(
        "NBBody",
        parent=styles["BodyText"],
        leading=16,
        spaceAfter=6,
    )
    bullet_style = ParagraphStyle(
        "NBBullet",
        parent=styles["BodyText"],
        leftIndent=14,
        bulletIndent=0,
        leading=16,
        spaceAfter=4,
    )

    return {
        "title": title_style,
        "heading": heading_style,
        "body": body_style,
        "bullet": bullet_style,
    }


def generate_pdf_from_text(title: str, content: str) -> BytesIO:
    """
    Generate a simple PDF from plain text content.

    - Blank lines create paragraph spacing
    - Each non-empty line becomes a paragraph
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
    )

    styles = _build_styles()
    elements = []

    elements.append(Paragraph(_clean_text(title), styles["title"]))
    elements.append(Spacer(1, 12))

    for raw_line in str(content or "").splitlines():
        line = raw_line.strip()
        if not line:
            elements.append(Spacer(1, 8))
            continue

        elements.append(Paragraph(_clean_text(line), styles["body"]))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_pdf_from_sections(
    title: str,
    sections: Iterable[dict],
    subtitle: Optional[str] = None,
) -> BytesIO:
    """
    Generate a richer PDF from structured sections.

    Each section may contain:
    {
        "heading": "Section title",
        "paragraphs": ["para 1", "para 2"],
        "bullets": ["item 1", "item 2"]
    }
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
    )

    styles = _build_styles()
    elements = []

    elements.append(Paragraph(_clean_text(title), styles["title"]))

    if subtitle:
      elements.append(Spacer(1, 6))
      elements.append(Paragraph(_clean_text(subtitle), styles["body"]))

    elements.append(Spacer(1, 12))

    for section in sections or []:
        heading = (section or {}).get("heading")
        paragraphs = (section or {}).get("paragraphs") or []
        bullets = (section or {}).get("bullets") or []

        if heading:
            elements.append(Paragraph(_clean_text(heading), styles["heading"]))

        for paragraph in paragraphs:
            text = str(paragraph or "").strip()
            if text:
                elements.append(Paragraph(_clean_text(text), styles["body"]))

        for bullet in bullets:
            text = str(bullet or "").strip()
            if text:
                elements.append(
                    Paragraph(
                        f"• {_clean_text(text)}",
                        styles["bullet"],
                    )
                )

        elements.append(Spacer(1, 8))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_strategy_pdf(strategy: dict) -> BytesIO:
    """
    Generate a reusable strategy PDF from a strategy payload.
    This is useful for Premium export routes.
    """
    strategy = strategy or {}

    crs_score = strategy.get("crs_score", "--")
    recommended_programs = strategy.get("recommended_programs") or []
    strengths = strategy.get("strengths") or []
    weaknesses = strategy.get("weaknesses") or []
    next_steps = strategy.get("next_steps") or []
    advisor_summary = strategy.get("advisor_summary") or ""
    noc_summary = strategy.get("noc_summary") or {}

    noc_parts = []
    if noc_summary.get("noc_code"):
        noc_parts.append(str(noc_summary["noc_code"]))
    if noc_summary.get("noc_title"):
        noc_parts.append(str(noc_summary["noc_title"]))
    elif noc_summary.get("occupation"):
        noc_parts.append(str(noc_summary["occupation"]))

    noc_line = " — ".join(noc_parts) if noc_parts else "Not available"

    sections = [
        {
            "heading": "Strategy Snapshot",
            "paragraphs": [
                f"CRS Score: {crs_score}",
                f"NOC Signal: {noc_line}",
            ],
        },
        {
            "heading": "Recommended Programs",
            "bullets": recommended_programs or ["No programs available."],
        },
        {
            "heading": "Strengths",
            "bullets": strengths or ["No strengths available."],
        },
        {
            "heading": "Weaknesses",
            "bullets": weaknesses or ["No weaknesses available."],
        },
        {
            "heading": "Next Steps",
            "bullets": next_steps or ["No next steps available."],
        },
    ]

    if advisor_summary:
        sections.append(
            {
                "heading": "Advisor Summary",
                "paragraphs": [advisor_summary],
            }
        )

    return generate_pdf_from_sections(
        title="NorthBridgeAI Strategy Report",
        subtitle="Personalized immigration strategy export",
        sections=sections,
    )