"""Job description create and listing. Pasted text in, stored raw."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import JobDescription

router = APIRouter(prefix="/api/job-descriptions", tags=["job-descriptions"])


class JobDescriptionIn(BaseModel):
    raw_text: str


@router.post("")
def create_job_description(
    body: JobDescriptionIn, session: Session = Depends(get_session)
) -> dict:
    if not body.raw_text.strip():
        raise HTTPException(status_code=400, detail="Job description text is empty.")

    jd = JobDescription(raw_text=body.raw_text)
    session.add(jd)
    session.commit()
    session.refresh(jd)
    return {"id": jd.id}


@router.get("")
def list_job_descriptions(session: Session = Depends(get_session)) -> list[dict]:
    jds = session.exec(select(JobDescription)).all()
    return [{"id": jd.id, "preview": jd.raw_text[:80]} for jd in jds]
