# backend/app/config/settings.py
from dotenv import load_.dotenv
import os

load_dotenv()  # Load .env file

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")