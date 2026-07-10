from datetime import datetime, timezone

from sqlmodel import JSON, Column, Field, SQLModel

# Table names default to the lowercased class name with no snake_casing:
# InterviewSession -> "interviewsession", JobDescription -> "jobdescription".
# foreign_key strings below must use those exact names.
#
# Nullability rule: a column is nullable iff its value is produced by a later
# step than row creation (an AI call or a user answer that hasn't happened yet).


class Resume(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    filename: str
    raw_text: str
    profile_json: dict | None = Field(default=None, sa_column=Column(JSON))


class JobDescription(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    raw_text: str
    profile_json: dict | None = Field(default=None, sa_column=Column(JSON))


class InterviewSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    resume_id: int = Field(foreign_key="resume.id")
    jd_id: int = Field(foreign_key="jobdescription.id")
    gap_analysis_json: dict | None = Field(default=None, sa_column=Column(JSON))
    status: str = Field(default="pending")  # "pending" | "in_progress" | "completed"
    question_count: int = Field(default=0)


class Turn(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="interviewsession.id")
    turn_index: int
    question: str
    answer: str | None = Field(default=None)
    targets: list | None = Field(default=None, sa_column=Column(JSON))
    is_followup: bool = Field(default=False)


class Report(SQLModel, table=True):
    # A Report row is only inserted once generation succeeds, so all fields
    # are known at insert time and therefore required.
    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="interviewsession.id")
    overall_score: int
    summary: str
    strengths_json: list = Field(sa_column=Column(JSON))
    gaps_json: list = Field(sa_column=Column(JSON))


class ApiUsage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    call_type: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
