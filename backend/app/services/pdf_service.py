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
                        f"- {_clean_text(text)}",
                        styles["bullet"],
                    )
                )

        elements.append(Spacer(1, 8))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_strategy_pdf(
    strategy: dict,
    *,
    language: str = "en",
    profile: Optional[dict] = None,
    user_email: Optional[str] = None,
) -> BytesIO:
    """
    Generate a reusable strategy PDF from a strategy payload.
    This avoids external wkhtmltopdf dependencies for deployment.
    """
    strategy = strategy if isinstance(strategy, dict) else {}
    profile = profile if isinstance(profile, dict) else (getattr(profile, "__dict__", {}) or {})
    language = "fr" if str(language or "").lower() == "fr" else "en"

    def label(en: str, fr: str) -> str:
        return fr if language == "fr" else en

    def as_dict(value) -> dict:
        return value if isinstance(value, dict) else {}

    def display_text(value) -> str:
        if isinstance(value, dict):
            value = (
                value.get("name")
                or value.get("pathway")
                or value.get("title")
                or value.get("program")
                or value.get("label")
                or value.get("summary")
            )
        return str(value or "").strip()

    def display_list(value) -> list[str]:
        if isinstance(value, (list, tuple, set)):
            items = value
        elif value:
            items = [value]
        else:
            items = []

        return [text for text in (display_text(item) for item in items) if text]

    crs_score = strategy.get("crs_score", "--")
    recommended_programs = display_list(
        strategy.get("recommended_programs") or strategy.get("programs")
    )
    strengths = display_list(strategy.get("strengths"))
    weaknesses = display_list(strategy.get("weaknesses"))
    next_steps = display_list(strategy.get("next_steps"))
    advisor_summary = strategy.get("advisor_summary") or ""
    noc_summary = as_dict(
        strategy.get("noc_summary")
        or strategy.get("noc_profile")
        or strategy.get("noc_advantage")
        or {}
    )
    best_pathway = strategy.get("best_pathway")
    probability = strategy.get("probability_estimate")

    noc_code = (
        noc_summary.get("noc_code")
        or noc_summary.get("resolved_noc_code")
        or noc_summary.get("suggested_noc_code")
        or strategy.get("noc_code")
        or strategy.get("resolved_noc_code")
        or profile.get("noc_code")
    )
    noc_title = (
        noc_summary.get("noc_title")
        or noc_summary.get("resolved_title")
        or noc_summary.get("suggested_title")
        or strategy.get("noc_title")
        or strategy.get("resolved_title")
        or profile.get("occupation")
    )
    noc_parts = [str(part) for part in [noc_code, noc_title] if part]
    noc_line = " - ".join(noc_parts) if noc_parts else label("Not available", "Non disponible")

    if isinstance(probability, dict):
        probability_value = (
            probability.get("overall_probability")
            or probability.get("chance_of_pr_within_12_months")
            or probability.get("score")
            or probability.get("probability")
            or "--"
        )
    else:
        probability_value = probability or strategy.get("probability") or "--"

    if isinstance(probability_value, (int, float)):
        probability_value = f"{probability_value}%"

    best_pathway_name = (
        display_text(best_pathway)
        or (recommended_programs[0] if recommended_programs else None)
        or "--"
    )

    sections = [
        {
            "heading": label("Strategy Snapshot", "Apercu de la strategie"),
            "paragraphs": [
                f"{label('CRS Score', 'Score CRS')}: {crs_score}",
                f"{label('Best Pathway', 'Meilleur parcours')}: {best_pathway_name}",
                f"{label('NOC Signal', 'Signal CNP')}: {noc_line}",
                f"{label('Probability', 'Probabilite')}: {probability_value}",
            ],
        },
        {
            "heading": label("Recommended Programs", "Programmes recommandes"),
            "bullets": recommended_programs
            or [label("No programs available.", "Aucun programme disponible.")],
        },
        {
            "heading": label("Strengths", "Forces"),
            "bullets": strengths
            or [label("No strengths available.", "Aucune force disponible.")],
        },
        {
            "heading": label("Weaknesses", "Faiblesses"),
            "bullets": weaknesses
            or [label("No weaknesses available.", "Aucune faiblesse disponible.")],
        },
        {
            "heading": label("Next Steps", "Prochaines etapes"),
            "bullets": next_steps
            or [label("No next steps available.", "Aucune prochaine etape disponible.")],
        },
    ]

    if advisor_summary:
        sections.append(
            {
                "heading": label("Advisor Summary", "Resume du conseiller"),
                "paragraphs": [advisor_summary],
            }
        )

    footer_lines = []
    if user_email:
        footer_lines.append(f"{label('Prepared for', 'Prepare pour')}: {user_email}")
    footer_lines.append(
        label(
            "Informational planning support only; verify official IRCC requirements before filing.",
            "Soutien informatif seulement; verifiez les exigences officielles d'IRCC avant de soumettre.",
        )
    )
    sections.append(
        {
            "heading": label("Important note", "Note importante"),
            "paragraphs": footer_lines,
        }
    )

    return generate_pdf_from_sections(
        title=label("NorthBridgeAI Strategy Report", "Rapport de strategie NorthBridgeAI"),
        subtitle=label(
            "Personalized immigration strategy export",
            "Export personnalise de strategie d'immigration",
        ),
        sections=sections,
    )
