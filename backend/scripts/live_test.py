"""Phase 5 isolated live-call tests — one AI call type per invocation.

Usage (from backend/, with AI_MOCK=false and the key in the root .env):

    uv run python scripts/live_test.py resume   # resume extraction (~$0.01)
    uv run python scripts/live_test.py jd       # JD extraction (~$0.01)
    uv run python scripts/live_test.py gap      # gap analysis (~$0.01)
    uv run python scripts/live_test.py turn     # one interview turn (~$0.005)
    uv run python scripts/live_test.py report   # report generation (~$0.01)

The resume/jd steps insert real rows and cache profile_json on them, so the
later full UI run reuses the cached profiles instead of re-extracting. The
gap result is stashed in a local JSON file for the turn/report steps, which
are throwaway isolation tests (nothing session-shaped is persisted).
"""

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # walks up from CWD to the repo-root .env

sys.path.insert(0, str(Path(__file__).parent.parent))

from pypdf import PdfReader
from sqlmodel import Session, select

from app.agent.extraction import extract_job_profile, extract_resume_profile
from app.agent.gap import analyze_gaps
from app.agent.interviewer import next_turn
from app.agent.report import generate_report
from app.db import engine
from app.models import JobDescription, Resume
from app.schemas import GapAnalysis, JobProfile, ResumeProfile

PDF_PATH = Path(__file__).parent.parent.parent / "samples" / "maria-delgado-resume.pdf"
GAP_STASH = Path(__file__).parent / "live_test_gap.json"

# The assessment's real Sigma HomeCare caregiver role. Same text as the
# frontend's "Use example" button, so the UI picker matches.
EXAMPLE_JD = """Caregiver (CNA / HHA / PCA / Home Health Aide) — Sigma HomeCare

Location: Downriver Region, MI (in person)
Shift: 12:00 PM-6:00 PM
Pay: $16.00-$18.40 per hour, weekly pay

Sigma HomeCare provides one-on-one care for seniors and adults with disabilities, helping clients remain safe, comfortable, and independent in their own homes.

Responsibilities:
- Assist clients with personal care, grooming, and hygiene
- Provide companionship and emotional support
- Help with meal preparation and light housekeeping
- Assist with mobility and daily activities
- Provide medication reminders
- Accompany clients to appointments and errands as needed
- Maintain accurate care documentation

Qualifications:
- Must be 18 years of age or older
- High school diploma or GED
- Valid driver's license or state-issued ID, and reliable transportation
- Smartphone with GPS capability
- Current TB test, or willingness to obtain one
- Compassionate, dependable, and professional attitude
- Previous caregiving experience preferred but not required"""


def step_resume() -> None:
    text = "\n".join(page.extract_text() for page in PdfReader(PDF_PATH).pages)
    profile = extract_resume_profile(text)
    with Session(engine) as db:
        row = Resume(filename=PDF_PATH.name, raw_text=text, profile_json=profile.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
    print(f"\nResume row id={row.id} (profile cached)")
    print(profile.model_dump_json(indent=2))


def step_jd() -> None:
    profile = extract_job_profile(EXAMPLE_JD)
    with Session(engine) as db:
        row = JobDescription(raw_text=EXAMPLE_JD, profile_json=profile.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
    print(f"\nJD row id={row.id} (profile cached)")
    print(profile.model_dump_json(indent=2))


def _load_profiles() -> tuple[ResumeProfile, JobProfile]:
    with Session(engine) as db:
        resume = db.exec(select(Resume).where(Resume.profile_json != None)).first()  # noqa: E711
        jd = db.exec(select(JobDescription).where(JobDescription.profile_json != None)).first()  # noqa: E711
    if not resume or not jd:
        sys.exit("Run the resume and jd steps first.")
    return ResumeProfile.model_validate(resume.profile_json), JobProfile.model_validate(jd.profile_json)


def step_gap() -> None:
    resume, jd = _load_profiles()
    gap = analyze_gaps(resume, jd)
    GAP_STASH.write_text(gap.model_dump_json(indent=2), encoding="utf-8")
    print(f"\nGap analysis stashed to {GAP_STASH.name}")
    print(gap.model_dump_json(indent=2))


def _load_gap() -> GapAnalysis:
    if not GAP_STASH.exists():
        sys.exit("Run the gap step first.")
    return GapAnalysis.model_validate(json.loads(GAP_STASH.read_text(encoding="utf-8")))


def step_turn() -> None:
    turn = next_turn(_load_gap(), history=[], question_count=0)
    print("\nFirst interview turn:")
    print(turn.model_dump_json(indent=2))


def step_report() -> None:
    # Minimal plausible transcript, grounded in the Maria Delgado scenario.
    history = [
        {
            "question": "This role requires a smartphone with GPS capability for care documentation. Do you have one you can use for work?",
            "answer": "Yes, I have an iPhone with GPS. At Riverbend we logged visits through an app, so I'm used to that.",
        },
        {
            "question": "The position requires a current TB test, or willingness to obtain one. When was your last TB test?",
            "answer": "I had one when I started at Cedar Ridge, but that was over two years ago. I can get a new one this week if needed.",
        },
        {
            "question": "The shift is 12:00 PM to 6:00 PM. Your resume says you prefer weekday daytime hours — does that shift work for you?",
            "answer": "Yes, noon to six on weekdays is exactly what I'm looking for.",
        },
    ]
    report = generate_report(_load_gap(), history)
    print("\nFinal report:")
    print(report.model_dump_json(indent=2))


STEPS = {"resume": step_resume, "jd": step_jd, "gap": step_gap, "turn": step_turn, "report": step_report}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in STEPS:
        sys.exit(f"Usage: python scripts/live_test.py [{'|'.join(STEPS)}]")
    STEPS[sys.argv[1]]()
