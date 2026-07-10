"""Phase 1 acceptance test: create tables, insert one row per model, read back.

Run from backend/ with:  uv run python -m scripts.smoke_test_db
(-m runs it as a module so `import app...` resolves from the project root.)
"""

from pathlib import Path

from sqlmodel import Session, select

from app.db import create_db_and_tables, engine
from app.models import ApiUsage, InterviewSession, JobDescription, Report, Resume, Turn

DB_FILE = Path("interviewer.db")


def main() -> None:
    # Start from a fresh database so the assertions below are deterministic.
    if DB_FILE.exists():
        DB_FILE.unlink()

    create_db_and_tables()

    # --- Insert: parents first so foreign keys have ids to point at ---
    with Session(engine) as session:
        resume = Resume(
            filename="jane_doe.pdf",
            raw_text="Jane Doe. Caregiver with 3 years of home care experience.",
            profile_json={"name": "Jane Doe", "skills": ["meal prep", "mobility assistance"]},
        )
        jd = JobDescription(
            raw_text="Sigma HomeCare is hiring a part-time caregiver in Austin, TX.",
            profile_json={"title": "Caregiver", "organization": "Sigma HomeCare"},
        )
        session.add(resume)
        session.add(jd)
        session.commit()
        session.refresh(resume)  # re-read from DB so auto-generated ids are populated
        session.refresh(jd)

        interview = InterviewSession(
            resume_id=resume.id,
            jd_id=jd.id,
            gap_analysis_json={"strong_matches": [], "weak_or_missing": [], "claims_to_verify": []},
            status="in_progress",
            question_count=1,
        )
        session.add(interview)
        session.commit()
        session.refresh(interview)

        turn = Turn(
            session_id=interview.id,
            turn_index=0,
            question="Tell me about your experience with mobility assistance.",
            answer="I helped two clients with daily transfers and walks.",
            targets=["weak_or_missing:0"],
        )
        report = Report(
            session_id=interview.id,
            overall_score=78,
            summary="Solid caregiving fundamentals; verify certification status.",
            strengths_json=["Hands-on mobility assistance experience"],
            gaps_json=["No CPR certification on record"],
        )
        usage = ApiUsage(call_type="extraction", input_tokens=1200, output_tokens=350, cost_usd=0.0021)
        session.add(turn)
        session.add(report)
        session.add(usage)
        session.commit()

        resume_id = resume.id
        jd_id = jd.id
        interview_id = interview.id

    # --- Read back in a brand-new session to prove the data was persisted ---
    with Session(engine) as session:
        loaded_resume = session.get(Resume, resume_id)
        assert loaded_resume is not None
        assert loaded_resume.filename == "jane_doe.pdf"
        assert loaded_resume.profile_json["name"] == "Jane Doe"

        loaded_jd = session.get(JobDescription, jd_id)
        assert loaded_jd is not None
        assert loaded_jd.profile_json["organization"] == "Sigma HomeCare"

        loaded_interview = session.get(InterviewSession, interview_id)
        assert loaded_interview is not None
        assert loaded_interview.resume_id == resume_id
        assert loaded_interview.jd_id == jd_id
        assert loaded_interview.status == "in_progress"

        turns = session.exec(select(Turn).where(Turn.session_id == interview_id)).all()
        assert len(turns) == 1
        assert turns[0].turn_index == 0
        assert turns[0].targets == ["weak_or_missing:0"]
        assert turns[0].is_followup is False

        reports = session.exec(select(Report).where(Report.session_id == interview_id)).all()
        assert len(reports) == 1
        assert reports[0].overall_score == 78
        assert reports[0].strengths_json == ["Hands-on mobility assistance experience"]

        usages = session.exec(select(ApiUsage)).all()
        assert len(usages) == 1
        assert usages[0].call_type == "extraction"
        assert usages[0].cost_usd == 0.0021
        assert usages[0].created_at is not None

    print("Smoke test passed: all 6 models inserted and read back OK.")


if __name__ == "__main__":
    main()
