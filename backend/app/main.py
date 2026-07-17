import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.data.db import engine
from app.services.document_storage import document_storage_healthcheck
from app.services.observability import configure_error_monitoring, observe_request
from app.services.security_controls import rate_limiter_healthcheck

from app.routes import (
    ai_routes,
    app_routes,
    auth_routes,
    billing_routes,
    career_match_routes,
    client_document_routes,
    client_profile_routes,
    client_routes,
    client_simulation_routes,
    client_strategy_routes,
    citizenship_routes,
    crs_routes,
    disclosure_routes,
    document_review_routes,
    express_entry_routes,
    generated_document_routes,
    journey_routes,
    matter_routes,
    noc_routes,
    profile_routes,
    program_routes,
    recommendation_routes,
    self_document_routes,
    simulation_scenarios_routes,
    strategy_routes,
    forms_routes,
    household_routes,
    immigration_intelligence_routes,
    application_case_routes,
)

import app.models.disclosure_acceptance_model
import app.models.generated_document_model
import app.models.matter_model
import app.models.billing_transaction_model
import app.models.career_match_models
import app.models.citizenship_models
import app.models.promo_code_model
import app.models.profile_model
import app.models.recommendation
import app.models.self_application_model
import app.models.self_document_model
import app.models.user_models

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"


def validate_runtime_configuration() -> None:
    environment = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "")).strip().lower()
    if environment not in {"prod", "production"}:
        return

    required = [
        "SECRET_KEY",
        "DATABASE_URL",
        "FRONTEND_URL",
        "OPENAI_API_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "DOCUMENT_STORAGE_BUCKET",
        "DOCUMENT_STORAGE_REGION",
        "REDIS_URL",
        "SENTRY_DSN",
    ]
    missing = [name for name in required if not os.getenv(name, "").strip()]
    if missing:
        raise RuntimeError(
            "Missing required production settings: " + ", ".join(sorted(missing))
        )

    frontend_url = os.getenv("FRONTEND_URL", "").strip().lower()
    if not frontend_url.startswith("https://"):
        raise RuntimeError("FRONTEND_URL must use HTTPS in production.")

    if os.getenv("DOCUMENT_STORAGE_BACKEND", "").strip().lower() != "s3":
        raise RuntimeError(
            "DOCUMENT_STORAGE_BACKEND must be 's3' in production; local document "
            "storage is not durable enough for customer files."
        )


def get_allowed_origins() -> list[str]:
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://northbridgeai.com",
        "https://www.northbridgeai.com",
        "https://northbridgeia.com",
        "https://www.northbridgeia.com",
    ]

    env_origins = os.getenv("CORS_ORIGINS", "").strip()

    parsed_env_origins: list[str] = []
    if env_origins:
        for origin in env_origins.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned:
                parsed_env_origins.append(cleaned)

    merged: list[str] = []
    seen = set()

    for origin in default_origins + parsed_env_origins:
        normalized = origin.rstrip("/")
        if normalized and normalized not in seen:
            seen.add(normalized)
            merged.append(normalized)

    return merged


def register_routers(app: FastAPI) -> None:
    app.include_router(program_routes.router, prefix="/programs", tags=["Programs"])
    app.include_router(recommendation_routes.router, prefix="/recommendations", tags=["AI"])
    app.include_router(crs_routes.router, prefix="/crs", tags=["CRS Calculator"])
    app.include_router(express_entry_routes.router, prefix="/express-entry", tags=["Express Entry"])

    app.include_router(auth_routes.router)
    app.include_router(app_routes.router)
    app.include_router(profile_routes.router)
    app.include_router(strategy_routes.router)
    app.include_router(ai_routes.router)
    app.include_router(journey_routes.router)
    app.include_router(document_review_routes.router)

    app.include_router(client_routes.router)
    app.include_router(client_profile_routes.router)
    app.include_router(client_strategy_routes.router)
    app.include_router(client_simulation_routes.router)
    app.include_router(client_document_routes.router)
    app.include_router(career_match_routes.router)
    app.include_router(citizenship_routes.router)

    app.include_router(simulation_scenarios_routes.router)
    app.include_router(disclosure_routes.router)
    app.include_router(billing_routes.router)
    app.include_router(matter_routes.router)
    app.include_router(self_document_routes.router)
    app.include_router(generated_document_routes.router)
    app.include_router(noc_routes.router)
    app.include_router(forms_routes.router)
    app.include_router(household_routes.router)
    app.include_router(immigration_intelligence_routes.router)
    app.include_router(application_case_routes.router)


def create_app() -> FastAPI:
    validate_runtime_configuration()
    configure_error_monitoring()
    app = FastAPI(title="NorthBridgeAI API")

    allowed_origins = get_allowed_origins()
    print("CORS allowed origins:", allowed_origins)
    print("OPENAI_API_KEY loaded:", bool(os.getenv("OPENAI_API_KEY")))
    print("DATABASE_URL loaded:", bool(os.getenv("DATABASE_URL")))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.middleware("http")(observe_request)

    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        if request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    register_routers(app)

    @app.get("/")
    def root():
        return {"message": "Welcome to NorthBridgeAI API"}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/health/live", include_in_schema=False)
    def liveness():
        return {"status": "ok"}

    @app.get("/health/ready", include_in_schema=False)
    def readiness():
        components: dict[str, str] = {}

        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            components["database"] = "ok"
        except Exception:
            components["database"] = "unavailable"

        try:
            rate_limiter_healthcheck()
            components["rate_limiter"] = "ok"
        except Exception:
            components["rate_limiter"] = "unavailable"

        try:
            document_storage_healthcheck()
            components["document_storage"] = "ok"
        except Exception:
            components["document_storage"] = "unavailable"

        ready = all(value == "ok" for value in components.values())
        payload = {
            "status": "ready" if ready else "not_ready",
            "components": components,
        }
        if not ready:
            return JSONResponse(status_code=503, content=payload)
        return payload

    return app


app = create_app()
