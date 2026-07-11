"""Structured-output contracts for the AI agent calls.

These schemas define the exact shapes the model is forced to return via
tool use in Phase 2. Persistence lives in models.py; this file must stay
free of DB concerns.
"""

from typing import Literal

from pydantic import BaseModel


class WorkExperience(BaseModel):
    role: str
    org: str
    duration: str
    responsibilities: list[str] = []


class ResumeProfile(BaseModel):
    name: str
    summary: str
    work_experience: list[WorkExperience] = []
    skills: list[str] = []
    certifications: list[str] = []
    education: list[str] = []
    # Nullable: resumes often omit these, and extraction must return null
    # rather than invent values.
    availability_notes: str | None = None
    transportation_notes: str | None = None
    other_relevant: list[str] = []


class JobProfile(BaseModel):
    title: str
    organization: str
    location: str
    shift: str
    required_qualifications: list[str] = []
    responsibilities: list[str] = []
    preferred_qualifications: list[str] = []
    hard_requirements: list[str] = []  # e.g. "21+", "valid driver's license", "TB test"


class StrongMatch(BaseModel):
    requirement: str
    evidence_from_resume: str


class WeakOrMissing(BaseModel):
    requirement: str
    why_weak: str
    priority: Literal["high", "medium", "low"]


class ClaimToVerify(BaseModel):
    claim: str
    why_verify: str


class GapAnalysis(BaseModel):
    strong_matches: list[StrongMatch] = []
    weak_or_missing: list[WeakOrMissing] = []
    claims_to_verify: list[ClaimToVerify] = []


class InterviewTurn(BaseModel):
    question: str
    targets: list[str] = []  # ids like "weak_or_missing:2"; convention set in Phase 2
    is_followup: bool
    should_end: bool
    # Internal bookkeeping fields, never shown to the candidate. Defaulted so a
    # truncated tool call missing them degrades gracefully instead of 500ing the
    # answer endpoint (Phase 5 finding: real outputs dropped coverage_notes).
    reasoning: str = ""
    coverage_notes: str = ""


class FinalReport(BaseModel):
    # The assessment's exact schema — an external hard constraint.
    overall_score: int
    summary: str
    strengths: list[str]
    gaps: list[str]
