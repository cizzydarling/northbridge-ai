def normalize_text(value):
    if not value:
        return ""
    return value.strip().lower()


def classify_occupation_group(occupation):
    occ = normalize_text(occupation)

    tech_keywords = [
        "software", "developer", "programmer", "data", "cloud",
        "cyber", "devops", "web", "it", "systems analyst"
    ]
    healthcare_keywords = [
        "nurse", "doctor", "physician", "pharmacist",
        "medical", "laboratory", "health"
    ]
    trades_keywords = [
        "electrician", "welder", "plumber", "carpenter",
        "mechanic", "trades", "industrial"
    ]
    finance_keywords = [
        "accountant", "auditor", "financial", "bookkeeper"
    ]

    if any(word in occ for word in tech_keywords):
        return "tech"
    if any(word in occ for word in healthcare_keywords):
        return "healthcare"
    if any(word in occ for word in trades_keywords):
        return "trades"
    if any(word in occ for word in finance_keywords):
        return "finance"

    return "general_skilled"