from fastapi import FastAPI
from app.data.db import Base, engine
from app.routes import (
    program_routes,
    recommendation_routes,
    crs_routes,
    express_entry_routes,
    strategy_routes,
    auth_routes,
    profile_routes,
)
from fastapi.middleware.cors import CORSMiddleware

import app.models.db_models
import app.models.profile_model

app = FastAPI(title="NorthBridgeAI")

origins = [
    "http://localhost:5173",
    "https://northbridge-ai.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(program_routes.router, prefix="/programs", tags=["Programs"])
app.include_router(recommendation_routes.router, prefix="/recommendations", tags=["AI"])
app.include_router(crs_routes.router, prefix="/crs", tags=["CRS Calculator"])
app.include_router(express_entry_routes.router, prefix="/express-entry", tags=["Express Entry"])
app.include_router(strategy_routes.router)
app.include_router(auth_routes.router)
app.include_router(profile_routes.router)

@app.get("/")
def root():
    return {"message": "Welcome to NorthBridgeAI"}
