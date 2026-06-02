def build_user_context(profile=None, strategy=None, application=None, decision=None, features=None):
    return {
        "profile": {
            "age": getattr(profile, "age", None),
            "education": getattr(profile, "education", None),
            "occupation": getattr(profile, "occupation", None),
            "noc_code": getattr(profile, "noc_code", None),
            "preferred_province": getattr(profile, "preferred_province", None),
        },
        "strategy": strategy or {},
        "application": {
            "matter_type": application.get("matter_type") if application else None,
            "checklist": application.get("checklist_result", []) if application else [],
            "missing_fields": application.get("forms_result", {}).get("missing_fields", []) if application else [],
        },
        "decision": decision or {},
        "features": features or {},
    }
