"""Synthetic parity inputs; expected outputs were captured from RC 4fa95a3."""
from types import SimpleNamespace

NOC_CASES = [
    dict(occupation="Administrative officer", language="en"),
    dict(occupation="infirmière autorisée", language="fr"),
    dict(occupation="Software developer", job_description="Design and maintain software applications", duties=["Write and test software", "Review requirements"], language="en"),
    dict(occupation="administration", language="fr", top_k=10),
    dict(occupation="quantum cloud storyteller", language="en", top_k=10),
    dict(occupation="manager", language="en", top_k=10),
    dict(occupation="zzzzzzzz", language="en", top_k=10),
]

def strategy_case(index):
    profile = dict(age=28, education="bachelor", language_score=9,
                   english_language_score=9, experience_years=3,
                   occupation="Administrative officer", noc_code="13100",
                   preferred_province="Ontario", has_job_offer=False,
                   has_canadian_experience=False, studied_in_canada=False)
    language = "en"
    members = []
    case = None
    if index == 1:
        profile.update(occupation="infirmière autorisée", noc_code="", french_language_score=9)
        language = "fr"
        members = [SimpleNamespace(id=i, relationship_to_primary=relationship,
                   participation="accompanying", first_name="Synthetic", last_name="Member",
                   date_of_birth=None, nationality="France", marital_status=None,
                   education=None, language_score=None, experience_years=None)
                   for i, relationship in enumerate(["self", "spouse", "child"], 1)]
        case = SimpleNamespace(id=1, application_type="permanent_residence", case_title="Synthetic family",
                               pathway=None, target_province="Ontario", family_size=3)
    return SimpleNamespace(**profile), language, members, case
