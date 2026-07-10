import os

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

app = FastAPI(title="AI Interviewer")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_mock": os.environ.get("AI_MOCK", "true")}
