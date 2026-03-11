from dotenv import load_dotenv
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_advice(user_data: dict):

    prompt = f"""
    Suggest suitable Canadian immigration programs for the following candidate:

    {user_data}

    Explain why each program may be suitable.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert Canadian immigration consultant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )

        advice = response.choices[0].message.content

        return {"advice": advice}

    except Exception as e:
        return {"error": str(e)}