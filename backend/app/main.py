import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import models  # noqa: F401 — registers tables with SQLModel.metadata
from app.agent.client import AgentError
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


@app.exception_handler(AgentError)
def handle_agent_error(request: Request, exc: AgentError) -> JSONResponse:
    # Every AI-call failure (API error, malformed tool output surviving the
    # retry) reaches here as one type, so this is the single place that turns
    # it into a clean 502 instead of a raw stack trace reaching the client.
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI service is temporarily unavailable. Please try again."},
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_mock": os.environ.get("AI_MOCK", "true")}
