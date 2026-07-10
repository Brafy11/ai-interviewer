"""Resume upload and listing.

Upload only parses the PDF to text and stores it — no AI runs here, so a bad
PDF fails cheaply on parse rather than after any model spend. Extraction to a
structured profile happens lazily at session creation (see routes/sessions.py).
"""

from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pypdf import PdfReader
from sqlmodel import Session, select

from app.db import get_session
from app.models import Resume

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


@router.post("")
async def upload_resume(
    file: UploadFile, session: Session = Depends(get_session)
) -> dict:
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    data = await file.read()
    try:
        text = _extract_pdf_text(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the PDF file.")

    if not text:
        raise HTTPException(
            status_code=400,
            detail="No text could be extracted from the PDF (is it a scanned image?).",
        )

    resume = Resume(filename=file.filename, raw_text=text)
    session.add(resume)
    session.commit()
    session.refresh(resume)
    return {"id": resume.id, "filename": resume.filename}


@router.get("")
def list_resumes(session: Session = Depends(get_session)) -> list[dict]:
    resumes = session.exec(select(Resume)).all()
    return [{"id": r.id, "filename": r.filename} for r in resumes]
