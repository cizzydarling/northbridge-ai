from typing import Dict, List


def estimate_pr_timeline(profile, crs_score: int) -> Dict:
    steps: List[Dict] = []
    total_min_months = 0
    total_max_months = 0
    language_score = profile.language_score or 0
    experience_years = profile.experience_years or 0

    if language_score < 9:
        steps.append({
            "title": "Improve language score to CLB 9 or higher",
            "estimated_time_min_months": 2,
            "estimated_time_max_months": 4,
            "reason": "Language preparation and re-testing usually takes a few months.",
        })
        total_min_months += 2
        total_max_months += 4

    if experience_years < 5:
        steps.append({
            "title": "Gain more skilled work experience",
            "estimated_time_min_months": 6,
            "estimated_time_max_months": 12,
            "reason": "Experience gains depend on employment duration and timing.",
        })
        total_min_months += 6
        total_max_months += 12

    if not profile.has_job_offer:
        steps.append({
            "title": "Secure a valid Canadian job offer",
            "estimated_time_min_months": 3,
            "estimated_time_max_months": 8,
            "reason": "Finding an employer and completing the process can take time.",
        })
        total_min_months += 3
        total_max_months += 8

    if not profile.has_canadian_experience:
        steps.append({
            "title": "Gain Canadian work experience",
            "estimated_time_min_months": 6,
            "estimated_time_max_months": 12,
            "reason": "Canadian experience usually requires time working in Canada.",
        })
        total_min_months += 6
        total_max_months += 12

    if profile.preferred_province:
        steps.append({
            "title": f"Target {profile.preferred_province} Provincial Nominee Program",
            "estimated_time_min_months": 4,
            "estimated_time_max_months": 6,
            "reason": "PNP processing and nomination timelines vary by province.",
        })
        total_min_months += 4
        total_max_months += 6
    else:
        steps.append({
            "title": "Select a province and pursue a Provincial Nominee Program",
            "estimated_time_min_months": 4,
            "estimated_time_max_months": 6,
            "reason": "Choosing and applying through a province adds planning and processing time.",
        })
        total_min_months += 4
        total_max_months += 6

    if crs_score >= 470:
        invitation_window = {
            "title": "Prepare for Express Entry invitation and PR application",
            "estimated_time_min_months": 1,
            "estimated_time_max_months": 3,
            "reason": "A competitive score may allow faster progress once documents are ready.",
        }
    else:
        invitation_window = {
            "title": "Improve profile before likely invitation",
            "estimated_time_min_months": 3,
            "estimated_time_max_months": 6,
            "reason": "Additional time may be needed to strengthen competitiveness before invitation.",
        }

    steps.append(invitation_window)
    total_min_months += invitation_window["estimated_time_min_months"]
    total_max_months += invitation_window["estimated_time_max_months"]

    if not steps:
        steps.append({
            "title": "Maintain profile readiness and monitor draws",
            "estimated_time_min_months": 1,
            "estimated_time_max_months": 3,
            "reason": "Your profile already appears strong enough for near-term action.",
        })
        total_min_months = 1
        total_max_months = 3

    if crs_score >= 500:
        readiness = "Very strong"
    elif crs_score >= 470:
        readiness = "Strong"
    elif crs_score >= 430:
        readiness = "Competitive with improvement"
    else:
        readiness = "Needs profile strengthening"

    return {
        "readiness": readiness,
        "estimated_pr_timeline_min_months": total_min_months,
        "estimated_pr_timeline_max_months": total_max_months,
        "timeline_steps": steps,
    }
