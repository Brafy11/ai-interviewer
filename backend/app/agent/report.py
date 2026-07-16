"""Final report generation from the gap analysis and interview transcript."""

from app.agent.client import call_structured
from app.agent.interviewer import format_history
from app.schemas import FinalReport, GapAnalysis

REPORT_SYSTEM = (
    "You write a final interview report for a caregiver candidate in the required "
    "schema.\n"
    "- overall_score is an integer from 0 to 100.\n"
    "- Every strength and every gap must be grounded in either the gap analysis or a "
    "specific answer the candidate gave in the interview. Do not introduce claims that "
    "are not supported by that evidence.\n"
    "- summary is a short, fair paragraph that a hiring manager could act on."
)


def generate_report(gap_analysis: GapAnalysis, history: list[dict]) -> FinalReport:
    user_prompt = (
        "Gap analysis:\n"
        + gap_analysis.model_dump_json(indent=2)
        + "\n\nInterview transcript:\n"
        + format_history(history)
    )
    return call_structured(
        call_type="report",
        system=REPORT_SYSTEM,
        user_prompt=user_prompt,
        schema=FinalReport,
        max_tokens=3000,
    )
