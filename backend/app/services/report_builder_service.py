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


def _render_key_value_grid(items, lang):
    safe_items = [(escape(str(label)), escape(str(value))) for label, value in items if value not in [None, ""]]
    if not safe_items:
        return f"<p class='muted'>{_t('None available.', 'Aucun élément disponible.', lang)}</p>"

    return (
        "<div class='kv-grid'>"
        + "".join(
            f"""
            <div class='kv-card'>
              <div class='kv-label'>{label}</div>
              <div class='kv-value'>{value}</div>
            </div>
            """
            for label, value in safe_items
        )
        + "</div>"
    )


def _render_profile_summary(profile, lang):
    if not profile:
        return f"<p class='muted'>{_t('No profile data available.', 'Aucune donnée de profil disponible.', lang)}</p>"

    items = [
        (_t("Age", "Âge", lang), profile.get("age")),
        (_t("Education", "Études", lang), profile.get("education")),
        (_t("Language score", "Score linguistique", lang), profile.get("language_score")),
        (_t("Experience years", "Années d’expérience", lang), profile.get("experience_years")),
        (_t("Occupation", "Profession", lang), profile.get("occupation")),
        (_t("NOC code", "Code CNP", lang), profile.get("noc_code")),
        (_t("Preferred province", "Province préférée", lang), profile.get("preferred_province")),
        (
            _t("Job offer", "Offre d’emploi", lang),
            _t("Yes", "Oui", lang) if profile.get("has_job_offer") else _t("No", "Non", lang),
        ),
        (
            _t("Canadian experience", "Expérience canadienne", lang),
            _t("Yes", "Oui", lang) if profile.get("has_canadian_experience") else _t("No", "Non", lang),
        ),
        (
            _t("Studied in Canada", "Études au Canada", lang),
            _t("Yes", "Oui", lang) if profile.get("studied_in_canada") else _t("No", "Non", lang),
        ),
    ]
    return _render_key_value_grid(items, lang)


def _render_noc_section(noc_advantage, strategy_data, lang):
    noc_summary = strategy_data.get("noc_summary", {}) or {}
    noc_advantage = noc_advantage or {}

    noc_code = noc_summary.get("noc_code") or noc_advantage.get("noc_code") or ""
    noc_title = noc_summary.get("noc_title") or ""
    teer = noc_summary.get("teer")
    if teer in [None, ""]:
        teer = noc_advantage.get("teer")
    strategic_value = noc_advantage.get("strategic_value")
    is_high_demand = noc_advantage.get("is_high_demand")

    summary_items = [
        (_t("NOC code", "Code CNP", lang), noc_code or "-"),
        (_t("Title", "Titre", lang), noc_title or "-"),
        (_t("TEER", "TEER", lang), teer if teer not in [None, ""] and teer >= 0 else "-"),
        (_t("Strategic value", "Valeur stratégique", lang), strategic_value or "-"),
        (
            _t("High-demand occupation", "Profession en demande", lang),
            _t("Yes", "Oui", lang) if is_high_demand else _t("No", "Non", lang) if is_high_demand is not None else "-",
        ),
    ]

    signals = noc_advantage.get("signals", []) or []
    recommendations = noc_advantage.get("recommendations", []) or []

    return f"""
    <div class="section">
      <h2>{_t("NOC Insight", "Analyse CNP", lang)}</h2>
      {_render_key_value_grid(summary_items, lang)}
      <div class="subsection">
        <h3>{_t("Why this matters", "Pourquoi c’est important", lang)}</h3>
        {_list_items(signals, lang)}
      </div>
      <div class="subsection">
        <h3>{_t("Recommended NOC actions", "Actions liées au CNP", lang)}</h3>
        {_list_items(recommendations, lang)}
      </div>
    </div>
    """


def _render_province_recommendations(items, lang):
    if not items:
        return f"<p class='muted'>{_t('No province recommendations available.', 'Aucune recommandation provinciale disponible.', lang)}</p>"

    cards = []
    for item in items:
      province = escape(str(item.get("province", "-")))
      program = escape(str(item.get("program", "-")))
      chance = escape(str(item.get("chance", "-")))
      score = item.get("score")
      reason = escape(str(item.get("reason", "")))

      score_line = ""
      if score not in [None, ""]:
          score_line = f"<p class='meta-row'>{_t('Score', 'Score', lang)}: <strong>{escape(str(score))}</strong></p>"

      cards.append(
          f"""
          <div class="recommendation-card">
            <div class="recommendation-top">
              <div>
                <p class="recommendation-title">{province}</p>
                <p class="recommendation-program">{program}</p>
              </div>
              <div class="pill">{chance}</div>
            </div>
            {score_line}
            <p class="recommendation-reason">{reason}</p>
          </div>
          """
      )

    return "<div class='recommendation-list'>" + "".join(cards) + "</div>"


