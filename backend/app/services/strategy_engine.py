def generate_strategy(profile, crs_score):

    advice = []

    if crs_score < 400:
        advice.append(
            "Your CRS score is currently low. Improving your language score can significantly increase your ranking."
        )

    if profile["language_score"] < 9:
        advice.append(
            "Consider improving your IELTS score to CLB 9 or higher to gain additional CRS points."
        )
    
    if profile["experience_years"] < 3:
        advice.append(
            "Gaining additional work experience can increase your CRS score."
        )

    if profile["education"] == "bachelor":
        advice.append(
            "Completing a master's degree could significantly improve your immigration score."
        )

    return advice