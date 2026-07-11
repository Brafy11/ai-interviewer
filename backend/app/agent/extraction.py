"""Extraction calls: resume text -> ResumeProfile, JD text -> JobProfile."""

from app.agent.client import call_structured
from app.schemas import JobProfile, ResumeProfile

_HALLUCINATION_RULE = (
    "Use only information present in the text. Do not infer, guess, or invent. "
    "For any field with no supporting information in the text, use an empty list "
    "or null — never fabricate a plausible-sounding value."
)

RESUME_SYSTEM = (
    "You extract structured data from a candidate's resume into the required schema.\n"
    + _HALLUCINATION_RULE
)

JD_SYSTEM = (
    "You extract structured data from a job description into the required schema.\n"
    + _HALLUCINATION_RULE
    + "\nPut genuine disqualifiers (age, license, required tests/certifications, "
    "background checks) in hard_requirements."
)


def extract_resume_profile(raw_text: str) -> ResumeProfile:
    return call_structured(
        call_type="extraction_resume",
        system=RESUME_SYSTEM,
        user_prompt=f"Resume text:\n\n{raw_text}",
        schema=ResumeProfile,
        max_tokens=3000,
    )


def extract_job_profile(raw_text: str) -> JobProfile:
    return call_structured(
        call_type="extraction_jd",
        system=JD_SYSTEM,
        user_prompt=f"Job description text:\n\n{raw_text}",
        schema=JobProfile,
        max_tokens=3000,
    )