def _render_roadmap(items, lang):
    if not items:
        return f"<p class='muted'>{_t('No roadmap available.', 'Aucune feuille de route disponible.', lang)}</p>"

    rows = []
    for item in items:
        title = escape(str(item.get("title", "-")))
        reason = escape(str(item.get("reason", "")))
        priority = escape(str(item.get("priority", "-")))
        difficulty = escape(str(item.get("difficulty", "-")))
        estimated_gain = item.get("estimated_crs_gain", "-")

        rows.append(
            f"""
            <div class="roadmap-card">
              <div class="roadmap-header">
                <h3>{title}</h3>
                <span class="pill-outline">{_t("Priority", "Priorité", lang)} {priority}</span>
              </div>
              <div class="roadmap-meta">
                <span>{_t("Estimated CRS gain", "Gain CRS estimé", lang)}: <strong>{escape(str(estimated_gain))}</strong></span>
                <span>{_t("Difficulty", "Difficulté", lang)}: <strong>{difficulty}</strong></span>
              </div>
              <p>{reason}</p>
            </div>
            """
        )

    return "<div class='roadmap-list'>" + "".join(rows) + "</div>"


def _render_improvement_scenarios(items, lang):
    if not items:
        return f"<p class='muted'>{_t('No improvement scenarios available.', 'Aucun scénario d’amélioration disponible.', lang)}</p>"

    rendered = []
    for item in items:
        label = escape(str(item.get("label") or item.get("scenario") or item.get("title") or "-"))
        current_score = item.get("current_crs_score", item.get("current_score", "-"))
        projected_score = item.get("projected_crs_score", item.get("new_score", item.get("projected_score", "-")))
        difference = item.get("difference", item.get("delta", "-"))

        rendered.append(
            f"""
            <div class="scenario-card">
              <h3>{label}</h3>
              <div class="scenario-grid">
                <div><span>{_t("Current", "Actuel", lang)}</span><strong>{escape(str(current_score))}</strong></div>
                <div><span>{_t("Projected", "Projeté", lang)}</span><strong>{escape(str(projected_score))}</strong></div>
                <div><span>{_t("Difference", "Différence", lang)}</span><strong>{escape(str(difference))}</strong></div>
              </div>
            </div>
            """
        )

    return "<div class='scenario-list'>" + "".join(rendered) + "</div>"


