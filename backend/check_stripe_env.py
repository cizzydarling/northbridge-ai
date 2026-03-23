import os
from dotenv import load_dotenv

load_dotenv()

print("STRIPE_SECRET_KEY:", os.getenv("STRIPE_SECRET_KEY"))
print("STRIPE_PRICE_INDIVIDUAL_PRO:", os.getenv("STRIPE_PRICE_INDIVIDUAL_PRO"))
print("STRIPE_PRICE_AGENT_PRO:", os.getenv("STRIPE_PRICE_AGENT_PRO"))
print("FRONTEND_URL:", os.getenv("FRONTEND_URL"))