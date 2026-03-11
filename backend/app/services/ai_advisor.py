from openai import OpenAI

client = OpenAI()


def generate_ai_strategy(profile, crs_score, programs):

    prompt = f"""
You are an expert Canadian immigration advisor.

Candidate profile:
Age: {profile.age}
Education: {profile.education}
Language score: {profile.language_score}
Foreign work experience: {profile.experience_years} years
Job offer: {profile.has_job_offer}
Canadian work experience: {profile.has_canadian_experience}
Studied in Canada: {profile.studied_in_canada}
Occupation: {profile.occupation}
Preferred province: {profile.preferred_province}

Calculated CRS score: {crs_score}

Recommended pathways from the system:
{", ".join(programs)}

Instructions:
- Rank immigration pathways from strongest to weakest.
- If CRS score is above 500, treat Express Entry as a strong pathway.
- If CRS score is below 430, emphasize improvement strategies or alternative pathways.
- Stay consistent with the CRS score and recommended pathways.
- Provide practical and realistic advice.

Structure the answer into four sections:

1. Best pathway
2. Why it fits the candidate
3. How to improve the profile
4. Next steps
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a careful Canadian immigration advisor who must stay consistent with the CRS score and pathway recommendations."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    return response.choices[0].message.content