def _render_generic_json_block(value, lang):
    if not value:
        return f"<p class='muted'>{_t('Not available.', 'Non disponible.', lang)}</p>"

    if isinstance(value, list):
        return _list_items([str(item) for item in value], lang)

    if isinstance(value, dict):
        return _render_key_value_grid(list(value.items()), lang)

    return f"<p>{escape(str(value))}</p>"


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

    noc_advantage = strategy_data.get("noc_advantage", {}) or {}
    province_recommendations = strategy_data.get("province_recommendations", []) or []
    roadmap = strategy_data.get("roadmap", []) or []
    improvement_scenarios = strategy_data.get("improvement_scenarios", []) or []
    timeline_estimate = strategy_data.get("timeline_estimate")
    probability_estimate = strategy_data.get("probability_estimate")
    draw_prediction = strategy_data.get("draw_prediction")
    french_advantage = strategy_data.get("french_advantage", {}) or {}

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
          line-height: 1.55;
        }}
        .container {{
          max-width: 1000px;
          margin: auto;
          background: white;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }}
        .hero {{
          padding-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }}
        .brand {{
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }}
        .report-title {{
          margin: 10px 0 0 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e3a8a;
        }}
        .muted {{
          color: #64748b;
        }}
        .meta {{
          margin-top: 10px;
          font-size: 13px;
        }}
        .section {{
          margin-top: 28px;
        }}
        .subsection {{
          margin-top: 16px;
        }}
        h1, h2, h3 {{
          color: #0f172a;
        }}
        h2 {{
          font-size: 20px;
          margin: 0 0 12px 0;
        }}
        h3 {{
          font-size: 15px;
          margin: 0 0 8px 0;
        }}
        .summary-box {{
          background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 18px;
        }}
        .score-box {{
          display: inline-block;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 14px 18px;
          border-radius: 14px;
          font-size: 28px;
          font-weight: 700;
        }}
        ul {{
          margin: 0;
          padding-left: 20px;
        }}
        li {{
          margin: 8px 0;
        }}
        .kv-grid {{
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }}
        .kv-card {{
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
        }}
        .kv-label {{
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          margin-bottom: 6px;
        }}
        .kv-value {{
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
        }}
        .recommendation-list,
        .roadmap-list,
        .scenario-list {{
          display: grid;
          gap: 12px;
        }}
        .recommendation-card,
        .roadmap-card,
        .scenario-card {{
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
        }}
        .recommendation-top,
        .roadmap-header {{
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }}
        .recommendation-title {{
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }}
        .recommendation-program {{
          margin: 4px 0 0 0;
          color: #475569;
          font-size: 14px;
        }}
        .recommendation-reason {{
          margin: 12px 0 0 0;
          font-size: 14px;
          color: #334155;
        }}
        .meta-row {{
          margin: 10px 0 0 0;
          color: #64748b;
          font-size: 12px;
        }}
        .pill {{
          display: inline-block;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }}
        .pill-outline {{
          display: inline-block;
          border: 1px solid #cbd5e1;
          color: #334155;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }}
        .roadmap-meta {{
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 13px;
          color: #475569;
          margin: 10px 0 10px 0;
        }}
        .scenario-grid {{
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }}
        .scenario-grid div {{
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
        }}
        .scenario-grid span {{
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
        }}
        .scenario-grid strong {{
          font-size: 16px;
          color: #0f172a;
        }}
        .footer-note {{
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 13px;
          color: #64748b;
        }}
      </style>
    </head>
    <body>
      <div class="container">

        <div class="hero">
          <h1 class="brand">NorthBridgeAI</h1>
          <p class="report-title">{_t("Personalized Strategy Report", "Rapport stratégique personnalisé", lang)}</p>
          <div class="meta">
            <p class="muted">{_t("Generated on", "Généré le", lang)}: {generated_at}</p>
            <p class="muted">{_t("User", "Utilisateur", lang)}: {escape(str(user_email or "-"))}</p>
          </div>
        </div>

        <div class="section">
          <h2>{_t("Profile Snapshot", "Aperçu du profil", lang)}</h2>
          {_render_profile_summary(profile or {}, lang)}
        </div>

        <div class="section">
          <h2>{_t("Strategy Summary", "Résumé stratégique", lang)}</h2>
          <div class="summary-box">
            <p>{escape(str(advisor_summary or ""))}</p>
          </div>
        </div>

        <div class="section">
          <h2>{_t("CRS Score", "Score CRS", lang)}</h2>
          <div class="score-box">{escape(str(crs_score))}</div>
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

        {_render_noc_section(noc_advantage, strategy_data, lang)}

        <div class="section">
          <h2>{_t("Recommended Provinces", "Provinces recommandées", lang)}</h2>
          {_render_province_recommendations(province_recommendations, lang)}
        </div>

        <div class="section">
          <h2>{_t("Strategic Roadmap", "Feuille de route stratégique", lang)}</h2>
          {_render_roadmap(roadmap, lang)}
        </div>

        <div class="section">
          <h2>{_t("Improvement Scenarios", "Scénarios d’amélioration", lang)}</h2>
          {_render_improvement_scenarios(improvement_scenarios, lang)}
        </div>

        <div class="section">
          <h2>{_t("French Advantage", "Avantage francophone", lang)}</h2>
          {_render_generic_json_block(french_advantage, lang)}
        </div>

        <div class="section">
          <h2>{_t("Timeline Estimate", "Estimation de délai", lang)}</h2>
          {_render_generic_json_block(timeline_estimate, lang)}
        </div>

        <div class="section">
          <h2>{_t("Probability Estimate", "Estimation de probabilité", lang)}</h2>
          {_render_generic_json_block(probability_estimate, lang)}
        </div>

        <div class="section">
          <h2>{_t("Draw Prediction", "Prévision des rondes", lang)}</h2>
          {_render_generic_json_block(draw_prediction, lang)}
        </div>

        <div class="section">
          <h2>{_t("AI Strategy", "Stratégie IA", lang)}</h2>
          <p>{escape(str(ai_strategy or ""))}</p>
        </div>

        <div class="footer-note">
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