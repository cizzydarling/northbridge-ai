from datetime import datetime
from html import escape


def _normalize_language(language: str) -> str:
    return "fr" if (language or "").strip().lower() == "fr" else "en"


def _t(en: str, fr: str, lang: str) -> str:
    return fr if _normalize_language(lang) == "fr" else en


def _list_items(items, lang):
    if not items:
        return f"<p class='muted'>{_t('None available.', 'Aucun élément disponible.', lang)}</p>"

    return "<ul>" + "".join(f"<li>{escape(str(item))}</li>" for item in items) + "</ul>"


def build_strategy_report_html(profile, strategy_data, user_email=None, language="en"):
    lang = _normalize_language(language)

    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    crs_score = strategy_data.get("crs_score", "--")
    recommended_programs = strategy_data.get("recommended_programs", [])
    strengths = strategy_data.get("strengths", [])
    weaknesses = strategy_data.get("weaknesses", [])
    next_steps = strategy_data.get("next_steps", [])
    advisor_summary = strategy_data.get("advisor_summary", "")
    ai_strategy = strategy_data.get("ai_strategy", "")

    return f"""
    <!DOCTYPE html>
    <html lang="{lang}">
    <head>
      <meta charset="UTF-8" />
      <title>{_t("Strategy Report", "Rapport de stratégie", lang)}</title>
      <style>
        body {{
          font-family: Arial, sans-serif;
          background: #f8fafc;
          color: #0f172a;
          padding: 32px;
        }}
        .container {{
          max-width: 1000px;
          margin: auto;
          background: white;
          padding: 32px;
          border-radius: 16px;
        }}
        .muted {{
          color: #64748b;
        }}
        .section {{
          margin-top: 24px;
        }}
        h1 {{ margin-bottom: 0 }}
        h2 {{ margin-top: 24px }}
      </style>
    </head>
    <body>
      <div class="container">

        <h1>NorthBridgeAI</h1>
        <p class="muted">{_t("Generated on", "Généré le", lang)}: {generated_at}</p>
        <p class="muted">{_t("User", "Utilisateur", lang)}: {escape(str(user_email or "-"))}</p>

        <div class="section">
          <h2>{_t("Strategy Summary", "Résumé stratégique", lang)}</h2>
          <p>{escape(str(advisor_summary or ""))}</p>
        </div>

        <div class="section">
          <h2>{_t("CRS Score", "Score CRS", lang)}</h2>
          <p><strong>{crs_score}</strong></p>
        </div>

        <div class="section">
          <h2>{_t("Recommended Programs", "Programmes recommandés", lang)}</h2>
          {_list_items(recommended_programs, lang)}
        </div>

        <div class="section">
          <h2>{_t("Strengths", "Forces", lang)}</h2>
          {_list_items(strengths, lang)}
        </div>

        <div class="section">
          <h2>{_t("Weaknesses", "Faiblesses", lang)}</h2>
          {_list_items(weaknesses, lang)}
        </div>

        <div class="section">
          <h2>{_t("Next Steps", "Prochaines étapes", lang)}</h2>
          {_list_items(next_steps, lang)}
        </div>

        <div class="section">
          <h2>{_t("AI Strategy", "Stratégie IA", lang)}</h2>
          <p>{escape(str(ai_strategy or ""))}</p>
        </div>

        <div class="section muted">
          <p>
            {_t(
              "This report is general guidance and not legal advice.",
              "Ce rapport est fourni à titre informatif et ne constitue pas un avis juridique.",
              lang
            )}
          </p>
        </div>

      </div>
    </body>
    </html>
    """