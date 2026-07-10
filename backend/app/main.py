import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from app import models  # noqa: F401 — registers tables with SQLModel.metadata
from app.db import create_db_and_tables
from app.routes import job_descriptions, resumes, sessions

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()  # runs once at startup, before the first request
    yield  # anything after the yield would run at shutdown


app = FastAPI(title="AI Interviewer", lifespan=lifespan)

app.include_router(resumes.router)
app.include_router(job_descriptions.router)
app.include_router(sessions.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_mock": os.environ.get("AI_MOCK", "true")}
