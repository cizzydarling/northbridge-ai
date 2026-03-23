from datetime import datetime
from html import escape


def _list_items(items):
    if not items:
        return "<p class='muted'>None available.</p>"

    return "<ul>" + "".join(f"<li>{escape(str(item))}</li>" for item in items) + "</ul>"


def _roadmap_items(roadmap):
    if not roadmap:
        return "<p class='muted'>No roadmap available.</p>"

    blocks = []
    for index, step in enumerate(roadmap, start=1):
        title = escape(str(step.get("title", "Untitled step")))
        reason = escape(str(step.get("reason", "")))
        gain = step.get("estimated_crs_gain", 0)
        difficulty = escape(str(step.get("difficulty", "Not specified")))

        blocks.append(
            f"""
            <div class="card">
              <h4>Step {index}: {title}</h4>
              <p><strong>Estimated CRS Gain:</strong> +{gain}</p>
              <p><strong>Difficulty:</strong> {difficulty}</p>
              <p>{reason}</p>
            </div>
            """
        )

    return "".join(blocks)


def _province_items(items):
    if not items:
        return "<p class='muted'>No province recommendations available.</p>"

    blocks = []
    for index, item in enumerate(items, start=1):
        province = escape(str(item.get("province", "Unknown province")))
        score = item.get("score", "--")
        reason = escape(str(item.get("reason", "")))

        blocks.append(
            f"""
            <div class="card">
              <h4>Rank {index}: {province}</h4>
              <p><strong>Fit Score:</strong> {score}</p>
              <p>{reason}</p>
            </div>
            """
        )

    return "".join(blocks)


def _timeline_items(timeline):
    steps = timeline.get("timeline_steps", []) if timeline else []
    if not steps:
        return "<p class='muted'>No timeline estimate available.</p>"

    blocks = []
    for index, step in enumerate(steps, start=1):
        title = escape(str(step.get("title", "Untitled step")))
        reason = escape(str(step.get("reason", "")))
        min_months = step.get("estimated_time_min_months", "--")
        max_months = step.get("estimated_time_max_months", "--")

        blocks.append(
            f"""
            <div class="card">
              <h4>Step {index}: {title}</h4>
              <p><strong>Estimated Time:</strong> {min_months}-{max_months} months</p>
              <p>{reason}</p>
            </div>
            """
        )

    return "".join(blocks)


def _probability_block(probability):
    if not probability:
        return "<p class='muted'>No probability estimate available.</p>"

    return f"""
    <div class="grid">
      <div class="stat">
        <div class="label">PR Within 12 Months</div>
        <div class="value">{probability.get("chance_of_pr_within_12_months", "--")}%</div>
      </div>
      <div class="stat">
        <div class="label">Via Express Entry</div>
        <div class="value">{probability.get("chance_via_express_entry", "--")}%</div>
      </div>
      <div class="stat">
        <div class="label">Via PNP</div>
        <div class="value">{probability.get("chance_via_pnp", "--")}%</div>
      </div>
    </div>
    <p><strong>Confidence:</strong> {escape(str(probability.get("confidence", "Not available")))}</p>
    <p><strong>Strongest Path:</strong> {escape(str(probability.get("strongest_path", "Not available")))}</p>
    <p>{escape(str(probability.get("strongest_path_reason", "")))}</p>
    """


def _draw_prediction_block(draw_prediction):
    if not draw_prediction:
        return "<p class='muted'>No draw prediction available.</p>"

    hints = draw_prediction.get("category_hints", [])
    hints_html = _list_items(hints)

    return f"""
    <div class="grid">
      <div class="stat">
        <div class="label">Predicted Draw Type</div>
        <div class="value small">{escape(str(draw_prediction.get("predicted_draw_type", "--")))}</div>
      </div>
      <div class="stat">
        <div class="label">Predicted Cutoff</div>
        <div class="value">{draw_prediction.get("predicted_cutoff_min", "--")}-{draw_prediction.get("predicted_cutoff_max", "--")}</div>
      </div>
      <div class="stat">
        <div class="label">Likelihood</div>
        <div class="value small">{escape(str(draw_prediction.get("likelihood", "--")))}</div>
      </div>
      <div class="stat">
        <div class="label">Time Window</div>
        <div class="value small">{escape(str(draw_prediction.get("estimated_time_window", "--")))}</div>
      </div>
    </div>
    <p><strong>Reason:</strong> {escape(str(draw_prediction.get("reason", "")))}</p>
    <p><strong>Next Best Move:</strong> {escape(str(draw_prediction.get("next_best_move", "")))}</p>
    <h4>Category Hints</h4>
    {hints_html}
    <p class="muted">{escape(str(draw_prediction.get("disclaimer", "")))}</p>
    """


