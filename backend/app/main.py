import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

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


# The Next.js static export (frontend/out) is copied here as app/static during
# the Docker build (see Dockerfile). It doesn't exist in local dev, where the
# Next dev server on :3000 serves the frontend instead.
STATIC_DIR = Path(__file__).parent / "static"


@app.get("/{full_path:path}")
def serve_frontend(full_path: str) -> FileResponse:
    # Registered after the routers above, so /api/* always matches those first.
    # `next build` with output: "export" produces flat files (index.html,
    # interview.html, report.html) rather than per-route directories, so a
    # request for "/interview" needs the ".html" appended by hand. Starlette's
    # StaticFiles(html=True) only resolves directory index.html, not this shape.
    candidate = STATIC_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    html_candidate = STATIC_DIR / f"{full_path}.html"
    if html_candidate.is_file():
        return FileResponse(html_candidate)
    return FileResponse(STATIC_DIR / "index.html")
