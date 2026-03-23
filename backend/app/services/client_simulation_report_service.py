from datetime import datetime
from html import escape


def _list_items(items):
    if not items:
        return "<p class='muted'>None available.</p>"

    return "<ul>" + "".join(f"<li>{escape(str(item))}</li>" for item in items) + "</ul>"


def _scenario_cards(scenarios):
    if not scenarios:
        return "<p class='muted'>No saved simulation scenarios.</p>"

    blocks = []
    for scenario in scenarios:
        label = escape(str(scenario.get("label", "Unnamed Scenario")))
        current_crs = scenario.get("current_crs", "--")
        simulated_crs = scenario.get("simulated_crs", "--")
        difference = scenario.get("difference", "--")
        pathways = scenario.get("pathways", []) or []

        pathway_html = _list_items(pathways)

        blocks.append(
            f"""
            <div class="card">
              <h4>{label}</h4>
              <p><strong>CRS:</strong> {current_crs} → {simulated_crs}</p>
              <p><strong>Difference:</strong> {difference}</p>
              <h5>Pathways</h5>
              {pathway_html}
            </div>
            """
        )

    return "".join(blocks)


def build_client_simulation_report_html(
    client,
    profile,
    latest_result=None,
    saved_scenarios=None,
):
    saved_scenarios = saved_scenarios or []
    latest_result = latest_result or {}

    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    crs_comparison = latest_result.get("crs_comparison", {})
    pathway_comparison = latest_result.get("pathway_comparison", {})
    simulated_result = latest_result.get("simulated_result", {})

    current_crs = crs_comparison.get("current_crs_score", "--")
    simulated_crs = crs_comparison.get("simulated_crs_score", "--")
    difference = crs_comparison.get("difference", "--")

    unlocked = pathway_comparison.get("newly_unlocked_pathways", []) or []
    simulated_pathways = pathway_comparison.get("simulated_eligible_pathways", []) or []
    strengths = simulated_result.get("strengths", []) or []
    next_steps = simulated_result.get("next_steps", []) or []
    summary = simulated_result.get("advisor_summary", "No summary available.")

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Client Simulation Report</title>
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
        h1, h2, h3, h4, h5 {{
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
        <h1>Client Simulation Report</h1>
        <p class="muted">Generated: {generated_at}</p>
        <p class="muted">Client: {escape(str(client.full_name or "Unknown Client"))}</p>
        <p class="muted">Email: {escape(str(client.email or "Not available"))}</p>

        <h2>Client Profile Snapshot</h2>
        <div class="grid">
          <div class="stat"><div class="label">Age</div><div class="value small">{getattr(profile, "age", "--")}</div></div>
          <div class="stat"><div class="label">Education</div><div class="value small">{escape(str(getattr(profile, "education", "--")))}</div></div>
          <div class="stat"><div class="label">Language Score</div><div class="value small">{getattr(profile, "language_score", "--")}</div></div>
          <div class="stat"><div class="label">Experience</div><div class="value small">{getattr(profile, "experience_years", "--")} years</div></div>
          <div class="stat"><div class="label">Occupation</div><div class="value small">{escape(str(getattr(profile, "occupation", "--") or "--"))}</div></div>
          <div class="stat"><div class="label">Preferred Province</div><div class="value small">{escape(str(getattr(profile, "preferred_province", "--") or "--"))}</div></div>
        </div>

        <h2>Latest Simulation Summary</h2>
        <div class="summary">
          <p>{escape(str(summary))}</p>
        </div>

        <div class="grid">
          <div class="stat"><div class="label">Current CRS</div><div class="value">{current_crs}</div></div>
          <div class="stat"><div class="label">Simulated CRS</div><div class="value">{simulated_crs}</div></div>
          <div class="stat"><div class="label">Difference</div><div class="value">{difference}</div></div>
        </div>

        <h2>Simulated Eligible Pathways</h2>
        {_list_items(simulated_pathways)}

        <h2>Newly Unlocked Pathways</h2>
        {_list_items(unlocked)}

        <h2>Strengths</h2>
        {_list_items(strengths)}

        <h2>Recommended Next Steps</h2>
        {_list_items(next_steps)}

        <h2>Saved Simulation Scenarios</h2>
        {_scenario_cards(saved_scenarios)}

        <div class="footer">
          This report is generated by NorthBridgeAI for planning and simulation support.
          It is not legal advice and does not replace official government assessment.
        </div>
      </div>
    </body>
    </html>
    """