def build_strategy_report_html(profile, strategy_data, user_email=None):
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    crs_score = strategy_data.get("crs_score", "--")
    recommended_programs = strategy_data.get("recommended_programs", [])
    roadmap = strategy_data.get("roadmap", [])
    province_recommendations = strategy_data.get("province_recommendations", [])
    timeline_estimate = strategy_data.get("timeline_estimate", {})
    probability_estimate = strategy_data.get("probability_estimate", {})
    draw_prediction = strategy_data.get("draw_prediction", {})
    strengths = strategy_data.get("strengths", [])
    weaknesses = strategy_data.get("weaknesses", [])
    next_steps = strategy_data.get("next_steps", [])
    advisor_summary = strategy_data.get("advisor_summary", "")
    ai_strategy = strategy_data.get("ai_strategy", "")

    timeline_min = timeline_estimate.get("estimated_pr_timeline_min_months", "--")
    timeline_max = timeline_estimate.get("estimated_pr_timeline_max_months", "--")
    readiness = escape(str(timeline_estimate.get("readiness", "Not available")))

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>NorthBridgeAI Strategy Report</title>
      <style>
        body {{
          font-family: Arial, sans-serif;
          background: #f8fafc;
          color: #0f172a;
          margin: 0;
          padding: 32px;
          line-height: 1.6;
        }}
        .container {{
          max-width: 1100px;
          margin: 0 auto;
          background: white;
          padding: 32px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }}
        h1, h2, h3, h4 {{
          margin-top: 0;
        }}
        h1 {{
          font-size: 30px;
          margin-bottom: 8px;
        }}
        h2 {{
          font-size: 22px;
          margin-top: 32px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }}
        .muted {{
          color: #64748b;
        }}
        .grid {{
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin: 20px 0;
        }}
        .stat {{
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
        }}
        .label {{
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 8px;
        }}
        .value {{
          font-size: 32px;
          font-weight: 700;
        }}
        .value.small {{
          font-size: 20px;
        }}
        .card {{
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          margin: 12px 0;
        }}
        ul {{
          padding-left: 22px;
        }}
        .summary {{
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 18px;
        }}
        .footer {{
          margin-top: 32px;
          font-size: 12px;
          color: #64748b;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>NorthBridgeAI Strategy Report</h1>
        <p class="muted">Generated: {generated_at}</p>
        <p class="muted">User: {escape(str(user_email or "Not available"))}</p>

        <h2>Profile Snapshot</h2>
        <div class="grid">
          <div class="stat"><div class="label">Age</div><div class="value small">{getattr(profile, "age", "--")}</div></div>
          <div class="stat"><div class="label">Education</div><div class="value small">{escape(str(getattr(profile, "education", "--")))}</div></div>
          <div class="stat"><div class="label">Language Score</div><div class="value small">{getattr(profile, "language_score", "--")}</div></div>
          <div class="stat"><div class="label">Experience</div><div class="value small">{getattr(profile, "experience_years", "--")} years</div></div>
          <div class="stat"><div class="label">Job Offer</div><div class="value small">{'Yes' if getattr(profile, 'has_job_offer', False) else 'No'}</div></div>
          <div class="stat"><div class="label">Canadian Experience</div><div class="value small">{'Yes' if getattr(profile, 'has_canadian_experience', False) else 'No'}</div></div>
        </div>

        <h2>Strategy Summary</h2>
        <div class="summary">
          <p>{escape(str(advisor_summary or "No summary available."))}</p>
        </div>

        <div class="grid">
          <div class="stat"><div class="label">CRS Score</div><div class="value">{crs_score}</div></div>
          <div class="stat"><div class="label">Timeline</div><div class="value small">{timeline_min}-{timeline_max} months</div></div>
          <div class="stat"><div class="label">Readiness</div><div class="value small">{readiness}</div></div>
          <div class="stat"><div class="label">PR Probability</div><div class="value">{probability_estimate.get("chance_of_pr_within_12_months", "--")}%</div></div>
        </div>

        <h2>Recommended Programs</h2>
        {_list_items(recommended_programs)}

        <h2>Strengths</h2>
        {_list_items(strengths)}

        <h2>Weaknesses</h2>
        {_list_items(weaknesses)}

        <h2>Suggested Next Steps</h2>
        {_list_items(next_steps)}

        <h2>Strategy Roadmap</h2>
        {_roadmap_items(roadmap)}

        <h2>Province Targeting</h2>
        {_province_items(province_recommendations)}

        <h2>Timeline Estimator</h2>
        {_timeline_items(timeline_estimate)}

        <h2>Probability Engine</h2>
        {_probability_block(probability_estimate)}

        <h2>Express Entry Draw Predictor</h2>
        {_draw_prediction_block(draw_prediction)}

        <h2>AI Strategy</h2>
        <div class="card">
          <p>{escape(str(ai_strategy or "No AI strategy available."))}</p>
        </div>

        <div class="footer">
          This report is generated by NorthBridgeAI for planning and strategy support.
          Forecast-style outputs are internal estimates and not official IRCC predictions.
        </div>
      </div>
    </body>
    </html>
    """