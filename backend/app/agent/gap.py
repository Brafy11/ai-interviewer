"""Gap analysis: compare a ResumeProfile against a JobProfile."""

from app.agent.client import call_structured
from app.schemas import GapAnalysis, JobProfile, ResumeProfile

GAP_SYSTEM = (
    "You compare a candidate profile against a job profile and produce a structured "
    "gap analysis for a caregiver hiring process.\n"
    "- strong_matches: requirements the candidate clearly meets, each with specific "
    "evidence quoted or paraphrased from the resume.\n"
    "- weak_or_missing: requirements the candidate does not clearly meet, each with a "
    "reason and a priority of high, medium, or low. Genuine disqualifiers "
    "(transportation, required certifications/tests, availability conflicts) are high.\n"
    "- claims_to_verify: statements on the resume that sound plausible but should be "
    "confirmed in the interview.\n"
    "Ground every item in the two profiles. Do not invent requirements or evidence."
)


def analyze_gaps(resume: ResumeProfile, job: JobProfile) -> GapAnalysis:
    user_prompt = (
        "Candidate profile:\n"
        + resume.model_dump_json(indent=2)
        + "\n\nJob profile:\n"
        + job.model_dump_json(indent=2)
    )
    return call_structured(
        call_type="gap_analysis",
        system=GAP_SYSTEM,
        user_prompt=user_prompt,
        schema=GapAnalysis,
        max_tokens=3000,
    )
