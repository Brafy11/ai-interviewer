"""Interview sessions: create, drive the Q&A loop, and fetch the report.

The API is stateless — every request rebuilds the interview context from SQLite
(the gap analysis JSON plus the stored Turn rows), so a client can refresh at any
point and resume from the current unanswered question.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.agent.extraction import extract_job_profile, extract_resume_profile
from app.agent.gap import analyze_gaps
from app.agent.interviewer import next_turn, should_end_interview
from app.agent.report import generate_report
from app.db import get_session
from app.models import InterviewSession, JobDescription, Report, Resume, Turn
from app.schemas import GapAnalysis, JobProfile, ResumeProfile

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionIn(BaseModel):
    resume_id: int
    jd_id: int


class AnswerIn(BaseModel):
    answer: str


def _get_session_or_404(session: Session, session_id: int) -> InterviewSession:
    interview = session.get(InterviewSession, session_id)
    if interview is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return interview


def _ordered_turns(session: Session, session_id: int) -> list[Turn]:
    return session.exec(
        select(Turn).where(Turn.session_id == session_id).order_by(Turn.turn_index)
    ).all()


def _history(turns: list[Turn]) -> list[dict]:
    """Answered turns as the {question, answer} dicts the agent layer expects."""
    return [
        {"question": t.question, "answer": t.answer}
        for t in turns
        if t.answer is not None
    ]


@router.post("")
def create_session(body: SessionIn, session: Session = Depends(get_session)) -> dict:
    resume = session.get(Resume, body.resume_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")
    jd = session.get(JobDescription, body.jd_id)
    if jd is None:
        raise HTTPException(status_code=404, detail="Job description not found.")

    # Extract each profile lazily and cache it back, so a second session reusing
    # the same resume or JD doesn't pay for extraction again.
    if resume.profile_json is None:
        resume_profile = extract_resume_profile(resume.raw_text)
        resume.profile_json = resume_profile.model_dump()
        session.add(resume)
    else:
        resume_profile = ResumeProfile.model_validate(resume.profile_json)

    if jd.profile_json is None:
        job_profile = extract_job_profile(jd.raw_text)
        jd.profile_json = job_profile.model_dump()
        session.add(jd)
    else:
        job_profile = JobProfile.model_validate(jd.profile_json)

    gaps = analyze_gaps(resume_profile, job_profile)

    interview = InterviewSession(
        resume_id=resume.id,
        jd_id=jd.id,
        gap_analysis_json=gaps.model_dump(),
        status="in_progress",
        question_count=1,
    )
    session.add(interview)
    session.commit()
    session.refresh(interview)

    # Ask the first question immediately and store it unanswered as turn 0.
    first = next_turn(gaps, history=[], question_count=0)
    session.add(
        Turn(
            session_id=interview.id,
            turn_index=0,
            question=first.question,
            targets=first.targets,
            is_followup=first.is_followup,
            should_end=first.should_end,
        )
    )
    session.commit()

    return {
        "id": interview.id,
        "gap_analysis": gaps.model_dump(),
        "question": first.question,
        "question_count": interview.question_count,
    }


@router.get("")
def list_sessions(session: Session = Depends(get_session)) -> list[dict]:
    interviews = session.exec(select(InterviewSession)).all()
    result = []
    for interview in interviews:
        resume = session.get(Resume, interview.resume_id)
        jd = session.get(JobDescription, interview.jd_id)
        job_title = jd.profile_json.get("title") if jd and jd.profile_json else None
        result.append(
            {
                "id": interview.id,
                "status": interview.status,
                "question_count": interview.question_count,
                "resume_filename": resume.filename if resume else None,
                "job_title": job_title,
            }
        )
    return result


@router.get("/{session_id}")
def get_session_state(
    session_id: int, session: Session = Depends(get_session)
) -> dict:
    interview = _get_session_or_404(session, session_id)
    turns = _ordered_turns(session, session_id)
    current = next((t for t in turns if t.answer is None), None)
    return {
        "id": interview.id,
        "status": interview.status,
        "question_count": interview.question_count,
        "gap_analysis": interview.gap_analysis_json,
        "turns": [
            {
                "turn_index": t.turn_index,
                "question": t.question,
                "answer": t.answer,
                "targets": t.targets,
                "is_followup": t.is_followup,
            }
            for t in turns
        ],
        "current_question": current.question if current else None,
    }


@router.post("/{session_id}/answer")
def submit_answer(
    session_id: int, body: AnswerIn, session: Session = Depends(get_session)
) -> dict:
    interview = _get_session_or_404(session, session_id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=400, detail="This interview is already completed."
        )
    if not body.answer.strip():
        raise HTTPException(status_code=400, detail="Answer is empty.")

    turns = _ordered_turns(session, session_id)
    pending = next((t for t in turns if t.answer is None), None)
    if pending is None:
        raise HTTPException(status_code=400, detail="There is no question to answer.")

    pending.answer = body.answer
    session.add(pending)

    # Every prior turn was already answered, so once this one is stored the
    # answered count equals the number of questions asked so far.
    answered_count = len(turns)

    if should_end_interview(pending.should_end, question_count=answered_count):
        interview.status = "completed"
        session.add(interview)
        session.commit()
        return {"done": True, "question_count": interview.question_count}

    gaps = GapAnalysis.model_validate(interview.gap_analysis_json)
    history = _history(turns)  # includes the answer just stored
    following = next_turn(gaps, history, question_count=len(history))
    session.add(
        Turn(
            session_id=interview.id,
            turn_index=len(turns),
            question=following.question,
            targets=following.targets,
            is_followup=following.is_followup,
            should_end=following.should_end,
        )
    )
    interview.question_count += 1
    session.add(interview)
    session.commit()

    return {
        "done": False,
        "question": following.question,
        "question_count": interview.question_count,
    }


@router.get("/{session_id}/report")
def get_report(session_id: int, session: Session = Depends(get_session)) -> dict:
    interview = _get_session_or_404(session, session_id)
    if interview.status != "completed":
        raise HTTPException(
            status_code=400, detail="The interview is not completed yet."
        )

    report = session.exec(
        select(Report).where(Report.session_id == session_id)
    ).first()
    if report is None:
        # Generate once on first request, then persist so it's cached thereafter.
        gaps = GapAnalysis.model_validate(interview.gap_analysis_json)
        history = _history(_ordered_turns(session, session_id))
        generated = generate_report(gaps, history)
        report = Report(
            session_id=session_id,
            overall_score=generated.overall_score,
            summary=generated.summary,
            strengths_json=generated.strengths,
            gaps_json=generated.gaps,
        )
        session.add(report)
        session.commit()
        session.refresh(report)

    return {
        "overall_score": report.overall_score,
        "summary": report.summary,
        "strengths": report.strengths_json,
        "gaps": report.gaps_json,
    }
