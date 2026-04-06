def format_ai_response(raw_text: str, plan: str):
    """
    Enforces structured output depending on plan.
    """

    if plan == "free":
        return {
            "reply": raw_text[:500],  # limit length
            "suggested_next_actions": [],
            "insights": [],
            "locked": True,
        }

    if plan == "pro":
        return {
            "reply": raw_text,
            "suggested_next_actions": extract_actions(raw_text),
            "insights": extract_insights(raw_text),
            "locked": False,
        }

    if plan == "premium":
        return {
            "reply": raw_text,
            "suggested_next_actions": extract_actions(raw_text),
            "insights": extract_insights(raw_text),
            "risk_analysis": extract_risks(raw_text),
            "optimization_tips": extract_optimizations(raw_text),
            "locked": False,
        }


def extract_actions(text):
    lines = text.split("\n")
    return [l for l in lines if l.lower().startswith(("1.", "2.", "3.", "-"))][:3]


def extract_insights(text):
    return [s.strip() for s in text.split(".") if len(s.strip()) > 40][:3]


def extract_risks(text):
    return [s for s in text.split(".") if "risk" in s.lower()][:3]


def extract_optimizations(text):
    return [s for s in text.split(".") if "improve" in s.lower() or "increase" in s.lower()][:3]