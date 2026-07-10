"""Phase 2 acceptance: run the full agent pipeline in mock mode, zero API spend.

Run from backend/ with:  uv run python -m scripts.smoke_test_agent

This drives the same sequence the API routes will in Phase 3 — extract, gap
analysis, an interview loop, and a final report — but entirely against the
fixtures in app/mocks/, so no API key is needed and nothing is billed.
"""

import os

# Force mock mode before importing the agent modules, so the Anthropic client is
# never constructed and no key is ever read.
os.environ["AI_MOCK"] = "true"

from app.agent.extraction import extract_job_profile, extract_resume_profile
from app.agent.gap import analyze_gaps
from app.agent.interviewer import next_turn, should_end_interview
from app.agent.report import generate_report

# In mock mode the raw text is ignored (fixtures are returned), but we pass
# realistic input so the script reads like the real Phase 3 flow.
RESUME_TEXT = (
    "Maria Lopez. Home caregiver, ~3 years at Comfort Keepers of Austin. "
    "Bilingual English/Spanish. CPR/First Aid expired 2024. Available weekdays."
)
JD_TEXT = (
    "Sigma HomeCare is hiring an In-Home Caregiver in Austin, TX. Weekend and "
    "evening shifts. Requires driver's license, current CPR, TB test, background check."
)

# Canned candidate answers, one per scripted turn. The first is deliberately
# vague so the second scripted turn is a transportation follow-up.
CANNED_ANSWERS = [
    "I usually find a way to get to my clients.",
    "Yes, I have a valid license and my own car, and it runs reliably.",
    "I could do some weekends, but evenings are harder because of my family.",
    "I know it lapsed. I can renew my CPR within a couple of weeks.",
    "I had a TB test last year, but I would need to check the exact date.",
    "I did transfers every day, and my agency trained me to use a gait belt safely.",
]


def main() -> None:
    resume = extract_resume_profile(RESUME_TEXT)
    job = extract_job_profile(JD_TEXT)
    print(f"Resume extracted: {resume.name}, {len(resume.work_experience)} roles")
    print(f"Job extracted: {job.title} @ {job.organization}")

    gaps = analyze_gaps(resume, job)
    print(
        f"Gap analysis: {len(gaps.strong_matches)} strong, "
        f"{len(gaps.weak_or_missing)} weak/missing, "
        f"{len(gaps.claims_to_verify)} to verify"
    )

    history: list[dict] = []
    followups = 0
    while True:
        turn = next_turn(gaps, history, question_count=len(history))
        answer = (
            CANNED_ANSWERS[len(history)]
            if len(history) < len(CANNED_ANSWERS)
            else "I understand, thank you."
        )
        if turn.is_followup:
            followups += 1
        print(f"  Q{len(history) + 1} (targets {turn.targets}): {turn.question}")
        history.append({"question": turn.question, "answer": answer})
        if should_end_interview(turn.should_end, question_count=len(history)):
            break

    assert len(history) == 6, f"expected 6 turns, got {len(history)}"
    assert followups == 1, f"expected exactly 1 follow-up, got {followups}"

    report = generate_report(gaps, history)
    assert isinstance(report.overall_score, int)
    assert report.strengths and report.gaps
    print(
        f"Report: score {report.overall_score}, "
        f"{len(report.strengths)} strengths, {len(report.gaps)} gaps"
    )

    print("Agent smoke test passed: full pipeline ran in mock mode with zero API spend.")


if __name__ == "__main__":
    main()
