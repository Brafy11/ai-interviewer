"""Extraction calls: resume text -> ResumeProfile, JD text -> JobProfile.

Also hosts the one vision call: transcribing a resume *image* (screenshot or
photo) to plain text, so image uploads feed the exact same text pipeline.
"""

from app.agent.client import call_structured
from app.schemas import JobProfile, ResumeProfile, ResumeTranscription

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


TRANSCRIPTION_SYSTEM = (
    "You transcribe an image of a resume (a screenshot, photo, or scan) into "
    "plain text.\n"
    + _HALLUCINATION_RULE
    + "\nTranscribe every piece of text you can read, preserving the reading "
    "order. If a word is illegible, write [illegible] instead of guessing."
)


def transcribe_resume_image(image_b64: str, media_type: str) -> str:
    result = call_structured(
        call_type="transcription_resume",
        system=TRANSCRIPTION_SYSTEM,
        user_prompt="Transcribe this resume image into plain text.",
        schema=ResumeTranscription,
        max_tokens=3000,
        image=(media_type, image_b64),
    )
    return result.text


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
